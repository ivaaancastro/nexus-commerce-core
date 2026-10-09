package com.nexus.commerce.security;

import com.nexus.commerce.entity.Role;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tarea 7.1 (spec specs/admin-roles/, R2 · CA 1-3): el rol viaja en el claim
 * {@code role} de access y refresh, y un token sin el claim se lee como USER.
 */
class JwtServiceTest {

    /** HS256 exige ≥ 32 bytes — la clave de prueba cumple holgadamente. */
    private static final String SECRET =
            "secreto-de-pruebas-suficientemente-largo-para-HS256-0123456789";

    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService();
        ReflectionTestUtils.setField(jwtService, "secret", SECRET);
        ReflectionTestUtils.setField(jwtService, "expiration", 86_400_000L);
        ReflectionTestUtils.setField(jwtService, "refreshExpiration", 604_800_000L);
    }

    @Test
    @DisplayName("El access token lleva el claim role con el rol del usuario")
    void accessTokenLlevaClaimRole() {
        // WHEN
        String token = jwtService.generateToken(7L, "ana@example.com", Role.ADMIN);

        // THEN — el rol viaja junto al userId y el email que ya llevaba
        assertThat(jwtService.extractClaims(token).get("role", String.class)).isEqualTo("ADMIN");
        assertThat(jwtService.extractRole(token)).isEqualTo(Role.ADMIN);
        assertThat(jwtService.extractUserId(token)).isEqualTo(7L);
        assertThat(jwtService.extractEmail(token)).isEqualTo("ana@example.com");
    }

    @Test
    @DisplayName("El refresh token también lleva el claim role")
    void refreshTokenLlevaClaimRole() {
        // WHEN
        String token = jwtService.generateRefreshToken(7L, "ana@example.com", Role.USER);

        // THEN
        assertThat(jwtService.extractRole(token)).isEqualTo(Role.USER);
        assertThat(jwtService.extractEmail(token)).isEqualTo("ana@example.com");
    }

    @Test
    @DisplayName("Un token sin el claim role (anterior a la 7.1) se lee como USER")
    void tokenSinClaimRoleSeLeeComoUser() {
        // GIVEN — un token firmado con la misma clave pero sin el claim
        String legacy = tokenConRole(null);

        // THEN — mínimo privilegio: nunca ADMIN
        assertThat(jwtService.extractRole(legacy)).isEqualTo(Role.USER);
    }

    @Test
    @DisplayName("Un valor de rol desconocido en el claim cae en USER, no en error")
    void claimRoleDesconocidoCaeEnUser() {
        // GIVEN — valor que nunca emite el backend
        String conBasura = tokenConRole("SUPERVISOR");

        // THEN
        assertThat(jwtService.extractRole(conBasura)).isEqualTo(Role.USER);
    }

    /** Construye un token como lo haría el servicio, para controlar el claim. */
    private String tokenConRole(String roleValue) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", 1L);
        if (roleValue != null) {
            claims.put("role", roleValue);
        }
        return Jwts.builder()
                .setClaims(claims)
                .setSubject("legacy@example.com")
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)),
                        SignatureAlgorithm.HS256)
                .compact();
    }
}
