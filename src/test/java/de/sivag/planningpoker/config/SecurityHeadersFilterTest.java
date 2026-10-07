package de.sivag.planningpoker.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit-Tests für SecurityHeadersFilter.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
class SecurityHeadersFilterTest {

    private final SecurityHeadersFilter filter = new SecurityHeadersFilter();

    @Test
    @DisplayName("Normale Seiten bekommen CSP und weitere Security-Header")
    void page_getsSecurityHeaders() throws Exception {
        MockHttpServletResponse response = request("/session/ABCD1234");

        assertThat(response.getHeader("Content-Security-Policy"))
                .contains("default-src 'self'")
                .contains("connect-src 'self'")
                .contains("object-src 'none'")
                .doesNotContain("https:");
        assertThat(response.getHeader("X-Content-Type-Options")).isEqualTo("nosniff");
        assertThat(response.getHeader("X-Frame-Options")).isEqualTo("SAMEORIGIN");
        assertThat(response.getHeader("Referrer-Policy")).isEqualTo("same-origin");
    }

    @Test
    @DisplayName("H2-Konsole bekommt keine CSP")
    void h2Console_hasNoCsp() throws Exception {
        assertThat(request("/h2-console/login.jsp").getHeader("Content-Security-Policy")).isNull();
    }

    private MockHttpServletResponse request(String path) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
        request.setServletPath(path);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }
}
