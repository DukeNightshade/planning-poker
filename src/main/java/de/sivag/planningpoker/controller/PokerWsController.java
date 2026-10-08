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
        Participant participant;
        try {
            participant = sessionService.authenticate(roomCode, token);
        } catch (ForbiddenException e) {
            log.debug("Register ignoriert: {} (roomCode={})", e.getMessage(), roomCode);
            return;
        }
        Long   participantId = participant.getId();
        String wsSessionId   = headerAccessor.getSessionId();

        sessionRegistry.register(wsSessionId, roomCode, participantId);

        boolean wasReconnect = sessionRegistry.cancelRemoval(participantId);
        if (wasReconnect) {
            log.info("Reconnect innerhalb Grace Period: participantId={}, roomCode={}",
                    participantId, roomCode);
        }

        // Team-Raum: wer als abwesend galt (z. B. nach Server-Neustart), ist wieder da
        if (sessionService.markPresent(participantId)) {
            broadcast(roomCode, playerJoined(participant));
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
        boolean poCanVote        = flag(payload, "productOwnerCanVote", current.isProductOwnerCanVote());
        boolean autoReveal       = flag(payload, "autoReveal",       current.isAutoReveal());
        boolean showOnlyTotal    = flag(payload, "showOnlyTotal",    current.isShowOnlyTotal());

        sessionService.updateSettings(roomCode, showTopic, poCanVote, autoReveal, showOnlyTotal);

        // Dürfen Product Owner nicht mehr mitwählen, zählen ihre bisherigen Stimmen nicht
        if (!poCanVote) {
            voteService.removeProductOwnerVotes(roomCode);
        }

        broadcast(roomCode, Map.of(
                "type",             "SETTINGS_UPDATE",
                "showTopic",        showTopic,
                "productOwnerCanVote", poCanVote,
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

        SessionService.Departure departure = sessionService.removeFromTable(roomCode, caller, targetId);
        sessionRegistry.cancelRemoval(targetId);

        broadcast(roomCode, Map.of(
                "type",           departure.keptAsAbsent() ? "PLAYER_AWAY" : "PLAYER_LEFT",
                PARTICIPANT_ID,   targetId.toString(),
                PARTICIPANT_NAME, departure.name()
        ));

        // Weniger Stimmberechtigte: evtl. haben jetzt alle abgestimmt
        revealService.revealIfComplete(roomCode);
    }

    // ====================================
    // Hilfsmethoden
    // ====================================

    /** Gleiche Nachricht wie beim REST-Join, damit Clients beide Wege gleich behandeln. */
    static Map<String, Object> playerJoined(Participant participant) {
        return Map.of(
                "type",           "PLAYER_JOINED",
                PARTICIPANT_ID,   participant.getId().toString(),
                PARTICIPANT_NAME, participant.getName(),
                PARTICIPANT_ROLE, participant.getRole().name(),
                "moderator",      participant.isModerator()
        );
    }

    private static boolean flag(Map<String, Object> payload, String key, boolean fallback) {
        Object value = payload.get(key);
        return value instanceof Boolean b ? b : fallback;
    }

    private void broadcast(String roomCode, Map<String, ?> message) {
        messagingTemplate.convertAndSend(TOPIC_SESSION + roomCode, message);
    }
}