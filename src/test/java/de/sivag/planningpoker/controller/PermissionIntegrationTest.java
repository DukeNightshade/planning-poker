package de.sivag.planningpoker.controller;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
import java.util.List;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integrationstest: Teilnehmer-Token und serverseitige Rechteprüfung über REST und STOMP.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:permissiontest;MODE=PostgreSQL;DB_CLOSE_DELAY=-1"
})
class PermissionIntegrationTest {

    // ====================================
    // Konstanten
    // ====================================

    private static final String TOKEN_HEADER = "participant-token";
    private static final long   TIMEOUT_SEC  = 5;

    // ====================================
    // Abhängigkeiten
    // ====================================

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate rest;

    // ====================================
    // Testdaten
    // ====================================

    private String roomCode;
    private String moderatorToken;
    private Long   moderatorId;
    private String devToken;
    private Long   devId;

    private StompSession                          stomp;
    private final BlockingQueue<Map<String, Object>> topic  = new LinkedBlockingQueue<>();
    private final BlockingQueue<Map<String, Object>> errors = new LinkedBlockingQueue<>();

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() throws Exception {
        Map<String, Object> created = rest.postForObject("/api/sessions", Map.of(
                "moderatorName", "Max",
                "method",        "FIBONACCI",
                "moderatorRole", "DEVELOPER",
                "browserId",     "browser-mod"), Map.class);
        roomCode       = (String) created.get("roomCode");
        moderatorToken = (String) created.get("token");
        moderatorId    = ((Number) created.get("participantId")).longValue();

        Map<String, Object> joined = rest.postForObject("/api/sessions/" + roomCode + "/join", Map.of(
                "name",      "Lisa",
                "role",      "DEVELOPER",
                "browserId", "browser-dev"), Map.class);
        devToken = (String) joined.get("token");
        devId    = ((Number) joined.get("participantId")).longValue();

        WebSocketStompClient client = new WebSocketStompClient(
                new SockJsClient(List.of(new WebSocketTransport(new StandardWebSocketClient()))));
        client.setMessageConverter(new MappingJackson2MessageConverter());

        stomp = client.connectAsync("ws://localhost:" + port + "/ws",
                        new StompSessionHandlerAdapter() {})
                .get(TIMEOUT_SEC, TimeUnit.SECONDS);
        stomp.subscribe("/topic/session/" + roomCode, collectInto(topic));
        stomp.subscribe("/user/queue/errors", collectInto(errors));

        // Simple Broker bestätigt Subscriptions nicht – kurz warten, bis sie aktiv sind
        Thread.sleep(300);
    }

    @AfterEach
    void tearDown() {
        if (stomp != null) stomp.disconnect();
    }

    // ====================================
    // Tests
    // ====================================

    @Test
    @DisplayName("Create und Join liefern ein Token")
    void createAndJoin_returnToken() {
        assertThat(moderatorToken).isNotBlank();
        assertThat(devToken).isNotBlank().isNotEqualTo(moderatorToken);
    }

    @Test
    @DisplayName("Aufdecken ohne Moderator-Rechte wird abgelehnt, nur der Absender erhält den Fehler")
    void reveal_byNonModerator_isForbidden() throws Exception {
        send("/reveal", devToken, Map.of());

        Map<String, Object> error = errors.poll(TIMEOUT_SEC, TimeUnit.SECONDS);
        assertThat(error).isNotNull().containsEntry("code", "FORBIDDEN");
        assertThat(topic.poll(500, TimeUnit.MILLISECONDS)).isNull();
    }

    @Test
    @DisplayName("Aufdecken durch Moderator wird an den Raum gesendet")
    void reveal_byModerator_isBroadcast() throws Exception {
        send("/reveal", moderatorToken, Map.of());

        Map<String, Object> message = topic.poll(TIMEOUT_SEC, TimeUnit.SECONDS);
        assertThat(message).isNotNull().containsEntry("type", "REVEAL");
    }

    @Test
    @DisplayName("Vote zählt für den Token-Inhaber, eine Payload-ID wird ignoriert")
    void vote_usesTokenIdentity() throws Exception {
        send("/vote", devToken, Map.of("participantId", moderatorId.toString(), "cardValue", "5"));

        Map<String, Object> message = topic.poll(TIMEOUT_SEC, TimeUnit.SECONDS);
        assertThat(message).isNotNull()
                .containsEntry("type", "VOTE_UPDATE")
                .containsEntry("voterId", devId.toString());
    }

    @Test
    @DisplayName("State liefert die eigene verdeckte Karte nur an den Token-Inhaber")
    @SuppressWarnings("unchecked")
    void state_returnsOwnCardOnlyToOwner() throws Exception {
        send("/vote", devToken, Map.of("cardValue", "8"));
        assertThat(topic.poll(TIMEOUT_SEC, TimeUnit.SECONDS)).isNotNull();

        String url = "/api/sessions/" + roomCode + "/state";
        assertThat(getWithToken(url, devToken)).containsEntry("myCardValue", "8");
        assertThat(getWithToken(url, moderatorToken)).doesNotContainKey("myCardValue");
        assertThat(rest.getForObject(url, Map.class)).doesNotContainKey("myCardValue");
    }

    @Test
    @DisplayName("Moderator-Stimmrecht aus: Moderator-Stimme fällt weg, Auto-Reveal deckt auf")
    @SuppressWarnings("unchecked")
    void disablingModeratorVote_dropsVote_andAutoReveals() throws Exception {
        send("/vote", moderatorToken, Map.of("cardValue", "5"));
        send("/vote", devToken,       Map.of("cardValue", "8"));
        assertThat(pollType("VOTE_UPDATE")).isNotNull();
        assertThat(pollType("VOTE_UPDATE")).isNotNull();

        send("/settings", moderatorToken, Map.of("moderatorCanVote", false, "autoReveal", true));

        assertThat(pollType("SETTINGS_UPDATE")).isNotNull();
        Map<String, Object> reveal = pollType("REVEAL");
        assertThat(reveal).isNotNull();
        List<Map<String, Object>> votes = (List<Map<String, Object>>) reveal.get("votes");
        assertThat(votes).extracting(v -> v.get("participantName")).containsExactly("Lisa");

        // Danach darf der Moderator nicht mehr abstimmen
        send("/reset", moderatorToken, Map.of());
        assertThat(pollType("RESET")).isNotNull();
        send("/vote", moderatorToken, Map.of("cardValue", "3"));
        assertThat(errors.poll(TIMEOUT_SEC, TimeUnit.SECONDS))
                .isNotNull().containsEntry("code", "FORBIDDEN");
    }

    @Test
    @DisplayName("Vote ohne Token oder mit ungültiger Karte wird abgelehnt")
    void vote_withoutTokenOrInvalidCard_isRejected() throws Exception {
        send("/vote", null, Map.of("cardValue", "5"));
        assertThat(errors.poll(TIMEOUT_SEC, TimeUnit.SECONDS))
                .isNotNull().containsEntry("code", "FORBIDDEN");

        send("/vote", devToken, Map.of("cardValue", "9999"));
        assertThat(errors.poll(TIMEOUT_SEC, TimeUnit.SECONDS))
                .isNotNull().containsEntry("code", "BAD_REQUEST");

        assertThat(topic.poll(500, TimeUnit.MILLISECONDS)).isNull();
    }

    @Test
    @DisplayName("Promote: ohne Token 403, andere befördern als Nicht-Moderator 403, sich selbst 200")
    void promote_isCheckedServerSide() {
        String base = "/api/sessions/" + roomCode + "/participants/";

        assertThat(post(base + devId + "/promote", null).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);

        Map<String, Object> otherRoom = createOtherSession();
        assertThat(post(base + devId + "/promote", (String) otherRoom.get("token")).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);

        assertThat(post(base + devId + "/promote", devToken).getStatusCode())
                .isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("Demote: Nicht-Moderator darf Moderator nicht entziehen")
    void demote_byNonModerator_isForbidden() {
        String url = "/api/sessions/" + roomCode + "/participants/" + moderatorId + "/demote";
        assertThat(post(url, devToken).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    // ====================================
    // Hilfsmethoden
    // ====================================

    /** Wartet auf die nächste Raum-Nachricht des angegebenen Typs (andere werden übersprungen). */
    private Map<String, Object> pollType(String type) throws InterruptedException {
        long deadline = System.currentTimeMillis() + TIMEOUT_SEC * 1000;
        while (System.currentTimeMillis() < deadline) {
            Map<String, Object> message = topic.poll(deadline - System.currentTimeMillis(), TimeUnit.MILLISECONDS);
            if (message != null && type.equals(message.get("type"))) return message;
        }
        return null;
    }

    private void send(String path, String token, Map<String, ?> body) {
        StompHeaders headers = new StompHeaders();
        headers.setDestination("/app/session/" + roomCode + path);
        if (token != null) headers.add(TOKEN_HEADER, token);
        stomp.send(headers, body);
    }

    private ResponseEntity<String> post(String url, String token) {
        HttpHeaders headers = new HttpHeaders();
        if (token != null) headers.add("X-Participant-Token", token);
        return rest.postForEntity(url, new HttpEntity<>(null, headers), String.class);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> getWithToken(String url, String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.add("X-Participant-Token", token);
        return rest.exchange(url, org.springframework.http.HttpMethod.GET,
                new HttpEntity<>(null, headers), Map.class).getBody();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> createOtherSession() {
        return rest.postForObject("/api/sessions", Map.of(
                "moderatorName", "Fremd",
                "method",        "FIBONACCI",
                "browserId",     "browser-other"), Map.class);
    }

    private static StompFrameHandler collectInto(BlockingQueue<Map<String, Object>> queue) {
        return new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return Map.class;
            }

            @Override
            @SuppressWarnings("unchecked")
            public void handleFrame(StompHeaders headers, Object payload) {
                queue.add((Map<String, Object>) payload);
            }
        };
    }
}
