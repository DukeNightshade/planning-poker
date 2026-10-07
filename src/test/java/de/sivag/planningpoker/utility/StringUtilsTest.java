package de.sivag.planningpoker.utility;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.*;

/**
 * Unit-Tests für StringUtils.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
class StringUtilsTest {

    // ====================================
    // sanitizeTicketTitle()
    // ====================================

    @Test
    @DisplayName("sanitizeTicketTitle: Normaler Text bleibt unverändert")
    void sanitizeTicketTitle_normalText_unchanged() {
        assertThat(StringUtils.sanitizeTicketTitle("Story A"))
                .isEqualTo("Story A");
    }

    @ParameterizedTest
    @DisplayName("sanitizeTicketTitle: Sonderzeichen und URLs bleiben Klartext (Escaping im Client)")
    @ValueSource(strings = {
            "Max & Moritz",
            "<script>alert('XSS')</script>",
            "https://jira.example.com/browse/PP-1?a=1&b=2"
    })
    void sanitizeTicketTitle_specialCharacters_keptAsPlainText(String input) {
        assertThat(StringUtils.sanitizeTicketTitle(input)).isEqualTo(input);
    }

    @Test
    @DisplayName("sanitizeTicketTitle: Leerzeichen und Steuerzeichen werden bereinigt")
    void sanitizeTicketTitle_whitespaceAndControlChars_cleaned() {
        assertThat(StringUtils.sanitizeTicketTitle("  Story\tA\n "))
                .isEqualTo("Story A");
    }

    @Test
    @DisplayName("sanitizeTicketTitle: Zu lange Titel werden gekürzt")
    void sanitizeTicketTitle_tooLong_isTruncated() {
        String longTitle = "x".repeat(StringUtils.MAX_TITLE_LENGTH + 50);
        assertThat(StringUtils.sanitizeTicketTitle(longTitle))
                .hasSize(StringUtils.MAX_TITLE_LENGTH);
    }

    @Test
    @DisplayName("sanitizeTicketTitle: Leerer Titel wirft IllegalArgumentException")
    void sanitizeTicketTitle_blank_throwsException() {
        assertThatThrownBy(() -> StringUtils.sanitizeTicketTitle("   "))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> StringUtils.sanitizeTicketTitle(null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ====================================
    // sanitizeName()
    // ====================================

    @Test
    @DisplayName("sanitizeName: Normaler Name bleibt unverändert")
    void sanitizeName_normalName_unchanged() {
        assertThat(StringUtils.sanitizeName("Max Mustermann"))
                .isEqualTo("Max Mustermann");
    }

    @Test
    @DisplayName("sanitizeName: Umlaute und Bindestriche werden akzeptiert")
    void sanitizeName_umlauts_accepted() {
        assertThat(StringUtils.sanitizeName("Müller-Lüdenscheidt"))
                .isEqualTo("Müller-Lüdenscheidt");
    }

    @Test
    @DisplayName("sanitizeName: Zahlen werden entfernt")
    void sanitizeName_numbers_stripped() {
        assertThat(StringUtils.sanitizeName("Max123"))
                .isEqualTo("Max");
    }

    @Test
    @DisplayName("sanitizeName: HTML-Tags werden entfernt, Buchstaben bleiben")
    void sanitizeName_htmlTags_stripped() {
        assertThat(StringUtils.sanitizeName("<script>alert</script>"))
                .isEqualTo("scriptalertscript");
    }

    @Test
    @DisplayName("sanitizeName: Nur Zahlen wirft IllegalArgumentException")
    void sanitizeName_onlyNumbers_throwsException() {
        assertThatThrownBy(() -> StringUtils.sanitizeName("12345"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("sanitizeName: Null wirft IllegalArgumentException")
    void sanitizeName_null_throwsException() {
        assertThatThrownBy(() -> StringUtils.sanitizeName(null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("sanitizeName: Leerer String wirft IllegalArgumentException")
    void sanitizeName_blank_throwsException() {
        assertThatThrownBy(() -> StringUtils.sanitizeName("   "))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("sanitizeName: Name wird bei 50 Zeichen abgeschnitten")
    void sanitizeName_tooLong_truncated() {
        String longName = "A".repeat(60);
        assertThat(StringUtils.sanitizeName(longName))
                .hasSize(50);
    }

    // ====================================
    // Konstruktor
    // ====================================

    @Test
    @DisplayName("StringUtils: Konstruktor wirft UnsupportedOperationException")
    void constructor_throwsException() throws Exception {
        var constructor = StringUtils.class.getDeclaredConstructor();
        constructor.setAccessible(true);
        assertThatThrownBy(constructor::newInstance)
                .cause()
                .isInstanceOf(UnsupportedOperationException.class);
    }
}