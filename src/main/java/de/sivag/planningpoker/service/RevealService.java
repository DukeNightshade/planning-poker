package de.sivag.planningpoker.service;

import de.sivag.planningpoker.config.WebSocketSessionRegistry;
import de.sivag.planningpoker.model.Participant;
import de.sivag.planningpoker.model.Session;
import de.sivag.planningpoker.model.Vote;
import de.sivag.planningpoker.model.enums.SessionStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

import static de.sivag.planningpoker.utility.ApiConstants.*;

/**
 * Zählt Stimmen und deckt bei aktivem Auto-Reveal auf, sobald alle
 * Stimmberechtigten abgestimmt haben. Wird nach Stimmen, Einstellungsänderungen
 * und wenn jemand den Tisch verlässt aufgerufen.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
@Service
@RequiredArgsConstructor
public class RevealService {

    // ====================================
    // Abhängigkeiten
    // ====================================

    private final SessionService           sessionService;
    private final VoteService              voteService;
    private final WebSocketSessionRegistry sessionRegistry;
    private final SimpMessagingTemplate    messagingTemplate;

    // ====================================
    // Business Logik Methoden
    // ====================================

    public record VoteCount(int voted, int total) {}

    /** Zählt abgegebene Stimmen der Stimmberechtigten; getrennte Teilnehmer (Grace Period) zählen nicht. */
    public VoteCount countVotes(String roomCode) {
        List<Long> votingIds = sessionService.getVotingParticipants(roomCode)
                .stream()
                .map(Participant::getId)
                .filter(id -> !sessionRegistry.isRemovalPending(id))
                .toList();
        List<Long> votedIds = voteService.getVotedParticipantIds(roomCode);
        return new VoteCount((int) votingIds.stream().filter(votedIds::contains).count(), votingIds.size());
    }

    /** Deckt bei aktivem Auto-Reveal auf, sobald alle Stimmberechtigten abgestimmt haben. */
    public boolean revealIfComplete(String roomCode) {
        Session session = sessionService.getSessionByRoomCode(roomCode);
        if (!session.isAutoReveal() || session.getStatus() == SessionStatus.REVEALED) return false;

        VoteCount count = countVotes(roomCode);
        if (count.total() == 0 || count.voted() < count.total()) return false;

        reveal(roomCode);
        return true;
    }

    /** Deckt die Karten auf und sendet das Ergebnis an den Raum. */
    public void reveal(String roomCode) {
        List<Vote> votes = voteService.revealCards(roomCode);
        messagingTemplate.convertAndSend(TOPIC_SESSION + roomCode, Map.of(
                "type",  "REVEAL",
                "votes", votes.stream().map(v -> Map.of(
                        PARTICIPANT_NAME, v.getParticipant().getName(),
                        PARTICIPANT_ROLE, v.getParticipant().getRole().name(),
                        "cardValue",      v.getCardValue()
                )).toList()
        ));
    }
}
