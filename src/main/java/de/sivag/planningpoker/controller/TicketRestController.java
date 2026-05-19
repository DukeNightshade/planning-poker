package de.sivag.planningpoker.controller;

import de.sivag.planningpoker.model.Ticket;
import de.sivag.planningpoker.service.TicketService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST-Controller für Ticket-Operationen.
 * Verantwortlich für Hinzufügen, Auswählen und Abrufen von Tickets.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
@Slf4j
@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class TicketRestController {

    // ====================================
    // Dependencies
    // ====================================

    private final TicketService ticketService;
    private final SimpMessagingTemplate messagingTemplate;

    // ====================================
    // Endpoints
    // ====================================

    @GetMapping("/{roomCode}/tickets")
    public ResponseEntity<?> getTickets(@PathVariable String roomCode) {
        List<Ticket> tickets = ticketService.getTickets(roomCode);
        return ResponseEntity.ok(tickets.stream().map(t -> Map.of(
                "id",            t.getId(),
                "title",         t.getTitle(),
                "status",        t.getStatus().name(),
                "finalEstimate", t.getFinalEstimate() != null
                        ? t.getFinalEstimate() : "",
                "orderIndex",    t.getOrderIndex()
        )).toList());
    }

    @PostMapping("/{roomCode}/tickets")
    public ResponseEntity<?> addTicket(
            @PathVariable String roomCode,
            @RequestBody Map<String, String> body) {

        Ticket ticket = ticketService.addTicket(roomCode, body.get("title"));

        log.info("Ticket hinzugefügt: title='{}', roomCode={}",
                ticket.getTitle(), roomCode);

        return ResponseEntity.ok(Map.of(
                "id",         ticket.getId(),
                "title",      ticket.getTitle(),
                "status",     ticket.getStatus().name(),
                "orderIndex", ticket.getOrderIndex()
        ));
    }

    @PostMapping("/{roomCode}/tickets/{ticketId}/select")
    public ResponseEntity<?> selectTicket(
            @PathVariable String roomCode,
            @PathVariable Long ticketId) {

        Ticket ticket = ticketService.selectTicket(roomCode, ticketId);

        log.info("Ticket ausgewählt: title='{}', roomCode={}",
                ticket.getTitle(), roomCode);

        return ResponseEntity.ok(Map.of(
                "id",     ticket.getId(),
                "title",  ticket.getTitle(),
                "status", ticket.getStatus().name()
        ));
    }
}