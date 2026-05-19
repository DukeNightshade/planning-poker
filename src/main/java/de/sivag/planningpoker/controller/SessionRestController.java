package de.sivag.planningpoker.controller;

import de.sivag.planningpoker.model.Participant;
import de.sivag.planningpoker.model.Session;
import de.sivag.planningpoker.model.enums.EstimationMethod;
import de.sivag.planningpoker.model.enums.ParticipantRole;
import de.sivag.planningpoker.service.SessionService;
import de.sivag.planningpoker.service.TicketService;
import de.sivag.planningpoker.utility.RoleParser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

/**
 * REST-Controller für Session-Operationen.
 * Verantwortlich für Erstellen und Statusabfrage von Sessions.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class SessionRestController {

    // ====================================
    // Dependencies
    // ====================================

    private final SessionService sessionService;
    private final TicketService ticketService;

    // ====================================
    // Endpoints
    // ====================================

    @PostMapping
    public ResponseEntity<?> createSession(@RequestBody Map<String, Object> body) {
        try {
            String moderatorName = (String) body.get("moderatorName");
            EstimationMethod method = EstimationMethod.valueOf((String) body.get("method"));
            ParticipantRole moderatorRole = RoleParser.parseModeratorRole(
                    (String) body.getOrDefault("moderatorRole", "DEVELOPER"));

            @SuppressWarnings("unchecked")
            List<String> ticketTitles = (List<String>) body.getOrDefault("tickets", List.of());

            Session session = ticketTitles.isEmpty()
                    ? sessionService.createSession(moderatorName, method, moderatorRole)
                    : sessionService.createSessionWithTickets(
                    moderatorName, method, moderatorRole, ticketTitles);

            Long moderatorId = sessionService.getParticipants(session.getRoomCode())
                    .stream()
                    .filter(p -> p.getRole() == moderatorRole)
                    .findFirst()
                    .map(Participant::getId)
                    .orElse(null);

            return ResponseEntity.ok(Map.of(
                    "roomCode", session.getRoomCode(),
                    "method", session.getEstimationMethod().name(),
                    "status", session.getStatus().name(),
                    "participantId", moderatorId,
                    "moderatorRole", moderatorRole.name()
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Ungültige Schätzmethode."));
        }
    }

    @GetMapping("/{roomCode}/state")
    public ResponseEntity<?> getState(@PathVariable String roomCode) {
        try {
            Session session = sessionService.getSessionByRoomCode(roomCode);

            String currentTicketTitle = resolveCurrentTicketTitle(session);

            return ResponseEntity.ok(Map.of(
                    "roomCode", session.getRoomCode(),
                    "currentTicketId", session.getCurrentTicketId() != null
                            ? session.getCurrentTicketId() : "",
                    "currentTicketTitle", currentTicketTitle,
                    "method", session.getEstimationMethod().name(),
                    "status", session.getStatus().name(),
                    "participantCount", sessionService.getParticipants(roomCode).size()
            ));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // ====================================
    // Utility Methods
    // ====================================

    private String resolveCurrentTicketTitle(Session session) {
        if (session.getCurrentTicketId() == null) return "";
        return ticketService.getTickets(session.getRoomCode())
                .stream()
                .filter(t -> t.getId().equals(session.getCurrentTicketId()))
                .findFirst()
                .map(t -> t.getTitle())
                .orElse("");
    }
}