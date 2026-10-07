package de.sivag.planningpoker.service;

import de.sivag.planningpoker.repository.SessionRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static java.time.temporal.ChronoUnit.SECONDS;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit-Tests für SessionCleanupService.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
class SessionCleanupServiceTest {

    private final SessionRepository sessionRepository = mock(SessionRepository.class);

    @Test
    @DisplayName("Cleanup sucht mit konfigurierter Inaktivitätsdauer und löscht die Treffer")
    void cleanup_usesConfiguredIdleHours_andDeletesInactive() {
        when(sessionRepository.findInactiveSessionIds(any())).thenReturn(List.of(1L, 2L));
        SessionCleanupService service = new SessionCleanupService(sessionRepository, 6);

        service.cleanupInactiveSessions();

        ArgumentCaptor<LocalDateTime> cutoff = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(sessionRepository).findInactiveSessionIds(cutoff.capture());
        assertThat(cutoff.getValue()).isCloseTo(LocalDateTime.now().minusHours(6), within(5, SECONDS));
        verify(sessionRepository).deleteAllById(List.of(1L, 2L));
    }

    @Test
    @DisplayName("Cleanup ohne inaktive Sessions löscht nichts")
    void cleanup_nothingInactive_deletesNothing() {
        when(sessionRepository.findInactiveSessionIds(any())).thenReturn(List.of());

        new SessionCleanupService(sessionRepository, 24).cleanupInactiveSessions();

        verify(sessionRepository, never()).deleteAllById(any());
    }
}
