package de.sivag.planningpoker.controller;

import de.sivag.planningpoker.config.WebSocketSessionRegistry;
import de.sivag.planningpoker.model.Participant;
import de.sivag.planningpoker.model.Session;
import de.sivag.planningpoker.model.Ticket;
import de.sivag.planningpoker.model.Vote;
import de.sivag.planningpoker.service.SessionService;
import de.sivag.planningpoker.service.TicketService;
import de.sivag.planningpoker.service.VoteService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.List;
import java.util.Map;

/**
 * WebSocket-Controller für Echtzeit-Kommunikation.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
@Controller
@RequiredArgsConstructor
public class PokerWsController {

    // ====================================
    // Konstanten
    // ====================================

    private static final String TOPIC_SESSION    = "/topic/session/";
    private static final String PARTICIPANT_ID   = "participantId";
    private static final String PARTICIPANT_NAME = "participantName";
    private static final String CARD_VALUE       = "cardValue";
    private static final String TITLE            = "title";

    // ====================================
    // Abhängigkeiten
    // ====================================

    private final SessionService            sessionService;
    private final VoteService               voteService;
    private final TicketService             ticketService;
    private final SimpMessagingTemplate     messagingTemplate;
    private final WebSocketSessionRegistry  sessionRegistry;

    // ====================================
    // WebSocket Endpunkte
    // ====================================
    @MessageMapping("/session/{roomCode}/register")
    public void register(
            @DestinationVariable String roomCode,
            @Payload Map<String, String> payload,
            SimpMessageHeaderAccessor headerAccessor) {

        String raw = payload.get(PARTICIPANT_ID);
        if (raw == null) return;

        Long participantId = Long.parseLong(raw);
        String wsSessionId = headerAccessor.getSessionId();

        sessionRegistry.register(wsSessionId, roomCode, participantId);
    }

    @MessageMapping("/session/{roomCode}/vote")
    public void submitVote(
            @DestinationVariable String roomCode,
            @Payload Map<String, String> payload,
            SimpMessageHeaderAccessor headerAccessor) {

        Long    participantId = Long.parseLong(payload.get(PARTICIPANT_ID));
        String  cardValue     = payload.get(CARD_VALUE);
        boolean isDiscussion  = Boolean.parseBoolean(
                payload.getOrDefault("isDiscussion", "false"));

        Map<String, Object> sessionAttributes = headerAccessor.getSessionAttributes();
        if (sessionAttributes != null) {
            sessionAttributes.put("roomCode",     roomCode);
            sessionAttributes.put(PARTICIPANT_ID, participantId);
        }

        Vote vote = voteService.submitVote(
                roomCode, participantId, cardValue, isDiscussion);

        if (vote == null) return;

        if (isDiscussion) {
            String participantName = sessionService.getParticipants(roomCode)
                    .stream()
                    .filter(p -> p.getId().equals(participantId))
                    .findFirst()
                    .map(Participant::getName)
                    .orElse("");

            broadcast(roomCode, Map.of(
                    "type",          "DISCUSSION_UPDATE",
                    PARTICIPANT_ID,   participantId.toString(),
                    PARTICIPANT_NAME, participantName,
                    CARD_VALUE,       cardValue
            ));
            return;
        }

        int     totalParticipants = sessionService.getParticipants(roomCode).size();
        int     votedCount        = voteService.getVotes(roomCode).size();
        Session session           = sessionService.getSessionByRoomCode(roomCode);

        if (session.isAutoReveal() && votedCount >= totalParticipants) {
            broadcastReveal(roomCode, voteService.revealCards(roomCode));
            return;
        }

        broadcast(roomCode, Map.of(
                "type",       "VOTE_UPDATE",
                "votedCount", votedCount,
                "totalCount", totalParticipants,
                "voterId",    participantId.toString()
        ));
    }

    @MessageMapping("/session/{roomCode}/reveal")
    public void revealCards(@DestinationVariable String roomCode) {
        broadcastReveal(roomCode, voteService.revealCards(roomCode));
    }

    @MessageMapping("/session/{roomCode}/reset")
    public void resetRound(@DestinationVariable String roomCode) {
        voteService.resetRound(roomCode);
        broadcast(roomCode, Map.of("type", "RESET"));
    }

    @MessageMapping("/session/{roomCode}/settings")
    public void updateSettings(
            @DestinationVariable String roomCode,
            @Payload Map<String, Object> payload) {

        boolean showTopic        = (boolean) payload.get("showTopic");
        boolean moderatorCanVote = (boolean) payload.get("moderatorCanVote");
        boolean autoReveal       = (boolean) payload.get("autoReveal");

        sessionService.updateSettings(roomCode, showTopic, moderatorCanVote, autoReveal);

        broadcast(roomCode, Map.of(
                "type",             "SETTINGS_UPDATE",
                "showTopic",        showTopic,
                "moderatorCanVote", moderatorCanVote,
                "autoReveal",       autoReveal
        ));
    }

    @MessageMapping("/session/{roomCode}/ticket/add")
    public void addTicket(
            @DestinationVariable String roomCode,
            @Payload Map<String, String> payload) {

        Ticket ticket = ticketService.addTicket(roomCode, payload.get(TITLE));

        broadcast(roomCode, Map.of(
                "type",       "TICKET_ADDED",
                "id",         ticket.getId().toString(),
                TITLE,        ticket.getTitle(),
                "status",     ticket.getStatus().name(),
                "orderIndex", ticket.getOrderIndex()
        ));
    }

    @MessageMapping("/session/{roomCode}/ticket/select")
    public void selectTicket(
            @DestinationVariable String roomCode,
            @Payload Map<String, String> payload) {

        Ticket ticket = ticketService.selectTicket(
                roomCode, Long.parseLong(payload.get("ticketId")));

        broadcast(roomCode, Map.of(
                "type",  "TICKET_SELECTED",
                "id",    ticket.getId().toString(),
                TITLE,   ticket.getTitle()
        ));
    }

    // ====================================
    // Utility Methoden
    // ====================================

    private void broadcast(String roomCode, Map<String, ?> message) {
        messagingTemplate.convertAndSend(
                TOPIC_SESSION + roomCode, message);
    }

    private void broadcastReveal(String roomCode, List<Vote> votes) {
        broadcast(roomCode, Map.of(
                "type",  "REVEAL",
                "votes", votes.stream().map(v -> Map.of(
                        PARTICIPANT_NAME,  v.getParticipant().getName(),
                        "participantRole", v.getParticipant().getRole().name(),
                        CARD_VALUE,        v.getCardValue()
                )).toList()
        ));
    }
}