"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { WishlistItem } from "@/types/commerce";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface WishlistContextType {
    /**
     * Favoritos de la sesión actual, en el orden del servidor (más reciente
     * primero). Sin sesión devuelve `[]` — derivado, nunca estado viejo.
     */
    items: WishlistItem[];
    /** true cuando la lista de la sesión ya resolvió (o no hay nada que cargar). */
    isHydrated: boolean;
    /** La carga inicial falló (red / token caducado): `/wishlist` ofrece «Reintentar». */
    hasLoadError: boolean;
    /** ¿Está guardado este producto? Lo consultan los corazones sin iterar la lista. */
    isSaved: (productId: number) => boolean;
    /**
     * Guarda si no estaba y quita si lo estaba (el corazón no necesita saber
     * el estado previo). **Lanza** si la red falla: el componente pinta el
     * toast y el estado queda intacto (plan D6, sin optimistas).
     */
    toggle: (productId: number) => Promise<void>;
    /** Quita un producto («Quitar» de `/wishlist`). Lanza si falla. */
    remove: (productId: number) => Promise<void>;
    /** Vacía la lista («Vaciar favoritos»). Lanza si falla. */
    clear: () => Promise<void>;
    /** Reintenta la hidratación tras un fallo de carga (R7.5). */
    reload: () => void;
}

/**
 * Valor degrado sin provider (patrón `MarketContext`): lista vacía y corazones
 * «sin guardar». Es el estado **correcto** — no un agujero — porque en la app
 * real `layout.tsx` monta `WishlistProvider` dentro de `AuthProvider` y nunca
 * degrada; el valor por defecto permite, como en `MarketContext`, renderizar
 * cabecera y páginas aislados en tests sin repetir el árbol de providers.
 */
const WishlistContext = createContext<WishlistContextType>({
    items: [],
    isHydrated: true,
    hasLoadError: false,
    isSaved: () => false,
    toggle: async () => undefined,
    remove: async () => undefined,
    clear: async () => undefined,
    reload: () => undefined,
});

/**
 * Estado global de favoritos (spec V3 wishlist, plan D6).
 *
 * <p>**Server-backed, sin `localStorage`**: el servidor es la única fuente de
 * verdad — un caché local sería exactamente el merge de dos fuentes que el
 * plan descarta. Se hidrata con `GET /wishlist` al haber sesión y se limpia al
 * cerrarla; nunca escribe de forma optimista (la respuesta del servidor manda).</p>
 *
 * <p>Sin `setState` síncrono en el cuerpo de los efectos
 * (regla `react-hooks/set-state-in-effect`): la hidratación va en cadena de
 * promesa (patrón `AuthContext`) y el corte de sesión se resuelve **en el
 * render** (patrón `Toast.tsx`, «Adjusting state when a prop changes»).</p>
 */
export function WishlistProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth();

    const [stored, setStored] = useState<WishlistItem[]>([]);
    const [hydrated, setHydrated] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [prevAuth, setPrevAuth] = useState(isAuthenticated);

    // Ajuste de estado en el render (react.dev): al cambiar la sesión, la lista
    // vieja muere aquí mismo — jamás se filtran favoritos de la cuenta anterior
    // mientras carga la de la nueva. Es el patrón de `Toast.tsx`, no un efecto.
    if (prevAuth !== isAuthenticated) {
        setPrevAuth(isAuthenticated);
        setStored([]);
        setHydrated(false);
        setLoadError(false);
    }

    useEffect(() => {
        if (isLoading || !isAuthenticated) return; // sin sesión: `items` se deriva vacío
        let cancelled = false;
        api.getWishlist()
            .then((wishlist) => {
                if (!cancelled) {
                    setStored(wishlist.items);
                    setLoadError(false);
                }
            })
            .catch(() => {
                // Token caducado u offline: lista vacía sin romper la página
                // (D6); `/wishlist` pinta «Reintentar» con `reload()`.
                if (!cancelled) setLoadError(true);
            })
            .finally(() => {
                if (!cancelled) setHydrated(true);
            });
        return () => {
            cancelled = true;
        };
    }, [isLoading, isAuthenticated, attempt]);

    // `useMemo` no es decorativo: `[]` literal (rama sin sesión) crearía un
    // array nuevo en cada render y haría re-renderizar en cadena `isSaved` y
    // `toggle` (aviso `react-hooks/exhaustive-deps` medido aquí).
    const items = useMemo(
        () => (isAuthenticated ? stored : []),
        [isAuthenticated, stored]
    );

    const isSaved = useCallback(
        (productId: number) => items.some((item) => item.product.id === productId),
        [items]
    );

    const toggle = useCallback(
        async (productId: number) => {
            if (items.some((item) => item.product.id === productId)) {
                await api.removeWishlistItem(productId);
                setStored((prev) => prev.filter((item) => item.product.id !== productId));
            } else {
                const item = await api.addWishlistItem(productId);
                setStored((prev) =>
                    prev.some((i) => i.product.id === productId)
                        ? prev
                        : [item, ...prev] // el servidor ordena por addedAt DESC: lo nuevo, arriba
                );
            }
        },
        [items]
    );

    const remove = useCallback(async (productId: number) => {
        await api.removeWishlistItem(productId);
        setStored((prev) => prev.filter((item) => item.product.id !== productId));
    }, []);

    const clear = useCallback(async () => {
        await api.clearWishlist();
        setStored([]);
    }, []);

    const reload = useCallback(() => setAttempt((n) => n + 1), []);

    return (
        <WishlistContext.Provider
            value={{
                items,
                isHydrated: isLoading ? false : isAuthenticated ? hydrated : true,
                hasLoadError: loadError,
                isSaved,
                toggle,
                remove,
                clear,
                reload,
            }}
        >
            {children}
        </WishlistContext.Provider>
    );
}

/**
 * Devuelve el contexto de favoritos **con su valor por defecto** si todavía no
 * hay `WishlistProvider` montado (patrón `useMarket`): lista vacía y corazones
 * «sin guardar». En la app real el provider vive en `layout.tsx` dentro de
 * `AuthProvider`, del que cuelga el estado de sesión, así que nunca degrada.
 */
export function useWishlist(): WishlistContextType {
    return useContext(WishlistContext);
}
