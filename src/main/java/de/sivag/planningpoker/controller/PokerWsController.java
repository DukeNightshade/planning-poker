package de.sivag.planningpoker.controller;

import de.sivag.planningpoker.config.WebSocketSessionRegistry;
import de.sivag.planningpoker.exception.ForbiddenException;
import de.sivag.planningpoker.model.Participant;
import de.sivag.planningpoker.model.Session;
import de.sivag.planningpoker.model.Ticket;
import de.sivag.planningpoker.model.Vote;
import de.sivag.planningpoker.service.RevealService;
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

import java.util.Map;

import static de.sivag.planningpoker.utility.ApiConstants.*;

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

    private static final String CARD_VALUE       = "cardValue";
    private static final String TITLE            = "title";

    // ====================================
    // Abhängigkeiten
    // ====================================

    private final SessionService           sessionService;
    private final VoteService              voteService;
    private final TicketService            ticketService;
    private final SimpMessagingTemplate    messagingTemplate;
    private final WebSocketSessionRegistry sessionRegistry;
    private final RevealService            revealService;

    // ====================================
    // WebSocket Endpunkte
    // ====================================

    @MessageMapping("/session/{roomCode}/register")
    public void register(
            @DestinationVariable String roomCode,
            @Header(name = WS_TOKEN_HEADER, required = false) String token,
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
            @Header(name = WS_TOKEN_HEADER, required = false) String token,
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

        if (revealService.revealIfComplete(roomCode)) return;

        RevealService.VoteCount count = revealService.countVotes(roomCode);
        broadcast(roomCode, Map.of(
                "type",       "VOTE_UPDATE",
                "votedCount", count.voted(),
                "totalCount", count.total(),
                "voterId",    participantId.toString()
        ));
    }

    @MessageMapping("/session/{roomCode}/reveal")
    public void revealCards(
            @DestinationVariable String roomCode,
            @Header(name = WS_TOKEN_HEADER, required = false) String token) {

        sessionService.requireModerator(roomCode, token);
        revealService.reveal(roomCode);
    }

    @MessageMapping("/session/{roomCode}/reset")
    public void resetRound(
            @DestinationVariable String roomCode,
            @Header(name = WS_TOKEN_HEADER, required = false) String token) {

        sessionService.requireModerator(roomCode, token);
        voteService.resetRound(roomCode);
        broadcast(roomCode, Map.of("type", "RESET"));
    }

    @MessageMapping("/session/{roomCode}/settings")
    public void updateSettings(
            @DestinationVariable String roomCode,
            @Header(name = WS_TOKEN_HEADER, required = false) String token,
            @Payload Map<String, Object> payload) {

        sessionService.requireModerator(roomCode, token);
        Session current = sessionService.getSessionByRoomCode(roomCode);

        boolean showTopic        = flag(payload, "showTopic",        current.isShowTopic());
        boolean moderatorCanVote = flag(payload, "moderatorCanVote", current.isModeratorCanVote());
        boolean autoReveal       = flag(payload, "autoReveal",       current.isAutoReveal());
        boolean showOnlyTotal    = flag(payload, "showOnlyTotal",    current.isShowOnlyTotal());

        sessionService.updateSettings(roomCode, showTopic, moderatorCanVote, autoReveal, showOnlyTotal);

        // Dürfen Moderatoren nicht mehr abstimmen, zählen ihre bisherigen Stimmen nicht
        if (!moderatorCanVote) {
            voteService.removeModeratorVotes(roomCode);
        }

        broadcast(roomCode, Map.of(
                "type",             "SETTINGS_UPDATE",
                "showTopic",        showTopic,
                "moderatorCanVote", moderatorCanVote,
                "autoReveal",       autoReveal,
                "showOnlyTotal",    showOnlyTotal
        ));

        // Weniger Stimmberechtigte oder Auto-Reveal neu an: evtl. haben jetzt alle abgestimmt
        revealService.revealIfComplete(roomCode);
    }

    @MessageMapping("/session/{roomCode}/ticket/add")
    public void addTicket(
            @DestinationVariable String roomCode,
            @Header(name = WS_TOKEN_HEADER, required = false) String token,
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
            @Header(name = WS_TOKEN_HEADER, required = false) String token,
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

    /**
     * Nimmt einen Teilnehmer vom Tisch: Moderatoren dürfen andere entfernen,
     * jeder darf selbst gehen. Für den Raum sieht es aus wie ein normales Verlassen.
     */
    @MessageMapping("/session/{roomCode}/participant/remove")
    public void removeFromTable(
            @DestinationVariable String roomCode,
            @Header(name = WS_TOKEN_HEADER, required = false) String token,
            @Payload Map<String, String> payload) {

        Participant caller   = sessionService.authenticate(roomCode, token);
        Long        targetId = Long.parseLong(payload.get(PARTICIPANT_ID));

        String name = sessionService.removeFromTable(roomCode, caller, targetId);
        sessionRegistry.cancelRemoval(targetId);

        broadcast(roomCode, Map.of(
                "type",           "PLAYER_LEFT",
                PARTICIPANT_ID,   targetId.toString(),
                PARTICIPANT_NAME, name
        ));

        // Weniger Stimmberechtigte: evtl. haben jetzt alle abgestimmt
        revealService.revealIfComplete(roomCode);
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
}