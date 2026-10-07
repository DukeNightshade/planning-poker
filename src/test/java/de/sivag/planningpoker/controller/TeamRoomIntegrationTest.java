package de.sivag.planningpoker.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import org.springframework.web.socket.sockjs.client.SockJsClient;
import org.springframework.web.socket.sockjs.client.WebSocketTransport;

import java.lang.reflect.Type;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integrationstest: permanente Team-Räume (Route, Beitritt per Name, Anwesenheit).
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:teamroomtest;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "planningpoker.reconnect-grace-seconds=1"
})
class TeamRoomIntegrationTest {

    private static final long TIMEOUT_SEC = 5;

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate rest;

    private final HttpClient http = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NEVER).build();

    // ====================================
    // Tests
    // ====================================

    @Test
    @DisplayName("Team-Raum: über /team/{name} erreichbar, /join löst Name und Code auf")
    @SuppressWarnings("unchecked")
    void teamRoom_routesAndJoinResolution() throws Exception {
        Map<String, Object> created = createTeam("Route Test");
        String roomCode = (String) created.get("roomCode");
        assertThat(created).containsEntry("teamName", "route-test");

        assertThat(rest.getForEntity("/team/route-test", String.class).getBody()).contains(roomCode);

        assertThat(location("/join/Route%20Test")).endsWith("/team/route-test");
        assertThat(location("/join/" + roomCode.toLowerCase())).endsWith("/session/" + roomCode);
        assertThat(location("/join/gibt-es-nicht")).contains("notfound=gibt-es-nicht");
    }

    @Test
    @DisplayName("Team-Raum: Verbindung weg -> abwesend statt gelöscht, zählt nicht; Rückkehr behält Rechte")
    @SuppressWarnings("unchecked")
    void teamRoom_presence() throws Exception {
        Map<String, Object> created = createTeam("presence-team");
        String roomCode = (String) created.get("roomCode");
        String modToken = (String) created.get("token");

        Map<String, Object> lisa = rest.postForObject("/api/sessions/" + roomCode + "/join",
                Map.of("name", "Lisa", "role", "DEVELOPER", "browserId", "lisa-browser"), Map.class);
        String lisaId = lisa.get("participantId").toString();

        BlockingQueue<Map<String, Object>> topic = new LinkedBlockingQueue<>();
        StompSession mod  = connect(roomCode, modToken, topic);
        StompSession lisaWs = connect(roomCode, (String) lisa.get("token"), new LinkedBlockingQueue<>());
        send(mod, roomCode, "/settings", modToken, Map.of("autoReveal", true));
        assertThat(pollType(topic, "SETTINGS_UPDATE")).isNotNull();

        // Lisa verliert die Verbindung -> nach der Grace Period abwesend
        lisaWs.disconnect();
        Map<String, Object> away = pollType(topic, "PLAYER_AWAY");
        assertThat(away).isNotNull().containsEntry("participantId", lisaId);

        // Abwesende zählen nicht: Stimme des Moderators reicht für Auto-Reveal
        send(mod, roomCode, "/vote", modToken, Map.of("cardValue", "5"));
        assertThat(pollType(topic, "REVEAL")).isNotNull();

        // Rückkehr mit gleichem Browser: gleicher Platz, Raum erfährt es
        Map<String, Object> back = rest.postForObject("/api/sessions/" + roomCode + "/join",
                Map.of("name", "Lisa", "role", "DEVELOPER", "browserId", "lisa-browser"), Map.class);
        assertThat(back.get("participantId").toString()).isEqualTo(lisaId);
        assertThat(pollType(topic, "PLAYER_JOINED")).isNotNull().containsEntry("participantId", lisaId);

        mod.disconnect();
    }

    // ====================================
    // Hilfsmethoden
    // ====================================

    @SuppressWarnings("unchecked")
    private Map<String, Object> createTeam(String teamName) {
        return rest.postForObject("/api/sessions", Map.of(
                "moderatorName", "Max",
                "method",        "FIBONACCI",
                "browserId",     "max-" + teamName,
                "teamName",      teamName), Map.class);
    }

    private String location(String path) throws Exception {
        HttpResponse<Void> response = http.send(
                HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).GET().build(),
                HttpResponse.BodyHandlers.discarding());
        assertThat(response.statusCode()).isEqualTo(302);
        return response.headers().firstValue("Location").orElse("");
    }

    private StompSession connect(String roomCode, String token,
                                 BlockingQueue<Map<String, Object>> topic) throws Exception {
        WebSocketStompClient client = new WebSocketStompClient(
                new SockJsClient(List.of(new WebSocketTransport(new StandardWebSocketClient()))));
        client.setMessageConverter(new MappingJackson2MessageConverter());
        StompSession session = client.connectAsync("ws://localhost:" + port + "/ws",
                new StompSessionHandlerAdapter() {}).get(TIMEOUT_SEC, TimeUnit.SECONDS);
        session.subscribe("/topic/session/" + roomCode, new StompFrameHandler() {
            @Override public Type getPayloadType(StompHeaders headers) { return Map.class; }
            @Override @SuppressWarnings("unchecked")
            public void handleFrame(StompHeaders headers, Object payload) {
                topic.add((Map<String, Object>) payload);
            }
        });
        Thread.sleep(300);
        send(session, roomCode, "/register", token, Map.of());
        return session;
    }

    private static void send(StompSession session, String roomCode, String path,
                             String token, Map<String, ?> body) {
        StompHeaders headers = new StompHeaders();
        headers.setDestination("/app/session/" + roomCode + path);
        headers.add("participant-token", token);
        session.send(headers, body);
    }

    private static Map<String, Object> pollType(BlockingQueue<Map<String, Object>> topic, String type)
            throws InterruptedException {
        long deadline = System.currentTimeMillis() + TIMEOUT_SEC * 1000;
        while (System.currentTimeMillis() < deadline) {
            Map<String, Object> message = topic.poll(deadline - System.currentTimeMillis(), TimeUnit.MILLISECONDS);
            if (message != null && type.equals(message.get("type"))) return message;
        }
        return null;
    }
}
