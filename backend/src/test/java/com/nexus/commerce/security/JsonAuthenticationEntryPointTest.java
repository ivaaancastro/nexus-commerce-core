package com.nexus.commerce.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.BadCredentialsException;

import static org.assertj.core.api.Assertions.assertThat;

class JsonAuthenticationEntryPointTest {

    private final JsonAuthenticationEntryPoint entryPoint = new JsonAuthenticationEntryPoint();

    @Test
    @DisplayName("Debe responder 401 cuando falta la credencial")
    void shouldReturn401() throws Exception {
        // GIVEN
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/users/me/orders");
        MockHttpServletResponse response = new MockHttpServletResponse();

        // WHEN
        entryPoint.commence(request, response, new BadCredentialsException("Sin token"));

        // THEN
        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentType()).contains("application/json");
        assertThat(response.getContentAsString())
                .contains("\"status\":401")
                .contains("Autenticación requerida");
    }
}
