package de.sivag.planningpoker.config;

import de.sivag.planningpoker.service.SessionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.Map;

/**
 * Listener für WebSocket-Verbindungsereignisse.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketEventListener {

    // ====================================
    // Dependencies
    // ====================================

    private final SessionService sessionService;
    private final SimpMessagingTemplate messagingTemplate;

    // ====================================
    // Event Handlers
    // ====================================

    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        Map<String, Object> sessionAttributes = accessor.getSessionAttributes();

        if (sessionAttributes == null) return;

        String roomCode     = (String) sessionAttributes.get("roomCode");
        Long   participantId = (Long)   sessionAttributes.get("participantId");

        if (roomCode == null || participantId == null) return;

        try {
            String participantName = sessionService.removeParticipant(
                    roomCode, participantId);

            log.info("Teilnehmer getrennt und entfernt: name={}, roomCode={}",
                    participantName, roomCode);

            messagingTemplate.convertAndSend(
                    "/topic/session/" + roomCode,
                    Map.of(
                            "type",            "PLAYER_LEFT",
                            "participantId",   participantId.toString(),
                            "participantName", participantName
                    )
            );
        } catch (Exception e) {
            log.warn("Fehler beim Entfernen des Teilnehmers {}: {}",
                    participantId, e.getMessage());
        }
    }
}