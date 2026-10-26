"use client";

import { useEffect, useRef, useState } from "react";
import ProductImage from "@/components/ProductImage";
import { imageAlt } from "@/lib/product-images";

interface ProductLightboxProps {
    /** Rutas ya resueltas `/products/…` (mínimo 1). */
    images: string[];
    name: string;
    family: string;
    /** Índice 0-based con el que se abre (R2). */
    index: number;
    /** El estado vive en `ProductGallery`: el visor sólo lo mueve. */
    setIndex: (i: number) => void;
    onClose: () => void;
}

/** Factor de zoom del patrón lupa (R6). La fuente es 1200×1600, así que ×2 cabe. */
const ZOOM = 2;

/**
 * ¿El entorno tiene puntero fino? (R6)
 *
 * <p>La condición de la spec es `@media (hover: hover) and (pointer: fine)`:
 * móvil/tablet táctil no zoomifica. Con guarda de tipo porque **jsdom no
 * implementa `matchMedia`** — en tests se sustituye `window.matchMedia` para
 * simular cada entorno.</p>
 */
function esPunteroFino(): boolean {
    return (
        typeof window.matchMedia === "function" &&
        window.matchMedia("(hover: hover) and (pointer: fine)").matches
    );
}

/**
 * Visor ampliado de la galería de la ficha (V2 — R2..R7).
 *
 * <p>Diálogo modal (`role="dialog"` + `aria-modal`, patrón `CartDrawer`) con
 * **trampa de foco**, cierre por ✕/Escape/fondo (con guarda anti-arrastre),
 * navegación **circular** ‹/› y ←/→, contador `role="status"` y **zoom ×2**
 * de hover sólo con puntero fino.</p>
 *
 * <p>La imagen grande reutiliza {@link ProductImage}: mismo `alt` y el mismo
 * placeholder si el fichero falta (defensa en profundidad). La caja tiene
 * relación de aspecto reservada ⇒ abrir no desplaza nada (CLS 0).</p>
 */
export default function ProductLightbox({
    images,
    name,
    family,
    index,
    setIndex,
    onClose,
}: ProductLightboxProps) {
    const dialogoRef = useRef<HTMLDivElement>(null);
    const cerrarRef = useRef<HTMLButtonElement>(null);
    /** Anti-arrastre (R4): el clic cierra sólo si empieza Y acaba en el fondo. */
    const origenFondo = useRef(false);
    const destinoFondo = useRef(false);
    /** Posición del cursor dentro de la imagen, en % — origen del zoom (R6). */
    const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);

    const total = images.length;
    const esFondo = (target: EventTarget | null) =>
        target === dialogoRef.current;

    // Foco inicial: botón ✕ (R5).
    useEffect(() => {
        cerrarRef.current?.focus();
    }, []);

    // Scroll del body bloqueado mientras está abierto y restaurado al cerrar
    // — también en cleanup, por si la ruta cambia con el visor puesto (R4).
    useEffect(() => {
        const previo = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previo;
        };
    }, []);

    // Teclado global del diálogo: Escape · ←/→ (circulares) · trampa Tab (R3/R5).
    useEffect(() => {
        const alPulsar = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                onClose();
                return;
            }
            if (total > 1 && e.key === "ArrowLeft") {
                e.preventDefault();
                setIndex((index - 1 + total) % total);
                return;
            }
            if (total > 1 && e.key === "ArrowRight") {
                e.preventDefault();
                setIndex((index + 1) % total);
                return;
            }
            if (e.key !== "Tab") return;

            const dialogo = dialogoRef.current;
            if (!dialogo) return;
            const foco = [
                ...dialogo.querySelectorAll<HTMLElement>("button, a[href]"),
            ];
            if (foco.length === 0) {
                e.preventDefault();
                return;
            }
            const primero = foco[0];
            const ultimo = foco[foco.length - 1];
            const activo = document.activeElement;
            if (e.shiftKey) {
                if (activo === primero || !dialogo.contains(activo)) {
                    e.preventDefault();
                    ultimo.focus();
                }
            } else if (activo === ultimo || !dialogo.contains(activo)) {
                e.preventDefault();
                primero.focus();
            }
        };
        document.addEventListener("keydown", alPulsar);
        return () => document.removeEventListener("keydown", alPulsar);
    }, [index, total, onClose, setIndex]);

    const anterior = () => setIndex((index - 1 + total) % total);
    const siguiente = () => setIndex((index + 1) % total);

    // Zoom lupa (R6): sólo con puntero fino; el origen sigue al cursor y, si el
    // navegador no mide la caja (jsdom), cae al centro — determinista en tests.
    const alMoverElCursor = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!esPunteroFino()) {
            setZoom(null);
            return;
        }
        const r = e.currentTarget.getBoundingClientRect();
        const medido = r.width > 0 && r.height > 0;
        setZoom({
            x: medido ? ((e.clientX - r.left) / r.width) * 100 : 50,
            y: medido ? ((e.clientY - r.top) / r.height) * 100 : 50,
        });
    };

    return (
        <div
            ref={dialogoRef}
            role="dialog"
            aria-modal="true"
            aria-label="Galería ampliada de producto"
            data-testid="product-lightbox"
            onMouseDown={(e) => {
                origenFondo.current = esFondo(e.target);
            }}
            onMouseUp={(e) => {
                destinoFondo.current = esFondo(e.target);
            }}
            onClick={(e) => {
                if (origenFondo.current && destinoFondo.current && esFondo(e.target)) {
                    onClose();
                }
            }}
            className="fixed inset-0 z-[60] bg-neutral-950/95 flex flex-col"
        >
            {/* Cerrar (foco inicial) */}
            <button
                ref={cerrarRef}
                type="button"
                aria-label="Cerrar visor"
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-2 text-white opacity-70 hover:opacity-100 transition-opacity duration-300 motion-reduce:transition-none"
            >
                <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                    />
                </svg>
            </button>

            {/* Imagen ampliada — caja con aspecto reservado, sin CLS (R2) */}
            <div className="flex-1 min-h-0 flex items-center justify-center px-4">
                <div className="relative w-full aspect-[3/4] max-w-[calc((100vh_-_9rem)*0.75)] overflow-hidden">
                    <div
                        className="absolute inset-0 cursor-zoom-in transition-transform duration-300 motion-reduce:transition-none"
                        style={{
                            transform: zoom ? `scale(${ZOOM})` : "scale(1)",
                            transformOrigin: zoom
                                ? `${zoom.x}% ${zoom.y}%`
                                : "50% 50%",
                        }}
                        onMouseEnter={alMoverElCursor}
                        onMouseMove={alMoverElCursor}
                        onMouseLeave={() => setZoom(null)}
                    >
                        <ProductImage
                            src={images[index]}
                            alt={imageAlt(name, index)}
                            sizes="100vw"
                            name={name}
                            family={family}
                            eager
                        />
                    </div>
                </div>
            </div>

            {/* Navegación circular — sólo con más de una imagen (R3) */}
            {total > 1 && (
                <>
                    <button
                        type="button"
                        aria-label="Imagen anterior"
                        onClick={anterior}
                        className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2 text-white opacity-70 hover:opacity-100 transition-opacity duration-300 motion-reduce:transition-none"
                    >
                        <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.5}
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15 18l-6-6 6-6"
                            />
                        </svg>
                    </button>
                    <button
                        type="button"
                        aria-label="Imagen siguiente"
                        onClick={siguiente}
                        className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2 text-white opacity-70 hover:opacity-100 transition-opacity duration-300 motion-reduce:transition-none"
                    >
                        <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.5}
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M9 18l6-6-6-6"
                            />
                        </svg>
                    </button>
                </>
            )}

            {/* Contador anunciado a los lectores (R3/R7) */}
            <p
                role="status"
                className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-xs font-medium uppercase tracking-widest"
            >
                {index + 1} / {total}
            </p>
        </div>
    );
}
