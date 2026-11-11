package com.nexus.commerce.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Red de la demo pública (Fase 10, R5 · D6 · ajuste A2).
 *
 * <p>Las credenciales del admin demo son públicas, así que cualquiera puede
 * entrar al panel. Este filtro responde {@code 403} + {@code code: DEMO_MODE}
 * a las acciones que permitirían <strong>vandalizar</strong> la demo o dejar a
 * otros visitantes sin acceso; todo lo demás (estados de pedido, stock,
 * precios, reembolsos, crear productos o cupones) sigue funcionando, porque es
 * justo lo que la demo quiere enseñar.</p>
 *
 * <p><strong>Solo existe con {@code app.demo.enabled=true}</strong>: sin el
 * flag no hay bean ni filtro, así que dev, tests y CI no cambian. Al ser un
 * filtro de servlet normal corre <em>después</em> de la cadena de Spring
 * Security: una petición sin sesión sigue recibiendo su {@code 401}/{@code 403}
 * de siempre y solo un admin autenticado llega a ver {@code DEMO_MODE}.</p>
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "app.demo.enabled", havingValue = "true")
public class DemoModeFilter extends OncePerRequestFilter {

    static final String MENSAJE = "Esta acción está desactivada en la demo pública.";

    private record Regla(HttpMethod metodo, String patron) {}

    private static final List<Regla> BLOQUEADAS = List.of(
            new Regla(HttpMethod.DELETE, "/api/v1/admin/products/**"),
            new Regla(HttpMethod.DELETE, "/api/v1/admin/coupons/**"),
            new Regla(HttpMethod.PUT, "/api/v1/admin/users/**"),
            new Regla(HttpMethod.POST, "/api/v1/auth/forgot-password"),
            new Regla(HttpMethod.POST, "/api/v1/auth/reset-password")
    );

    private final AntPathMatcher matcher = new AntPathMatcher();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public DemoModeFilter() {
        log.warn("MODO DEMO activo: acciones destructivas del panel y recuperación de contraseña desactivadas.");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (!bloqueada(request)) {
            chain.doFilter(request, response);
            return;
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", Instant.now().toString());
        body.put("status", HttpStatus.FORBIDDEN.value());
        body.put("error", HttpStatus.FORBIDDEN.getReasonPhrase());
        body.put("code", "DEMO_MODE");
        body.put("message", MENSAJE);

        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getWriter(), body);
    }

    boolean bloqueada(HttpServletRequest request) {
        String ruta = request.getRequestURI().substring(request.getContextPath().length());
        return BLOQUEADAS.stream().anyMatch(r ->
                r.metodo().matches(request.getMethod()) && matcher.match(r.patron(), ruta));
    }
}
