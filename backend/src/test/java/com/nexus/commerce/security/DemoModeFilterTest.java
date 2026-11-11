package com.nexus.commerce.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Fase 10 - DemoModeFilter: qué bloquea la demo pública (R5, A2)")
class DemoModeFilterTest {

    private final DemoModeFilter filtro = new DemoModeFilter();

    private MockHttpServletResponse ejecutar(String metodo, String ruta, MockFilterChain chain) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(metodo, ruta);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filtro.doFilter(request, response, chain);
        return response;
    }

    @ParameterizedTest(name = "{0} {1} → 403 DEMO_MODE")
    @CsvSource({
            "DELETE, /api/v1/admin/products/12",
            "DELETE, /api/v1/admin/products/12/skus/3",
            "DELETE, /api/v1/admin/coupons/5",
            "PUT,    /api/v1/admin/users/7/role",
            "PUT,    /api/v1/admin/users/7/suspension",
            "POST,   /api/v1/auth/forgot-password",
            "POST,   /api/v1/auth/reset-password"
    })
    void accionesBloqueadas(String metodo, String ruta) throws Exception {
        MockFilterChain chain = new MockFilterChain();
        MockHttpServletResponse response = ejecutar(metodo, ruta, chain);

        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(response.getContentType()).startsWith("application/json");
        assertThat(response.getContentAsString())
                .contains("\"code\":\"DEMO_MODE\"")
                .contains(DemoModeFilter.MENSAJE);
        assertThat(chain.getRequest()).as("la petición no sigue la cadena").isNull();
    }

    @ParameterizedTest(name = "{0} {1} → pasa")
    @CsvSource({
            "PUT,    /api/v1/admin/orders/ORD-1/status",
            "POST,   /api/v1/admin/orders/ORD-1/refund",
            "PUT,    /api/v1/admin/stock/3/WH_ARTEIXO",
            "PUT,    /api/v1/admin/skus/3/prices/ES",
            "POST,   /api/v1/admin/products",
            "PUT,    /api/v1/admin/products/12",
            "GET,    /api/v1/admin/users",
            "POST,   /api/v1/auth/login",
            "DELETE, /api/v1/users/me/addresses/4",
            "DELETE, /api/v1/wishlist/items/9"
    })
    void accionesPermitidas(String metodo, String ruta) throws Exception {
        MockFilterChain chain = new MockFilterChain();
        MockHttpServletResponse response = ejecutar(metodo, ruta, chain);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(chain.getRequest()).as("la petición sigue la cadena").isNotNull();
    }

    @Test
    @DisplayName("respeta el context path: la regla se evalúa sobre la ruta de la app")
    void respetaContextPath() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("DELETE", "/tienda/api/v1/admin/coupons/5");
        request.setContextPath("/tienda");
        assertThat(filtro.bloqueada(request)).isTrue();
    }
}
