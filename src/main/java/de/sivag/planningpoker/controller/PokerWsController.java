package de.sivag.planningpoker.controller;

import de.sivag.planningpoker.model.Session;
import de.sivag.planningpoker.model.Ticket;
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
        boolean isDiscussion = Boolean.parseBoolean(payload.getOrDefault("isDiscussion", "false"));

        sessionService.submitVote(roomCode, participantId, cardValue, isDiscussion);

        int totalParticipants = sessionService.getParticipants(roomCode).size();
        int votedCount = sessionService.getVotes(roomCode).size();

        Session session = sessionService.getSessionByRoomCode(roomCode);
        if (session.isAutoReveal() && votedCount >= totalParticipants && !isDiscussion) {
            List<Vote> votes = sessionService.revealCards(roomCode);
            messagingTemplate.convertAndSend(
                    "/topic/session/" + roomCode,
                    Map.of(
                            "type", "REVEAL",
                            "votes", votes.stream().map(v -> Map.of(
                                    "participantName", v.getParticipant().getName(),
                                    "participantRole", v.getParticipant().getRole().name(),
                                    "cardValue", v.getCardValue()
                            )).toList()
                    )
            );
            return;
        }

        if (isDiscussion) {
            String participantName = sessionService.getParticipants(roomCode).stream()
                    .filter(p -> p.getId().equals(participantId))
                    .findFirst()
                    .map(p -> p.getName())
                    .orElse("");

            messagingTemplate.convertAndSend(
                    "/topic/session/" + roomCode,
                    Map.of(
                            "type", "DISCUSSION_UPDATE",
                            "participantId", participantId.toString(),
                            "participantName", participantName,
                            "cardValue", cardValue
                    )
            );
            return;
        }

        messagingTemplate.convertAndSend(
                "/topic/session/" + roomCode,
                Map.of(
                        "type", "VOTE_UPDATE",
                        "votedCount", votedCount,
                        "totalCount", totalParticipants,
                        "voterId", participantId.toString()
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
                                "participantRole", v.getParticipant().getRole().name(),
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
    // Einstellungen aktualisieren
    // ====================================

    @MessageMapping("/session/{roomCode}/settings")
    public void updateSettings(
            @DestinationVariable String roomCode,
            @Payload Map<String, Object> payload) {

        boolean showTopic = (boolean) payload.get("showTopic");
        boolean moderatorCanVote = (boolean) payload.get("moderatorCanVote");
        boolean autoReveal = (boolean) payload.get("autoReveal");

        sessionService.updateSettings(roomCode, showTopic, moderatorCanVote, autoReveal);

        messagingTemplate.convertAndSend(
                "/topic/session/" + roomCode,
                Map.of(
                        "type", "SETTINGS_UPDATE",
                        "showTopic", showTopic,
                        "moderatorCanVote", moderatorCanVote,
                        "autoReveal", autoReveal
                )
        );
    }

    // ====================================
    // Ticket hinzufügen (live)
    // ====================================

    @MessageMapping("/session/{roomCode}/ticket/add")
    public void addTicket(
            @DestinationVariable String roomCode,
            @Payload Map<String, String> payload) {

        String title = payload.get("title");
        Ticket ticket = sessionService.addTicket(roomCode, title);

        messagingTemplate.convertAndSend(
                "/topic/session/" + roomCode,
                Map.of(
                        "type", "TICKET_ADDED",
                        "id", ticket.getId().toString(),
                        "title", ticket.getTitle(),
                        "status", ticket.getStatus().name(),
                        "orderIndex", ticket.getOrderIndex()
                )
        );
    }

    // ====================================
    // Ticket auswählen
    // ====================================

    @MessageMapping("/session/{roomCode}/ticket/select")
    public void selectTicket(
            @DestinationVariable String roomCode,
            @Payload Map<String, String> payload) {

        Long ticketId = Long.parseLong(payload.get("ticketId"));
        Ticket ticket = sessionService.selectTicket(roomCode, ticketId);

        messagingTemplate.convertAndSend(
                "/topic/session/" + roomCode,
                Map.of(
                        "type", "TICKET_SELECTED",
                        "id", ticket.getId().toString(),
                        "title", ticket.getTitle()
                )
        );
    }
}