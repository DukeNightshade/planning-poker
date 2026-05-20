package de.sivag.planningpoker.repository;

import de.sivag.planningpoker.model.Ticket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository für den Datenbankzugriff auf Ticket-Entitäten.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
@Repository
public interface TicketRepository extends JpaRepository<Ticket, Long> {

    // ====================================
    // Query Methoden
    // ====================================

    List<Ticket> findBySessionRoomCodeOrderByOrderIndex(String roomCode);

    int countBySessionRoomCode(String roomCode);
}