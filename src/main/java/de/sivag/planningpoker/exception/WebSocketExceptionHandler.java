package de.sivag.planningpoker.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.web.bind.annotation.ControllerAdvice;

import java.util.Map;
import java.util.NoSuchElementException;

/**
 * Exception-Handler für WebSocket-Nachrichten. Fehler gehen nur an die
 * auslösende Verbindung ({@code /user/queue/errors}), nicht an den ganzen Raum.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
@Slf4j
@ControllerAdvice
public class WebSocketExceptionHandler {

    // ====================================
    // Konstanten
    // ====================================

    private static final String ERRORS = "/queue/errors";
    private static final String ERROR  = "error";
    private static final String CODE   = "code";

    // ====================================
    // Handler
    // ====================================

    @MessageExceptionHandler(ForbiddenException.class)
    @SendToUser(destinations = ERRORS, broadcast = false)
    public Map<String, String> handleForbidden(ForbiddenException e) {
        log.warn("WS-Zugriff verweigert: {}", e.getMessage());
        return Map.of(CODE, "FORBIDDEN", ERROR, e.getMessage());
    }

    @MessageExceptionHandler({IllegalArgumentException.class,
                              IllegalStateException.class,
                              NoSuchElementException.class})
    @SendToUser(destinations = ERRORS, broadcast = false)
    public Map<String, String> handleBadRequest(RuntimeException e) {
        log.warn("Ungültige WS-Nachricht: {}", e.getMessage());
        return Map.of(CODE, "BAD_REQUEST", ERROR, e.getMessage());
    }

    @MessageExceptionHandler(Exception.class)
    @SendToUser(destinations = ERRORS, broadcast = false)
    public Map<String, String> handleUnexpected(Exception e) {
        log.error("Unerwarteter WS-Fehler: {}", e.getMessage(), e);
        return Map.of(CODE, "INTERNAL", ERROR, "Ein interner Fehler ist aufgetreten.");
    }
}
