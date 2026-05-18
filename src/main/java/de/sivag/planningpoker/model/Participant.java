package de.sivag.planningpoker.model;

import de.sivag.planningpoker.model.enums.ParticipantRole;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity
@Table(name = "participants")
@Getter
@Setter
public class Participant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ParticipantRole role;

    @Column(nullable = false)
    private LocalDateTime joinedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private Session session;

    @PrePersist
    protected void onCreate() {
        this.joinedAt = LocalDateTime.now();
    }
}