import { describe, it, expect } from "vitest";
import { createI18n } from "@/lib/i18n";
import es from "@/lib/locales/es";
import en from "@/lib/locales/en";

describe("createI18n / t (Fase 12)", () => {
    const i18n = createI18n({ es, en }, "es");

    it("devuelve el texto en español por defecto", () => {
        expect(i18n.t("nav.collection")).toBe("Colección");
        expect(i18n.t("cart.checkout")).toBe("Finalizar compra");
    });

    it("cambia a inglés con setLocale", () => {
        i18n.setLocale("en");
        expect(i18n.t("nav.collection")).toBe("Collection");
        expect(i18n.t("cart.checkout")).toBe("Checkout");
    });

    it("vuelve a español", () => {
        i18n.setLocale("es");
        expect(i18n.t("nav.collection")).toBe("Colección");
    });

    it("expones el locale activo", () => {
        expect(i18n.locale).toBe("es");
        i18n.setLocale("en");
        expect(i18n.locale).toBe("en");
    });

    it("clave faltante devuelve la clave misma (fallback, nunca lanza)", () => {
        i18n.setLocale("es");
        expect(i18n.t("no.existe")).toBe("no.existe");
        i18n.setLocale("en");
        expect(i18n.t("no.existe")).toBe("no.existe");
    });

    it("los diccionarios es y en tienen las mismas claves", () => {
        const clavesEs = Object.keys(es);
        const clavesEn = Object.keys(en);
        expect(clavesEn.length).toBe(clavesEs.length);
        for (const clave of clavesEs) {
            expect(clavesEn).toContain(clave);
            expect(String(en[clave as keyof typeof en]).length).toBeGreaterThan(0);
        }
    });

    it("defaultLocale distinto de es funciona", () => {
        const i18nEn = createI18n({ es, en }, "en");
        expect(i18nEn.locale).toBe("en");
        expect(i18nEn.t("nav.collection")).toBe("Collection");
    });

    it("locale ignorado si no es es/en", () => {
        const i18n = createI18n({ es, en }, "es");
        i18n.setLocale("en");
        // @ts-expect-error — forzamos un locale inválido para probar la guardia
        i18n.setLocale("fr");
        expect(i18n.locale).toBe("en");
    });
});
