package de.sivag.planningpoker.controller;

import de.sivag.planningpoker.model.Participant;
import de.sivag.planningpoker.model.Session;
import de.sivag.planningpoker.model.enums.EstimationMethod;
import de.sivag.planningpoker.model.enums.ParticipantRole;
import de.sivag.planningpoker.service.SessionService;
import de.sivag.planningpoker.service.TicketService;
import de.sivag.planningpoker.utility.RoleParser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST-Controller für Session-Operationen.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
@Slf4j
@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class SessionRestController {

    // ====================================
    // Konstanten
    // ====================================

    private static final String METHOD = "method";

    // ====================================
    // Abhängigkeiten
    // ====================================

    private final SessionService sessionService;
    private final TicketService  ticketService;

    // ====================================
    // Endpunkte
    // ====================================

    @PostMapping
    public ResponseEntity<Map<String, Object>> createSession(
            @RequestBody Map<String, Object> body) {

        String moderatorName = (String) body.get("moderatorName");
        EstimationMethod method = EstimationMethod.valueOf(
                (String) body.get(METHOD));
        ParticipantRole moderatorRole = RoleParser.parseModeratorRole(
                (String) body.getOrDefault("moderatorRole", "DEVELOPER"));

        @SuppressWarnings("unchecked")
        List<String> ticketTitles =
                (List<String>) body.getOrDefault("tickets", List.of());

        Session session = ticketTitles.isEmpty()
                ? sessionService.createSession(moderatorName, method, moderatorRole)
                : sessionService.createSessionWithTickets(
                moderatorName, method, moderatorRole, ticketTitles);

        log.info("Session erstellt: roomCode={}, methode={}, tickets={}",
                session.getRoomCode(),
                method.name(),
                ticketTitles.size());

        Long moderatorId = sessionService.getParticipants(session.getRoomCode())
                .stream()
                .filter(p -> p.getRole() == moderatorRole)
                .findFirst()
                .map(Participant::getId)
                .orElseThrow(() -> new IllegalStateException(
                        "Moderator wurde nicht gefunden nach Session-Erstellung."));

        return ResponseEntity.ok(Map.of(
                "roomCode",      session.getRoomCode(),
                METHOD,        session.getEstimationMethod().name(),
                "status",        session.getStatus().name(),
                "participantId", moderatorId,
                "moderatorRole", moderatorRole.name()
        ));
    }

    @GetMapping("/{roomCode}/state")
    public ResponseEntity<Map<String, Object>> getState(
            @PathVariable String roomCode) {

        Session session = sessionService.getSessionByRoomCode(roomCode);
        String currentTicketTitle = ticketService.getCurrentTicketTitle(
                roomCode, session.getCurrentTicketId());

        return ResponseEntity.ok(Map.of(
                "roomCode",           session.getRoomCode(),
                "currentTicketId",    session.getCurrentTicketId() != null
                        ? session.getCurrentTicketId() : "",
                "currentTicketTitle", currentTicketTitle,
                METHOD,             session.getEstimationMethod().name(),
                "status",             session.getStatus().name(),
                "participantCount",   sessionService.getParticipants(roomCode).size()
        ));
    }
}