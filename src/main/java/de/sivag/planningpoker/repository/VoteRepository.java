package de.sivag.planningpoker.repository;

import de.sivag.planningpoker.model.Vote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository für den Datenbankzugriff auf Vote-Entitäten.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
@Repository
public interface VoteRepository extends JpaRepository<Vote, Long> {

    // ====================================
    // Query Methods
    // ====================================

    List<Vote> findBySessionRoomCode(String roomCode);

    Optional<Vote> findBySessionRoomCodeAndParticipantId(String roomCode, Long participantId);

    void deleteBySessionRoomCode(String roomCode);

    @Query("SELECT v FROM Vote v JOIN FETCH v.participant WHERE v.session.roomCode = :roomCode")
    List<Vote> findBySessionRoomCodeWithParticipant(@Param("roomCode") String roomCode);
}