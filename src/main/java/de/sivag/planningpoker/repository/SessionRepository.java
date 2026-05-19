package de.sivag.planningpoker.repository;

import de.sivag.planningpoker.model.Session;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

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
    // Query Methods
    // ====================================

    Optional<Session> findByRoomCode(String roomCode);

    boolean existsByRoomCode(String roomCode);
}