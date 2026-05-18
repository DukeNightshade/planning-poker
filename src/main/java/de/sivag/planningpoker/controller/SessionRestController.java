package de.sivag.planningpoker.controller;

import de.sivag.planningpoker.model.*;
import de.sivag.planningpoker.model.enums.EstimationMethod;
import de.sivag.planningpoker.service.SessionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class SessionRestController {

    private final SessionService sessionService;

    @PostMapping
    public ResponseEntity<?> createSession(@RequestBody Map<String, String> body) {
        try {
            String moderatorName = body.get("moderatorName");
            EstimationMethod method = EstimationMethod.valueOf(body.get("method"));
            Session session = sessionService.createSession(moderatorName, method);
            return ResponseEntity.ok(Map.of(
                    "roomCode", session.getRoomCode(),
                    "method", session.getEstimationMethod().name(),
                    "status", session.getStatus().name()
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
            return ResponseEntity.ok(Map.of(
                    "roomCode", session.getRoomCode(),
                    "topic", session.getTopic() != null ? session.getTopic() : "",
                    "method", session.getEstimationMethod().name(),
                    "status", session.getStatus().name(),
                    "participantCount",
                    sessionService.getParticipants(roomCode).size()
            ));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }
}