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

    private static final int MAX_NAME_LENGTH  = 50;
    public  static final int MAX_TITLE_LENGTH = 255;
    private static final int MIN_TEAM_NAME_LENGTH = 3;
    private static final int MAX_TEAM_NAME_LENGTH = 40;

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
     * Bereinigt einen Ticket-Titel. Gespeichert wird Klartext – das
     * HTML-Escaping übernimmt der Client beim Rendern.
     *
     * @param input der Roh-Titel
     * @return getrimmter Titel ohne Steuerzeichen, max. {@value #MAX_TITLE_LENGTH} Zeichen
     * @throws IllegalArgumentException wenn der Titel leer ist
     */
    public static String sanitizeTicketTitle(String input) {
        if (input == null || input.isBlank()) {
            throw new IllegalArgumentException("Ticket-Titel darf nicht leer sein.");
        }

        String cleaned = input.replaceAll("\\p{Cntrl}", " ").trim();

        if (cleaned.length() > MAX_TITLE_LENGTH) {
            cleaned = cleaned.substring(0, MAX_TITLE_LENGTH).trim();
        }

        return cleaned;
    }

    /**
     * Normalisiert den Namen eines Team-Raums für die URL (/team/{name}):
     * Kleinbuchstaben, Ziffern und Bindestriche, 3–40 Zeichen.
     *
     * @param input der gewünschte Name, z. B. "Backend Team"
     * @return URL-tauglicher Name, z. B. "backend-team"
     * @throws IllegalArgumentException wenn danach kein gültiger Name übrig bleibt
     */
    public static String sanitizeTeamName(String input) {
        String cleaned = input == null ? "" : input.trim().toLowerCase()
                .replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
                .replaceAll("[\\s_]+", "-")
                .replaceAll("[^a-z0-9-]", "")
                .replaceAll("-{2,}", "-")
                .replaceAll("^-|-$", "");

        if (cleaned.length() < MIN_TEAM_NAME_LENGTH || cleaned.length() > MAX_TEAM_NAME_LENGTH) {
            throw new IllegalArgumentException(
                    "Team-Name muss 3 bis 40 Zeichen haben (Buchstaben, Ziffern, Bindestriche).");
        }
        return cleaned;
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