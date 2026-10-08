package de.sivag.planningpoker.repository;

import de.sivag.planningpoker.model.Participant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

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

    Optional<Participant> findBySessionRoomCodeAndBrowserId(String roomCode, String browserId);

    boolean existsBySessionRoomCodeAndName(String roomCode, String name);

    Optional<Participant> findBySessionRoomCodeAndToken(String roomCode, String token);

    Optional<Participant> findBySessionRoomCodeAndName(String roomCode, String name);

    /** Nach einem Neustart ist niemand verbunden: alle Team-Mitglieder gelten als abwesend. */
    @Modifying
    @Transactional
    @Query("UPDATE Participant p SET p.present = false WHERE p.session.id IN "
            + "(SELECT s.id FROM Session s WHERE s.teamName IS NOT NULL)")
    int markAllTeamMembersAbsent();
}