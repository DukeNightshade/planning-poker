package de.sivag.planningpoker.controller;

import de.sivag.planningpoker.model.Participant;
import de.sivag.planningpoker.model.enums.ParticipantRole;
import de.sivag.planningpoker.service.SessionService;
import de.sivag.planningpoker.utility.RoleParser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST-Controller für Teilnehmer-Operationen.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
@Slf4j
@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class ParticipantRestController {

    // ====================================
    // Konstanten
    // ====================================

    private static final String TOPIC_SESSION    = "/topic/session/";
    private static final String PARTICIPANT_ID   = "participantId";
    private static final String PARTICIPANT_NAME = "participantName";

    // ====================================
    // Abhängigkeiten
    // ====================================

    private final SessionService sessionService;
    private final SimpMessagingTemplate messagingTemplate;

    // ====================================
    // Endpunkte
    // ====================================

    @PostMapping("/{roomCode}/join")
    public ResponseEntity<Map<String, Object>> joinSession(
            @PathVariable String roomCode,
            @RequestBody Map<String, String> body) {

        String name      = body.get("name");
        String browserId = body.get("browserId");
        ParticipantRole role = RoleParser.parseParticipantRole(
                body.getOrDefault("role", "DEVELOPER"));

        Participant participant = sessionService.joinSession(roomCode, name, role, browserId);

        log.info("Teilnehmer beigetreten: name={}, rolle={}, roomCode={}",
                name, role.name(), roomCode);

        messagingTemplate.convertAndSend(
                TOPIC_SESSION + roomCode,
                Map.of(
                        "type",            "PLAYER_JOINED",
                        PARTICIPANT_ID,    participant.getId().toString(),
                        PARTICIPANT_NAME,  participant.getName(),
                        "participantRole", participant.getRole().name()
                )
        );

        return ResponseEntity.ok(Map.of(
                PARTICIPANT_ID, participant.getId(),
                "name",          participant.getName(),
                "role",          participant.getRole().name()
        ));
    }

    @PostMapping("/{roomCode}/participants/{participantId}/promote")
    public ResponseEntity<Map<String, Object>> promoteToModerator(
            @PathVariable String roomCode,
            @PathVariable Long participantId) {

        Participant participant =
                sessionService.promoteToModerator(participantId);

        log.info("Teilnehmer zum Moderator befördert: name={}, roomCode={}",
                participant.getName(), roomCode);

        messagingTemplate.convertAndSend(
                TOPIC_SESSION + roomCode,
                Map.of(
                        "type",            "MODERATOR_PROMOTED",
                        PARTICIPANT_ID,   participant.getId().toString(),
                        PARTICIPANT_NAME, participant.getName()
                )
        );

        return ResponseEntity.ok(Map.of(
                PARTICIPANT_ID, participant.getId(),
                "moderator",     participant.isModerator()
        ));
    }

    @PostMapping("/{roomCode}/participants/{participantId}/demote")
    public ResponseEntity<Map<String, Object>> demoteFromModerator(
            @PathVariable String roomCode,
            @PathVariable Long participantId) {

        Participant participant =
                sessionService.demoteFromModerator(roomCode, participantId);

        log.info("Moderator-Rechte entzogen: name={}, roomCode={}",
                participant.getName(), roomCode);

        messagingTemplate.convertAndSend(
                TOPIC_SESSION + roomCode,
                Map.of(
                        "type",            "MODERATOR_DEMOTED",
                        PARTICIPANT_ID,   participant.getId().toString(),
                        PARTICIPANT_NAME, participant.getName()
                )
        );

        return ResponseEntity.ok(Map.of(
                PARTICIPANT_ID, participant.getId(),
                "moderator",     participant.isModerator()
        ));
    }
}