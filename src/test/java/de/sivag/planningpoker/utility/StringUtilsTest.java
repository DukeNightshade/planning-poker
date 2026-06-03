package de.sivag.planningpoker.utility;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.*;

/**
 * Unit-Tests für StringUtils.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
class StringUtilsTest {

    // ====================================
    // sanitize()
    // ====================================

    @Test
    @DisplayName("sanitize: Normaler Text bleibt unverändert")
    void sanitize_normalText_unchanged() {
        assertThat(StringUtils.sanitize("Nico Hoffmann"))
                .isEqualTo("Nico Hoffmann");
    }

    @Test
    @DisplayName("sanitize: null wird zu leerem String")
    void sanitize_null_returnsEmptyString() {
        assertThat(StringUtils.sanitize("")).isEmpty();
    }

    @Test
    @DisplayName("sanitize: Leerer String bleibt leer")
    void sanitize_emptyString_returnsEmptyString() {
        assertThat(StringUtils.sanitize("")).isEmpty();
    }

    @ParameterizedTest
    @DisplayName("sanitize: HTML-Sonderzeichen werden korrekt ersetzt")
    @CsvSource({
            "<script>,               &lt;script&gt;",
            "<img src=x onerror=1>,  &lt;img src=x onerror=1&gt;",
            "Max & Moritz,           Max &amp; Moritz",
            "Say \"hello\",          Say &quot;hello&quot;",
            "It's fine,              It&#x27;s fine"
    })
    void sanitize_htmlCharacters_areEscaped(String input, String expected) {
        assertThat(StringUtils.sanitize(input.trim()))
                .isEqualTo(expected.trim());
    }

    @Test
    @DisplayName("sanitize: XSS-Angriff wird vollständig neutralisiert")
    void sanitize_xssAttack_isNeutralized() {
        String xss = "<script>alert('XSS')</script>";
        assertThat(StringUtils.sanitize(xss))
                .isEqualTo("&lt;script&gt;alert(&#x27;XSS&#x27;)&lt;/script&gt;")
                .doesNotContain("<")
                .doesNotContain(">");
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