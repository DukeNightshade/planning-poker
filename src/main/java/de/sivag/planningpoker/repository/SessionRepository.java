package de.sivag.planningpoker.repository;

import de.sivag.planningpoker.model.Session;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface SessionRepository extends JpaRepository<Session, Long> {

    Optional<Session> findByRoomCode(String roomCode);

    boolean existsByRoomCode(String roomCode);
}