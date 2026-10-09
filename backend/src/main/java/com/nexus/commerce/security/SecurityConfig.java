package com.nexus.commerce.security;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Cadena de seguridad de la vitrina (Tarea 6.4, D6).
 *
 * <p>Antes terminaba en {@code anyRequest().permitAll()}: cualquier endpoint
 * nuevo nacía <strong>abierto por defecto</strong>. Ahora termina en
 * {@code denyAll()}: <strong>lo que no está listado, no funciona</strong> —
 * un endpoint olvidado falla en visible (401/403) en vez de filtrarse.</p>
 *
 * <p><strong>Orden importa</strong> (primera coincidencia gana): los 3 POST
 * que cambian estado van <em>antes</em> de los GET públicos, y SpringDoc /
 * {@code /error} al principio porque los necesita todo lo demás.</p>
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // 1) Infraestructura: OpenAPI y el manejador de errores de
                //    Spring MVC (sin /error, cualquier error se vuelve 401).
                .requestMatchers(
                        "/v3/api-docs",
                        "/v3/api-docs/**",
                        "/swagger-ui/**",
                        "/swagger-ui.html",
                        "/error"
                ).permitAll()

                // 2) Health check público (Tarea 6.4, D7: sin Actuator).
                .requestMatchers("/api/v1/health").permitAll()

                // 3) Registro, login y recuperación sin token todavía; el
                //    filtro JWT sigue activo para /auth/me si llega cabecera.
                .requestMatchers("/api/v1/auth/**").permitAll()

                // 4) Los 3 POST con estado pasan a exigir sesión (6.4).
                //    Van ANTES de los GET públicos: primera coincidencia gana.
                .requestMatchers(HttpMethod.POST, "/api/v1/inventory/reserve").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/v1/products/search/index").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/v1/products/enrich").authenticated()

                // 5) Vitrina pública: catálogo, mercado, stock y precio —
                //    6.4(i): GET /inventory/** y /pricing/** son públicos a
                //    propósito (lo que la propia ficha y el carrito publican
                //    sin sesión). Decisión documentada en el README.
                .requestMatchers(HttpMethod.GET, "/api/v1/products/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/inventory/**").permitAll()
                .requestMatchers("/api/v1/pricing/**").permitAll()
                .requestMatchers("/api/v1/markets").permitAll()

                // 6) Zona autenticada: perfil, direcciones y pedidos.
                .requestMatchers("/api/v1/users/**").authenticated()
                .requestMatchers("/api/v1/orders/**").authenticated()

                // 7) Zona admin (Tarea 7.1): exige ROLE_ADMIN en el
                //    SecurityContext, que el filtro sólo concede con el claim
                //    `role` del JWT (sin claim → USER, mínimo privilegio).
                //    Va ANTES de anyRequest().denyAll(): la primera
                //    coincidencia gana y SIN esta regla el denyAll dejaría
                //    /api/v1/admin/** cerrado también para el ADMIN.
                .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")

                // 8) Cualquier cosa no listada: NO funciona (D6).
                .anyRequest().denyAll()
            )
            .exceptionHandling(ex -> ex.authenticationEntryPoint(new JsonAuthenticationEntryPoint()))
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}
