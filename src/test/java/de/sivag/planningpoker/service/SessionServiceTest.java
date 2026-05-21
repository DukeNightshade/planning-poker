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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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

    private Session testSession;
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
                "Max", EstimationMethod.FIBONACCI, ParticipantRole.DEVELOPER);

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
                "Max", EstimationMethod.FIBONACCI, ParticipantRole.DEVELOPER);

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
                List.of("Story A", "Story B"));

        verify(ticketRepository, times(2)).save(any(Ticket.class));
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
        when(participantRepository.save(any(Participant.class)))
                .thenReturn(newParticipant);

        Participant result = sessionService.joinSession(
                "ABCD1234", "Lisa", ParticipantRole.TESTER);

        assertThat(result.getName()).isEqualTo("Lisa");
        assertThat(result.getRole()).isEqualTo(ParticipantRole.TESTER);
    }

    @Test
    @DisplayName("joinSession: Wirft NoSuchElementException bei ungültigem Raumcode")
    void joinSession_invalidRoomCode_throwsException() {
        when(sessionRepository.findByRoomCode("INVALID"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                sessionService.joinSession("INVALID", "Lisa", ParticipantRole.DEVELOPER))
                .isInstanceOf(NoSuchElementException.class);
    }

    @Test
    @DisplayName("joinSession: Wirft IllegalStateException wenn Session beendet")
    void joinSession_finishedSession_throwsException() {
        testSession.setStatus(SessionStatus.FINISHED);
        when(sessionRepository.findByRoomCode("ABCD1234"))
                .thenReturn(Optional.of(testSession));

        assertThatThrownBy(() ->
                sessionService.joinSession("ABCD1234", "Lisa", ParticipantRole.DEVELOPER))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("bereits beendet");
    }

    // ====================================
    // promoteToModerator()
    // ====================================

    @Test
    @DisplayName("promoteToModerator: Teilnehmer wird korrekt befördert")
    void promoteToModerator_success() {
        Participant participant = new Participant();
        participant.setId(2L);
        participant.setName("Lisa");
        participant.setModerator(false);

        when(participantRepository.findById(2L))
                .thenReturn(Optional.of(participant));
        when(participantRepository.save(any(Participant.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        Participant result = sessionService.promoteToModerator(2L);

        assertThat(result.isModerator()).isTrue();
    }

    @Test
    @DisplayName("promoteToModerator: Wirft NoSuchElementException bei unbekannter ID")
    void promoteToModerator_unknownId_throwsException() {
        when(participantRepository.findById(99L))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                sessionService.promoteToModerator(99L))
                .isInstanceOf(NoSuchElementException.class);
    }

    // ====================================
    // demoteFromModerator()
    // ====================================

    @Test
    @DisplayName("demoteFromModerator: Letzter Moderator kann nicht demoted werden")
    void demoteFromModerator_lastModerator_throwsException() {
        when(participantRepository.findBySessionRoomCode("ABCD1234"))
                .thenReturn(List.of(testModerator));

        assertThatThrownBy(() ->
                sessionService.demoteFromModerator("ABCD1234", 1L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("letzte Moderator");
    }

    @Test
    @DisplayName("demoteFromModerator: Moderator wird erfolgreich demoted wenn mehrere vorhanden")
    void demoteFromModerator_multipleModerators_success() {
        Participant secondModerator = new Participant();
        secondModerator.setId(2L);
        secondModerator.setName("Lisa");
        secondModerator.setModerator(true);

        when(participantRepository.findBySessionRoomCode("ABCD1234"))
                .thenReturn(List.of(testModerator, secondModerator));
        when(participantRepository.findById(1L))
                .thenReturn(Optional.of(testModerator));
        when(participantRepository.save(any(Participant.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        Participant result = sessionService.demoteFromModerator("ABCD1234", 1L);

        assertThat(result.isModerator()).isFalse();
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

        String name = sessionService.removeParticipant( 1L);

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