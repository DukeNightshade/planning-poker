package de.sivag.planningpoker.utility;

/**
 * Gemeinsame Konstanten für REST- und WebSocket-Schnittstelle.
 * Die Werte müssen zum Client-Code (static/js) passen.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
public final class ApiConstants {

    // ====================================
    // WebSocket-Topics
    // ====================================

    /** Broadcast an alle Teilnehmer eines Raums: TOPIC_SESSION + roomCode. */
    public static final String TOPIC_SESSION = "/topic/session/";

    // ====================================
    // Teilnehmer-Token
    // ====================================

    public static final String REST_TOKEN_HEADER = "X-Participant-Token";
    public static final String WS_TOKEN_HEADER   = "participant-token";

    // ====================================
    // Nachrichten-Schlüssel
    // ====================================

    public static final String PARTICIPANT_ID   = "participantId";
    public static final String PARTICIPANT_NAME = "participantName";
    public static final String PARTICIPANT_ROLE = "participantRole";

    // ====================================
    // Konstruktor
    // ====================================

    private ApiConstants() {
        throw new UnsupportedOperationException("Utility-Klasse");
    }
}
