package de.sivag.planningpoker.repository;

import de.sivag.planningpoker.model.Session;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository für den Datenbankzugriff auf Session-Entitäten.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
@Repository
public interface SessionRepository extends JpaRepository<Session, Long> {

    // ====================================
    // Query Methoden
    // ====================================

    Optional<Session> findByRoomCode(String roomCode);

    boolean existsByRoomCode(String roomCode);

    @Query("SELECT s.id FROM Session s WHERE s.createdAt < :cutoff")
    List<Long> findExpiredSessionIds(@Param("cutoff") LocalDateTime cutoff);
}