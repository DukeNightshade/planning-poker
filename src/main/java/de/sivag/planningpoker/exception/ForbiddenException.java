package de.sivag.planningpoker.exception;

/**
 * Wird geworfen, wenn ein Teilnehmer eine Aktion ohne die nötigen Rechte ausführt
 * oder sich nicht über ein gültiges Token ausweisen kann.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
public class ForbiddenException extends RuntimeException {

    public ForbiddenException(String message) {
        super(message);
    }
}
