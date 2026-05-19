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
            String moderatorRoleStr = (String) body.getOrDefault("moderatorRole", "DEVELOPER");
            ParticipantRole moderatorRole;
            try {
                moderatorRole = ParticipantRole.valueOf(moderatorRoleStr);
                if (moderatorRole == ParticipantRole.MODERATOR ||
                        moderatorRole == ParticipantRole.PRODUCT_OWNER) {
                    moderatorRole = ParticipantRole.DEVELOPER;
                }
            } catch (IllegalArgumentException e) {
                moderatorRole = ParticipantRole.DEVELOPER;
            }

            final ParticipantRole finalModeratorRole = moderatorRole;

            @SuppressWarnings("unchecked")
            List<String> ticketTitles = (List<String>) body.getOrDefault("tickets", List.of());

            Session session = ticketTitles.isEmpty()
                    ? sessionService.createSession(moderatorName, method, finalModeratorRole)
                    : sessionService.createSessionWithTickets(moderatorName, method, finalModeratorRole, ticketTitles);

            List<Participant> participants = sessionService.getParticipants(session.getRoomCode());
            Long moderatorId = participants.stream()
                    .filter(p -> p.getRole() == finalModeratorRole)
                    .findFirst()
                    .map(Participant::getId)
                    .orElse(null);

            return ResponseEntity.ok(Map.of(
                    "roomCode", session.getRoomCode(),
                    "method", session.getEstimationMethod().name(),
                    "status", session.getStatus().name(),
                    "participantId", moderatorId,
                    "moderatorRole", finalModeratorRole.name()
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
            String roleStr = body.getOrDefault("role", "DEVELOPER");
            ParticipantRole role;
            try {
                role = ParticipantRole.valueOf(roleStr);
                if (role == ParticipantRole.MODERATOR) role = ParticipantRole.DEVELOPER;
            } catch (IllegalArgumentException e) {
                role = ParticipantRole.DEVELOPER;
            }

            Participant participant = sessionService.joinSession(roomCode, name, role);

            messagingTemplate.convertAndSend(
                    "/topic/session/" + roomCode,
                    Map.of(
                            "type", "PLAYER_JOINED",
                            "participantId", participant.getId().toString(),
                            "participantName", participant.getName(),
                            "participantRole", participant.getRole().name()
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

    @PostMapping("/{roomCode}/participants/{participantId}/promote")
    public ResponseEntity<?> promoteToModerator(
            @PathVariable String roomCode,
            @PathVariable Long participantId) {
        try {
            Participant participant = sessionService.promoteToModerator(roomCode, participantId);

            messagingTemplate.convertAndSend(
                    "/topic/session/" + roomCode,
                    Map.of(
                            "type", "MODERATOR_PROMOTED",
                            "participantId", participant.getId().toString(),
                            "participantName", participant.getName()
                    )
            );

            return ResponseEntity.ok(Map.of(
                    "participantId", participant.getId(),
                    "moderator", participant.isModerator()
            ));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/{roomCode}/participants/{participantId}/demote")
    public ResponseEntity<?> demoteFromModerator(
            @PathVariable String roomCode,
            @PathVariable Long participantId) {
        try {
            Participant participant = sessionService.demoteFromModerator(roomCode, participantId);

            messagingTemplate.convertAndSend(
                    "/topic/session/" + roomCode,
                    Map.of(
                            "type", "MODERATOR_DEMOTED",
                            "participantId", participant.getId().toString(),
                            "participantName", participant.getName()
                    )
            );

            return ResponseEntity.ok(Map.of(
                    "participantId", participant.getId(),
                    "moderator", participant.isModerator()
            ));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }
}