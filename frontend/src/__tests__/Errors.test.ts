import { describe, it, expect } from "vitest";
import { getFriendlyErrorMessage, isUnverifiedEmailError } from "@/lib/errors";

/**
 * Réplica exacta del mensaje que genera `handleResponse()` en lib/api.ts:
 * `API Error [${res.status}]: ${errorText || res.statusText}`.
 */
const apiError = (status: number, body: string) => new Error(`API Error [${status}]: ${body}`);

describe("getFriendlyErrorMessage", () => {
    describe("Códigos HTTP del proyecto (R3 de specs/checkout-auth)", () => {
        it("401 — traduce el error reportado por el usuario sin filtrar el técnico", () => {
            // Literal del reporte del 2026-10-05
            const crudo = apiError(
                401,
                '{"timestamp":"2026-10-05T12:44:52.643623+02:00","status":401,' +
                    '"error":"Unauthorized","message":"Autenticación requerida"}'
            );

            const mensaje = getFriendlyErrorMessage(crudo);

            expect(mensaje).toBe("Tu sesión ha caducado. Inicia de nuevo para continuar.");
            expect(mensaje).not.toContain("API Error");
            expect(mensaje).not.toContain("timestamp");
            expect(mensaje).not.toContain("Unauthorized");
            expect(mensaje).not.toContain("401");
        });

        it("403 — explica la falta de permisos", () => {
            expect(getFriendlyErrorMessage(apiError(403, '{"error":"Forbidden"}'))).toBe(
                "No tienes permiso para realizar esta acción."
            );
        });

        it("404 — explica que no hay nada que mostrar", () => {
            expect(getFriendlyErrorMessage(apiError(404, "Order not found"))).toBe(
                "No encontramos lo que buscas."
            );
        });

        it("409 — explica el conflicto de stock", () => {
            expect(
                getFriendlyErrorMessage(apiError(409, '{"message":"Stock insuficiente"}'))
            ).toBe("No queda stock suficiente para completar el pedido.");
        });

        it("500 — sugiere reintentar más tarde", () => {
            expect(getFriendlyErrorMessage(apiError(500, "Internal Server Error"))).toBe(
                "Algo salió mal. Inténtalo de nuevo en unos minutos."
            );
        });

        it("fallback — devuelve un mensaje amigable, nunca el técnico", () => {
            const mensaje = getFriendlyErrorMessage(apiError(418, "Soy una tetera"));
            expect(mensaje).toBe("Algo salió mal. Inténtalo de nuevo.");
            expect(mensaje).not.toContain("API Error");
        });

        it("no-Error — devuelve un mensaje amigable", () => {
            expect(getFriendlyErrorMessage("fallo raro")).toBe(
                "Algo salió mal. Inténtalo de nuevo."
            );
        });
    });

    describe("Matching anclado al prefijo (evita falsos positivos)", () => {
        it("no confunde «401» dentro de un importe con un error HTTP 401", () => {
            // El importe 401.00 aparece en el cuerpo: sin anclaje esto devolvería
            // el mensaje de sesión caducada, que es falso.
            const mensaje = getFriendlyErrorMessage(
                apiError(400, '{"campo":"total","valor":"401.00"}')
            );

            expect(mensaje).not.toBe("Tu sesión ha caducado. Inicia de nuevo para continuar.");
        });

        it("no confunde «500» dentro de un importe con un error HTTP 500", () => {
            const mensaje = getFriendlyErrorMessage(apiError(409, '{"detalle":"500.00"}'));

            expect(mensaje).toBe("No queda stock suficiente para completar el pedido.");
            expect(mensaje).not.toContain("unos minutos");
        });
    });

    describe("Reglas de negocio preexistentes", () => {
        it("consigue el error de email no verificado", () => {
            const error = new Error("Email no verificado");
            expect(getFriendlyErrorMessage(error)).toContain("verificar tu email");
            expect(isUnverifiedEmailError(error)).toBe(true);
        });

        it("consigue el error de credenciales inválidas", () => {
            expect(getFriendlyErrorMessage(new Error("Credenciales inválidas"))).toBe(
                "El email o la contraseña son incorrectos."
            );
        });

        it("consigue el error de formato de email", () => {
            expect(
                getFriendlyErrorMessage(
                    new Error('Value "ana@" did not match the expected pattern')
                )
            ).toContain("formato del email");
        });
    });
});
