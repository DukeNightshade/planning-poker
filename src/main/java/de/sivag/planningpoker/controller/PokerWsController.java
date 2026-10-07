package de.sivag.planningpoker.controller;

import de.sivag.planningpoker.config.WebSocketSessionRegistry;
import de.sivag.planningpoker.exception.ForbiddenException;
import de.sivag.planningpoker.model.Participant;
import de.sivag.planningpoker.model.Session;
import de.sivag.planningpoker.model.Ticket;
import de.sivag.planningpoker.model.Vote;
import de.sivag.planningpoker.service.SessionService;
import de.sivag.planningpoker.service.TicketService;
import de.sivag.planningpoker.service.VoteService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.Header;
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
@Slf4j
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
    private static final String TOKEN_HEADER     = "participant-token";

    // ====================================
    // Abhängigkeiten
    // ====================================

    private final SessionService           sessionService;
    private final VoteService              voteService;
    private final TicketService            ticketService;
    private final SimpMessagingTemplate    messagingTemplate;
    private final WebSocketSessionRegistry sessionRegistry;

    // ====================================
    // WebSocket Endpunkte
    // ====================================

    @MessageMapping("/session/{roomCode}/register")
    public void register(
            @DestinationVariable String roomCode,
            @Header(name = TOKEN_HEADER, required = false) String token,
            SimpMessageHeaderAccessor headerAccessor) {

        // Veraltetes Token (Teilnehmer nach Grace Period entfernt) ist hier kein Fehler:
        // der Client tritt danach ohnehin per browserId neu bei und registriert sich erneut
        Long participantId;
        try {
            participantId = sessionService.authenticate(roomCode, token).getId();
        } catch (ForbiddenException e) {
            log.debug("Register ignoriert: {} (roomCode={})", e.getMessage(), roomCode);
            return;
        }
        String wsSessionId = headerAccessor.getSessionId();

        sessionRegistry.register(wsSessionId, roomCode, participantId);

        boolean wasReconnect = sessionRegistry.cancelRemoval(participantId);
        if (wasReconnect) {
            log.info("Reconnect innerhalb Grace Period: participantId={}, roomCode={}",
                    participantId, roomCode);
        }
    }

    @MessageMapping("/session/{roomCode}/vote")
    public void submitVote(
            @DestinationVariable String roomCode,
            @Header(name = TOKEN_HEADER, required = false) String token,
            @Payload Map<String, String> payload) {

        // Abgestimmt wird immer als der Teilnehmer hinter dem Token, nie per Payload-ID
        Participant voter         = sessionService.authenticate(roomCode, token);
        Long        participantId = voter.getId();
        String      cardValue     = payload.get(CARD_VALUE);
        boolean     isDiscussion  = Boolean.parseBoolean(
                payload.getOrDefault("isDiscussion", "false"));

        Vote vote = voteService.submitVote(roomCode, participantId, cardValue, isDiscussion);
        if (vote == null) return;

        if (isDiscussion) {
            broadcast(roomCode, Map.of(
                    "type",           "DISCUSSION_UPDATE",
                    PARTICIPANT_ID,   participantId.toString(),
                    PARTICIPANT_NAME, voter.getName(),
                    CARD_VALUE,       cardValue
            ));
            return;
        }

        // Teilnehmer in der Grace Period (Verbindung getrennt) zählen nicht mit
        List<Long> votingIds = sessionService.getVotingParticipants(roomCode)
                .stream()
                .map(Participant::getId)
                .filter(id -> !sessionRegistry.isRemovalPending(id))
                .toList();
        List<Long> votedIds = voteService.getVotedParticipantIds(roomCode);

        int     totalParticipants = votingIds.size();
        int     votedCount        = (int) votingIds.stream().filter(votedIds::contains).count();
        Session session           = sessionService.getSessionByRoomCode(roomCode);

        if (session.isAutoReveal() && totalParticipants > 0 && votedCount >= totalParticipants) {
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
    public void revealCards(
            @DestinationVariable String roomCode,
            @Header(name = TOKEN_HEADER, required = false) String token) {

        sessionService.requireModerator(roomCode, token);
        broadcastReveal(roomCode, voteService.revealCards(roomCode));
    }

    @MessageMapping("/session/{roomCode}/reset")
    public void resetRound(
            @DestinationVariable String roomCode,
            @Header(name = TOKEN_HEADER, required = false) String token) {

        sessionService.requireModerator(roomCode, token);
        voteService.resetRound(roomCode);
        broadcast(roomCode, Map.of("type", "RESET"));
    }

    @MessageMapping("/session/{roomCode}/settings")
    public void updateSettings(
            @DestinationVariable String roomCode,
            @Header(name = TOKEN_HEADER, required = false) String token,
            @Payload Map<String, Object> payload) {

        sessionService.requireModerator(roomCode, token);
        Session current = sessionService.getSessionByRoomCode(roomCode);

        boolean showTopic        = flag(payload, "showTopic",        current.isShowTopic());
        boolean moderatorCanVote = flag(payload, "moderatorCanVote", current.isModeratorCanVote());
        boolean autoReveal       = flag(payload, "autoReveal",       current.isAutoReveal());
        boolean showOnlyTotal    = flag(payload, "showOnlyTotal",    current.isShowOnlyTotal());

        sessionService.updateSettings(roomCode, showTopic, moderatorCanVote, autoReveal, showOnlyTotal);

        broadcast(roomCode, Map.of(
                "type",             "SETTINGS_UPDATE",
                "showTopic",        showTopic,
                "moderatorCanVote", moderatorCanVote,
                "autoReveal",       autoReveal,
                "showOnlyTotal",    showOnlyTotal
        ));
    }

    @MessageMapping("/session/{roomCode}/ticket/add")
    public void addTicket(
            @DestinationVariable String roomCode,
            @Header(name = TOKEN_HEADER, required = false) String token,
            @Payload Map<String, String> payload) {

        sessionService.requireModerator(roomCode, token);
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
            @Header(name = TOKEN_HEADER, required = false) String token,
            @Payload Map<String, String> payload) {

        sessionService.requireModerator(roomCode, token);
        Ticket ticket = ticketService.selectTicket(
                roomCode, Long.parseLong(payload.get("ticketId")));

        broadcast(roomCode, Map.of(
                "type",   "TICKET_SELECTED",
                "id",     ticket.getId().toString(),
                TITLE,    ticket.getTitle(),
                "status", ticket.getStatus().name()
        ));
    }

    // ====================================
    // Hilfsmethoden
    // ====================================

    private static boolean flag(Map<String, Object> payload, String key, boolean fallback) {
        Object value = payload.get(key);
        return value instanceof Boolean b ? b : fallback;
    }

    private void broadcast(String roomCode, Map<String, ?> message) {
        messagingTemplate.convertAndSend(TOPIC_SESSION + roomCode, message);
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