package de.sivag.planningpoker.config;

import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;

/**
 * Registry für aktive WebSocket-Verbindungen.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
@Component
public class WebSocketSessionRegistry {

    private final ConcurrentHashMap<String, ParticipantInfo> registry =
            new ConcurrentHashMap<>();

    public void register(String wsSessionId, String roomCode, Long participantId) {
        registry.put(wsSessionId, new ParticipantInfo(roomCode, participantId));
    }

    public ParticipantInfo remove(String wsSessionId) {
        return registry.remove(wsSessionId);
    }

    public record ParticipantInfo(String roomCode, Long participantId) {}
}