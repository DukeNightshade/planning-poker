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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit-Tests für SessionService.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
@ExtendWith(MockitoExtension.class)
class SessionServiceTest {

    // ====================================
    // Mocks & Subject Under Test
    // ====================================

    @Mock
    private SessionRepository sessionRepository;

    @Mock
    private ParticipantRepository participantRepository;

    @Mock
    private TicketRepository ticketRepository;

    @InjectMocks
    private SessionService sessionService;

    // ====================================
    // Testdaten
    // ====================================

    private static final String BROWSER_ID = "test-browser-id-1234";

    private Session     testSession;
    private Participant testModerator;

    @BeforeEach
    void setUp() {
        testSession = new Session();
        testSession.setRoomCode("ABCD1234");
        testSession.setEstimationMethod(EstimationMethod.FIBONACCI);
        testSession.setStatus(SessionStatus.WAITING);

        testModerator = new Participant();
        testModerator.setId(1L);
        testModerator.setName("Max");
        testModerator.setRole(ParticipantRole.DEVELOPER);
        testModerator.setModerator(true);
        testModerator.setSession(testSession);
    }

    // ====================================
    // createSession()
    // ====================================

    @Test
    @DisplayName("createSession: Session wird korrekt erstellt")
    void createSession_success() {
        when(sessionRepository.existsByRoomCode(anyString())).thenReturn(false);
        when(sessionRepository.save(any(Session.class))).thenReturn(testSession);
        when(participantRepository.save(any(Participant.class))).thenReturn(testModerator);

        Session result = sessionService.createSession(
                "Max", EstimationMethod.FIBONACCI, ParticipantRole.DEVELOPER, BROWSER_ID);

        assertThat(result).isNotNull();
        verify(sessionRepository, times(1)).save(any(Session.class));
        verify(participantRepository, times(1)).save(any(Participant.class));
    }

    @Test
    @DisplayName("createSession: Raumcode wird neu generiert wenn bereits vorhanden")
    void createSession_roomCodeCollision_generatesNewCode() {
        when(sessionRepository.existsByRoomCode(anyString()))
                .thenReturn(true)
                .thenReturn(false);
        when(sessionRepository.save(any(Session.class))).thenReturn(testSession);
        when(participantRepository.save(any(Participant.class))).thenReturn(testModerator);

        sessionService.createSession(
                "Max", EstimationMethod.FIBONACCI, ParticipantRole.DEVELOPER, BROWSER_ID);

        verify(sessionRepository, times(2)).existsByRoomCode(anyString());
    }

    // ====================================
    // createSessionWithTickets()
    // ====================================

    @Test
    @DisplayName("createSessionWithTickets: Tickets werden angelegt und erstes Ticket als currentTicketId gesetzt")
    void createSessionWithTickets_success() {
        Ticket firstTicket = new Ticket();
        firstTicket.setId(10L);
        firstTicket.setTitle("Story A");

        when(sessionRepository.existsByRoomCode(anyString())).thenReturn(false);
        when(sessionRepository.save(any(Session.class))).thenReturn(testSession);
        when(participantRepository.save(any(Participant.class))).thenReturn(testModerator);
        when(ticketRepository.save(any(Ticket.class))).thenReturn(firstTicket);

        sessionService.createSessionWithTickets(
                "Max", EstimationMethod.FIBONACCI, ParticipantRole.DEVELOPER,
                List.of("Story A", "Story B"), BROWSER_ID);

        verify(ticketRepository, times(2)).save(any(Ticket.class));
    }

    @Test
    @DisplayName("createSessionWithTickets: Titel werden bereinigt, leere Titel übersprungen")
    void createSessionWithTickets_sanitizesTitles() {
        when(sessionRepository.existsByRoomCode(anyString())).thenReturn(false);
        when(sessionRepository.save(any(Session.class))).thenReturn(testSession);
        when(participantRepository.save(any(Participant.class))).thenReturn(testModerator);
        when(ticketRepository.save(any(Ticket.class))).thenAnswer(i -> i.getArgument(0));

        sessionService.createSessionWithTickets(
                "Max", EstimationMethod.FIBONACCI, ParticipantRole.DEVELOPER,
                List.of("  Story A  ", "   ", "x".repeat(300)), BROWSER_ID);

        ArgumentCaptor<Ticket> captor = ArgumentCaptor.forClass(Ticket.class);
        verify(ticketRepository, times(2)).save(captor.capture());
        assertThat(captor.getAllValues().get(0).getTitle()).isEqualTo("Story A");
        assertThat(captor.getAllValues().get(1).getTitle()).hasSize(255);
    }

    // ====================================
    // getVotingParticipants()
    // ====================================

    @Test
    @DisplayName("getVotingParticipants: Product Owner zählt nie, Moderator nur wenn er abstimmen darf")
    void getVotingParticipants_respectsModeratorCanVote() {
        Participant dev = new Participant();
        dev.setId(2L);
        dev.setRole(ParticipantRole.DEVELOPER);
        Participant po = new Participant();
        po.setId(3L);
        po.setRole(ParticipantRole.PRODUCT_OWNER);

        when(sessionRepository.findByRoomCode("ABCD1234")).thenReturn(Optional.of(testSession));
        when(participantRepository.findBySessionRoomCode("ABCD1234"))
                .thenReturn(List.of(testModerator, dev, po));

        testSession.setModeratorCanVote(true);
        assertThat(sessionService.getVotingParticipants("ABCD1234"))
                .containsExactly(testModerator, dev);

        testSession.setModeratorCanVote(false);
        assertThat(sessionService.getVotingParticipants("ABCD1234"))
                .containsExactly(dev);
    }

    // ====================================
    // joinSession()
    // ====================================

    @Test
    @DisplayName("joinSession: Teilnehmer tritt erfolgreich bei")
    void joinSession_success() {
        Participant newParticipant = new Participant();
        newParticipant.setId(2L);
        newParticipant.setName("Lisa");
        newParticipant.setRole(ParticipantRole.TESTER);

        when(sessionRepository.findByRoomCode("ABCD1234"))
                .thenReturn(Optional.of(testSession));
        when(participantRepository.findBySessionRoomCodeAndBrowserId("ABCD1234", BROWSER_ID))
                .thenReturn(Optional.empty());
        when(participantRepository.save(any(Participant.class)))
                .thenReturn(newParticipant);

        Participant result = sessionService.joinSession(
                "ABCD1234", "Lisa", ParticipantRole.TESTER, BROWSER_ID);

        assertThat(result.getName()).isEqualTo("Lisa");
        assertThat(result.getRole()).isEqualTo(ParticipantRole.TESTER);
    }

    @Test
    @DisplayName("joinSession: Reconnect – bestehender Teilnehmer wird zurückgegeben")
    void joinSession_reconnect_returnsExistingParticipant() {
        Participant existing = new Participant();
        existing.setId(2L);
        existing.setName("Lisa");
        existing.setRole(ParticipantRole.TESTER);
        existing.setBrowserId(BROWSER_ID);

        when(sessionRepository.findByRoomCode("ABCD1234"))
                .thenReturn(Optional.of(testSession));
        when(participantRepository.findBySessionRoomCodeAndBrowserId("ABCD1234", BROWSER_ID))
                .thenReturn(Optional.of(existing));
        when(participantRepository.save(any(Participant.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        Participant result = sessionService.joinSession(
                "ABCD1234", "Lisa", ParticipantRole.TESTER, BROWSER_ID);

        assertThat(result.getId()).isEqualTo(2L);
        verify(participantRepository, times(1)).save(existing);
    }

    @Test
    @DisplayName("joinSession: Wirft NoSuchElementException bei ungültigem Raumcode")
    void joinSession_invalidRoomCode_throwsException() {
        when(sessionRepository.findByRoomCode("INVALID"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                sessionService.joinSession("INVALID", "Lisa", ParticipantRole.DEVELOPER, BROWSER_ID))
                .isInstanceOf(NoSuchElementException.class);
    }

    @Test
    @DisplayName("joinSession: Wirft IllegalStateException wenn Session beendet")
    void joinSession_finishedSession_throwsException() {
        testSession.setStatus(SessionStatus.FINISHED);
        when(sessionRepository.findByRoomCode("ABCD1234"))
                .thenReturn(Optional.of(testSession));

        assertThatThrownBy(() ->
                sessionService.joinSession("ABCD1234", "Lisa", ParticipantRole.DEVELOPER, BROWSER_ID))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("bereits beendet");
    }

    @Test
    @DisplayName("joinSession: browserId null – neuer Teilnehmer wird angelegt ohne Reconnect-Prüfung")
    void joinSession_nullBrowserId_createsNewParticipant() {
        Participant newParticipant = new Participant();
        newParticipant.setId(3L);
        newParticipant.setName("Tom");

        when(sessionRepository.findByRoomCode("ABCD1234"))
                .thenReturn(Optional.of(testSession));
        when(participantRepository.save(any(Participant.class)))
                .thenReturn(newParticipant);

        Participant result = sessionService.joinSession(
                "ABCD1234", "Tom", ParticipantRole.DEVELOPER, null);

        assertThat(result.getId()).isEqualTo(3L);
        verify(participantRepository, never())
                .findBySessionRoomCodeAndBrowserId(any(), any());
    }

    // ====================================
    // promoteToModerator()
    // ====================================


    @Test
    @DisplayName("promoteToModerator: Teilnehmer darf sich selbst befördern")
    void promoteToModerator_self_success() {
        Participant lisa = participantInRoom(2L, "Lisa", false, testSession);

        when(participantRepository.findById(2L)).thenReturn(Optional.of(lisa));
        when(participantRepository.save(any(Participant.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        Participant result = sessionService.promoteToModerator("ABCD1234", lisa, 2L);

        assertThat(result.isModerator()).isTrue();
    }

    @Test
    @DisplayName("promoteToModerator: Moderator darf andere befördern")
    void promoteToModerator_byModerator_success() {
        Participant lisa = participantInRoom(2L, "Lisa", false, testSession);

        when(participantRepository.findById(2L)).thenReturn(Optional.of(lisa));
        when(participantRepository.save(any(Participant.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        assertThat(sessionService.promoteToModerator("ABCD1234", testModerator, 2L).isModerator())
                .isTrue();
    }

    @Test
    @DisplayName("promoteToModerator: Normaler Teilnehmer darf andere nicht befördern")
    void promoteToModerator_otherByNonModerator_forbidden() {
        Participant lisa = participantInRoom(2L, "Lisa", false, testSession);

        assertThatThrownBy(() -> sessionService.promoteToModerator("ABCD1234", lisa, 3L))
                .isInstanceOf(ForbiddenException.class);
        verify(participantRepository, never()).save(any());
    }

    @Test
    @DisplayName("promoteToModerator: Teilnehmer aus fremdem Raum wird nicht gefunden")
    void promoteToModerator_otherRoom_notFound() {
        Session otherSession = new Session();
        otherSession.setRoomCode("ZZZZ9999");
        Participant stranger = participantInRoom(5L, "Fremd", false, otherSession);

        when(participantRepository.findById(5L)).thenReturn(Optional.of(stranger));

        assertThatThrownBy(() -> sessionService.promoteToModerator("ABCD1234", testModerator, 5L))
                .isInstanceOf(NoSuchElementException.class);
        verify(participantRepository, never()).save(any());
    }

    @Test
    @DisplayName("promoteToModerator: Wirft NoSuchElementException bei unbekannter ID")
    void promoteToModerator_unknownId_throwsException() {
        when(participantRepository.findById(99L))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                sessionService.promoteToModerator("ABCD1234", testModerator, 99L))
                .isInstanceOf(NoSuchElementException.class);
    }

    // ====================================
    // demoteFromModerator()
    // ====================================

    @Test
    @DisplayName("demoteFromModerator: Letzter Moderator kann nicht demoted werden")
    void demoteFromModerator_lastModerator_throwsException() {
        when(participantRepository.findById(1L)).thenReturn(Optional.of(testModerator));
        when(participantRepository.findBySessionRoomCode("ABCD1234"))
                .thenReturn(List.of(testModerator));

        assertThatThrownBy(() ->
                sessionService.demoteFromModerator("ABCD1234", testModerator, 1L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("letzte Moderator");
    }

    @Test
    @DisplayName("demoteFromModerator: Moderator wird erfolgreich demoted wenn mehrere vorhanden")
    void demoteFromModerator_multipleModerators_success() {
        Participant secondModerator = participantInRoom(2L, "Lisa", true, testSession);

        when(participantRepository.findBySessionRoomCode("ABCD1234"))
                .thenReturn(List.of(testModerator, secondModerator));
        when(participantRepository.findById(1L))
                .thenReturn(Optional.of(testModerator));
        when(participantRepository.save(any(Participant.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        Participant result = sessionService.demoteFromModerator("ABCD1234", testModerator, 1L);

        assertThat(result.isModerator()).isFalse();
    }

    @Test
    @DisplayName("demoteFromModerator: Normaler Teilnehmer darf Moderator nicht demoten")
    void demoteFromModerator_byNonModerator_forbidden() {
        Participant lisa = participantInRoom(2L, "Lisa", false, testSession);

        assertThatThrownBy(() -> sessionService.demoteFromModerator("ABCD1234", lisa, 1L))
                .isInstanceOf(ForbiddenException.class);
    }

    // ====================================
    // authenticate() / requireModerator()
    // ====================================

    @Test
    @DisplayName("authenticate: Gültiges Token liefert den Teilnehmer")
    void authenticate_validToken_returnsParticipant() {
        when(participantRepository.findBySessionRoomCodeAndToken("ABCD1234", "tok"))
                .thenReturn(Optional.of(testModerator));

        assertThat(sessionService.authenticate("ABCD1234", "tok")).isSameAs(testModerator);
    }

    @Test
    @DisplayName("authenticate: Fehlendes oder unbekanntes Token wird abgelehnt")
    void authenticate_missingOrUnknownToken_forbidden() {
        when(participantRepository.findBySessionRoomCodeAndToken("ABCD1234", "falsch"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> sessionService.authenticate("ABCD1234", null))
                .isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> sessionService.authenticate("ABCD1234", "falsch"))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("requireModerator: Normaler Teilnehmer wird abgelehnt")
    void requireModerator_nonModerator_forbidden() {
        Participant lisa = participantInRoom(2L, "Lisa", false, testSession);
        when(participantRepository.findBySessionRoomCodeAndToken("ABCD1234", "tok"))
                .thenReturn(Optional.of(lisa));

        assertThatThrownBy(() -> sessionService.requireModerator("ABCD1234", "tok"))
                .isInstanceOf(ForbiddenException.class);
    }

    private static Participant participantInRoom(Long id, String name, boolean moderator, Session session) {
        Participant p = new Participant();
        p.setId(id);
        p.setName(name);
        p.setRole(ParticipantRole.DEVELOPER);
        p.setModerator(moderator);
        p.setSession(session);
        return p;
    }

    // ====================================
    // getSessionByRoomCode()
    // ====================================

    @Test
    @DisplayName("getSessionByRoomCode: Gibt Session zurück bei gültigem Code")
    void getSessionByRoomCode_success() {
        when(sessionRepository.findByRoomCode("ABCD1234"))
                .thenReturn(Optional.of(testSession));

        Session result = sessionService.getSessionByRoomCode("ABCD1234");

        assertThat(result.getRoomCode()).isEqualTo("ABCD1234");
    }

    @Test
    @DisplayName("getSessionByRoomCode: Wirft NoSuchElementException bei unbekanntem Code")
    void getSessionByRoomCode_unknown_throwsException() {
        when(sessionRepository.findByRoomCode("UNKNOWN"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                sessionService.getSessionByRoomCode("UNKNOWN"))
                .isInstanceOf(NoSuchElementException.class)
                .hasMessageContaining("UNKNOWN");
    }

    // ====================================
    // removeParticipant()
    // ====================================

    @Test
    @DisplayName("removeParticipant: Teilnehmer wird erfolgreich entfernt und Name zurückgegeben")
    void removeParticipant_success() {
        when(participantRepository.findById(1L))
                .thenReturn(Optional.of(testModerator));

        String name = sessionService.removeParticipant(1L);

        assertThat(name).isEqualTo("Max");
        verify(participantRepository, times(1)).delete(testModerator);
    }

    @Test
    @DisplayName("removeParticipant: Wirft NoSuchElementException bei unbekannter ID")
    void removeParticipant_unknownId_throwsException() {
        when(participantRepository.findById(99L))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                sessionService.removeParticipant(99L))
                .isInstanceOf(NoSuchElementException.class);
    }
}