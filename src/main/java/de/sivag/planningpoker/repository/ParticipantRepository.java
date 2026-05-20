package de.sivag.planningpoker.repository;

import de.sivag.planningpoker.model.Participant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository für den Datenbankzugriff auf Participant-Entitäten.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
@Repository
public interface ParticipantRepository extends JpaRepository<Participant, Long> {

    // ====================================
    // Query Methoden
    // ====================================

    List<Participant> findBySessionRoomCode(String roomCode);
}