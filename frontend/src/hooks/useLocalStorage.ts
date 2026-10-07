"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Hook de persistencia en localStorage con sincronización automática.
 *
 * `localStorage` es un sistema externo a React, así que se lee con
 * `useSyncExternalStore` y no con un efecto + `setState`: el valor ya está en
 * el **primer render** (sin renders en cascada y sin el `setState` en el cuerpo
 * del efecto que prohíbe `react-hooks/set-state-in-effect`), es seguro con SSR
 * —durante el hidratado se usa `getServerSnapshot` y React repinta con el valor
 * real sin desajuste— y además se sincroniza entre pestañas gracias al evento
 * `storage`.
 *
 * Maneja errores de `JSON.parse` de forma silenciosa: conserva el valor inicial
 * y avisa por consola.
 */

/**
 * Caché por clave: `getSnapshot` debe devolver **siempre la misma referencia**
 * mientras el contenido no cambie, si no React lanza «The result of getSnapshot
 * should be cached». Se invalida al escribir y al recibir el evento `storage`.
 */
const snapshots = new Map<string, { raw: string | null; value: unknown }>();

/**
 * Snapshot de servidor: allí no hay `localStorage`, así que se queda en el
 * valor inicial. También se cachea porque los llamadores pasan literales en
 * línea (`[]`) que cambiarían de identidad en cada llamada.
 */
const serverSnapshots = new Map<string, unknown>();

/** Suscriptores por clave, para poder avisarles desde `setValue`. */
const listeners = new Map<string, Set<() => void>>();

function subscribeKey(key: string, listener: () => void): () => void {
    let set = listeners.get(key);
    if (!set) {
        set = new Set();
        listeners.set(key, set);
    }
    set.add(listener);

    // Otra pestaña (o un `clear()` del navegador) cambia la clave: hay que
    // invalidar la caché y despertar a React, que por su cuenta no se entera.
    const onStorage = (event: StorageEvent) => {
        if (event.key !== null && event.key !== key) return;
        snapshots.delete(key);
        listener();
    };
    window.addEventListener("storage", onStorage);

    return () => {
        listeners.get(key)?.delete(listener);
        window.removeEventListener("storage", onStorage);
    };
}

function readSnapshot<T>(key: string, initialValue: T): T {
    const raw = window.localStorage.getItem(key);
    const cached = snapshots.get(key);
    if (cached && cached.raw === raw) {
        return cached.value as T;
    }

    let value: T = initialValue;
    if (raw !== null) {
        try {
            value = JSON.parse(raw) as T;
        } catch (error) {
            console.warn(`Error leyendo localStorage key "${key}":`, error);
        }
    }
    snapshots.set(key, { raw, value });
    return value;
}

function readServerSnapshot<T>(key: string, initialValue: T): T {
    if (!serverSnapshots.has(key)) {
        serverSnapshots.set(key, initialValue);
    }
    return serverSnapshots.get(key) as T;
}

/** Suscripción inútil pero estable: el estado de hidratado no tiene store. */
function subscribeNever(): () => void {
    return () => void 0;
}
const hydratedOnClient = () => true;
const hydratedOnServer = () => false;

export function useLocalStorage<T>(key: string, initialValue: T) {
    // Sólo `subscribe` tiene que ser estable: si cambia, React se da de baja y
    // vuelve a suscribirse en cada render.
    const subscribe = useCallback((listener: () => void) => subscribeKey(key, listener), [key]);

    const storedValue = useSyncExternalStore(
        subscribe,
        () => readSnapshot(key, initialValue),
        () => readServerSnapshot(key, initialValue)
    );

    // Equivalente al antiguo `isHydrated` que apagaba un efecto: `false` en
    // servidor y durante el hidratado, `true` en cuanto el cliente ya ve el
    // valor real. Los consumidores (carrito y mercado) siguen esperando igual.
    const isHydrated = useSyncExternalStore(subscribeNever, hydratedOnClient, hydratedOnServer);

    const setValue = (value: T | ((val: T) => T)) => {
        if (typeof window === "undefined") return;
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        try {
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.warn(`Error escribiendo localStorage key "${key}":`, error);
            return;
        }
        snapshots.delete(key);
        listeners.get(key)?.forEach((listener) => listener());
    };

    return [storedValue, setValue, isHydrated] as const;
}
