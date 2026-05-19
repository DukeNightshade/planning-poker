package de.sivag.planningpoker.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Entity für eine abgegebene Kartenwahl eines Teilnehmers.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
@Entity
@Table(
        name = "votes",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uq_vote_session_participant",
                        columnNames = {"session_id", "participant_id"}
                )
        }
)
@Getter
@Setter
public class Vote {

    // ====================================
    // Instance Variables
    // ====================================

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 10)
    private String cardValue;

    @Column(nullable = false)
    private LocalDateTime votedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private Session session;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "participant_id", nullable = false)
    private Participant participant;

    // ====================================
    // Lifecycle Callbacks
    // ====================================

    @PrePersist
    protected void onCreate() {
        this.votedAt = LocalDateTime.now();
    }
}