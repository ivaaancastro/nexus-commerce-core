package com.nexus.commerce.security;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class JwtAuthenticationFilterTest {

    private static final String EMAIL = "ana@example.com";

    @Mock
    private JwtService jwtService;

    @InjectMocks
    private JwtAuthenticationFilter filter;

    private MockHttpServletRequest request;
    private MockHttpServletResponse response;
    private FilterChain chain;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
        request = new MockHttpServletRequest("GET", "/api/v1/users/me/orders");
        response = new MockHttpServletResponse();
        chain = mock(FilterChain.class);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("Un token malformado no debe provocar 500: se descarta y se sigue la cadena")
    void shouldIgnoreMalformedTokenInsteadOfFailing() throws Exception {
        // GIVEN — un JWT basura hace que JwtService lance al parsearlo
        request.addHeader("Authorization", "Bearer token-basura");
        lenient().when(jwtService.extractEmail("token-basura"))
                .thenThrow(new IllegalArgumentException("Malformed JWT"));

        // WHEN / THEN — no debe lanzar: eso era el bug (500 en el endpoint)
        assertThatCode(() -> filter.doFilter(request, response, chain))
                .doesNotThrowAnyException();

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(request, response);
    }

    @Test
    @DisplayName("Con un token válido autentica con el email como principal")
    void shouldAuthenticateWithValidToken() throws Exception {
        // GIVEN
        request.addHeader("Authorization", "Bearer token-valido");
        lenient().when(jwtService.extractEmail("token-valido")).thenReturn(EMAIL);
        lenient().when(jwtService.extractUserId("token-valido")).thenReturn(7L);

        // WHEN
        filter.doFilter(request, response, chain);

        // THEN
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        assertThat(authentication).isNotNull();
        assertThat(authentication.getPrincipal()).isEqualTo(EMAIL);
        verify(chain).doFilter(request, response);
    }

    @Test
    @DisplayName("Sin cabecera Authorization la petición sigue sin autenticar")
    void shouldLeaveRequestUnauthenticatedWithoutHeader() throws Exception {
        // WHEN
        filter.doFilter(request, response, chain);

        // THEN
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(request, response);
    }
}
