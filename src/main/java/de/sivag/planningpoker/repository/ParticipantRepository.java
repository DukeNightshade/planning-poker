package de.sivag.planningpoker.repository;

import de.sivag.planningpoker.model.Participant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ParticipantRepository extends JpaRepository<Participant, Long> {

    List<Participant> findBySessionRoomCode(String roomCode);
}