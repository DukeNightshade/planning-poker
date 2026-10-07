package de.sivag.planningpoker.utility;

import de.sivag.planningpoker.model.enums.ParticipantRole;

/**
 * Utility-Klasse zur sicheren Konvertierung von Rollen-Strings
 *
 * @author Nico Hoffmann
 * @version 1.1
 */
public final class RoleParser {

    // ====================================
    // Konstruktor
    // ====================================

    private RoleParser() {
        throw new UnsupportedOperationException("Utility-Klasse");
    }

    // ====================================
    // Utility Methoden
    // ====================================

    /**
     * Wandelt den Rollen-String aus einem Request in eine Teilnehmerrolle um.
     * MODERATOR ist keine wählbare Rolle (Moderator ist ein Flag), ungültige
     * oder fehlende Werte fallen auf DEVELOPER zurück.
     */
    public static ParticipantRole parseRole(String roleStr) {
        if (roleStr == null) return ParticipantRole.DEVELOPER;
        try {
            ParticipantRole role = ParticipantRole.valueOf(roleStr);
            return role == ParticipantRole.MODERATOR ? ParticipantRole.DEVELOPER : role;
        } catch (IllegalArgumentException e) {
            return ParticipantRole.DEVELOPER;
        }
    }
}
