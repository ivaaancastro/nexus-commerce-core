import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "@/lib/api";

/**
 * Tarea 6.3b (R4) — cobertura de `src/lib/api.ts`, la única puerta a la API.
 *
 * Era el fichero con peor cobertura del proyecto (**20,77 %** medido el
 * 2026-10-09) y cada fase nueva lo toca, así que la 6.3b le pone tests
 * dedicados y un umbral por fichero congelado en `vitest.config.ts` (D5).
 *
 * Cubre los cinco caminos de `handleResponse()` (JSON, 204, cuerpo vacío,
 * error con cuerpo, error sin cuerpo → `statusText`) y los métodos
 * representativos con `fetch` mockeado — mismo patrón que
 * `ApiAuthHeaders.test.ts`.
 *
 * Nota: **no existe «refresh de token» en `api.ts`**: el refresh token sólo
 * se guarda/borra en `AuthContext` (login/logout) y la sesión se refresca
 * re-pidiendo `/auth/me` (`getCurrentUser`), que sí está cubierto aquí. El
 * flujo de `AuthContext` tiene sus propios tests.
 */

const fetchMock = vi.fn();

type CheckoutRequest = Parameters<typeof api.checkout>[0];
type RegisterData = Parameters<typeof api.register>[0];

const checkoutRequest: CheckoutRequest = {
    marketCode: "ES",
    items: [{ skuId: 1, warehouseCode: "WH_ARTEIXO", quantity: 1 }],
    destinationCountryCode: "ES",
    addressId: 5,
    paymentMethod: "CARD",
};

const registerData: RegisterData = {
    email: "ana@example.com",
    password: "Segura1234!",
    firstName: "Ana",
    lastName: "García",
    birthDate: "1990-05-20",
    gender: "FEMALE",
};

function response(status: number, statusText: string, body: string): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText,
        text: async () => body,
    } as unknown as Response;
}

function jsonResponse(body: unknown, status = 200): Response {
    return response(status, status === 204 ? "No Content" : "OK", JSON.stringify(body));
}

function lastCall(): [string, RequestInit?] {
    const calls = fetchMock.mock.calls;
    const [url, init] = calls[calls.length - 1] as [string, RequestInit?];
    return [url, init];
}

function lastUrl(): string {
    return lastCall()[0];
}

function lastInit(): RequestInit | undefined {
    return lastCall()[1];
}

function lastHeaders(): Record<string, string> {
    return (lastInit()?.headers ?? {}) as Record<string, string>;
}

describe("api — puerta única a la API (R4)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetchMock.mockResolvedValue(jsonResponse({}));
        global.fetch = fetchMock as unknown as typeof fetch;
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    describe("handleResponse()", () => {
        it("parsea el JSON de una respuesta exitosa", async () => {
            fetchMock.mockResolvedValue(
                jsonResponse([{ family: "OUTERWEAR", count: 2 }])
            );

            const familias = await api.getFamilies();

            expect(familias).toEqual([{ family: "OUTERWEAR", count: 2 }]);
        });

        it("204 sin cuerpo devuelve undefined sin intentar parsear", async () => {
            fetchMock.mockResolvedValue(response(204, "No Content", ""));

            await expect(
                api.verifyEmail("ana@example.com", "123456")
            ).resolves.toBeUndefined();
        });

        it("200 con cuerpo vacío también devuelve undefined", async () => {
            fetchMock.mockResolvedValue(response(200, "OK", ""));

            // register es void: el backend puede responder sin body.
            await expect(api.register(registerData)).resolves.toBeUndefined();
            expect(lastUrl()).toContain("/api/v1/auth/register");
            expect(lastInit()?.method).toBe("POST");
            expect(lastHeaders()["Content-Type"]).toBe("application/json");
        });

        it("error HTTP con cuerpo lanza con el formato API Error [status]: cuerpo", async () => {
            fetchMock.mockResolvedValue(
                response(400, "Bad Request", JSON.stringify({ message: "Familia inválida" }))
            );

            await expect(api.getFamilies()).rejects.toThrow("API Error [400]:");
        });

        it("error HTTP sin cuerpo cae a statusText, no a la cadena vacía", async () => {
            fetchMock.mockResolvedValue(response(500, "Internal Server Error", ""));

            await expect(api.getMarkets()).rejects.toThrow(
                "API Error [500]: Internal Server Error"
            );
        });
    });

    describe("catálogo", () => {
        it("getProducts sin filtros no añade query string y desactiva la caché", async () => {
            fetchMock.mockResolvedValue(jsonResponse([]));

            await api.getProducts();

            expect(lastUrl()).toContain("/api/v1/products");
            expect(lastUrl()).not.toContain("?");
            expect(lastInit()?.cache).toBe("no-store");
        });

        it("getProducts traduce filtros a query params y omite el sort por defecto", async () => {
            fetchMock.mockResolvedValue(jsonResponse([]));

            await api.getProducts({
                family: "OUTERWEAR",
                size: "M",
                color: "BLACK",
                sort: "default",
            });

            const url = lastUrl();
            expect(url).toContain("family=OUTERWEAR");
            expect(url).toContain("size=M");
            expect(url).toContain("color=BLACK");
            expect(url).not.toContain("sort=");
        });

        it("getProducts emite el sort cuando no es el por defecto", async () => {
            fetchMock.mockResolvedValue(jsonResponse([]));

            await api.getProducts({ sort: "name-asc" });

            expect(lastUrl()).toContain("sort=name-asc");
        });

        it("searchByReference codifica la referencia con barra (0432/021 → 0432%2F021)", async () => {
            fetchMock.mockResolvedValue(jsonResponse({}));

            await api.searchByReference("0432/021");

            expect(lastUrl()).toContain("reference=0432%2F021");
        });

        it("searchSemantic codifica la consulta y lleva el límite por defecto (8)", async () => {
            fetchMock.mockResolvedValue(jsonResponse([]));

            await api.searchSemantic("traje de boda");

            expect(lastUrl()).toContain("query=traje%20de%20boda");
            expect(lastUrl()).toContain("limit=8");
        });

        it("searchSemantic respeta el límite explícito", async () => {
            fetchMock.mockResolvedValue(jsonResponse([]));

            await api.searchSemantic("lana", 3);

            expect(lastUrl()).toContain("limit=3");
        });

        it("getPrice apunta al sku con su mercado", async () => {
            fetchMock.mockResolvedValue(jsonResponse({}));

            await api.getPrice(7, "ES");

            expect(lastUrl()).toContain("/api/v1/pricing/skus/7?market=ES");
        });

        it("getStock consulta el inventario del sku", async () => {
            fetchMock.mockResolvedValue(jsonResponse({}));

            await api.getStock(7);

            expect(lastUrl()).toContain("/api/v1/inventory/skus/7");
        });
    });

    describe("checkout", () => {
        it("monta Authorization, Idempotency-Key y el body JSON", async () => {
            localStorage.setItem("nexus-auth-token", "jwt-de-prueba");
            fetchMock.mockResolvedValue(jsonResponse({ orderNumber: "ORD-TEST-1" }));

            await api.checkout(checkoutRequest, "idem-key-uuid");

            expect(lastHeaders().Authorization).toBe("Bearer jwt-de-prueba");
            expect(lastHeaders()["Idempotency-Key"]).toBe("idem-key-uuid");
            expect(lastHeaders()["Content-Type"]).toBe("application/json");
            expect(JSON.parse(lastInit()?.body as string)).toEqual(checkoutRequest);
        });
    });

    describe("pedidos y devoluciones", () => {
        it("getMyOrders usa la paginación por defecto y Authorization", async () => {
            localStorage.setItem("nexus-auth-token", "jwt-de-prueba");
            fetchMock.mockResolvedValue(jsonResponse({ content: [] }));

            await api.getMyOrders();

            expect(lastUrl()).toContain("page=0&size=20");
            expect(lastHeaders().Authorization).toBe("Bearer jwt-de-prueba");
            expect(lastInit()?.cache).toBe("no-store");
        });

        it("getMyOrders respeta página y tamaño explícitos", async () => {
            fetchMock.mockResolvedValue(jsonResponse({ content: [] }));

            await api.getMyOrders(2, 5);

            expect(lastUrl()).toContain("page=2&size=5");
        });

        it("getMyOrder y getMyReturns apuntan al pedido con su sesión", async () => {
            localStorage.setItem("nexus-auth-token", "jwt-de-prueba");
            fetchMock.mockResolvedValue(jsonResponse({}));

            await api.getMyOrder("ORD-789A1ACA");
            expect(lastUrl()).toContain("/api/v1/users/me/orders/ORD-789A1ACA");
            expect(lastHeaders().Authorization).toBe("Bearer jwt-de-prueba");

            fetchMock.mockResolvedValue(jsonResponse([]));
            await api.getMyReturns("ORD-789A1ACA");
            expect(lastUrl()).toContain("/api/v1/users/me/orders/ORD-789A1ACA/returns");
        });

        it("createReturn es POST con sesión y su payload", async () => {
            localStorage.setItem("nexus-auth-token", "jwt-de-prueba");
            fetchMock.mockResolvedValue(jsonResponse({}));

            await api.createReturn("ORD-789A1ACA", { orderItemId: 11, reason: "TALLA" });

            expect(lastInit()?.method).toBe("POST");
            expect(lastHeaders().Authorization).toBe("Bearer jwt-de-prueba");
            expect(JSON.parse(lastInit()?.body as string)).toEqual({
                orderItemId: 11,
                reason: "TALLA",
            });
        });
    });

    describe("autenticación", () => {
        it("login es POST con credenciales y devuelve la sesión", async () => {
            fetchMock.mockResolvedValue(
                jsonResponse({ token: "jwt", refreshToken: "rt", user: { id: 1 } })
            );

            const sesion = await api.login({
                email: "ana@example.com",
                password: "Segura1234!",
            });

            expect(sesion.token).toBe("jwt");
            expect(lastInit()?.method).toBe("POST");
            expect(lastUrl()).toContain("/api/v1/auth/login");
        });

        it("resendVerificationCode y forgotPassword son POST con el email", async () => {
            fetchMock.mockResolvedValue(response(204, "No Content", ""));

            await expect(api.resendVerificationCode("ana@example.com")).resolves.toBeUndefined();
            expect(lastUrl()).toContain("/api/v1/auth/resend-verification?email=ana%40example.com");

            await expect(api.forgotPassword("ana@example.com")).resolves.toBeUndefined();
            expect(lastUrl()).toContain("/api/v1/auth/forgot-password?email=ana%40example.com");
            expect(lastInit()?.method).toBe("POST");
        });

        it("resetPassword codifica la contraseña en la query", async () => {
            fetchMock.mockResolvedValue(response(204, "No Content", ""));

            await expect(
                api.resetPassword("ana@example.com", "123456", "p@ ss/word!")
            ).resolves.toBeUndefined();

            const url = lastUrl();
            expect(url).toContain("/api/v1/auth/reset-password");
            expect(url).toContain("code=123456");
            // encodeURIComponent no escapa «!» (no reservado por RFC 3986)
            expect(url).toContain("newPassword=p%40%20ss%2Fword!");
        });

        it("getCurrentUser pide /auth/me con la sesión", async () => {
            localStorage.setItem("nexus-auth-token", "jwt-de-prueba");
            fetchMock.mockResolvedValue(jsonResponse({ id: 1 }));

            const usuario = await api.getCurrentUser();

            expect(usuario.id).toBe(1);
            expect(lastUrl()).toContain("/api/v1/auth/me");
            expect(lastHeaders().Authorization).toBe("Bearer jwt-de-prueba");
        });
    });

    describe("perfil, direcciones y recomendación de talla", () => {
        it("getProfile y updateProfile usan /users/me con la sesión", async () => {
            localStorage.setItem("nexus-auth-token", "jwt-de-prueba");
            fetchMock.mockResolvedValue(jsonResponse({ id: 1 }));

            await api.getProfile();
            expect(lastUrl()).toContain("/api/v1/users/me");
            expect(lastHeaders().Authorization).toBe("Bearer jwt-de-prueba");

            fetchMock.mockResolvedValue(jsonResponse({ id: 1 }));
            await api.updateProfile({ firstName: "Ana" });
            expect(lastInit()?.method).toBe("PUT");
            expect(JSON.parse(lastInit()?.body as string)).toEqual({ firstName: "Ana" });
        });

        it("direcciones: listado, alta, edición y borrado con sesión", async () => {
            localStorage.setItem("nexus-auth-token", "jwt-de-prueba");
            fetchMock.mockResolvedValue(jsonResponse([]));

            await api.getAddresses();
            expect(lastUrl()).toContain("/api/v1/users/me/addresses");

            const direccion = {
                fullName: "Ana García",
                street: "Calle Mayor 1",
                city: "Madrid",
                postalCode: "28001",
                countryCode: "ES",
                defaultAddress: true,
            };

            fetchMock.mockResolvedValue(jsonResponse({ id: 5 }));
            await api.createAddress(direccion);
            expect(lastInit()?.method).toBe("POST");
            expect(lastHeaders().Authorization).toBe("Bearer jwt-de-prueba");

            fetchMock.mockResolvedValue(jsonResponse({ id: 5 }));
            await api.updateAddress(5, direccion);
            expect(lastInit()?.method).toBe("PUT");
            expect(lastUrl()).toContain("/api/v1/users/me/addresses/5");

            fetchMock.mockResolvedValue(response(204, "No Content", ""));
            await expect(api.deleteAddress(5)).resolves.toBeUndefined();
            expect(lastInit()?.method).toBe("DELETE");
        });

        it("recommendSize es POST con el producto a recomendar", async () => {
            localStorage.setItem("nexus-auth-token", "jwt-de-prueba");
            fetchMock.mockResolvedValue(
                jsonResponse({ recommendedSize: "M", reason: "x", confidence: "Alta" })
            );

            const recomendacion = await api.recommendSize(42);

            expect(recomendacion.recommendedSize).toBe("M");
            expect(lastInit()?.method).toBe("POST");
            expect(lastUrl()).toContain("/api/v1/users/me/size-recommendation");
            expect(JSON.parse(lastInit()?.body as string)).toEqual({ productId: 42 });
        });
    });
});
