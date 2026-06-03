package de.sivag.planningpoker.utility;

/**
 * Utility-Klasse für String-Operationen.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
public final class StringUtils {

    // ====================================
    // Konstanten
    // ====================================

    private static final int MAX_NAME_LENGTH = 50;

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
     * Bereinigt einen Ticket-Titel gegen XSS.
     *
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

    /**
     * Validiert und bereinigt einen Teilnehmernamen.
     *
     * @param input der Rohname
     * @return bereinigter Name
     * @throws IllegalArgumentException wenn der Name ungültig oder leer ist
     */
    public static String sanitizeName(String input) {
        if (input == null || input.isBlank()) {
            throw new IllegalArgumentException(
                    "Name darf nicht leer sein.");
        }

        String cleaned = input.trim()
                .replaceAll("[^\\p{L}\\s\\-]", "")
                .trim();

        if (cleaned.isBlank()) {
            throw new IllegalArgumentException(
                    "Name darf nur Buchstaben, Leerzeichen und Bindestriche enthalten.");
        }

        if (cleaned.length() > MAX_NAME_LENGTH) {
            cleaned = cleaned.substring(0, MAX_NAME_LENGTH).trim();
        }

        return cleaned;
    }
}