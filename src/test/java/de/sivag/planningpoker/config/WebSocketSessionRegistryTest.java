package de.sivag.planningpoker.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit-Tests für die Grace-Period-Logik der WebSocketSessionRegistry.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
class WebSocketSessionRegistryTest {

    @Test
    @DisplayName("Entfernung läuft nach der Grace Period und gilt danach nicht mehr als ausstehend")
    void scheduledRemoval_runsAndClearsPending() throws InterruptedException {
        WebSocketSessionRegistry registry = new WebSocketSessionRegistry(0);
        CountDownLatch removed = new CountDownLatch(1);

        registry.scheduleRemoval(1L, removed::countDown);

        assertThat(removed.await(2, TimeUnit.SECONDS)).isTrue();
        Thread.sleep(50);
        assertThat(registry.isRemovalPending(1L)).isFalse();
    }

    @Test
    @DisplayName("Reconnect innerhalb der Grace Period bricht die Entfernung ab")
    void cancelRemoval_withinGracePeriod_preventsRemoval() throws InterruptedException {
        WebSocketSessionRegistry registry = new WebSocketSessionRegistry(1);
        AtomicBoolean removed = new AtomicBoolean(false);

        registry.scheduleRemoval(1L, () -> removed.set(true));
        assertThat(registry.isRemovalPending(1L)).isTrue();

        assertThat(registry.cancelRemoval(1L)).isTrue();
        Thread.sleep(1_300);

        assertThat(removed).isFalse();
        assertThat(registry.isRemovalPending(1L)).isFalse();
    }

    @Test
    @DisplayName("Registrierung wird beim Trennen zurückgegeben und entfernt")
    void register_andRemove_returnsInfo() {
        WebSocketSessionRegistry registry = new WebSocketSessionRegistry(20);
        registry.register("ws-1", "ABCD1234", 7L);

        WebSocketSessionRegistry.ParticipantInfo info = registry.remove("ws-1");

        assertThat(info.roomCode()).isEqualTo("ABCD1234");
        assertThat(info.participantId()).isEqualTo(7L);
        assertThat(registry.remove("ws-1")).isNull();
    }
}
