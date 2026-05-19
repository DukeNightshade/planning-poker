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
        assertThat(StringUtils.sanitize(null)).isEqualTo("");
    }

    @Test
    @DisplayName("sanitize: Leerer String bleibt leer")
    void sanitize_emptyString_returnsEmptyString() {
        assertThat(StringUtils.sanitize("")).isEqualTo("");
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
    // Konstruktor
    // ====================================

    @Test
    @DisplayName("StringUtils: Konstruktor wirft UnsupportedOperationException")
    void constructor_throwsException() {
        assertThatThrownBy(() -> {
            var constructor = StringUtils.class.getDeclaredConstructor();
            constructor.setAccessible(true);
            constructor.newInstance();
        }).cause().isInstanceOf(UnsupportedOperationException.class);
    }
}