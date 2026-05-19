package de.sivag.planningpoker.service;

import de.sivag.planningpoker.model.Session;
import de.sivag.planningpoker.model.Ticket;
import de.sivag.planningpoker.model.enums.EstimationMethod;
import de.sivag.planningpoker.model.enums.SessionStatus;
import de.sivag.planningpoker.model.enums.TicketStatus;
import de.sivag.planningpoker.repository.SessionRepository;
import de.sivag.planningpoker.repository.TicketRepository;
import de.sivag.planningpoker.repository.VoteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.NoSuchElementException;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit-Tests für TicketService.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
@ExtendWith(MockitoExtension.class)
class TicketServiceTest {

    // ====================================
    // Mocks & Subject Under Test
    // ====================================

    @Mock private SessionRepository sessionRepository;
    @Mock private TicketRepository  ticketRepository;
    @Mock private VoteRepository    voteRepository;

    @InjectMocks
    private TicketService ticketService;

    // ====================================
    // Testdaten
    // ====================================

    private Session testSession;
    private Ticket  testTicket;

    @BeforeEach
    void setUp() {
        testSession = new Session();
        testSession.setRoomCode("ABCD1234");
        testSession.setEstimationMethod(EstimationMethod.FIBONACCI);
        testSession.setStatus(SessionStatus.WAITING);

        testTicket = new Ticket();
        testTicket.setId(1L);
        testTicket.setTitle("Login implementieren");
        testTicket.setStatus(TicketStatus.OPEN);
        testTicket.setOrderIndex(0);
        testTicket.setSession(testSession);
    }

    // ====================================
    // addTicket()
    // ====================================

    @Test
    @DisplayName("addTicket: Ticket wird erfolgreich hinzugefügt")
    void addTicket_success() {
        when(sessionRepository.findByRoomCode("ABCD1234"))
                .thenReturn(Optional.of(testSession));
        when(ticketRepository.countBySessionRoomCode("ABCD1234"))
                .thenReturn(0);
        when(ticketRepository.save(any(Ticket.class)))
                .thenReturn(testTicket);

        Ticket result = ticketService.addTicket("ABCD1234", "Login implementieren");

        assertThat(result.getTitle()).isEqualTo("Login implementieren");
        assertThat(result.getOrderIndex()).isEqualTo(0);
        verify(ticketRepository, times(1)).save(any(Ticket.class));
    }

    @Test
    @DisplayName("addTicket: OrderIndex entspricht der bisherigen Ticket-Anzahl")
    void addTicket_orderIndexIsTicketCount() {
        when(sessionRepository.findByRoomCode("ABCD1234"))
                .thenReturn(Optional.of(testSession));
        when(ticketRepository.countBySessionRoomCode("ABCD1234"))
                .thenReturn(3);

        Ticket capturedTicket = new Ticket();
        when(ticketRepository.save(any(Ticket.class))).thenAnswer(inv -> {
            Ticket t = inv.getArgument(0);
            capturedTicket.setOrderIndex(t.getOrderIndex());
            return t;
        });

        ticketService.addTicket("ABCD1234", "Viertes Ticket");

        assertThat(capturedTicket.getOrderIndex()).isEqualTo(3);
    }

    @Test
    @DisplayName("addTicket: Wirft NoSuchElementException bei ungültigem Raumcode")
    void addTicket_invalidRoomCode_throwsException() {
        when(sessionRepository.findByRoomCode("INVALID"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                ticketService.addTicket("INVALID", "Test"))
                .isInstanceOf(NoSuchElementException.class);
    }

    // ====================================
    // selectTicket()
    // ====================================

    @Test
    @DisplayName("selectTicket: Ticket wird ausgewählt und Votes gelöscht")
    void selectTicket_success() {
        when(sessionRepository.findByRoomCode("ABCD1234"))
                .thenReturn(Optional.of(testSession));
        when(ticketRepository.findById(1L))
                .thenReturn(Optional.of(testTicket));
        when(sessionRepository.save(any(Session.class)))
                .thenReturn(testSession);

        Ticket result = ticketService.selectTicket("ABCD1234", 1L);

        assertThat(result.getTitle()).isEqualTo("Login implementieren");
        assertThat(testSession.getCurrentTicketId()).isEqualTo(1L);
        assertThat(testSession.getStatus()).isEqualTo(SessionStatus.WAITING);
        verify(voteRepository, times(1)).deleteBySessionRoomCode("ABCD1234");
    }

    @Test
    @DisplayName("selectTicket: Wirft NoSuchElementException bei unbekannter Ticket-ID")
    void selectTicket_unknownTicket_throwsException() {
        when(sessionRepository.findByRoomCode("ABCD1234"))
                .thenReturn(Optional.of(testSession));
        when(ticketRepository.findById(99L))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                ticketService.selectTicket("ABCD1234", 99L))
                .isInstanceOf(NoSuchElementException.class)
                .hasMessageContaining("Ticket nicht gefunden");
    }
}
