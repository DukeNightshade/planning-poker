package de.sivag.planningpoker.service;

import de.sivag.planningpoker.model.Participant;
import de.sivag.planningpoker.model.Session;
import de.sivag.planningpoker.model.Vote;
import de.sivag.planningpoker.model.Ticket;
import de.sivag.planningpoker.model.enums.SessionStatus;
import de.sivag.planningpoker.model.enums.TicketStatus;
import de.sivag.planningpoker.repository.ParticipantRepository;
import de.sivag.planningpoker.repository.TicketRepository;
import de.sivag.planningpoker.repository.VoteRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.OptionalDouble;

/**
 * Service für die Abstimmungslogik.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class VoteService {

    // ====================================
    // Abhängigkeiten
    // ====================================

    private final SessionService sessionService;
    private final ParticipantRepository participantRepository;
    private final VoteRepository        voteRepository;
    private final TicketRepository      ticketRepository;

    // ====================================
    // Business Logik Methoden
    // ====================================

    @Transactional
    public Vote submitVote(String roomCode, Long participantId,
                           String cardValue, boolean isDiscussion) {
        Session session = sessionService.getSessionByRoomCode(roomCode);
        if (!isDiscussion && session.getStatus() == SessionStatus.REVEALED) {
            throw new IllegalStateException("Karten bereits aufgedeckt.");
        }
        if (!session.getEstimationMethod().isValidCard(cardValue)) {
            throw new IllegalArgumentException("Ungültiger Kartenwert: " + cardValue);
        }

        Optional<Participant> participantOpt =
                participantRepository.findById(participantId);
        if (participantOpt.isEmpty()) {
            log.warn("Vote ignoriert – Teilnehmer {} nicht gefunden " +
                    "(veraltete SessionStorage?)", participantId);
            return null;
        }
        Participant participant = participantOpt.get();

        voteRepository.findBySessionRoomCodeAndParticipantId(roomCode, participantId)
                .ifPresent(existing -> {
                    voteRepository.delete(existing);
                    voteRepository.flush();
                });

        Vote vote = new Vote();
        vote.setSession(session);
        vote.setParticipant(participant);
        vote.setCardValue(cardValue);

        if (!isDiscussion) {
            session.setStatus(SessionStatus.VOTING);
        }

        Vote saved = voteRepository.save(vote);

        // Änderungen in der Diskussion fließen in die gespeicherte Schätzung ein
        if (isDiscussion && session.getStatus() == SessionStatus.REVEALED) {
            updateTicketEstimate(session, voteRepository.findBySessionRoomCodeWithParticipant(roomCode));
        }

        return saved;
    }

    @Transactional
    public List<Vote> revealCards(String roomCode) {
        Session session = sessionService.getSessionByRoomCode(roomCode);
        session.setStatus(SessionStatus.REVEALED);
        List<Vote> votes = voteRepository
                .findBySessionRoomCodeWithParticipant(roomCode);

        updateTicketEstimate(session, votes);

        return votes;
    }

    @Transactional
    public void resetRound(String roomCode) {
        Session session = sessionService.getSessionByRoomCode(roomCode);
        session.setStatus(SessionStatus.WAITING);
        voteRepository.deleteBySessionRoomCode(roomCode);
    }

    public List<Vote> getVotes(String roomCode) {
        return voteRepository.findBySessionRoomCode(roomCode);
    }

    public Optional<String> getOwnCardValue(String roomCode, Long participantId) {
        return voteRepository.findBySessionRoomCodeAndParticipantId(roomCode, participantId)
                .map(Vote::getCardValue);
    }

    public List<Long> getVotedParticipantIds(String roomCode) {
        return voteRepository.findParticipantIdsBySessionRoomCode(roomCode);
    }

    public List<Vote> getVotesWithParticipant(String roomCode) {
        return voteRepository.findBySessionRoomCodeWithParticipant(roomCode);
    }

    // ====================================
    // Utility Methoden
    // ====================================

    private void updateTicketEstimate(Session session, List<Vote> votes) {
        if (session.getCurrentTicketId() == null) return;
        ticketRepository.findById(session.getCurrentTicketId())
                .ifPresent(ticket -> saveEstimateToTicket(ticket, votes));
    }

    private void saveEstimateToTicket(Ticket ticket, List<Vote> votes) {
        OptionalDouble avg = votes.stream()
                .map(Vote::getCardValue)
                .filter(v -> v.matches("-?\\d+(\\.\\d+)?"))
                .mapToDouble(Double::parseDouble)
                .average();

        ticket.setFinalEstimate(avg.isPresent()
                ? formatDouble(avg.getAsDouble())
                : "–");
        ticket.setStatus(TicketStatus.VOTED);
        ticketRepository.save(ticket);
    }

    private String formatDouble(double value) {
        return value == Math.floor(value)
                ? String.valueOf((int) value)
                : String.format(Locale.US, "%.1f", value);
    }
}