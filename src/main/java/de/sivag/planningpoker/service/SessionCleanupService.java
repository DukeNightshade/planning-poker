package de.sivag.planningpoker.service;

import de.sivag.planningpoker.repository.SessionRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Service für die automatische Bereinigung der Sessions.
 *
 * @author Nico Hoffmann
 * @version 1.1
 */
@Slf4j
@Service
public class SessionCleanupService {

    // ====================================
    // Abhängigkeiten
    // ====================================

    private final SessionRepository sessionRepository;
    private final int               maxIdleHours;

    // ====================================
    // Konstruktor
    // ====================================

    public SessionCleanupService(
            SessionRepository sessionRepository,
            @Value("${planningpoker.cleanup.max-idle-hours:24}") int maxIdleHours) {
        this.sessionRepository = sessionRepository;
        this.maxIdleHours      = maxIdleHours;
    }

    // ====================================
    // Geplante Aufgaben
    // ====================================

    /**
     * Löscht alle Sessions, in denen seit {@code max-idle-hours} nichts mehr passiert ist.
     * Läuft standardmäßig täglich um 03:00 Uhr.
     */
    @Scheduled(cron = "${planningpoker.cleanup.cron:0 0 3 * * *}")
    @Transactional
    public void cleanupInactiveSessions() {
        LocalDateTime cutoff = LocalDateTime.now().minusHours(maxIdleHours);

        List<Long> inactiveIds = sessionRepository.findInactiveSessionIds(cutoff);

        if (inactiveIds.isEmpty()) {
            log.info("Cleanup: Keine inaktiven Sessions gefunden.");
            return;
        }

        sessionRepository.deleteAllById(inactiveIds);

        log.info("Cleanup: {} Session(s) gelöscht (seit über {} Stunden inaktiv).",
                inactiveIds.size(), maxIdleHours);
    }
}
