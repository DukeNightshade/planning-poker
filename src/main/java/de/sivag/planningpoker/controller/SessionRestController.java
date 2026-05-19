package de.sivag.planningpoker.controller;

import de.sivag.planningpoker.model.*;
import de.sivag.planningpoker.model.enums.EstimationMethod;
import de.sivag.planningpoker.model.enums.ParticipantRole;
import de.sivag.planningpoker.service.SessionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class SessionRestController {

    private final SessionService sessionService;
    private final SimpMessagingTemplate messagingTemplate;

    @PostMapping
    public ResponseEntity<?> createSession(@RequestBody Map<String, Object> body) {
        try {
            String moderatorName = (String) body.get("moderatorName");
            EstimationMethod method = EstimationMethod.valueOf((String) body.get("method"));

            @SuppressWarnings("unchecked")
            List<String> ticketTitles = (List<String>) body.getOrDefault("tickets", List.of());

            Session session = ticketTitles.isEmpty()
                    ? sessionService.createSession(moderatorName, method)
                    : sessionService.createSessionWithTickets(moderatorName, method, ticketTitles);

            List<Participant> participants = sessionService.getParticipants(session.getRoomCode());
            Long moderatorId = participants.stream()
                    .filter(p -> p.getRole() == ParticipantRole.MODERATOR)
                    .findFirst()
                    .map(Participant::getId)
                    .orElse(null);

            return ResponseEntity.ok(Map.of(
                    "roomCode", session.getRoomCode(),
                    "method", session.getEstimationMethod().name(),
                    "status", session.getStatus().name(),
                    "participantId", moderatorId
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Ungültige Schätzmethode."));
        }
    }

    @PostMapping("/{roomCode}/join")
    public ResponseEntity<?> joinSession(
            @PathVariable String roomCode,
            @RequestBody Map<String, String> body) {
        try {
            String name = body.get("name");
            Participant participant = sessionService.joinSession(roomCode, name);

            // Alle informieren dass jemand beigetreten ist
            messagingTemplate.convertAndSend(
                    "/topic/session/" + roomCode,
                    Map.of(
                            "type", "PLAYER_JOINED",
                            "participantId", participant.getId().toString(),
                            "participantName", participant.getName()
                    )
            );

            return ResponseEntity.ok(Map.of(
                    "participantId", participant.getId(),
                    "name", participant.getName(),
                    "role", participant.getRole().name()
            ));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{roomCode}/state")
    public ResponseEntity<?> getState(@PathVariable String roomCode) {
        try {
            Session session = sessionService.getSessionByRoomCode(roomCode);

            // Aktives Ticket ermitteln
            String currentTicketTitle = "";
            if (session.getCurrentTicketId() != null) {
                currentTicketTitle = sessionService.getTickets(session.getRoomCode())
                        .stream()
                        .filter(t -> t.getId().equals(session.getCurrentTicketId()))
                        .findFirst()
                        .map(t -> t.getTitle())
                        .orElse("");
            }

            return ResponseEntity.ok(Map.of(
                    "roomCode", session.getRoomCode(),
                    "currentTicketId", session.getCurrentTicketId() != null ? session.getCurrentTicketId() : "",
                    "currentTicketTitle", currentTicketTitle,
                    "method", session.getEstimationMethod().name(),
                    "status", session.getStatus().name(),
                    "participantCount", sessionService.getParticipants(roomCode).size()
            ));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/{roomCode}/tickets")
    public ResponseEntity<?> addTicket(
            @PathVariable String roomCode,
            @RequestBody Map<String, String> body) {
        try {
            String title = body.get("title");
            Ticket ticket = sessionService.addTicket(roomCode, title);
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
            Ticket ticket = sessionService.selectTicket(roomCode, ticketId);
            return ResponseEntity.ok(Map.of(
                    "id", ticket.getId(),
                    "title", ticket.getTitle(),
                    "status", ticket.getStatus().name()
            ));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/{roomCode}/tickets")
    public ResponseEntity<?> getTickets(@PathVariable String roomCode) {
        try {
            List<Ticket> tickets = sessionService.getTickets(roomCode);
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
}