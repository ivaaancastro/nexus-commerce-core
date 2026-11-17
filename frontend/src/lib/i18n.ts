/**
 * i18n ligero (Fase 12 — opcional).
 *
 * Utilidad propia sin dependencias externas (decisión D1 del plan).
 * Expone `createI18n(locales, defaultLocale)` que devuelve `{ t, locale, setLocale }`.
 * `t(key)` devuelve el texto en el idioma activo; si falta la clave, devuelve la
 * clave misma (fallback visible, nunca lanza ni deja la UI en blanco — D4/D8).
 *
 * El idioma se lee de `localStorage` (clave `nexus-locale`) si hay `window`;
 * si no (SSR / tests sin DOM), se usa el `defaultLocale`.
 */

export type Locale = "es" | "en";

export interface I18n {
    /** Idioma activo. */
    readonly locale: Locale;
    /** Cambia el idioma y lo persiste en localStorage. */
    setLocale: (locale: Locale) => void;
    /** Traduce una clave al idioma activo. Fallback: devuelve la clave misma. */
    t: (key: string) => string;
}

const DEFAULT_LOCALE: Locale = "es";
const STORAGE_KEY = "nexus-locale";

function readStoredLocale(): Locale {
    if (typeof window === "undefined") return DEFAULT_LOCALE;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === "es" || raw === "en") return raw;
    } catch {
        // localStorage inaccesible (modo privado, quota, etc.): se ignora.
    }
    return DEFAULT_LOCALE;
}

function persistLocale(locale: Locale): void {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(STORAGE_KEY, locale);
    } catch {
        // localStorage inaccesible: se ignora, el idioma vive solo en memoria.
    }
}

/**
 * Crea una instancia de i18n sobre los diccionarios dados.
 *
 * `locales` mapea código de idioma → objeto de claves a texto.
 * `defaultLocale` es el idioma usado cuando no hay nada en localStorage.
 */
export function createI18n(
    locales: Record<Locale, Record<string, string>>,
    defaultLocale: Locale = DEFAULT_LOCALE,
): I18n {
    let current =
        (readStoredLocale() as Locale | undefined) ?? defaultLocale;

    function t(key: string): string {
        const dict = locales[current];
        const value = dict?.[key];
        return typeof value === "string" && value.length > 0 ? value : key;
    }

    function setLocale(locale: Locale): void {
        if (locale !== "es" && locale !== "en") return;
        current = locale;
        persistLocale(locale);
    }

    return {
        get locale(): Locale {
            return current;
        },
        setLocale,
        t,
    };
}
