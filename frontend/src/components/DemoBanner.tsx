"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";

/**
 * Aviso de «demo pública» (Fase 10, R6 · D4).
 *
 * <p>Solo aparece si el backend declara `demoMode` en `GET /payments/config`
 * (A3: una única fuente). Va **fijo** abajo a la izquierda: no empuja la
 * maqueta, así que no hay CLS aunque llegue tarde. Si la petición falla o el
 * modo está apagado (dev, CI), no pinta nada.</p>
 *
 * <p>En la propia `/proyecto` no tiene sentido enlazar a `/proyecto`.</p>
 */
export default function DemoBanner() {
    const [demo, setDemo] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        let cancelled = false;
        api.getPaymentConfig()
            .then((config) => {
                if (!cancelled && config?.demoMode) setDemo(true);
            })
            .catch(() => {
                // Sin backend no hay banner: el resto de la página ya informa del error.
            });
        return () => {
            cancelled = true;
        };
    }, []);

    if (!demo || pathname === "/proyecto") return null;

    return (
        <aside
            aria-label="Demo pública"
            className="fixed bottom-4 left-4 z-40 max-w-[calc(100vw-2rem)] bg-neutral-900 text-white text-[11px] uppercase tracking-widest px-4 py-3 shadow-lg"
        >
            Demo pública · datos de prueba ·{" "}
            <Link href="/proyecto" className="underline underline-offset-4 hover:text-neutral-300">
                Ver el proyecto
            </Link>
        </aside>
    );
}
