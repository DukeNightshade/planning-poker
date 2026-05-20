package de.sivag.planningpoker.service;

import de.sivag.planningpoker.model.Session;
import de.sivag.planningpoker.model.Ticket;
import de.sivag.planningpoker.model.enums.EstimationMethod;
import de.sivag.planningpoker.model.enums.SessionStatus;
import de.sivag.planningpoker.model.enums.TicketStatus;
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

    @Mock private SessionService   sessionService; // <-- Hier ist der neue Mock
    @Mock private TicketRepository ticketRepository;
    @Mock private VoteRepository   voteRepository;

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
        testTicket.setTitle("Story A");
        testTicket.setSession(testSession);
        testTicket.setOrderIndex(0);
        testTicket.setStatus(TicketStatus.OPEN);
    }

    // ====================================
    // addTicket()
    // ====================================

    @Test
    @DisplayName("addTicket: Ticket wird erfolgreich hinzugefügt")
    void addTicket_success() {
        when(sessionService.getSessionByRoomCode("ABCD1234"))
                .thenReturn(testSession);
        when(ticketRepository.countBySessionRoomCode("ABCD1234"))
                .thenReturn(0);
        when(ticketRepository.save(any(Ticket.class)))
                .thenReturn(testTicket);

        Ticket result = ticketService.addTicket("ABCD1234", "Story A");

        assertThat(result.getTitle()).isEqualTo("Story A");
        verify(ticketRepository, times(1)).save(any(Ticket.class));
    }

    @Test
    @DisplayName("addTicket: OrderIndex entspricht der Anzahl bisheriger Tickets")
    void addTicket_orderIndexIsTicketCount() {
        when(sessionService.getSessionByRoomCode("ABCD1234"))
                .thenReturn(testSession);
        when(ticketRepository.countBySessionRoomCode("ABCD1234"))
                .thenReturn(5); // Es gibt schon 5 Tickets
        when(ticketRepository.save(any(Ticket.class)))
                .thenAnswer(i -> i.getArgument(0)); // Gibt das gespeicherte Ticket zurück

        Ticket result = ticketService.addTicket("ABCD1234", "Story B");

        assertThat(result.getOrderIndex()).isEqualTo(5); // Das neue Ticket kriegt Index 5
    }

    @Test
    @DisplayName("addTicket: Wirft Exception bei ungültigem Raum-Code")
    void addTicket_invalidRoomCode_throwsException() {
        // Dem Mock beibringen, die Exception zu werfen, wie es der SessionService tun würde
        when(sessionService.getSessionByRoomCode("INVALID"))
                .thenThrow(new NoSuchElementException("Session nicht gefunden."));

        assertThatThrownBy(() ->
                ticketService.addTicket("INVALID", "Story A"))
                .isInstanceOf(NoSuchElementException.class);
    }

    // ====================================
    // selectTicket()
    // ====================================

    @Test
    @DisplayName("selectTicket: Setzt aktuelles Ticket, Status auf WAITING und löscht Votes")
    void selectTicket_success() {
        when(sessionService.getSessionByRoomCode("ABCD1234"))
                .thenReturn(testSession);
        when(ticketRepository.findById(1L))
                .thenReturn(Optional.of(testTicket));

        Ticket result = ticketService.selectTicket("ABCD1234", 1L);

        assertThat(result.getId()).isEqualTo(1L);
        assertThat(testSession.getCurrentTicketId()).isEqualTo(1L);
        assertThat(testSession.getStatus()).isEqualTo(SessionStatus.WAITING);
        verify(voteRepository, times(1)).deleteBySessionRoomCode("ABCD1234");
    }

    @Test
    @DisplayName("selectTicket: Wirft Exception bei unbekanntem Ticket")
    void selectTicket_unknownTicket_throwsException() {
        when(sessionService.getSessionByRoomCode("ABCD1234"))
                .thenReturn(testSession);
        when(ticketRepository.findById(99L))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                ticketService.selectTicket("ABCD1234", 99L))
                .isInstanceOf(NoSuchElementException.class)
                .hasMessageContaining("nicht gefunden");
    }

    // ====================================
    // getTickets()
    // ====================================

    @Test
    @DisplayName("getTickets: Liefert sortierte Liste der Tickets")
    void getTickets_returnsSortedList() {
        when(ticketRepository.findBySessionRoomCodeOrderByOrderIndex("ABCD1234"))
                .thenReturn(List.of(testTicket));

        List<Ticket> results = ticketService.getTickets("ABCD1234");

        assertThat(results).hasSize(1);
        assertThat(results.getFirst().getTitle()).isEqualTo("Story A");
    }
}