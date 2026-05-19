package de.sivag.planningpoker.model;

import de.sivag.planningpoker.model.enums.TicketStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/**
 * Entity für ein zu schätzendes Ticket innerhalb einer Session.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
@Entity
@Table(name = "tickets")
@Getter
@Setter
public class Ticket {

    // ====================================
    // Instance Variables
    // ====================================

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TicketStatus status;

    @Column(length = 20)
    private String finalEstimate;

    @Column(nullable = false)
    private int orderIndex;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private Session session;

    // ====================================
    // Lifecycle Callbacks
    // ====================================

    @PrePersist
    protected void onCreate() {
        this.status = TicketStatus.OPEN;
    }
}