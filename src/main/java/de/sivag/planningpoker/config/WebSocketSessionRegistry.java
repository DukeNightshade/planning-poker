package de.sivag.planningpoker.config;

import org.springframework.stereotype.Component;

import java.util.concurrent.*;

/**
 * Registry für aktive WebSocket-Verbindungen.
 * @author Nico Hoffmann
 * @version 1.1
 */
@Component
public class WebSocketSessionRegistry {

    // ====================================
    // Konstanten
    // ====================================

    private static final long REMOVAL_DELAY_SECONDS = 20L;

    // ====================================
    // Zustand
    // ====================================

    private final ConcurrentHashMap<String, ParticipantInfo> registry =
            new ConcurrentHashMap<>();

    private final ConcurrentHashMap<Long, ScheduledFuture<?>> pendingRemovals =
            new ConcurrentHashMap<>();

    private final ScheduledExecutorService scheduler =
            Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "ws-removal-scheduler");
                t.setDaemon(true);
                return t;
            });

    // ====================================
    // WS-Session Registry
    // ====================================

    public void register(String wsSessionId, String roomCode, Long participantId) {
        registry.put(wsSessionId, new ParticipantInfo(roomCode, participantId));
    }

    public ParticipantInfo remove(String wsSessionId) {
        return registry.remove(wsSessionId);
    }

    // ====================================
    // Grace-Period Verwaltung
    // ====================================

    public void scheduleRemoval(Long participantId, Runnable task) {
        cancelRemoval(participantId); // bestehenden Auftrag ggf. abbrechen
        ScheduledFuture<?> future = scheduler.schedule(task, REMOVAL_DELAY_SECONDS, TimeUnit.SECONDS);
        pendingRemovals.put(participantId, future);
    }

    public boolean cancelRemoval(Long participantId) {
        ScheduledFuture<?> future = pendingRemovals.remove(participantId);
        if (future != null) {
            future.cancel(false);
            return true;
        }
        return false;
    }

    // ====================================
    // Record
    // ====================================

    public record ParticipantInfo(String roomCode, Long participantId) {}
}