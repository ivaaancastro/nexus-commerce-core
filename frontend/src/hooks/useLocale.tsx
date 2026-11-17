"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { createI18n, type Locale } from "@/lib/i18n";
import es from "@/lib/locales/es";
import en from "@/lib/locales/en";

const locales: Record<Locale, Record<string, string>> = { es, en };

/**
 * Contexto de idioma (Fase 12 — i18n ES/EN).
 *
 * Patrón `MarketContext`: devuelve un valor por defecto (`es`) sin `throw`
 * cuando no hay provider montado, para que los tests que renderizan
 * componentes aislados sigan funcionando. El degradado es silencioso y
 * nunca rompe la UI.
 *
 * El idioma se lee de `localStorage` (clave `nexus-locale`) y es
 * independiente del mercado (D2/D4 del plan).
 */

interface LocaleContextType {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: (key: string) => string;
}

const LocaleContext = createContext<LocaleContextType>({
    locale: "es",
    setLocale: () => undefined,
    t: (key) => key,
});

export function LocaleProvider({ children }: { children: ReactNode }) {
    const [storedLocale, setStoredLocale] = useState<Locale>(() =>
        typeof window === "undefined" ? "es" : (readStoredLocale() as Locale)
    );

    const i18n = useMemo(() => createI18n(locales, "es"), []);

    function setLocale(locale: Locale): void {
        if (locale !== "es" && locale !== "en") return;
        i18n.setLocale(locale);
        setStoredLocale(locale);
    }

    return (
        <LocaleContext.Provider value={{ locale: storedLocale, setLocale, t: i18n.t }}>
            {children}
        </LocaleContext.Provider>
    );
}

export function useLocale(): LocaleContextType {
    return useContext(LocaleContext);
}

function readStoredLocale(): Locale {
    if (typeof window === "undefined") return "es";
    try {
        const raw = localStorage.getItem("nexus-locale");
        if (raw === "es" || raw === "en") return raw;
    } catch {
        // localStorage inaccesible (modo privado, quota, etc.): se ignora.
    }
    return "es";
}
