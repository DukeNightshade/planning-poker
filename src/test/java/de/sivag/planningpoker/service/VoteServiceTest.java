package de.sivag.planningpoker.service;

import de.sivag.planningpoker.model.Participant;
import de.sivag.planningpoker.model.Session;
import de.sivag.planningpoker.model.Ticket;
import de.sivag.planningpoker.model.Vote;
import de.sivag.planningpoker.model.enums.EstimationMethod;
import de.sivag.planningpoker.model.enums.ParticipantRole;
import de.sivag.planningpoker.model.enums.SessionStatus;
import de.sivag.planningpoker.model.enums.TicketStatus;
import de.sivag.planningpoker.repository.ParticipantRepository;
import de.sivag.planningpoker.repository.TicketRepository;
import de.sivag.planningpoker.repository.VoteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit-Tests für VoteService.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
@ExtendWith(MockitoExtension.class)
class VoteServiceTest {

    // ====================================
    // Mocks & Subject Under Test
    // ====================================

    @Mock private SessionService        sessionService;
    @Mock private ParticipantRepository participantRepository;
    @Mock private VoteRepository        voteRepository;
    @Mock private TicketRepository      ticketRepository;

    @InjectMocks
    private VoteService voteService;

    // ====================================
    // Testdaten
    // ====================================

    private Session     testSession;
    private Participant testParticipant;
    private Vote        testVote;

    @BeforeEach
    void setUp() {
        testSession = new Session();
        testSession.setRoomCode("ABCD1234");
        testSession.setEstimationMethod(EstimationMethod.FIBONACCI);
        testSession.setStatus(SessionStatus.WAITING);

        testParticipant = new Participant();
        testParticipant.setId(1L);
        testParticipant.setName("Max");
        testParticipant.setRole(ParticipantRole.DEVELOPER);

        testVote = new Vote();
        testVote.setId(1L);
        testVote.setCardValue("5");
        testVote.setSession(testSession);
        testVote.setParticipant(testParticipant);
    }

    // ====================================
    // submitVote()
    // ====================================

    @Test
    @DisplayName("submitVote: Vote wird erfolgreich gespeichert")
    void submitVote_success() {
        when(sessionService.getSessionByRoomCode("ABCD1234"))
                .thenReturn(testSession);
        when(participantRepository.findById(1L))
                .thenReturn(Optional.of(testParticipant));
        when(voteRepository.findBySessionRoomCodeAndParticipantId("ABCD1234", 1L))
                .thenReturn(Optional.empty());
        when(voteRepository.save(any(Vote.class)))
                .thenReturn(testVote);

        Vote result = voteService.submitVote("ABCD1234", 1L, "5", false);

        assertThat(result.getCardValue()).isEqualTo("5");
        verify(voteRepository, times(1)).save(any(Vote.class));
    }

    @Test
    @DisplayName("submitVote: Vorhandener Vote wird überschrieben")
    void submitVote_existingVote_isReplaced() {
        when(sessionService.getSessionByRoomCode("ABCD1234"))
                .thenReturn(testSession);
        when(participantRepository.findById(1L))
                .thenReturn(Optional.of(testParticipant));
        when(voteRepository.findBySessionRoomCodeAndParticipantId("ABCD1234", 1L))
                .thenReturn(Optional.of(testVote));
        when(voteRepository.save(any(Vote.class))).thenReturn(testVote);

        voteService.submitVote("ABCD1234", 1L, "8", false);

        verify(voteRepository, times(1)).delete(testVote);
        verify(voteRepository, times(1)).flush();
        verify(voteRepository, times(1)).save(any(Vote.class));
    }

    @Test
    @DisplayName("submitVote: Wirft IllegalStateException wenn Karten bereits aufgedeckt")
    void submitVote_alreadyRevealed_throwsException() {
        testSession.setStatus(SessionStatus.REVEALED);
        when(sessionService.getSessionByRoomCode("ABCD1234"))
                .thenReturn(testSession);

        assertThatThrownBy(() ->
                voteService.submitVote("ABCD1234", 1L, "5", false))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("bereits aufgedeckt");
    }

    @Test
    @DisplayName("submitVote: Im Diskussionsmodus wird REVEALED-Status ignoriert")
    void submitVote_discussionMode_allowsVoteWhenRevealed() {
        testSession.setStatus(SessionStatus.REVEALED);
        when(sessionService.getSessionByRoomCode("ABCD1234"))
                .thenReturn(testSession);
        when(participantRepository.findById(1L))
                .thenReturn(Optional.of(testParticipant));
        when(voteRepository.findBySessionRoomCodeAndParticipantId(any(), any()))
                .thenReturn(Optional.empty());
        when(voteRepository.save(any(Vote.class))).thenReturn(testVote);

        assertThatNoException().isThrownBy(() ->
                voteService.submitVote("ABCD1234", 1L, "8", true));
    }

    // ====================================
    // revealCards()
    // ====================================

    @Test
    @DisplayName("revealCards: Session-Status wird auf REVEALED gesetzt")
    void revealCards_setsStatusToRevealed() {
        when(sessionService.getSessionByRoomCode("ABCD1234"))
                .thenReturn(testSession);
        when(voteRepository.findBySessionRoomCodeWithParticipant("ABCD1234"))
                .thenReturn(List.of(testVote));

        voteService.revealCards("ABCD1234");

        assertThat(testSession.getStatus()).isEqualTo(SessionStatus.REVEALED);
    }

    @Test
    @DisplayName("revealCards: FinalEstimate wird korrekt berechnet (ganzzahlig)")
    void revealCards_calculatesIntegerEstimate() {
        Ticket ticket = new Ticket();
        ticket.setId(1L);
        ticket.setTitle("Story A");
        ticket.setStatus(TicketStatus.OPEN);

        testSession.setCurrentTicketId(1L);

        Vote vote1 = new Vote();
        vote1.setCardValue("5");
        vote1.setParticipant(testParticipant);

        Participant p2 = new Participant();
        p2.setId(2L);
        p2.setRole(ParticipantRole.DEVELOPER);
        Vote vote2 = new Vote();
        vote2.setCardValue("3");
        vote2.setParticipant(p2);

        when(sessionService.getSessionByRoomCode("ABCD1234"))
                .thenReturn(testSession);
        when(voteRepository.findBySessionRoomCodeWithParticipant("ABCD1234"))
                .thenReturn(List.of(vote1, vote2));
        when(ticketRepository.findById(1L))
                .thenReturn(Optional.of(ticket));
        when(ticketRepository.save(any())).thenReturn(ticket);

        voteService.revealCards("ABCD1234");

        assertThat(ticket.getFinalEstimate()).isEqualTo("4");
        assertThat(ticket.getStatus()).isEqualTo(TicketStatus.VOTED);
    }

    @Test
    @DisplayName("revealCards: FinalEstimate wird korrekt berechnet (Dezimal)")
    void revealCards_calculatesDecimalEstimate() {
        Ticket ticket = new Ticket();
        ticket.setId(1L);
        ticket.setStatus(TicketStatus.OPEN);
        testSession.setCurrentTicketId(1L);

        Vote vote1 = new Vote();
        vote1.setCardValue("5");
        vote1.setParticipant(testParticipant);

        Participant p2 = new Participant();
        p2.setId(2L);
        p2.setRole(ParticipantRole.DEVELOPER);
        Vote vote2 = new Vote();
        vote2.setCardValue("8");
        vote2.setParticipant(p2);

        when(sessionService.getSessionByRoomCode("ABCD1234"))
                .thenReturn(testSession);
        when(voteRepository.findBySessionRoomCodeWithParticipant("ABCD1234"))
                .thenReturn(List.of(vote1, vote2));
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(ticket));
        when(ticketRepository.save(any())).thenReturn(ticket);

        voteService.revealCards("ABCD1234");

        assertThat(ticket.getFinalEstimate()).isEqualTo("6.5");
    }

    @Test
    @DisplayName("revealCards: Nicht-numerische Karten werden ignoriert")
    void revealCards_nonNumericCards_ignored() {
        Ticket ticket = new Ticket();
        ticket.setId(1L);
        ticket.setStatus(TicketStatus.OPEN);
        testSession.setCurrentTicketId(1L);

        Vote voteQuestion = new Vote();
        voteQuestion.setCardValue("?");
        voteQuestion.setParticipant(testParticipant);

        Participant p2 = new Participant();
        p2.setId(2L);
        p2.setRole(ParticipantRole.DEVELOPER);
        Vote voteCoffee = new Vote();
        voteCoffee.setCardValue("☕");
        voteCoffee.setParticipant(p2);

        when(sessionService.getSessionByRoomCode("ABCD1234"))
                .thenReturn(testSession);
        when(voteRepository.findBySessionRoomCodeWithParticipant("ABCD1234"))
                .thenReturn(List.of(voteQuestion, voteCoffee));
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(ticket));
        when(ticketRepository.save(any())).thenReturn(ticket);

        voteService.revealCards("ABCD1234");

        assertThat(ticket.getFinalEstimate()).isEqualTo("–");
    }

    // ====================================
    // resetRound()
    // ====================================

    @Test
    @DisplayName("resetRound: Status wird auf WAITING gesetzt und Votes gelöscht")
    void resetRound_resetsStatusAndDeletesVotes() {
        testSession.setStatus(SessionStatus.REVEALED);
        when(sessionService.getSessionByRoomCode("ABCD1234"))
                .thenReturn(testSession);

        voteService.resetRound("ABCD1234");

        assertThat(testSession.getStatus()).isEqualTo(SessionStatus.WAITING);
        verify(voteRepository, times(1)).deleteBySessionRoomCode("ABCD1234");
    }
}