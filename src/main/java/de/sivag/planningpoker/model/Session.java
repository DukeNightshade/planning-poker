package de.sivag.planningpoker.model;

import de.sivag.planningpoker.model.enums.EstimationMethod;
import de.sivag.planningpoker.model.enums.SessionStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Entity für eine Planning-Poker-Session.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
@Entity
@Table(name = "sessions")
@Getter
@Setter
public class Session {

    // ====================================
    // Instanz Variablen
    // ====================================

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 8)
    private String roomCode;

    @Column
    private Long currentTicketId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EstimationMethod estimationMethod;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SessionStatus status;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private boolean showTopic = false;

    @Column(nullable = false)
    private boolean moderatorCanVote = true;

    @Column(nullable = false)
    private boolean autoReveal = false;

    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Participant> participants = new ArrayList<>();

    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Vote> votes = new ArrayList<>();

    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Ticket> tickets = new ArrayList<>();

    // ====================================
    // Lifecycle Callbacks
    // ====================================

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.status = SessionStatus.WAITING;
    }
}