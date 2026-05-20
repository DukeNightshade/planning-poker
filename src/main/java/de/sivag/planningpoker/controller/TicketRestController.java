package de.sivag.planningpoker.controller;

import de.sivag.planningpoker.model.Ticket;
import de.sivag.planningpoker.service.TicketService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST-Controller für Ticket-Operationen.
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
    // Konstanten
    // ====================================

    private static final String TITLE  = "title";
    private static final String STATUS = "status";

    // ====================================
    // Abhängigkeiten
    // ====================================

    private final TicketService ticketService;

    // ====================================
    // Endpunkte
    // ====================================

    @GetMapping("/{roomCode}/tickets")
    public ResponseEntity<List<Map<String, Object>>> getTickets(
            @PathVariable String roomCode) {

        List<Ticket> tickets = ticketService.getTickets(roomCode);
        return ResponseEntity.ok(tickets.stream().map(t -> Map.<String, Object>of(
                "id",            t.getId(),
                TITLE,           t.getTitle(),
                STATUS,          t.getStatus().name(),
                "finalEstimate", t.getFinalEstimate() != null
                        ? t.getFinalEstimate() : "",
                "orderIndex",    t.getOrderIndex()
        )).toList());
    }

    @PostMapping("/{roomCode}/tickets")
    public ResponseEntity<Map<String, Object>> addTicket(
            @PathVariable String roomCode,
            @RequestBody Map<String, String> body) {

        Ticket ticket = ticketService.addTicket(roomCode, body.get(TITLE));

        log.info("Ticket hinzugefügt: title='{}', roomCode={}",
                ticket.getTitle(), roomCode);

        return ResponseEntity.ok(Map.of(
                "id",         ticket.getId(),
                TITLE,        ticket.getTitle(),
                STATUS,       ticket.getStatus().name(),
                "orderIndex", ticket.getOrderIndex()
        ));
    }

    @PostMapping("/{roomCode}/tickets/{ticketId}/select")
    public ResponseEntity<Map<String, Object>> selectTicket(
            @PathVariable String roomCode,
            @PathVariable Long ticketId) {

        Ticket ticket = ticketService.selectTicket(roomCode, ticketId);

        log.info("Ticket ausgewählt: title='{}', roomCode={}",
                ticket.getTitle(), roomCode);

        return ResponseEntity.ok(Map.of(
                "id",    ticket.getId(),
                TITLE,   ticket.getTitle(),
                STATUS,  ticket.getStatus().name()
        ));
    }
}