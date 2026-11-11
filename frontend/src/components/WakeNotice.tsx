"use client";

import { useEffect, useState } from "react";

/** Umbral a partir del cual la primera respuesta se considera «arranque en frío» (R12). */
export const WAKE_THRESHOLD_MS = 4000;

const ACTIVE = process.env.NEXT_PUBLIC_DEMO === "1";

/**
 * Estado de despertar del backend (Fase 10, R12 · D5).
 *
 * <p>En el plan gratuito de Render el backend duerme tras 15 min sin tráfico y
 * tarda ~1 min en volver. Esconderlo daría la peor primera impresión: si la
 * primera petición a la API (`GET /markets`, la misma sonda de *readiness*
 * de los E2E) tarda más de 4 s, se avisa en voz alta y el aviso se retira en
 * cuanto llega una respuesta — o un error, que ya pinta cada página.</p>
 *
 * <p>Solo con `NEXT_PUBLIC_DEMO=1` (build de Vercel): no puede depender del
 * `demoMode` del backend porque precisamente el backend es lo que está
 * dormido (A3). Sin la variable el componente no hace nada.</p>
 */
export default function WakeNotice({ active = ACTIVE }: { active?: boolean }) {
    const [waking, setWaking] = useState(false);

    useEffect(() => {
        if (!active) return;
        let settled = false;
        const timer = setTimeout(() => {
            if (!settled) setWaking(true);
        }, WAKE_THRESHOLD_MS);

        const done = () => {
            settled = true;
            clearTimeout(timer);
            setWaking(false);
        };
        // Se consume el cuerpo: una respuesta sin leer queda abierta en el
        // navegador (medido: `networkidle` nunca llegaba en el build de demo).
        fetch("/api/v1/markets", { cache: "no-store" })
            .then((res) => res.text())
            .then(done, done);

        return () => {
            settled = true;
            clearTimeout(timer);
        };
    }, [active]);

    if (!waking) return null;

    return (
        <div
            role="status"
            className="fixed inset-x-0 top-0 z-[70] bg-neutral-900 text-white text-xs uppercase tracking-widest text-center px-4 py-3"
        >
            Despertando la demo, tarda hasta un minuto la primera vez…
        </div>
    );
}
