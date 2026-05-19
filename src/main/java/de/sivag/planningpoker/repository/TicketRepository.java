package de.sivag.planningpoker.repository;

import de.sivag.planningpoker.model.Ticket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface TicketRepository extends JpaRepository<Ticket, Long> {

    List<Ticket> findBySessionRoomCodeOrderByOrderIndex(String roomCode);

    int countBySessionRoomCode(String roomCode);
}