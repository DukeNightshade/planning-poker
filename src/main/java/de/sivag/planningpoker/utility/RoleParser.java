package de.sivag.planningpoker.utility;

import de.sivag.planningpoker.model.enums.ParticipantRole;

/**
 * Utility-Klasse zur sicheren Konvertierung von Rollen-Strings
 *
 * @author Nico Hoffmann
 * @version 1.0
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

    public static ParticipantRole parseParticipantRole(String roleStr) {
        try {
            ParticipantRole role = ParticipantRole.valueOf(roleStr);
            return role == ParticipantRole.MODERATOR
                    ? ParticipantRole.DEVELOPER : role;
        } catch (IllegalArgumentException e) {
            return ParticipantRole.DEVELOPER;
        }
    }

    public static ParticipantRole parseModeratorRole(String roleStr) {
        try {
            ParticipantRole role = ParticipantRole.valueOf(roleStr);
            if (role == ParticipantRole.MODERATOR ||
                    role == ParticipantRole.PRODUCT_OWNER) {
                return ParticipantRole.DEVELOPER;
            }
            return role;
        } catch (IllegalArgumentException e) {
            return ParticipantRole.DEVELOPER;
        }
    }
}
