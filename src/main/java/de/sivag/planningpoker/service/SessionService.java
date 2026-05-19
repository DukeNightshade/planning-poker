package de.sivag.planningpoker.service;

import de.sivag.planningpoker.model.*;
import de.sivag.planningpoker.model.enums.ParticipantRole;
import de.sivag.planningpoker.model.enums.SessionStatus;
import de.sivag.planningpoker.model.enums.EstimationMethod;
import de.sivag.planningpoker.model.enums.TicketStatus;
import de.sivag.planningpoker.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.OptionalDouble;

@Service
@RequiredArgsConstructor
public class SessionService {

    private final SessionRepository sessionRepository;
    private final ParticipantRepository participantRepository;
    private final VoteRepository voteRepository;
    private final TicketRepository ticketRepository;

    private static final String CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final int CODE_LENGTH = 8;
    private static final SecureRandom RANDOM = new SecureRandom();

    // ====================================
    // Session erstellen
    // ====================================

    @Transactional
    public Session createSession(String moderatorName, EstimationMethod method) {
        Session session = new Session();
        session.setRoomCode(generateUniqueRoomCode());
        session.setEstimationMethod(method);

        sessionRepository.save(session);

        Participant moderator = new Participant();
        moderator.setName(moderatorName);
        moderator.setRole(ParticipantRole.MODERATOR);
        moderator.setSession(session);
        participantRepository.save(moderator);

        return session;
    }

    // ====================================
    // Session erstellen mit Tickets
    // ====================================

    @Transactional
    public Session createSessionWithTickets(String moderatorName, EstimationMethod method, List<String> ticketTitles) {
        Session session = createSession(moderatorName, method);

        Ticket firstTicket = null;
        for (int i = 0; i < ticketTitles.size(); i++) {
            Ticket ticket = new Ticket();
            ticket.setTitle(ticketTitles.get(i));
            ticket.setSession(session);
            ticket.setOrderIndex(i);
            Ticket saved = ticketRepository.save(ticket);
            if (i == 0) firstTicket = saved;
        }

        if (firstTicket != null) {
            session.setCurrentTicketId(firstTicket.getId());
            sessionRepository.save(session);
        }

        return session;
    }

    // ====================================
    // Session beitreten
    // ====================================

    @Transactional
    public Participant joinSession(String roomCode, String participantName) {
        Session session = getSessionByRoomCode(roomCode);

        if (session.getStatus() == SessionStatus.FINISHED) {
            throw new IllegalStateException("Session ist bereits beendet.");
        }

        Participant participant = new Participant();
        participant.setName(participantName);
        participant.setRole(ParticipantRole.PARTICIPANT);
        participant.setSession(session);

        return participantRepository.save(participant);
    }

    // ====================================
    // Abstimmung
    // ====================================

    @Transactional
    public Vote submitVote(String roomCode, Long participantId, String cardValue, boolean isDiscussion) {
        Session session = getSessionByRoomCode(roomCode);

        if (!isDiscussion && session.getStatus() == SessionStatus.REVEALED) {
            throw new IllegalStateException("Karten bereits aufgedeckt.");
        }

        Participant participant = participantRepository.findById(participantId)
                .orElseThrow(() -> new NoSuchElementException("Teilnehmer nicht gefunden."));

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
            sessionRepository.save(session);
        }

        return voteRepository.save(vote);
    }

    // ====================================
    // Karten aufdecken
    // ====================================

    @Transactional
    public List<Vote> revealCards(String roomCode) {
        Session session = getSessionByRoomCode(roomCode);
        session.setStatus(SessionStatus.REVEALED);
        sessionRepository.save(session);

        List<Vote> votes = voteRepository.findBySessionRoomCodeWithParticipant(roomCode);

        // Durchschnitt berechnen und in aktivem Ticket speichern
        if (session.getCurrentTicketId() != null) {
            ticketRepository.findById(session.getCurrentTicketId()).ifPresent(ticket -> {
                OptionalDouble avg = votes.stream()
                        .map(Vote::getCardValue)
                        .filter(v -> v.matches("-?\\d+(\\.\\d+)?"))
                        .mapToDouble(Double::parseDouble)
                        .average();

                if (avg.isPresent()) {
                    double result = avg.getAsDouble();
                    ticket.setFinalEstimate(
                            result == Math.floor(result)
                                    ? String.valueOf((int) result)
                                    : String.format("%.1f", result)
                    );
                } else {
                    ticket.setFinalEstimate("–");
                }

                ticket.setStatus(TicketStatus.VOTED);
                ticketRepository.save(ticket);
            });
        }

        return votes;
    }

    // ====================================
    // Neue Runde
    // ====================================

    @Transactional
    public void resetRound(String roomCode) {
        Session session = getSessionByRoomCode(roomCode);
        session.setStatus(SessionStatus.WAITING);
        sessionRepository.save(session);
        voteRepository.deleteBySessionRoomCode(roomCode);
    }

    // ====================================
    // Ticket hinzufügen
    // ====================================

    @Transactional
    public Ticket addTicket(String roomCode, String title) {
        Session session = getSessionByRoomCode(roomCode);

        int nextIndex = ticketRepository.countBySessionRoomCode(roomCode);

        Ticket ticket = new Ticket();
        ticket.setTitle(title);
        ticket.setSession(session);
        ticket.setOrderIndex(nextIndex);

        return ticketRepository.save(ticket);
    }

    // ====================================
    // Ticket auswählen
    // ====================================

    @Transactional
    public Ticket selectTicket(String roomCode, Long ticketId) {
        Session session = getSessionByRoomCode(roomCode);

        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new NoSuchElementException("Ticket nicht gefunden."));

        session.setCurrentTicketId(ticketId);
        session.setStatus(SessionStatus.WAITING);
        sessionRepository.save(session);

        voteRepository.deleteBySessionRoomCode(roomCode);

        return ticket;
    }

    // ====================================
    // Tickets abrufen
    // ====================================

    public List<Ticket> getTickets(String roomCode) {
        return ticketRepository.findBySessionRoomCodeOrderByOrderIndex(roomCode);
    }

    // ====================================
    // Topic aktualisieren
    // ====================================

    @Transactional
    public void updateTopic(String roomCode, String topic) {
        Session session = getSessionByRoomCode(roomCode);
        // topic wird jetzt über Tickets verwaltet – diese Methode bleibt
        // als Fallback für den WebSocket-Handler erhalten
    }

    // ====================================
    // Session beenden
    // ====================================

    @Transactional
    public void endSession(String roomCode) {
        Session session = getSessionByRoomCode(roomCode);
        session.setStatus(SessionStatus.FINISHED);
        sessionRepository.save(session);
    }

    // ====================================
    // Einstellungen updaten
    // ====================================

    @Transactional
    public void updateSettings(String roomCode, boolean showTopic, boolean moderatorCanVote, boolean autoReveal) {
        Session session = getSessionByRoomCode(roomCode);
        session.setShowTopic(showTopic);
        session.setModeratorCanVote(moderatorCanVote);
        session.setAutoReveal(autoReveal);
        sessionRepository.save(session);
    }

    // ====================================
    // Hilfsmethoden
    // ====================================

    public Session getSessionByRoomCode(String roomCode) {
        return sessionRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new NoSuchElementException(
                        "Session mit Raumcode " + roomCode + " nicht gefunden."));
    }

    public List<Participant> getParticipants(String roomCode) {
        return participantRepository.findBySessionRoomCode(roomCode);
    }

    public List<Vote> getVotes(String roomCode) {
        return voteRepository.findBySessionRoomCode(roomCode);
    }

    private String generateUniqueRoomCode() {
        String code;
        do {
            code = generateRoomCode();
        } while (sessionRepository.existsByRoomCode(code));
        return code;
    }

    private String generateRoomCode() {
        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            sb.append(CODE_CHARS.charAt(RANDOM.nextInt(CODE_CHARS.length())));
        }
        return sb.toString();
    }
}