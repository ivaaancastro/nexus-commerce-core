"use client";

import { useEffect, useState } from "react";
import { SkuPrice } from "@/types/commerce";
import { api } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/errors";

const claseInput =
    "w-24 border border-neutral-200 px-2 py-1.5 text-sm text-neutral-900 " +
    "focus:outline-none focus:border-neutral-400";
const claseBoton =
    "border border-neutral-900 bg-neutral-900 text-white text-[10px] uppercase " +
    "tracking-widest px-3 py-1.5 transition-colors hover:bg-black disabled:border-neutral-200 " +
    "disabled:bg-white disabled:text-neutral-400 disabled:cursor-not-allowed";

interface AdminSkuPricesProps {
    skuId: number;
    /** Etiqueta de la variante, p. ej. «M · Marino». */
    skuLabel: string;
    /** El toast lo renderiza la página; aquí sólo se sube el mensaje. */
    onMensaje: (mensaje: string) => void;
}

/** Estado editable de una fila de mercado. */
interface FilaEdicion {
    base: string;
    descuento: string;
    activo: boolean;
}

/**
 * Precios por mercado de un SKU dentro de la ficha de producto (Tarea 7.3, R7).
 *
 * - **Autosuficiente** (R7.1): los 4 mercados salen del propio
 *   `GET /admin/skus/{id}/prices`, sin MarketContext. Sin fila aún, el
 *   backend devuelve `nulls` → inputs vacíos y el primer guardado crea la
 *   fila (cierre de la frontera 7.2 D9).
 * - Guardado **por fila** con toast «Precio guardado» (R7.1) y validación
 *   **espejo** en cliente antes de llamar (R7.4): vacío → `null` (nunca `0`),
 *   `descuento ≤ base` y `base > 0` con máximo 2 decimales.
 */
export default function AdminSkuPrices({ skuId, skuLabel, onMensaje }: AdminSkuPricesProps) {
    const [precios, setPrecios] = useState<SkuPrice[] | null>(null);
    const [ediciones, setEdiciones] = useState<Record<string, FilaEdicion>>({});
    const [error, setError] = useState<string | null>(null);
    const [guardandoCode, setGuardandoCode] = useState<string | null>(null);
    const [erroresFila, setErroresFila] = useState<Record<string, string | null>>({});

    function inicializar(lista: SkuPrice[]): Record<string, FilaEdicion> {
        const inicial: Record<string, FilaEdicion> = {};
        for (const precio of lista) {
            inicial[precio.marketCode] = {
                base: precio.basePrice != null ? precio.basePrice.toFixed(2) : "",
                descuento: precio.discountPrice != null ? precio.discountPrice.toFixed(2) : "",
                activo: precio.isActive != null ? precio.isActive : true,
            };
        }
        return inicial;
    }

    // Carga de los 4 mercados. La cadena va inline en el efecto (patrón del
    // panel): los setState viven en callbacks de promesa, con flag `activo`.
    useEffect(() => {
        let activo = true;
        api.getAdminSkuPrices(skuId)
            .then((respuesta) => {
                if (activo) {
                    setPrecios(respuesta);
                    setEdiciones(inicializar(respuesta));
                    setError(null);
                }
            })
            .catch((err: unknown) => {
                if (activo) setError(getFriendlyErrorMessage(err));
            });
        return () => {
            activo = false;
        };
    }, [skuId]);

    function validarFila(ed: FilaEdicion): string | null {
        const base = ed.base.trim();
        if (!/^\d+(\.\d{1,2})?$/.test(base) || Number(base) <= 0) {
            return "El precio base debe ser un número mayor que 0 con máximo 2 decimales.";
        }
        const descuento = ed.descuento.trim();
        if (descuento !== "") {
            if (!/^\d+(\.\d{1,2})?$/.test(descuento) || Number(descuento) <= 0) {
                return "El descuento debe ser mayor que 0; déjalo vacío para no tener descuento.";
            }
            if (Number(descuento) > Number(base)) {
                return "El descuento no puede superar el precio base.";
            }
        }
        return null;
    }

    async function guardar(precio: SkuPrice) {
        const ed = ediciones[precio.marketCode];
        if (!ed) return;

        const fallo = validarFila(ed);
        if (fallo) {
            setErroresFila((prev) => ({ ...prev, [precio.marketCode]: fallo }));
            return;
        }
        setErroresFila((prev) => ({ ...prev, [precio.marketCode]: null }));
        setGuardandoCode(precio.marketCode);
        setError(null);

        try {
            const base = ed.base.trim();
            const descuento = ed.descuento.trim();
            const actualizado = await api.updateAdminSkuPrice(skuId, precio.marketCode, {
                basePrice: Number(base),
                discountPrice: descuento === "" ? null : Number(descuento),
                isActive: ed.activo,
            });
            // Estado de servidor y editable quedan sincronizados con la
            // respuesta: la fila deja de estar «sucia» con formato canónico.
            setPrecios((prev) =>
                prev
                    ? prev.map((p) => (p.marketCode === actualizado.marketCode ? actualizado : p))
                    : prev
            );
            setEdiciones((prev) => ({
                ...prev,
                [actualizado.marketCode]: {
                    base:
                        actualizado.basePrice != null ? actualizado.basePrice.toFixed(2) : "",
                    descuento:
                        actualizado.discountPrice != null
                            ? actualizado.discountPrice.toFixed(2)
                            : "",
                    activo: actualizado.isActive != null ? actualizado.isActive : true,
                },
            }));
            onMensaje("Precio guardado");
        } catch (err: unknown) {
            // 400 (validación del servidor), 409 o 404: mensaje amigable aquí.
            setError(getFriendlyErrorMessage(err));
        } finally {
            setGuardandoCode(null);
        }
    }

    function sucia(precio: SkuPrice): boolean {
        const ed = ediciones[precio.marketCode];
        if (!ed) return false;
        const baseOriginal = precio.basePrice != null ? precio.basePrice.toFixed(2) : "";
        const descuentoOriginal =
            precio.discountPrice != null ? precio.discountPrice.toFixed(2) : "";
        const activoOriginal = precio.isActive != null ? precio.isActive : true;
        return (
            ed.base.trim() !== baseOriginal ||
            ed.descuento.trim() !== descuentoOriginal ||
            ed.activo !== activoOriginal
        );
    }

    return (
        <div className="flex flex-col gap-3" aria-label={`Precios de la variante ${skuLabel}`}>
            <p className="text-[11px] uppercase tracking-wider text-neutral-500">
                Variante {skuLabel}
            </p>

            {error && (
                <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs">
                    {error}
                </div>
            )}

            {!precios && !error && (
                <p
                    role="status"
                    className="text-xs uppercase tracking-widest text-neutral-500 py-4"
                >
                    Cargando precios...
                </p>
            )}

            {precios && (
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="border-b border-neutral-900 text-left text-[11px] uppercase tracking-wider text-neutral-500">
                                <th scope="col" className="py-2 pr-4 font-medium">
                                    Mercado
                                </th>
                                <th scope="col" className="py-2 pr-4 font-medium">
                                    Precio base
                                </th>
                                <th scope="col" className="py-2 pr-4 font-medium">
                                    Descuento
                                </th>
                                <th scope="col" className="py-2 pr-4 font-medium">
                                    Activo
                                </th>
                                <th scope="col" className="py-2 font-medium">
                                    <span className="sr-only">Acciones</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {precios.map((precio) => {
                                const ed = ediciones[precio.marketCode];
                                if (!ed) return null;
                                const idBase = `precio-base-${skuId}-${precio.marketCode}`;
                                const idDescuento = `precio-desc-${skuId}-${precio.marketCode}`;
                                return (
                                    <tr
                                        key={precio.marketCode}
                                        className="border-b border-neutral-200 align-top"
                                    >
                                        <td className="py-3 pr-4">
                                            <span className="block text-sm text-neutral-900">
                                                {precio.marketName}
                                            </span>
                                            <span className="text-[11px] uppercase tracking-wider text-neutral-500">
                                                {precio.marketCode} · {precio.currency} · impuesto{" "}
                                                {precio.taxRate}%
                                            </span>
                                        </td>
                                        <td className="py-3 pr-4">
                                            <label htmlFor={idBase} className="sr-only">
                                                Precio base en {precio.marketName}
                                            </label>
                                            <input
                                                id={idBase}
                                                type="number"
                                                min={0}
                                                step="0.01"
                                                inputMode="decimal"
                                                value={ed.base}
                                                onChange={(e) =>
                                                    setEdiciones((prev) => ({
                                                        ...prev,
                                                        [precio.marketCode]: {
                                                            ...prev[precio.marketCode],
                                                            base: e.target.value,
                                                        },
                                                    }))
                                                }
                                                className={claseInput}
                                            />
                                        </td>
                                        <td className="py-3 pr-4">
                                            <label htmlFor={idDescuento} className="sr-only">
                                                Descuento en {precio.marketName}
                                            </label>
                                            <input
                                                id={idDescuento}
                                                type="number"
                                                min={0}
                                                step="0.01"
                                                inputMode="decimal"
                                                placeholder="sin descuento"
                                                value={ed.descuento}
                                                onChange={(e) =>
                                                    setEdiciones((prev) => ({
                                                        ...prev,
                                                        [precio.marketCode]: {
                                                            ...prev[precio.marketCode],
                                                            descuento: e.target.value,
                                                        },
                                                    }))
                                                }
                                                className={claseInput}
                                            />
                                        </td>
                                        <td className="py-3 pr-4">
                                            <label className="flex items-center gap-2 text-xs font-light text-neutral-700">
                                                <input
                                                    type="checkbox"
                                                    checked={ed.activo}
                                                    onChange={(e) =>
                                                        setEdiciones((prev) => ({
                                                            ...prev,
                                                            [precio.marketCode]: {
                                                                ...prev[precio.marketCode],
                                                                activo: e.target.checked,
                                                            },
                                                        }))
                                                    }
                                                    className="accent-neutral-900"
                                                />
                                                En venta
                                            </label>
                                        </td>
                                        <td className="py-3">
                                            <div className="flex flex-col items-start gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => guardar(precio)}
                                                    disabled={!sucia(precio) || guardandoCode === precio.marketCode}
                                                    className={claseBoton}
                                                >
                                                    {guardandoCode === precio.marketCode
                                                        ? "..."
                                                        : "Guardar precio"}
                                                </button>
                                                {erroresFila[precio.marketCode] && (
                                                    <p role="alert" className="text-xs text-red-700 max-w-[14rem]">
                                                        {erroresFila[precio.marketCode]}
                                                    </p>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
