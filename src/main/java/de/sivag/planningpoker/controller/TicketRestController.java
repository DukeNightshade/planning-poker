package de.sivag.planningpoker.controller;

import de.sivag.planningpoker.model.Ticket;
import de.sivag.planningpoker.service.TicketService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

/**
 * REST-Controller für Ticket-Operationen.
 * Verantwortlich für Hinzufügen, Auswählen und Abrufen von Tickets.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
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
        try {
            List<Ticket> tickets = ticketService.getTickets(roomCode);
            return ResponseEntity.ok(tickets.stream().map(t -> Map.of(
                    "id", t.getId(),
                    "title", t.getTitle(),
                    "status", t.getStatus().name(),
                    "finalEstimate", t.getFinalEstimate() != null ? t.getFinalEstimate() : "",
                    "orderIndex", t.getOrderIndex()
            )).toList());
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/{roomCode}/tickets")
    public ResponseEntity<?> addTicket(
            @PathVariable String roomCode,
            @RequestBody Map<String, String> body) {
        try {
            Ticket ticket = ticketService.addTicket(roomCode, body.get("title"));
            return ResponseEntity.ok(Map.of(
                    "id", ticket.getId(),
                    "title", ticket.getTitle(),
                    "status", ticket.getStatus().name(),
                    "orderIndex", ticket.getOrderIndex()
            ));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/{roomCode}/tickets/{ticketId}/select")
    public ResponseEntity<?> selectTicket(
            @PathVariable String roomCode,
            @PathVariable Long ticketId) {
        try {
            Ticket ticket = ticketService.selectTicket(roomCode, ticketId);
            return ResponseEntity.ok(Map.of(
                    "id", ticket.getId(),
                    "title", ticket.getTitle(),
                    "status", ticket.getStatus().name()
            ));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }
}