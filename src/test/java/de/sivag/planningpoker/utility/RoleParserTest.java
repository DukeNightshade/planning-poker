package de.sivag.planningpoker.utility;

import de.sivag.planningpoker.model.enums.ParticipantRole;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
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
    // parseRole()
    // ====================================

    @ParameterizedTest
    @DisplayName("parseRole: Gültige Rollen werden übernommen")
    @ValueSource(strings = {"DEVELOPER", "TESTER", "PRODUCT_OWNER", "IT_ARCHITECT"})
    void parseRole_validRoles_areKept(String input) {
        assertThat(RoleParser.parseRole(input))
                .isEqualTo(ParticipantRole.valueOf(input));
    }

    @Test
    @DisplayName("parseRole: MODERATOR fällt auf DEVELOPER zurück")
    void parseRole_moderator_fallsBackToDeveloper() {
        assertThat(RoleParser.parseRole("MODERATOR"))
                .isEqualTo(ParticipantRole.DEVELOPER);
    }

    @ParameterizedTest
    @NullSource
    @DisplayName("parseRole: Ungültige oder fehlende Werte fallen auf DEVELOPER zurück")
    @ValueSource(strings = {"", "UNKNOWN", "admin", "null", "123"})
    void parseRole_invalidValues_fallBackToDeveloper(String input) {
        assertThat(RoleParser.parseRole(input))
                .isEqualTo(ParticipantRole.DEVELOPER);
    }

    // ====================================
    // Konstruktor
    // ====================================

    @Test
    @DisplayName("RoleParser: Konstruktor wirft UnsupportedOperationException")
    void constructor_throwsException() throws Exception {
        var constructor = RoleParser.class.getDeclaredConstructor();
        constructor.setAccessible(true);
        assertThatThrownBy(constructor::newInstance)
                .cause()
                .isInstanceOf(UnsupportedOperationException.class);
    }
}
