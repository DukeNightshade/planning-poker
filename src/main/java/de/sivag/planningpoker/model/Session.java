package de.sivag.planningpoker.model;

import de.sivag.planningpoker.model.enums.EstimationMethod;
import de.sivag.planningpoker.model.enums.SessionStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "sessions")
@Data
@NoArgsConstructor
@Builder
@AllArgsConstructor
@ToString(exclude = "participants")
@EqualsAndHashCode(exclude = "participants")
public class Session {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(unique = true, length = 6)
    private String roomCode;

    private String moderatorName;

    @Enumerated(EnumType.STRING)
    private EstimationMethod estimationMethod;

    @Enumerated(EnumType.STRING)
    private SessionStatus status;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Participant> participants;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    private List<UserStory> userStories;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
