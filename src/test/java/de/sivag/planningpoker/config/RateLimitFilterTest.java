package de.sivag.planningpoker.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit-Tests für RateLimitFilter.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
class RateLimitFilterTest {

    // ====================================
    // Testdaten
    // ====================================

    private final AtomicLong now = new AtomicLong(0);
    private RateLimitFilter  filter;

    @BeforeEach
    void setUp() {
        filter = new RateLimitFilter(2, 3, now::get);
    }

    // ====================================
    // Tests
    // ====================================

    @Test
    @DisplayName("Session-Erstellung: über dem Limit gibt es 429 mit Retry-After")
    void create_overLimit_returns429() throws Exception {
        assertThat(post("/api/sessions", "1.1.1.1").getStatus()).isEqualTo(200);
        assertThat(post("/api/sessions", "1.1.1.1").getStatus()).isEqualTo(200);

        MockHttpServletResponse blocked = post("/api/sessions", "1.1.1.1");
        assertThat(blocked.getStatus()).isEqualTo(429);
        assertThat(blocked.getHeader("Retry-After")).isEqualTo("60");
        assertThat(blocked.getContentAsString()).contains("error");
    }

    @Test
    @DisplayName("Limit gilt pro IP und Bucket, nach einer Minute wieder frei")
    void limit_perIpAndBucket_resetsAfterWindow() throws Exception {
        post("/api/sessions", "1.1.1.1");
        post("/api/sessions", "1.1.1.1");
        assertThat(post("/api/sessions", "1.1.1.1").getStatus()).isEqualTo(429);

        assertThat(post("/api/sessions", "2.2.2.2").getStatus()).isEqualTo(200);
        assertThat(post("/api/sessions/ABCD1234/join", "1.1.1.1").getStatus()).isEqualTo(200);

        now.addAndGet(60_000);
        assertThat(post("/api/sessions", "1.1.1.1").getStatus()).isEqualTo(200);
    }

    @Test
    @DisplayName("Join hat ein eigenes Limit, andere Endpunkte sind nicht begrenzt")
    void join_hasOwnLimit_otherPathsUnlimited() throws Exception {
        for (int i = 0; i < 3; i++) {
            assertThat(post("/api/sessions/ABCD1234/join", "1.1.1.1").getStatus()).isEqualTo(200);
        }
        assertThat(post("/api/sessions/ABCD1234/join", "1.1.1.1").getStatus()).isEqualTo(429);

        for (int i = 0; i < 10; i++) {
            assertThat(post("/api/sessions/ABCD1234/participants/1/promote", "1.1.1.1").getStatus())
                    .isEqualTo(200);
        }
    }

    // ====================================
    // Hilfsmethoden
    // ====================================

    private MockHttpServletResponse post(String path, String ip) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", path);
        request.setServletPath(path);
        request.setRemoteAddr(ip);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }
}
