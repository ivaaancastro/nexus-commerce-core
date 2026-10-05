import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "@/lib/api";

/**
 * Reproduce el bug 1 de specs/checkout-auth: `checkout` y `getOrder` montaban
 * sus cabeceras a mano sin incluir `getAuthHeaders()`, y como
 * `/api/v1/orders/**` es `authenticated()` en SecurityConfig, el backend
 * rechazaba la petición con 401 aunque el usuario tuviera la sesión iniciada.
 */

const fetchMock = vi.fn();

type CheckoutRequest = Parameters<typeof api.checkout>[0];

const checkoutRequest: CheckoutRequest = {
    marketCode: "ES",
    items: [{ skuId: 1, warehouseCode: "WH_ARTEIXO", quantity: 1 }],
    destinationCountryCode: "ES",
};

function jsonResponse(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: "OK",
        text: async () => JSON.stringify(body),
    } as unknown as Response;
}

function sentHeaders(): Record<string, string> {
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    return (init?.headers ?? {}) as Record<string, string>;
}

describe("api — cabeceras de autenticación en /api/v1/orders/**", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetchMock.mockResolvedValue(jsonResponse({ orderNumber: "ORD-TEST-1" }));
        global.fetch = fetchMock as unknown as typeof fetch;
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    describe("checkout", () => {
        it("envía Authorization con la sesión iniciada", async () => {
            localStorage.setItem("nexus-auth-token", "jwt-de-prueba");

            await api.checkout(checkoutRequest, "idem-key-uuid-1");

            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(sentHeaders().Authorization).toBe("Bearer jwt-de-prueba");
        });

        it("conserva la cabecera Idempotency-Key (idempotencia del checkout)", async () => {
            localStorage.setItem("nexus-auth-token", "jwt-de-prueba");

            await api.checkout(checkoutRequest, "idem-key-uuid-1");

            expect(sentHeaders()["Idempotency-Key"]).toBe("idem-key-uuid-1");
            expect(sentHeaders()["Content-Type"]).toBe("application/json");
        });

        it("sin sesión no inyecta Authorization (no se manda «Bearer null»)", async () => {
            await api.checkout(checkoutRequest, "idem-key-uuid-2");

            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(sentHeaders().Authorization).toBeUndefined();
        });

        it("apunta al endpoint protegido", async () => {
            localStorage.setItem("nexus-auth-token", "jwt-de-prueba");

            await api.checkout(checkoutRequest, "idem-key-uuid-3");

            expect(fetchMock.mock.calls[0][0]).toContain("/api/v1/orders/checkout");
        });
    });

    describe("getOrder", () => {
        it("envía Authorization con la sesión iniciada", async () => {
            localStorage.setItem("nexus-auth-token", "jwt-de-prueba");

            await api.getOrder("ORD-TEST-1");

            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(sentHeaders().Authorization).toBe("Bearer jwt-de-prueba");
        });

        it("apunta al endpoint protegido", async () => {
            await api.getOrder("ORD-TEST-1");

            expect(fetchMock.mock.calls[0][0]).toContain("/api/v1/orders/ORD-TEST-1");
        });
    });

    describe("manejo de respuestas", () => {
        it("propaga el cuerpo del 401 con el formato que traduce getFriendlyErrorMessage", async () => {
            localStorage.setItem("nexus-auth-token", "jwt-caducado");
            fetchMock.mockResolvedValue(
                jsonResponse(
                    {
                        timestamp: "2026-10-05T12:44:52.643623+02:00",
                        status: 401,
                        error: "Unauthorized",
                        message: "Autenticación requerida",
                    },
                    401
                )
            );

            await expect(api.checkout(checkoutRequest, "idem-key-uuid-4")).rejects.toThrow(
                /^API Error \[401\]: /
            );
        });
    });
});
