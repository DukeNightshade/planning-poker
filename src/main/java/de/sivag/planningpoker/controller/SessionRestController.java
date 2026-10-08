package de.sivag.planningpoker.controller;

import de.sivag.planningpoker.exception.ForbiddenException;
import de.sivag.planningpoker.model.Participant;
import de.sivag.planningpoker.model.Session;
import de.sivag.planningpoker.model.enums.EstimationMethod;
import de.sivag.planningpoker.model.enums.ParticipantRole;
import de.sivag.planningpoker.service.SessionService;
import de.sivag.planningpoker.service.TicketService;
import de.sivag.planningpoker.service.VoteService;
import de.sivag.planningpoker.utility.RoleParser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

import static de.sivag.planningpoker.utility.ApiConstants.*;

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
    private final VoteService voteService;

    // ====================================
    // Endpunkte
    // ====================================

    @PostMapping
    public ResponseEntity<Map<String, Object>> createSession(
            @RequestBody Map<String, Object> body) {

        String moderatorName = (String) body.get("moderatorName");
        String browserId     = (String) body.get("browserId");
        EstimationMethod method = EstimationMethod.valueOf(
                (String) body.get(METHOD));
        ParticipantRole moderatorRole = RoleParser.parseRole(
                (String) body.getOrDefault("moderatorRole", "DEVELOPER"));

        // Optional: permanenter Team-Raum unter /team/{teamName}
        String teamName = (String) body.get("teamName");

        @SuppressWarnings("unchecked")
        List<String> ticketTitles =
                (List<String>) body.getOrDefault("tickets", List.of());

        Session session = ticketTitles.isEmpty()
                ? sessionService.createSession(moderatorName, method, moderatorRole, browserId, teamName)
                : sessionService.createSessionWithTickets(
                moderatorName, method, moderatorRole, ticketTitles, browserId, teamName);

        log.info("Session erstellt: roomCode={}, methode={}, tickets={}, team={}",
                session.getRoomCode(),
                method.name(),
                ticketTitles.size(),
                session.getTeamName());

        Participant moderator = sessionService.getParticipants(session.getRoomCode())
                .stream()
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "Moderator wurde nicht gefunden nach Session-Erstellung."));

        return ResponseEntity.ok(Map.of(
                "roomCode",      session.getRoomCode(),
                METHOD,        session.getEstimationMethod().name(),
                "status",        session.getStatus().name(),
                PARTICIPANT_ID, moderator.getId(),
                "moderatorRole", moderatorRole.name(),
                "token",         moderator.getToken(),
                "teamName",      session.getTeamName() != null ? session.getTeamName() : ""
        ));
    }

    @GetMapping("/{roomCode}/state")
    public ResponseEntity<Map<String, Object>> getState(
            @PathVariable String roomCode,
            @RequestHeader(value = REST_TOKEN_HEADER, required = false) String token) {
        Session session = sessionService.getSessionByRoomCode(roomCode);
        String currentTicketTitle = ticketService.getCurrentTicketTitle(
                roomCode, session.getCurrentTicketId());

        List<String> votedIds = voteService.getVotedParticipantIds(roomCode)
                .stream()
                .map(Object::toString)
                .toList();

        Map<String, Object> body = new java.util.HashMap<>(Map.of(
                "roomCode",            session.getRoomCode(),
                "currentTicketId",     session.getCurrentTicketId() != null
                        ? session.getCurrentTicketId() : "",
                "currentTicketTitle",  currentTicketTitle,
                METHOD,                session.getEstimationMethod().name(),
                "status",              session.getStatus().name(),
                "participantCount",    sessionService.getParticipants(roomCode).size(),
                "votedParticipantIds", votedIds,
                "votedCount",          votedIds.size()
        ));

        // Eigene Karte vor dem Aufdecken nur an den Token-Inhaber (für Reload)
        if (token != null && !token.isBlank()) {
            try {
                Participant me = sessionService.authenticate(roomCode, token);
                voteService.getOwnCardValue(roomCode, me.getId())
                        .ifPresent(card -> body.put("myCardValue", card));
            } catch (ForbiddenException e) {
                log.debug("State ohne eigene Karte: {}", e.getMessage());
            }
        }

        if (session.getStatus() == de.sivag.planningpoker.model.enums.SessionStatus.REVEALED) {
            List<Map<String, Object>> votes = voteService.getVotesWithParticipant(roomCode)
                    .stream()
                    .map(v -> Map.<String, Object>of(
                            PARTICIPANT_ID,   v.getParticipant().getId().toString(),
                            PARTICIPANT_NAME, v.getParticipant().getName(),
                            PARTICIPANT_ROLE, v.getParticipant().getRole().name(),
                            "cardValue",       v.getCardValue()
                    ))
                    .toList();
            body.put("votes", votes);
        }

        return ResponseEntity.ok(body);
    }
}