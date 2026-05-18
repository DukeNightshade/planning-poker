package de.sivag.planningpoker.repository;

import de.sivag.planningpoker.model.Vote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface VoteRepository extends JpaRepository<Vote, Long> {

    List<Vote> findBySessionRoomCode(String roomCode);

    Optional<Vote> findBySessionRoomCodeAndParticipantId(String roomCode, Long participantId);

    void deleteBySessionRoomCode(String roomCode);
}