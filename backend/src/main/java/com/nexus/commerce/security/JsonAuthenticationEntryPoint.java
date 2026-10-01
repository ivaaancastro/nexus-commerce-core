package com.nexus.commerce.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;

import java.io.IOException;
import java.time.OffsetDateTime;

/**
 * Devuelve 401 con el mismo cuerpo estructurado que {@code GlobalExceptionHandler}.
 *
 * Sin este entry point, Spring Security responde 403 a peticiones anónimas en un
 * API sin login por formulario: el recurso no está prohibido, falta la credencial.
 */
public class JsonAuthenticationEntryPoint implements AuthenticationEntryPoint {

    @Override
    public void commence(HttpServletRequest request,
                         HttpServletResponse response,
                         AuthenticationException authException) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(String.format(
                "{\"timestamp\":\"%s\",\"status\":401,\"error\":\"Unauthorized\","
                        + "\"message\":\"Autenticación requerida\"}",
                OffsetDateTime.now().toString()));
    }
}
