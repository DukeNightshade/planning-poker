package de.sivag.planningpoker.service;

import de.sivag.planningpoker.model.*;
import de.sivag.planningpoker.model.enums.ParticipantRole;
import de.sivag.planningpoker.model.enums.SessionStatus;
import de.sivag.planningpoker.model.enums.EstimationMethod;
import de.sivag.planningpoker.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.List;
import java.util.NoSuchElementException;

@Service
@RequiredArgsConstructor
public class SessionService {

    private final SessionRepository sessionRepository;
    private final ParticipantRepository participantRepository;
    private final VoteRepository voteRepository;

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
    public Vote submitVote(String roomCode, Long participantId, String cardValue) {
        Session session = getSessionByRoomCode(roomCode);
        Participant participant = participantRepository.findById(participantId)
                .orElseThrow(() -> new NoSuchElementException("Teilnehmer nicht gefunden."));

        // Vorhandenen Vote überschreiben falls vorhanden
        voteRepository.findBySessionRoomCodeAndParticipantId(roomCode, participantId)
                .ifPresent(voteRepository::delete);

        Vote vote = new Vote();
        vote.setSession(session);
        vote.setParticipant(participant);
        vote.setCardValue(cardValue);

        session.setStatus(SessionStatus.VOTING);
        sessionRepository.save(session);

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
        return voteRepository.findBySessionRoomCodeWithParticipant(roomCode);
    }

    // ====================================
    // Neue Runde
    // ====================================

    @Transactional
    public void resetRound(String roomCode) {
        Session session = getSessionByRoomCode(roomCode);
        session.setStatus(SessionStatus.WAITING);
        session.setTopic(null);
        sessionRepository.save(session);
        voteRepository.deleteBySessionRoomCode(roomCode);
    }

    // ====================================
    // Topic aktualisieren
    // ====================================

    @Transactional
    public void updateTopic(String roomCode, String topic) {
        Session session = getSessionByRoomCode(roomCode);
        session.setTopic(topic);
        sessionRepository.save(session);
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