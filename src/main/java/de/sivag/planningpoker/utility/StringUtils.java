package de.sivag.planningpoker.utility;

/**
 * Utility-Klasse für String-Operationen.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
public final class StringUtils {

    // ====================================
    // Konstruktor
    // ====================================

    private StringUtils() {
        throw new UnsupportedOperationException("Utility-Klasse");
    }

    // ====================================
    // Utility Methoden
    // ====================================

    /**
     * @param input der zu bereinigende String
     * @return bereinigter String, oder leerer String bei null
     */
    public static String sanitize(String input) {
        if (input == null) return "";
        return input
                .replace("&",  "&amp;")
                .replace("<",  "&lt;")
                .replace(">",  "&gt;")
                .replace("\"", "&quot;")
                .replace("'",  "&#x27;");
    }
}