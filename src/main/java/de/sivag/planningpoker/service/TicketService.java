package de.sivag.planningpoker.service;

import de.sivag.planningpoker.model.Session;
import de.sivag.planningpoker.model.Ticket;
import de.sivag.planningpoker.model.enums.SessionStatus;
import de.sivag.planningpoker.repository.SessionRepository;
import de.sivag.planningpoker.repository.TicketRepository;
import de.sivag.planningpoker.repository.VoteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;

/**
 * Service für die Ticket-Verwaltung.
 * Verantwortlich für Hinzufügen, Auswählen und Abrufen
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
@Service
@RequiredArgsConstructor
public class TicketService {

    // ====================================
    // Dependencies
    // ====================================

    private final SessionRepository sessionRepository;
    private final TicketRepository ticketRepository;
    private final VoteRepository voteRepository;

    // ====================================
    // Business Logic Methods
    // ====================================

    @Transactional
    public Ticket addTicket(String roomCode, String title) {
        Session session = getSessionByRoomCode(roomCode);

        Ticket ticket = new Ticket();
        ticket.setTitle(title);
        ticket.setSession(session);
        ticket.setOrderIndex(ticketRepository.countBySessionRoomCode(roomCode));

        return ticketRepository.save(ticket);
    }

    @Transactional
    public Ticket selectTicket(String roomCode, Long ticketId) {
        Session session = getSessionByRoomCode(roomCode);

        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new NoSuchElementException("Ticket nicht gefunden."));

        session.setCurrentTicketId(ticketId);
        session.setStatus(SessionStatus.WAITING);
        sessionRepository.save(session);
        voteRepository.deleteBySessionRoomCode(roomCode);

        return ticket;
    }

    public List<Ticket> getTickets(String roomCode) {
        return ticketRepository.findBySessionRoomCodeOrderByOrderIndex(roomCode);
    }

    // ====================================
    // Utility Methods
    // ====================================

    private Session getSessionByRoomCode(String roomCode) {
        return sessionRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new NoSuchElementException(
                        "Session mit Raumcode " + roomCode + " nicht gefunden."));
    }
}