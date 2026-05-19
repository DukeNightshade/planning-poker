package de.sivag.planningpoker.utility;

import de.sivag.planningpoker.model.enums.ParticipantRole;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.*;

/**
 * Unit-Tests für RoleParser.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
class RoleParserTest {

    // ====================================
    // parseParticipantRole()
    // ====================================

    @Test
    @DisplayName("parseParticipantRole: DEVELOPER wird korrekt geparst")
    void parseParticipantRole_developer() {
        assertThat(RoleParser.parseParticipantRole("DEVELOPER"))
                .isEqualTo(ParticipantRole.DEVELOPER);
    }

    @Test
    @DisplayName("parseParticipantRole: TESTER wird korrekt geparst")
    void parseParticipantRole_tester() {
        assertThat(RoleParser.parseParticipantRole("TESTER"))
                .isEqualTo(ParticipantRole.TESTER);
    }

    @Test
    @DisplayName("parseParticipantRole: PRODUCT_OWNER wird korrekt geparst")
    void parseParticipantRole_productOwner() {
        assertThat(RoleParser.parseParticipantRole("PRODUCT_OWNER"))
                .isEqualTo(ParticipantRole.PRODUCT_OWNER);
    }

    @Test
    @DisplayName("parseParticipantRole: MODERATOR fällt auf DEVELOPER zurück")
    void parseParticipantRole_moderator_fallsBackToDeveloper() {
        assertThat(RoleParser.parseParticipantRole("MODERATOR"))
                .isEqualTo(ParticipantRole.DEVELOPER);
    }

    @ParameterizedTest
    @DisplayName("parseParticipantRole: Ungültige Werte fallen auf DEVELOPER zurück")
    @ValueSource(strings = {"", "UNKNOWN", "admin", "null", "123"})
    void parseParticipantRole_invalidValues_fallBackToDeveloper(String input) {
        assertThat(RoleParser.parseParticipantRole(input))
                .isEqualTo(ParticipantRole.DEVELOPER);
    }

    // ====================================
    // parseModeratorRole()
    // ====================================

    @Test
    @DisplayName("parseModeratorRole: DEVELOPER wird korrekt geparst")
    void parseModeratorRole_developer() {
        assertThat(RoleParser.parseModeratorRole("DEVELOPER"))
                .isEqualTo(ParticipantRole.DEVELOPER);
    }

    @Test
    @DisplayName("parseModeratorRole: TESTER wird korrekt geparst")
    void parseModeratorRole_tester() {
        assertThat(RoleParser.parseModeratorRole("TESTER"))
                .isEqualTo(ParticipantRole.TESTER);
    }

    @Test
    @DisplayName("parseModeratorRole: MODERATOR fällt auf DEVELOPER zurück")
    void parseModeratorRole_moderator_fallsBackToDeveloper() {
        assertThat(RoleParser.parseModeratorRole("MODERATOR"))
                .isEqualTo(ParticipantRole.DEVELOPER);
    }

    @Test
    @DisplayName("parseModeratorRole: PRODUCT_OWNER fällt auf DEVELOPER zurück")
    void parseModeratorRole_productOwner_fallsBackToDeveloper() {
        assertThat(RoleParser.parseModeratorRole("PRODUCT_OWNER"))
                .isEqualTo(ParticipantRole.DEVELOPER);
    }

    @ParameterizedTest
    @DisplayName("parseModeratorRole: Ungültige Werte fallen auf DEVELOPER zurück")
    @ValueSource(strings = {"", "UNKNOWN", "xyz"})
    void parseModeratorRole_invalidValues_fallBackToDeveloper(String input) {
        assertThat(RoleParser.parseModeratorRole(input))
                .isEqualTo(ParticipantRole.DEVELOPER);
    }

    // ====================================
    // Konstruktor
    // ====================================

    @Test
    @DisplayName("RoleParser: Konstruktor wirft UnsupportedOperationException")
    void constructor_throwsException() {
        assertThatThrownBy(() -> {
            var constructor = RoleParser.class.getDeclaredConstructor();
            constructor.setAccessible(true);
            constructor.newInstance();
        }).cause().isInstanceOf(UnsupportedOperationException.class);
    }
}