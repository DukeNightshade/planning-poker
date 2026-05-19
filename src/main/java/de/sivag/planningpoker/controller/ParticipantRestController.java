package de.sivag.planningpoker.controller;

import de.sivag.planningpoker.model.Participant;
import de.sivag.planningpoker.model.enums.ParticipantRole;
import de.sivag.planningpoker.service.SessionService;
import de.sivag.planningpoker.utility.RoleParser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.NoSuchElementException;

/**
 * REST-Controller für Teilnehmer-Operationen.
 * Verantwortlich für Beitritt, Promote und Demote.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class ParticipantRestController {

    // ====================================
    // Dependencies
    // ====================================

    private final SessionService sessionService;
    private final SimpMessagingTemplate messagingTemplate;

    // ====================================
    // Endpoints
    // ====================================

    @PostMapping("/{roomCode}/join")
    public ResponseEntity<?> joinSession(
            @PathVariable String roomCode,
            @RequestBody Map<String, String> body) {
        try {
            String name = body.get("name");
            ParticipantRole role = RoleParser.parseParticipantRole(
                    body.getOrDefault("role", "DEVELOPER"));

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
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
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
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }
}