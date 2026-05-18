package de.sivag.planningpoker.controller;

import de.sivag.planningpoker.model.Vote;
import de.sivag.planningpoker.service.SessionService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.List;
import java.util.Map;

@Controller
@RequiredArgsConstructor
public class PokerWsController {

    private final SessionService sessionService;
    private final SimpMessagingTemplate messagingTemplate;

    // ====================================
    // Karte wählen
    // ====================================

    @MessageMapping("/session/{roomCode}/vote")
    public void submitVote(
            @DestinationVariable String roomCode,
            @Payload Map<String, String> payload) {

        Long participantId = Long.parseLong(payload.get("participantId"));
        String cardValue = payload.get("cardValue");

        sessionService.submitVote(roomCode, participantId, cardValue);

        int totalParticipants = sessionService.getParticipants(roomCode).size();
        int votedCount = sessionService.getVotes(roomCode).size();

        messagingTemplate.convertAndSend(
                "/topic/session/" + roomCode,
                Map.of(
                        "type", "VOTE_UPDATE",
                        "votedCount", votedCount,
                        "totalCount", totalParticipants
                )
        );
    }

    // ====================================
    // Karten aufdecken
    // ====================================

    @MessageMapping("/session/{roomCode}/reveal")
    public void revealCards(@DestinationVariable String roomCode) {
        List<Vote> votes = sessionService.revealCards(roomCode);

        messagingTemplate.convertAndSend(
                "/topic/session/" + roomCode,
                Map.of(
                        "type", "REVEAL",
                        "votes", votes.stream().map(v -> Map.of(
                                "participantName", v.getParticipant().getName(),
                                "cardValue", v.getCardValue()
                        )).toList()
                )
        );
    }

    // ====================================
    // Neue Runde
    // ====================================

    @MessageMapping("/session/{roomCode}/reset")
    public void resetRound(@DestinationVariable String roomCode) {
        sessionService.resetRound(roomCode);

        messagingTemplate.convertAndSend(
                "/topic/session/" + roomCode,
                Map.of("type", "RESET")
        );
    }

    // ====================================
    // Topic aktualisieren
    // ====================================

    @MessageMapping("/session/{roomCode}/topic")
    public void updateTopic(
            @DestinationVariable String roomCode,
            @Payload Map<String, String> payload) {

        String topic = payload.get("topic");
        sessionService.updateTopic(roomCode, topic);

        messagingTemplate.convertAndSend(
                "/topic/session/" + roomCode,
                Map.of(
                        "type", "TOPIC_UPDATE",
                        "topic", topic
                )
        );
    }
}