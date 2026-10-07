package de.sivag.planningpoker.service;

import de.sivag.planningpoker.exception.ForbiddenException;
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

    private static final String       CODE_CHARS  = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final int          CODE_LENGTH = 8;
    private static final SecureRandom RANDOM      = new SecureRandom();

    // ====================================
    // Abhängigkeiten
    // ====================================

    private final SessionRepository     sessionRepository;
    private final ParticipantRepository participantRepository;
    private final TicketRepository      ticketRepository;

    // ====================================
    // Business Logik Methoden
    // ====================================

    /**
     * @param teamName optional: macht die Session zum permanenten Team-Raum (/team/{name})
     */
    @Transactional
    public Session createSession(String moderatorName, EstimationMethod method,
                                 ParticipantRole moderatorRole, String browserId, String teamName) {
        return buildSession(moderatorName, method, moderatorRole, browserId, teamName);
    }

    @Transactional
    public Session createSessionWithTickets(String moderatorName, EstimationMethod method,
                                            ParticipantRole moderatorRole,
                                            List<String> ticketTitles, String browserId,
                                            String teamName) {
        Session session = buildSession(moderatorName, method, moderatorRole, browserId, teamName);
        session.setShowTopic(true);

        List<String> titles = ticketTitles.stream()
                .filter(t -> t != null && !t.isBlank())
                .map(StringUtils::sanitizeTicketTitle)
                .toList();

        Ticket firstTicket = null;
        for (int i = 0; i < titles.size(); i++) {
            Ticket ticket = new Ticket();
            ticket.setTitle(titles.get(i));
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
        session.touch();

        if (session.getStatus() == SessionStatus.FINISHED) {
            throw new IllegalStateException("Session ist bereits beendet.");
        }

        String cleanedName = StringUtils.sanitizeName(participantName);

        if (browserId != null) {
            Optional<Participant> existing = participantRepository
                    .findBySessionRoomCodeAndBrowserId(roomCode, browserId);
            if (existing.isPresent()) {
                Participant p = existing.get();
                p.setName(cleanedName);
                p.setRole(role);
                p.setPresent(true);
                log.info("Reconnect: Bestehender Teilnehmer gefunden: name={}, roomCode={}",
                        p.getName(), roomCode);
                return participantRepository.save(p);
            }
        }

        Optional<Participant> sameName = participantRepository
                .findBySessionRoomCodeAndName(roomCode, cleanedName);
        if (sameName.isPresent()) {
            Participant p = sameName.get();
            // Team-Raum, neues Gerät: abwesendes Mitglied mit gleichem Namen übernimmt seinen Platz
            if (session.isTeamRoom() && !p.isPresent()) {
                p.setBrowserId(browserId);
                p.setRole(role);
                p.setPresent(true);
                log.info("Team-Mitglied übernimmt Platz: name={}, team={}", p.getName(), session.getTeamName());
                return participantRepository.save(p);
            }
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

    /** Ergebnis, wenn die Verbindung eines Teilnehmers endgültig weg ist. */
    public record Departure(String name, boolean keptAsAbsent) {}

    /**
     * Verbindung nach der Grace Period nicht zurück: in Team-Räumen wird der Teilnehmer
     * als abwesend gemerkt (Stimme der laufenden Runde verfällt), sonst gelöscht.
     */
    @Transactional
    public Departure handleConnectionLost(Long participantId) {
        Participant participant = participantRepository.findById(participantId)
                .orElseThrow(() -> new NoSuchElementException(PARTICIPANT_NOT_FOUND));

        if (participant.getSession().isTeamRoom()) {
            participant.setPresent(false);
            participant.getVotes().clear();
            return new Departure(participant.getName(), true);
        }
        participantRepository.delete(participant);
        return new Departure(participant.getName(), false);
    }

    /**
     * Markiert einen Team-Teilnehmer wieder als anwesend (z. B. nach Neustart des Servers).
     *
     * @return true, wenn er vorher abwesend war
     */
    @Transactional
    public boolean markPresent(Long participantId) {
        return participantRepository.findById(participantId)
                .filter(p -> !p.isPresent())
                .map(p -> { p.setPresent(true); return true; })
                .orElse(false);
    }

    @Transactional
    public String removeParticipant(Long participantId) {
        Participant participant = participantRepository.findById(participantId)
                .orElseThrow(() -> new NoSuchElementException(PARTICIPANT_NOT_FOUND));

        String name = participant.getName();
        participantRepository.delete(participant);
        return name;
    }

    /**
     * Nimmt einen Teilnehmer vom Tisch (inkl. seiner Stimme). Erlaubt für sich
     * selbst oder durch einen Moderator, nur innerhalb des eigenen Raums.
     *
     * In Team-Räumen wird, wer selbst geht, nur als abwesend markiert.
     *
     * @return Name und ob der Teilnehmer als abwesend gemerkt bleibt
     */
    @Transactional
    public Departure removeFromTable(String roomCode, Participant caller, Long participantId) {
        requireSelfOrModerator(caller, participantId);
        Participant participant = getParticipantInRoom(roomCode, participantId);
        participant.getSession().touch();

        // Team-Raum, selbst gegangen: "für heute" – bleibt als abwesend gemerkt
        if (participant.getSession().isTeamRoom() && caller.getId().equals(participantId)) {
            participant.setPresent(false);
            participant.getVotes().clear();
            return new Departure(participant.getName(), true);
        }

        participantRepository.delete(participant);
        return new Departure(participant.getName(), false);
    }

    @Transactional
    public void updateSettings(String roomCode, boolean showTopic,
                               boolean moderatorCanVote, boolean autoReveal,
                               boolean showOnlyTotal) {
        Session session = getSessionByRoomCode(roomCode);
        session.touch();
        session.setShowTopic(showTopic);
        session.setModeratorCanVote(moderatorCanVote);
        session.setAutoReveal(autoReveal);
        session.setShowOnlyTotal(showOnlyTotal);
        sessionRepository.save(session);
    }

    /**
     * Befördert einen Teilnehmer. Erlaubt für sich selbst oder durch einen Moderator.
     */
    @Transactional
    public Participant promoteToModerator(String roomCode, Participant caller, Long participantId) {
        requireSelfOrModerator(caller, participantId);
        Participant participant = getParticipantInRoom(roomCode, participantId);
        participant.setModerator(true);
        return participantRepository.save(participant);
    }

    /**
     * Entzieht Moderator-Rechte. Erlaubt für sich selbst oder durch einen Moderator.
     */
    @Transactional
    public Participant demoteFromModerator(String roomCode, Participant caller, Long participantId) {
        requireSelfOrModerator(caller, participantId);
        Participant participant = getParticipantInRoom(roomCode, participantId);

        long moderatorCount = participantRepository.findBySessionRoomCode(roomCode)
                .stream()
                .filter(Participant::isModerator)
                .count();

        if (moderatorCount <= 1) {
            throw new IllegalStateException(
                    "Der letzte Moderator kann nicht demoted werden.");
        }

        participant.setModerator(false);
        return participantRepository.save(participant);
    }

    // ====================================
    // Berechtigungen
    // ====================================

    /**
     * Ermittelt den Teilnehmer zu einem Token innerhalb des Raums.
     *
     * @throws ForbiddenException wenn das Token fehlt oder nicht zum Raum gehört
     */
    public Participant authenticate(String roomCode, String token) {
        if (token == null || token.isBlank()) {
            throw new ForbiddenException("Kein Teilnehmer-Token übermittelt.");
        }
        return participantRepository.findBySessionRoomCodeAndToken(roomCode, token)
                .orElseThrow(() -> new ForbiddenException("Ungültiges Teilnehmer-Token."));
    }

    /**
     * Wie {@link #authenticate}, verlangt zusätzlich Moderator-Rechte.
     */
    public Participant requireModerator(String roomCode, String token) {
        Participant participant = authenticate(roomCode, token);
        if (!participant.isModerator()) {
            throw new ForbiddenException("Nur Moderatoren dürfen diese Aktion ausführen.");
        }
        return participant;
    }

    private void requireSelfOrModerator(Participant caller, Long participantId) {
        if (!caller.getId().equals(participantId) && !caller.isModerator()) {
            throw new ForbiddenException("Nur Moderatoren dürfen andere Teilnehmer ändern.");
        }
    }

    private Participant getParticipantInRoom(String roomCode, Long participantId) {
        return participantRepository.findById(participantId)
                .filter(p -> p.getSession().getRoomCode().equals(roomCode))
                .orElseThrow(() -> new NoSuchElementException(PARTICIPANT_NOT_FOUND));
    }

    // ====================================
    // Query Methoden
    // ====================================

    public Session getSessionByRoomCode(String roomCode) {
        return sessionRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new NoSuchElementException(
                        "Session mit Raumcode " + roomCode + " nicht gefunden."));
    }

    public boolean sessionExists(String roomCode) {
        return sessionRepository.existsByRoomCode(roomCode);
    }

    public boolean teamRoomExists(String teamName) {
        return sessionRepository.existsByTeamName(teamName);
    }

    public Session getSessionByTeamName(String teamName) {
        return sessionRepository.findByTeamName(teamName.toLowerCase())
                .orElseThrow(() -> new NoSuchElementException(
                        "Team-Raum " + teamName + " nicht gefunden."));
    }

    public List<Participant> getParticipants(String roomCode) {
        return participantRepository.findBySessionRoomCode(roomCode);
    }

    public List<Participant> getVotingParticipants(String roomCode) {
        boolean moderatorCanVote = getSessionByRoomCode(roomCode).isModeratorCanVote();
        return participantRepository.findBySessionRoomCode(roomCode)
                .stream()
                .filter(Participant::isPresent)
                .filter(p -> p.getRole() != ParticipantRole.PRODUCT_OWNER)
                .filter(p -> moderatorCanVote || !p.isModerator())
                .toList();
    }

    // ====================================
    // Utility Methoden
    // ====================================

    private Session buildSession(String moderatorName, EstimationMethod method,
                                 ParticipantRole moderatorRole, String browserId,
                                 String teamName) {
        Session session = new Session();
        session.setRoomCode(generateUniqueRoomCode());
        session.setEstimationMethod(method);
        if (teamName != null && !teamName.isBlank()) {
            String cleanedTeamName = StringUtils.sanitizeTeamName(teamName);
            if (sessionRepository.existsByTeamName(cleanedTeamName)) {
                throw new IllegalStateException(
                        "Der Team-Name \"" + cleanedTeamName + "\" ist bereits vergeben.");
            }
            session.setTeamName(cleanedTeamName);
        }
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