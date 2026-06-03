package de.sivag.planningpoker.service;

import de.sivag.planningpoker.model.Participant;
import de.sivag.planningpoker.model.Session;
import de.sivag.planningpoker.model.Ticket;
import de.sivag.planningpoker.model.enums.EstimationMethod;
import de.sivag.planningpoker.model.enums.ParticipantRole;
import de.sivag.planningpoker.model.enums.SessionStatus;
import de.sivag.planningpoker.repository.ParticipantRepository;
import de.sivag.planningpoker.repository.SessionRepository;
import de.sivag.planningpoker.repository.TicketRepository;
import de.sivag.planningpoker.utility.StringUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;

/**
 * Service für den Session-Lifecycle.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SessionService {

    // ====================================
    // Konstanten
    // ====================================

    private static final String PARTICIPANT_NOT_FOUND = "Teilnehmer nicht gefunden.";

    // ====================================
    // Statische Variablen
    // ====================================

    private static final String CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final int    CODE_LENGTH = 8;
    private static final SecureRandom RANDOM = new SecureRandom();

    // ====================================
    // Abhängigkeiten
    // ====================================

    private final SessionRepository     sessionRepository;
    private final ParticipantRepository participantRepository;
    private final TicketRepository      ticketRepository;

    // ====================================
    // Business Logik Methoden
    // ====================================

    @Transactional
    public Session createSession(String moderatorName, EstimationMethod method,
                                 ParticipantRole moderatorRole, String browserId) {
        return buildSession(moderatorName, method, moderatorRole, browserId);
    }

    @Transactional
    public Session createSessionWithTickets(String moderatorName, EstimationMethod method,
                                            ParticipantRole moderatorRole,
                                            List<String> ticketTitles, String browserId) {
        Session session = buildSession(moderatorName, method, moderatorRole, browserId);
        session.setShowTopic(true);

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

    @Transactional
    public Participant joinSession(String roomCode, String participantName,
                                   ParticipantRole role, String browserId) {
        Session session = getSessionByRoomCode(roomCode);

        if (session.getStatus() == SessionStatus.FINISHED) {
            throw new IllegalStateException("Session ist bereits beendet.");
        }

        String cleanedName = StringUtils.sanitizeName(participantName);

        // Reconnect: bestehenden Teilnehmer mit gleicher Browser-ID zurückgeben
        if (browserId != null) {
            Optional<Participant> existing = participantRepository
                    .findBySessionRoomCodeAndBrowserId(roomCode, browserId);
            if (existing.isPresent()) {
                Participant p = existing.get();
                p.setName(cleanedName);
                p.setRole(role);
                log.info("Reconnect: Bestehender Teilnehmer gefunden: name={}, roomCode={}",
                        p.getName(), roomCode);
                return participantRepository.save(p);
            }
        }

        // Duplikat-Prüfung
        if (participantRepository.existsBySessionRoomCodeAndName(roomCode, cleanedName)) {
            throw new IllegalStateException(
                    "Der Name \"" + cleanedName + "\" ist in dieser Session bereits vergeben.");
        }

        Participant participant = new Participant();
        participant.setName(cleanedName);
        participant.setRole(role);
        participant.setBrowserId(browserId);
        participant.setSession(session);

        return participantRepository.save(participant);
    }

    @Transactional
    public String removeParticipant(Long participantId) {
        Participant participant = participantRepository.findById(participantId)
                .orElseThrow(() -> new NoSuchElementException(
                        PARTICIPANT_NOT_FOUND));

        String name = participant.getName();
        participantRepository.delete(participant);
        return name;
    }

    @Transactional
    public void updateSettings(String roomCode, boolean showTopic,
                               boolean moderatorCanVote, boolean autoReveal) {
        Session session = getSessionByRoomCode(roomCode);
        session.setShowTopic(showTopic);
        session.setModeratorCanVote(moderatorCanVote);
        session.setAutoReveal(autoReveal);
        sessionRepository.save(session);
    }

    @Transactional
    public Participant promoteToModerator(Long participantId) {
        Participant participant = participantRepository.findById(participantId)
                .orElseThrow(() -> new NoSuchElementException(PARTICIPANT_NOT_FOUND));
        participant.setModerator(true);
        return participantRepository.save(participant);
    }

    @Transactional
    public Participant demoteFromModerator(String roomCode, Long participantId) {
        long moderatorCount = participantRepository.findBySessionRoomCode(roomCode)
                .stream()
                .filter(Participant::isModerator)
                .count();

        if (moderatorCount <= 1) {
            throw new IllegalStateException(
                    "Der letzte Moderator kann nicht demoted werden.");
        }

        Participant participant = participantRepository.findById(participantId)
                .orElseThrow(() -> new NoSuchElementException(PARTICIPANT_NOT_FOUND));
        participant.setModerator(false);
        return participantRepository.save(participant);
    }

    // ====================================
    // Query Methoden
    // ====================================

    public Session getSessionByRoomCode(String roomCode) {
        return sessionRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new NoSuchElementException(
                        "Session mit Raumcode " + roomCode + " nicht gefunden."));
    }

    public List<Participant> getParticipants(String roomCode) {
        return participantRepository.findBySessionRoomCode(roomCode);
    }

    // ====================================
    // Utility Methoden
    // ====================================

    private Session buildSession(String moderatorName, EstimationMethod method,
                                 ParticipantRole moderatorRole, String browserId) {
        Session session = new Session();
        session.setRoomCode(generateUniqueRoomCode());
        session.setEstimationMethod(method);
        sessionRepository.save(session);

        Participant moderator = new Participant();
        moderator.setName(StringUtils.sanitizeName(moderatorName));
        moderator.setRole(moderatorRole);
        moderator.setModerator(true);
        moderator.setBrowserId(browserId);
        moderator.setSession(session);
        participantRepository.save(moderator);

        return session;
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