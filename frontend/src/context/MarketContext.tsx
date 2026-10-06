"use client";

import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { Market } from "@/types/commerce";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { api } from "@/lib/api";

/**
 * Mercado por defecto (Tarea 3.2, R3).
 *
 * Coincide con la semilla de `V1__initial_schema.sql`. Se usa en tres casos:
 * primer arranque sin localStorage, valor corrupto, y cuando el backend ya no
 * devuelve el código que el usuario tenía guardado.
 */
export const DEFAULT_MARKET: Market = {
    code: "ES",
    name: "España",
    currency: "EUR",
    taxRate: 21,
};

interface MarketContextType {
    /** Lista desde `GET /api/v1/markets`; vacía mientras no cargue o si falla. */
    markets: Market[];
    /** Mercado activo — siempre definido y válido. */
    market: Market;
    setMarketCode: (code: string) => void;
}

const MarketContext = createContext<MarketContextType>({
    markets: [],
    market: DEFAULT_MARKET,
    // Inalcanzable en la práctica: sin provider no hay lista y por tanto no se
    // pinta el <select> del header.
    setMarketCode: () => undefined,
});

/**
 * Guardia para lo que salga de localStorage: ahí puede haber cualquier JSON
 * válido que no sea un mercado (R3). Sin esto, `stored.code` sería `undefined`
 * y el selector pintaría «undefined / undefined» antes de que el endpoint
 * devolviera la lista.
 */
function isValidMarket(value: unknown): value is Market {
    if (!value || typeof value !== "object") return false;
    const m = value as Partial<Market>;
    return (
        typeof m.code === "string" &&
        m.code.length > 0 &&
        typeof m.name === "string" &&
        typeof m.currency === "string" &&
        m.currency.length > 0 &&
        typeof m.taxRate === "number" &&
        Number.isFinite(m.taxRate)
    );
}

export function MarketProvider({ children }: { children: ReactNode }) {
    const [stored, setStored, isHydrated] = useLocalStorage<Market>(
        "nexus-market",
        DEFAULT_MARKET
    );
    const [markets, setMarkets] = useState<Market[]>([]);

    // El endpoint es la única fuente de verdad de la lista (R1): si mañana se
    // da de alta un mercado en la tabla `markets`, aparece sin tocar TypeScript.
    useEffect(() => {
        let cancelled = false;
        api.getMarkets()
            .then((list) => {
                if (!cancelled && Array.isArray(list) && list.length > 0) {
                    setMarkets(list);
                }
            })
            .catch(() => {
                // Sin red: no se pinta el selector y sigue vigente el mercado
                // por defecto. La app entera no depende de esta llamada.
            });
        return () => {
            cancelled = true;
        };
    }, []);

    // R3 — valida lo persistido contra la lista real del backend.
    useEffect(() => {
        if (!isHydrated || markets.length === 0) return;

        if (!isValidMarket(stored) || !markets.some((m) => m.code === stored.code)) {
            // Corrupto o código que el backend ya no devuelve → vuelve a ES.
            setStored(
                markets.find((m) => m.code === DEFAULT_MARKET.code) ?? markets[0]
            );
            return;
        }

        // Refresca nombre/divisa/tasa por si han cambiado en el backend.
        const fresh = markets.find((m) => m.code === stored.code);
        if (
            fresh &&
            (fresh.name !== stored.name ||
                fresh.currency !== stored.currency ||
                fresh.taxRate !== stored.taxRate)
        ) {
            setStored(fresh);
        }
    }, [isHydrated, markets, stored, setStored]);

    // Siempre un mercado utilizable, aunque localStorage esté roto.
    const market = useMemo(
        () => (isValidMarket(stored) ? stored : DEFAULT_MARKET),
        [stored]
    );

    // Síncrono a propósito: MarketContext no conoce el carrito. Es CartContext
    // (montado por debajo, D5) quien observa `market.code` y re-precifica.
    const setMarketCode = (code: string) => {
        const found = markets.find((m) => m.code === code);
        if (found) setStored(found);
    };

    return (
        <MarketContext.Provider value={{ markets, market, setMarketCode }}>
            {children}
        </MarketContext.Provider>
    );
}

/**
 * Devuelve el contexto de mercado **con su valor por defecto** si todavía no hay
 * `MarketProvider` montado: mercado `ES` y lista vacía.
 *
 * Se eligió el valor por defecto de `createContext` frente a lanzar un error
 * porque el estado degradado es correcto **e imposible de pasar por alto**: sin
 * provider no hay lista de mercados, así que el `<select>` del header no se pinta
 * y la ausencia de la feature salta a la vista. De paso, permite renderizar el
 * carrito y las páginas aislados en tests sin repetir el árbol de providers.
 *
 * En la aplicación real `layout.tsx` monta `MarketProvider` envolviendo a
 * `CartProvider` (D5), por lo que nunca degrada.
 */
export function useMarket(): MarketContextType {
    return useContext(MarketContext);
}
