package de.sivag.planningpoker.service;

import de.sivag.planningpoker.repository.SessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Service für die automatische Bereinigung der Sessions.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SessionCleanupService {

    // ====================================
    // Statische Variablen
    // ====================================

    private static final int SESSION_MAX_AGE_HOURS = 24;

    // ====================================
    // Abhängigkeiten
    // ====================================

    private final SessionRepository sessionRepository;

    // ====================================
    // Geplante Aufgaben
    // ====================================

    /**
     * Löscht alle Sessions die älter als 24 Stunden sind.
     * Läuft täglich um 03:00 Uhr.
     */
    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public void cleanupExpiredSessions() {
        LocalDateTime cutoff = LocalDateTime.now()
                .minusHours(SESSION_MAX_AGE_HOURS);

        List<Long> expiredIds = sessionRepository
                .findExpiredSessionIds(cutoff);

        if (expiredIds.isEmpty()) {
            log.info("Cleanup: Keine abgelaufenen Sessions gefunden.");
            return;
        }

        sessionRepository.deleteAllById(expiredIds);

        log.info("Cleanup: {} abgelaufene Session(s) gelöscht (älter als {} Stunden).",
                expiredIds.size(), SESSION_MAX_AGE_HOURS);
    }
}