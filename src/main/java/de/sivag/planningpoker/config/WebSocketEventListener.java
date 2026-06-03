package de.sivag.planningpoker.config;

import de.sivag.planningpoker.service.SessionService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
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
public class WebSocketEventListener {

    // ====================================
    // Abhängigkeiten
    // ====================================

    private final SessionService sessionService;
    private final SimpMessagingTemplate messagingTemplate;
    private final WebSocketSessionRegistry sessionRegistry;

    // ====================================
    // Konstruktor
    // ====================================

    public WebSocketEventListener(@Lazy SessionService sessionService,
                                  SimpMessagingTemplate messagingTemplate,
                                  WebSocketSessionRegistry sessionRegistry) {
        this.sessionService    = sessionService;
        this.messagingTemplate = messagingTemplate;
        this.sessionRegistry   = sessionRegistry;
    }

    // ====================================
    // Event Handlers
    // ====================================

    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String wsSessionId = accessor.getSessionId();

        WebSocketSessionRegistry.ParticipantInfo info = sessionRegistry.remove(wsSessionId);
        if (info == null) return;

        try {
            String participantName = sessionService.removeParticipant(info.participantId());

            log.info("Teilnehmer getrennt und entfernt: name={}, roomCode={}",
                    participantName, info.roomCode());

            messagingTemplate.convertAndSend(
                    "/topic/session/" + info.roomCode(),
                    Map.of(
                            "type",            "PLAYER_LEFT",
                            "participantId",   info.participantId().toString(),
                            "participantName", participantName
                    )
            );
        } catch (Exception e) {
            log.warn("Fehler beim Entfernen des Teilnehmers {}: {}",
                    info.participantId(), e.getMessage());
        }
    }
}