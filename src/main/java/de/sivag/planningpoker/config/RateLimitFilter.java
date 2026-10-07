package de.sivag.planningpoker.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;
import java.util.regex.Pattern;

/**
 * Einfaches Rate-Limiting pro Client-IP (festes 1-Minuten-Fenster) für das
 * Erstellen von Sessions und das Beitreten. Hinter dem Reverse Proxy liefert
 * {@code getRemoteAddr()} dank forward-headers-strategy die echte Client-IP.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
@Slf4j
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    // ====================================
    // Konstanten
    // ====================================

    private static final long    WINDOW_MILLIS = 60_000L;
    private static final int     MAX_ENTRIES   = 10_000;
    private static final Pattern JOIN_PATH     = Pattern.compile("^/api/sessions/[^/]+/join$");

    // ====================================
    // Zustand
    // ====================================

    private final int          createPerMinute;
    private final int          joinPerMinute;
    private final LongSupplier clock;

    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

    // ====================================
    // Konstruktor
    // ====================================

    @Autowired
    public RateLimitFilter(
            @Value("${planningpoker.rate-limit.create-per-minute:20}") int createPerMinute,
            @Value("${planningpoker.rate-limit.join-per-minute:60}")   int joinPerMinute) {
        this(createPerMinute, joinPerMinute, System::currentTimeMillis);
    }

    RateLimitFilter(int createPerMinute, int joinPerMinute, LongSupplier clock) {
        this.createPerMinute = createPerMinute;
        this.joinPerMinute   = joinPerMinute;
        this.clock           = clock;
    }

    // ====================================
    // Filter
    // ====================================

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        if (!"POST".equals(request.getMethod())) {
            chain.doFilter(request, response);
            return;
        }

        String path = request.getServletPath();
        String bucket;
        int    limit;
        if ("/api/sessions".equals(path)) {
            bucket = "create";
            limit  = createPerMinute;
        } else if (JOIN_PATH.matcher(path).matches()) {
            bucket = "join";
            limit  = joinPerMinute;
        } else {
            chain.doFilter(request, response);
            return;
        }

        String ip = request.getRemoteAddr();
        if (!tryAcquire(bucket + ":" + ip, limit)) {
            log.warn("Rate-Limit erreicht: bucket={}, ip={}", bucket, ip);
            response.setStatus(429);
            response.setHeader("Retry-After", String.valueOf(WINDOW_MILLIS / 1000));
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write(
                    "{\"error\":\"Zu viele Anfragen. Bitte in einer Minute erneut versuchen.\"}");
            return;
        }

        chain.doFilter(request, response);
    }

    // ====================================
    // Hilfsmethoden
    // ====================================

    boolean tryAcquire(String key, int limit) {
        long now = clock.getAsLong();
        if (windows.size() > MAX_ENTRIES) {
            windows.values().removeIf(w -> now - w.start >= WINDOW_MILLIS);
        }

        Window window = windows.compute(key, (k, w) ->
                w == null || now - w.start >= WINDOW_MILLIS ? new Window(now) : w);
        synchronized (window) {
            return ++window.count <= limit;
        }
    }

    private static final class Window {
        private final long start;
        private int        count;

        private Window(long start) {
            this.start = start;
        }
    }
}
