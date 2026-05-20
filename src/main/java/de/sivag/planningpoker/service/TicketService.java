package de.sivag.planningpoker.service;

import de.sivag.planningpoker.model.Session;
import de.sivag.planningpoker.model.Ticket;
import de.sivag.planningpoker.model.enums.SessionStatus;
import de.sivag.planningpoker.repository.TicketRepository;
import de.sivag.planningpoker.repository.VoteRepository;
import de.sivag.planningpoker.utility.StringUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;

/**
 * Service für die Ticket-Verwaltung.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
@Service
@RequiredArgsConstructor
public class TicketService {

    // ====================================
    // Abhängigkeiten
    // ====================================

    private final SessionService sessionService;
    private final TicketRepository ticketRepository;
    private final VoteRepository voteRepository;

    // ====================================
    // Business Logik Methoden
    // ====================================

    @Transactional
    public Ticket addTicket(String roomCode, String title) {
        Session session = sessionService.getSessionByRoomCode(roomCode);

        Ticket ticket = new Ticket();
        ticket.setTitle(StringUtils.sanitize(title));
        ticket.setSession(session);
        ticket.setOrderIndex(ticketRepository.countBySessionRoomCode(roomCode));

        return ticketRepository.save(ticket);
    }

    @Transactional
    public Ticket selectTicket(String roomCode, Long ticketId) {
        Session session = sessionService.getSessionByRoomCode(roomCode);
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new NoSuchElementException("Ticket nicht gefunden."));
        session.setCurrentTicketId(ticketId);
        session.setStatus(SessionStatus.WAITING);
        voteRepository.deleteBySessionRoomCode(roomCode);

        return ticket;
    }

    public List<Ticket> getTickets(String roomCode) {
        return ticketRepository.findBySessionRoomCodeOrderByOrderIndex(roomCode);
    }

    public String getCurrentTicketTitle(String roomCode, Long ticketId) {
        if (ticketId == null) return "";
        return getTickets(roomCode).stream()
                .filter(t -> t.getId().equals(ticketId))
                .findFirst()
                .map(Ticket::getTitle)
                .orElse("");
    }
}