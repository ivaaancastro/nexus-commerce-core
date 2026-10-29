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

                // 2) Health check (Fase 8, R1): ahora protegido para admin.
                .requestMatchers("/api/v1/health").hasRole("ADMIN")

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

                // 6) V4 product-reviews: creación y borrado exigen sesión
                //    (spec §2.4). Van ANTES del denyAll; la lectura ya es
                //    pública por el GET /products/** de arriba.
                .requestMatchers(HttpMethod.POST, "/api/v1/products/*/reviews").authenticated()
                .requestMatchers(HttpMethod.DELETE, "/api/v1/products/*/reviews/*").authenticated()

                // 6) Zona autenticada: perfil, direcciones y pedidos.
                .requestMatchers("/api/v1/users/**").authenticated()
                // POST /orders/{orderNumber}/refund requiere ADMIN (Fase 9)
                .requestMatchers(HttpMethod.POST, "/api/v1/orders/*/refund").hasRole("ADMIN")
                .requestMatchers("/api/v1/orders/**").authenticated()

                //    V3 wishlist: favoritos del usuario autenticado (spec
                //    specs/wishlist/, R4.1). Sin esta regla el denyAll de
                //    aquí abajo la cerraría también a sesión iniciada.
                .requestMatchers("/api/v1/wishlist/**").authenticated()

                //    V5 cupones (spec specs/coupons/ §2.3): el validate de
                //    cliente exige sesión (suma al límite por usuario); el CRUD
                //    admin ya lo cubre /api/v1/admin/** con hasRole("ADMIN").
                //    También ANTES de anyRequest().denyAll().
                .requestMatchers("/api/v1/coupons/**").authenticated()

                //    Fase 8 (R2): métricas básicas, solo admin.
                .requestMatchers("/api/v1/metrics").hasRole("ADMIN")

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
