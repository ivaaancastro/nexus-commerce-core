import { describe, it, expect } from "vitest";
import {
    formatTaxRate,
    taxRateFromAmounts,
    taxesIncludedAmount,
    taxesIncludedLabel,
} from "@/lib/taxes";

// R4: la vitrina es multimercado (ES 21 %, UK 20 %, US 7,25 %) y habla de
// «Impuestos» en todos. El texto debe llevar el porcentaje siempre.

describe("taxesIncludedAmount (spec final-price-display, D3)", () => {
    it("deriva la parte incluida dividiendo, sin sumarla encima", () => {
        // GIVEN — 79,95 es precio **final** al 21 %
        // THEN — 79,95 × 21/121 = 13,88… (la parte real; sumar el 21 % daba 16,79)
        expect(taxesIncludedAmount(79.95, 21)).toBeCloseTo(13.88, 2);
    });

    it("no se inventa dinero: la suma de la nota con el resto da el subtotal", () => {
        // GIVEN / WHEN
        const incluido = taxesIncludedAmount(89.95, 21);

        // THEN — el total que cobra el checkout sigue siendo el subtotal
        expect(89.95 - incluido + incluido).toBe(89.95);
        expect(89.95 - incluido).toBeCloseTo(74.34, 2); // base imponible
    });

    it("respeta tasas sin impuesto (0 %) y casos borde", () => {
        // GIVEN / WHEN / THEN — un mercado sin impuesto no inventa uno
        expect(taxesIncludedAmount(50, 0)).toBe(0);
        // Subtotal vacío
        expect(taxesIncludedAmount(0, 21)).toBe(0);
        // Datos corruptos en vez de NaN en pantalla
        expect(taxesIncludedAmount(Number.NaN, 21)).toBe(0);
        expect(taxesIncludedAmount(10, -1)).toBe(0);
    });
});

describe("formatTaxRate", () => {
    it("recorta el ruido de coma flotante del dato de BD", () => {
        // GIVEN / WHEN / THEN — 21.000000000000004 no llega al copy
        expect(formatTaxRate(21.000000000000004)).toBe("21");
        expect(formatTaxRate(20)).toBe("20");
    });

    it("conserva un decimal cuando la tasa lo tiene", () => {
        // GIVEN / WHEN / THEN
        expect(formatTaxRate(7.25)).toBe("7.3"); // redondeo a 1 decimal
        expect(formatTaxRate(20.5)).toBe("20.5");
    });
});

describe("taxesIncludedLabel (R4 — texto neutro y uniforme)", () => {
    it("siempre lleva el porcentaje", () => {
        // GIVEN / WHEN / THEN
        expect(taxesIncludedLabel(21)).toBe("Impuestos incluidos (21 %)");
        expect(taxesIncludedLabel(20)).toBe("Impuestos incluidos (20 %)");
    });

    it("usa «Impuestos» en todos los mercados (ES, UK y US)", () => {
        // GIVEN — las tres tasas reales del catálogo
        const mercados = [21, 20, 7.25];

        // WHEN / THEN — una sola voz para tres impuestos distintos
        for (const rate of mercados) {
            expect(taxesIncludedLabel(rate)).toMatch(/^Impuestos incluidos \([\d.]+ %\)$/);
        }
    });
});

describe("taxRateFromAmounts (R3 — la tasa de un pedido cobrado)", () => {
    it("recupera el porcentaje de los importes firmados por el backend", () => {
        // GIVEN — un pedido ES: 66,07 netos + 13,88 de impuesto = 79,95
        // THEN — 13,88/66,07×100 = 21,007… y se pinta «21»
        expect(formatTaxRate(taxRateFromAmounts(13.88, 66.07))).toBe("21");
    });

    it("no adivina con la tasa del mercado activo: sirve para UK (20 %)", () => {
        // GIVEN — un pedido UK: 83,33 netos + 16,67 = 100,00
        // THEN
        expect(formatTaxRate(taxRateFromAmounts(16.67, 83.33))).toBe("20");
    });

    it("devuelve 0 en vez de infinito cuando no hay base", () => {
        // GIVEN / WHEN / THEN — un pedido sin importes no puede sacar tasa
        expect(taxRateFromAmounts(0, 0)).toBe(0);
        expect(taxRateFromAmounts(13.88, 0)).toBe(0);
        expect(taxRateFromAmounts(Number.NaN, 66.07)).toBe(0);
    });
});
