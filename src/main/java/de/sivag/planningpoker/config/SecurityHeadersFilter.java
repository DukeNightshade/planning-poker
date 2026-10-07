package de.sivag.planningpoker.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Setzt Security-Header auf alle Antworten.
 * HSTS setzt der Reverse Proxy, weil dort TLS terminiert wird.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
@Component
public class SecurityHeadersFilter extends OncePerRequestFilter {

    // ====================================
    // Konstanten
    // ====================================

    // 'unsafe-inline' wird noch für Thymeleaf-Inline-Skripte, onclick-Handler
    // und Inline-Styles gebraucht. Externe Quellen sind trotzdem ausgeschlossen.
    private static final String CSP = String.join("; ",
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data:",
            "font-src 'self'",
            "connect-src 'self'",
            "frame-src 'self'",
            "frame-ancestors 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'");

    private static final String H2_CONSOLE = "/h2-console";

    // ====================================
    // Filter
    // ====================================

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-Frame-Options",        "SAMEORIGIN");
        response.setHeader("Referrer-Policy",        "same-origin");
        response.setHeader("Permissions-Policy",     "camera=(), microphone=(), geolocation=()");

        // Die H2-Konsole (nur lokal) arbeitet mit Frames und Inline-Code
        if (!request.getServletPath().startsWith(H2_CONSOLE)) {
            response.setHeader("Content-Security-Policy", CSP);
        }

        chain.doFilter(request, response);
    }
}
