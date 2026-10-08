package de.sivag.planningpoker.config;

import de.sivag.planningpoker.repository.ParticipantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.stereotype.Component;

/**
 * Nach einem Neustart ist niemand verbunden. Team-Mitglieder werden deshalb beim Start
 * als abwesend markiert – noch bevor der Webserver Verbindungen annimmt. Offene Tabs
 * verbinden sich automatisch neu und sind damit sofort wieder anwesend.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TeamPresenceInitializer implements SmartInitializingSingleton {

    private final ParticipantRepository participantRepository;

    @Override
    public void afterSingletonsInstantiated() {
        int count = participantRepository.markAllTeamMembersAbsent();
        if (count > 0) {
            log.info("Start: {} Team-Mitglied(er) als abwesend markiert", count);
        }
    }
}
