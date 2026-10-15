"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StockCell, StockMatrix } from "@/types/commerce";
import { api } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/errors";
import Toast from "@/components/Toast";

/**
 * Matriz de stock por almacén (Tarea 7.3, R6).
 *
 * - **Una fila por SKU**, una columna por almacén (embebidos en la
 *   respuesta) y el ATS total de la fila (suma de nets).
 * - Guardado **por celda**: el botón sólo se habilita si la celda cambió;
 *   el éxito actualiza la celda con la respuesta del servidor y lanza el
 *   toast (R6.3), y cualquier fallo se queda en la propia celda con mensaje
 *   amigable — sin toast de éxito (R6.4).
 * - `quantityReserved` es **sólo lectura**: lo mueve el checkout (plan D3).
 */
const claseInput =
    "w-24 border border-neutral-200 px-2 py-1.5 text-sm text-neutral-900 " +
    "focus:outline-none focus:border-neutral-400";
const claseBoton =
    "border border-neutral-900 bg-neutral-900 text-white text-[10px] uppercase " +
    "tracking-widest px-3 py-1.5 transition-colors hover:bg-black disabled:border-neutral-200 " +
    "disabled:bg-white disabled:text-neutral-400 disabled:cursor-not-allowed";

interface CeldaProps {
    skuId: number;
    referenceCode: string;
    cell: StockCell;
    /** Tras un guardado exitoso, la página actualiza la matriz y el toast. */
    onGuardado: (skuId: number, actualizada: StockCell) => void;
}

function CeldaStock({ skuId, referenceCode, cell, onGuardado }: CeldaProps) {
    const [valor, setValor] = useState(String(cell.quantityAvailable));
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const sucio = valor.trim() !== String(cell.quantityAvailable);
    const idInput = `stock-${skuId}-${cell.warehouseCode}`;

    async function guardar() {
        // Espejo de validación (R6.4): entero ≥ 0 antes de llamar.
        if (!/^\d+$/.test(valor.trim())) {
            setError("Introduce un número entero igual o mayor que 0.");
            return;
        }
        setError(null);
        setGuardando(true);
        try {
            const actualizada = await api.updateAdminStockCell(skuId, cell.warehouseCode, {
                quantityAvailable: Number(valor.trim()),
            });
            setValor(String(actualizada.quantityAvailable));
            onGuardado(skuId, actualizada);
        } catch (err: unknown) {
            // 409 STOCK_CONFLICT («…hay 3 reservadas…»), 400, 404 o red:
            // todo se traduce aquí mismo y el toast de éxito no aparece.
            setError(getFriendlyErrorMessage(err));
        } finally {
            setGuardando(false);
        }
    }

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <label htmlFor={idInput} className="sr-only">
                    Disponible de {referenceCode} en {cell.warehouseCode}
                </label>
                <input
                    id={idInput}
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    className={claseInput}
                />
                <button
                    type="button"
                    onClick={guardar}
                    disabled={!sucio || guardando}
                    className={claseBoton}
                >
                    {guardando ? "..." : "Guardar"}
                </button>
            </div>
            <p className="text-[11px] font-light text-neutral-500">
                reservado {cell.quantityReserved} · neto {cell.netAvailable}
            </p>
            {error && (
                <p role="alert" className="text-xs text-red-700">
                    {error}
                </p>
            )}
        </div>
    );
}

export default function AdminStockPage() {
    const [matriz, setMatriz] = useState<StockMatrix | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState("");
    const [toastVisible, setToastVisible] = useState(false);
    // Recarga bajo demanda (botón «Reintentar»); mismo patrón de cadena inline
    // aceptado por react-hooks/set-state-in-effect que en el resto del panel.
    const [version, setVersion] = useState(0);

    useEffect(() => {
        let activo = true;
        api.getAdminStock()
            .then((obtenida) => {
                if (activo) {
                    setMatriz(obtenida);
                    setError(null);
                }
            })
            .catch((err: unknown) => {
                if (activo) setError(getFriendlyErrorMessage(err));
            })
            .finally(() => {
                if (activo) setCargando(false);
            });
        return () => {
            activo = false;
        };
    }, [version]);

    function celdaGuardada(skuId: number, actualizada: StockCell) {
        setMatriz((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                rows: prev.rows.map((fila) =>
                    fila.skuId !== skuId
                        ? fila
                        : {
                              ...fila,
                              cells: fila.cells.map((celda) =>
                                  celda.warehouseCode !== actualizada.warehouseCode
                                      ? celda
                                      : actualizada
                              ),
                          }
                ),
            };
        });
        setToastMessage("Stock actualizado");
        setToastVisible(true);
    }

    return (
        <>
            <div className="flex flex-col gap-2">
                <p className="text-[10px] uppercase tracking-widest text-neutral-600">
                    Stock y precios
                </p>
                <h1 className="text-2xl font-medium uppercase tracking-widest">
                    Existencias por almacén
                </h1>
                <p className="text-sm font-light text-neutral-700">
                    Edita las unidades disponibles de cada variante. Lo reservado lo mueve el
                    checkout y aquí sólo se consulta; los precios se editan en la ficha de cada
                    producto.
                </p>
            </div>

            {error && (
                <div
                    role="alert"
                    className="p-4 bg-red-50 border border-red-200 text-red-800 text-xs flex flex-wrap items-center gap-4"
                >
                    <span>{error}</span>
                    <button
                        type="button"
                        onClick={() => {
                            setError(null);
                            setCargando(true);
                            setVersion((v) => v + 1);
                        }}
                        className="border border-red-300 text-red-700 hover:bg-red-100 text-[10px] uppercase tracking-widest px-3 py-1.5 transition-colors"
                    >
                        Reintentar
                    </button>
                </div>
            )}

            {cargando && !matriz && (
                <p
                    role="status"
                    className="text-xs uppercase tracking-widest text-neutral-500 py-12 text-center"
                >
                    Cargando stock...
                </p>
            )}

            {!cargando && !error && matriz && matriz.rows.length === 0 && (
                <div className="border border-neutral-200 bg-white p-6">
                    <p className="text-sm font-light text-neutral-700">
                        No hay variantes en el catálogo. Crea un producto con SKUs para poder
                        gestionar su stock.
                    </p>
                </div>
            )}

            {!cargando && matriz && matriz.rows.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="border-b border-neutral-900 text-left text-[11px] uppercase tracking-wider text-neutral-500">
                                <th scope="col" className="py-2 pr-4 font-medium">
                                    Variante
                                </th>
                                {matriz.warehouses.map((almacen) => (
                                    <th key={almacen.code} scope="col" className="py-2 pr-4 font-medium">
                                        <span className="block text-neutral-900">{almacen.code}</span>
                                        <span className="block text-[10px] font-light normal-case tracking-normal text-neutral-500">
                                            {almacen.name}
                                        </span>
                                    </th>
                                ))}
                                <th scope="col" className="py-2 font-medium">
                                    ATS
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {matriz.rows.map((fila) => (
                                <tr key={fila.skuId} className="border-b border-neutral-200 align-top">
                                    <td className="py-3 pr-4">
                                        <Link
                                            href={`/admin/products/${fila.productId}/edit`}
                                            className="font-medium text-neutral-900 underline-offset-2 hover:underline"
                                        >
                                            {fila.referenceCode}
                                        </Link>
                                        <p className="text-xs font-light text-neutral-700">
                                            {fila.productName}
                                        </p>
                                        <p className="text-[11px] uppercase tracking-wider text-neutral-500">
                                            {fila.color} · {fila.size}
                                        </p>
                                    </td>
                                    {fila.cells.map((celda) => (
                                        <td key={celda.warehouseCode} className="py-3 pr-4">
                                            <CeldaStock
                                                skuId={fila.skuId}
                                                referenceCode={fila.referenceCode}
                                                cell={celda}
                                                onGuardado={celdaGuardada}
                                            />
                                        </td>
                                    ))}
                                    <td className="py-3 font-medium text-neutral-900">
                                        {fila.cells.reduce((total, celda) => total + celda.netAvailable, 0)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Toast
                message={toastMessage}
                isVisible={toastVisible}
                onClose={() => setToastVisible(false)}
            />
        </>
    );
}
