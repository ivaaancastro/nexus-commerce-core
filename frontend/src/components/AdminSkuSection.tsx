"use client";

import { useState, type FormEvent } from "react";
import { Product, Sku } from "@/types/commerce";
import { api } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/errors";

const PATRON_BARRAS = /^\d{8,20}$/;

interface AdminSkuSectionProps {
    producto: Product;
    /** Tras cualquier mutación, el padre recarga el producto. */
    onCambiado: () => void;
    /** El toast lo renderiza la página; aquí sólo se sube el mensaje. */
    onMensaje: (mensaje: string) => void;
}

interface ErroresSku {
    barcode?: string;
    color?: string;
    size?: string;
}

function validarSku(barcode: string, color: string, size: string): ErroresSku {
    const errores: ErroresSku = {};
    if (!barcode.trim()) {
        errores.barcode = "El código de barras es obligatorio.";
    } else if (!PATRON_BARRAS.test(barcode.trim())) {
        errores.barcode = "De 8 a 20 dígitos (ej. 843321900101).";
    }
    if (!color.trim()) {
        errores.color = "El color es obligatorio.";
    }
    if (!size.trim()) {
        errores.size = "La talla es obligatoria.";
    }
    return errores;
}

/**
 * Gestión de SKUs (variantes) dentro de la edición de producto (Tarea 7.2, E.5).
 *
 * Frontera con la 7.3 dicha en voz alta: un SKU nuevo **no tiene precio ni
 * stock** — hasta que se asignen, la vitrina lo muestra con «precio no
 * disponible». El backend no crea esas filas y esta sección tampoco.
 */
export default function AdminSkuSection({ producto, onCambiado, onMensaje }: AdminSkuSectionProps) {
    // Alta
    const [mostrandoFormulario, setMostrandoFormulario] = useState(false);
    const [barcode, setBarcode] = useState("");
    const [color, setColor] = useState("");
    const [size, setSize] = useState("");
    const [errores, setErrores] = useState<ErroresSku>({});

    // Edición inline
    const [editandoId, setEditandoId] = useState<number | null>(null);
    const [editColor, setEditColor] = useState("");
    const [editSize, setEditSize] = useState("");
    const [erroresEdicion, setErroresEdicion] = useState<ErroresSku>({});

    const [apiError, setApiError] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);

    const claseInput =
        "w-full border border-neutral-200 px-3 py-2 text-sm text-neutral-900 " +
        "focus:outline-none focus:border-neutral-400 disabled:bg-neutral-50 disabled:text-neutral-500";
    const claseLabel = "block text-[11px] uppercase tracking-wider text-neutral-500 mb-1";
    const claseError = "mt-1 text-xs text-red-700";

    async function crearSku(event: FormEvent) {
        event.preventDefault();
        const encontrados = validarSku(barcode, color, size);
        setErrores(encontrados);
        if (Object.keys(encontrados).length > 0) return;

        setGuardando(true);
        setApiError(null);
        try {
            const codigo = barcode.trim();
            await api.createAdminSku(producto.id, {
                barcode: codigo,
                color: color.trim(),
                size: size.trim(),
            });
            setBarcode("");
            setColor("");
            setSize("");
            setMostrandoFormulario(false);
            onMensaje(`SKU ${codigo} añadido`);
            onCambiado();
        } catch (err: unknown) {
            setApiError(getFriendlyErrorMessage(err));
        } finally {
            setGuardando(false);
        }
    }

    async function guardarEdicion(event: FormEvent) {
        event.preventDefault();
        if (editandoId === null) return;

        const encontrados: ErroresSku = {};
        if (!editColor.trim()) encontrados.color = "El color es obligatorio.";
        if (!editSize.trim()) encontrados.size = "La talla es obligatoria.";
        setErroresEdicion(encontrados);
        if (Object.keys(encontrados).length > 0) return;

        setGuardando(true);
        setApiError(null);
        try {
            await api.updateAdminSku(producto.id, editandoId, {
                color: editColor.trim(),
                size: editSize.trim(),
            });
            setEditandoId(null);
            onMensaje("SKU actualizado");
            onCambiado();
        } catch (err: unknown) {
            setApiError(getFriendlyErrorMessage(err));
        } finally {
            setGuardando(false);
        }
    }

    async function borrarSku(sku: Sku) {
        const seguro = window.confirm(
            `¿Borrar el SKU ${sku.barcode} (${sku.color}, ${sku.size})? Esta acción no se puede deshacer.`
        );
        if (!seguro) return;

        setApiError(null);
        try {
            await api.deleteAdminSku(producto.id, sku.id);
            onMensaje(`SKU ${sku.barcode} borrado`);
            onCambiado();
        } catch (err: unknown) {
            // 409 si el SKU tiene pedidos: se traduce, no se muestra crudo.
            setApiError(getFriendlyErrorMessage(err));
        }
    }

    function empezarEdicion(sku: Sku) {
        setEditandoId(sku.id);
        setEditColor(sku.color);
        setEditSize(sku.size);
        setErroresEdicion({});
        setApiError(null);
    }

    return (
        <section className="border border-neutral-200 bg-white p-6 flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xs uppercase tracking-widest text-neutral-600">
                        SKUs (variantes)
                    </h2>
                    <p className="text-xs font-light text-neutral-500">
                        Un SKU nuevo se publica en la vitrina sin precio ni stock hasta
                        que se asignen aparte.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        setMostrandoFormulario((v) => !v);
                        setErrores({});
                        setApiError(null);
                    }}
                    className="bg-neutral-900 hover:bg-black text-white text-[10px] uppercase tracking-widest px-4 py-2 transition-colors"
                >
                    {mostrandoFormulario ? "Cancelar" : "Nuevo SKU"}
                </button>
            </div>

            {apiError && (
                <div role="alert" className="p-4 bg-red-50 border border-red-200 text-red-800 text-xs">
                    {apiError}
                </div>
            )}

            {mostrandoFormulario && (
                <form onSubmit={crearSku} noValidate className="flex flex-col gap-4 border border-neutral-200 p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label htmlFor="sku-barcode" className={claseLabel}>
                                Código de barras
                            </label>
                            <input
                                id="sku-barcode"
                                type="text"
                                inputMode="numeric"
                                value={barcode}
                                onChange={(e) => setBarcode(e.target.value)}
                                aria-invalid={errores.barcode ? true : undefined}
                                placeholder="843321900101"
                                className={claseInput}
                            />
                            {errores.barcode && (
                                <p role="alert" className={claseError}>
                                    {errores.barcode}
                                </p>
                            )}
                        </div>
                        <div>
                            <label htmlFor="sku-color" className={claseLabel}>
                                Color
                            </label>
                            <input
                                id="sku-color"
                                type="text"
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                                aria-invalid={errores.color ? true : undefined}
                                className={claseInput}
                            />
                            {errores.color && (
                                <p role="alert" className={claseError}>
                                    {errores.color}
                                </p>
                            )}
                        </div>
                        <div>
                            <label htmlFor="sku-talla" className={claseLabel}>
                                Talla
                            </label>
                            <input
                                id="sku-talla"
                                type="text"
                                value={size}
                                onChange={(e) => setSize(e.target.value)}
                                aria-invalid={errores.size ? true : undefined}
                                placeholder="M"
                                className={claseInput}
                            />
                            {errores.size && (
                                <p role="alert" className={claseError}>
                                    {errores.size}
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={guardando}
                        className="self-start bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest px-6 py-3 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {guardando ? "Guardando..." : "Crear SKU"}
                    </button>
                </form>
            )}

            {producto.skus.length === 0 ? (
                <p className="text-sm font-light text-neutral-700">
                    Este producto todavía no tiene SKUs. Crea el primero con
                    «Nuevo SKU».
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b border-neutral-900 text-[11px] uppercase tracking-widest text-neutral-600 text-left">
                                <th scope="col" className="py-3 pr-4 font-medium">
                                    Código de barras
                                </th>
                                <th scope="col" className="py-3 pr-4 font-medium">
                                    Color
                                </th>
                                <th scope="col" className="py-3 pr-4 font-medium">
                                    Talla
                                </th>
                                <th scope="col" className="py-3 font-medium text-right">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {producto.skus.map((sku) =>
                                editandoId === sku.id ? (
                                    <tr key={sku.id} className="border-b border-neutral-200">
                                        <td colSpan={4} className="py-3">
                                            <form
                                                onSubmit={guardarEdicion}
                                                noValidate
                                                className="flex flex-wrap items-end gap-4"
                                            >
                                                <div>
                                                    <span className={claseLabel}>
                                                        Código de barras
                                                    </span>
                                                    <p className="text-sm text-neutral-500 border border-neutral-200 px-3 py-2">
                                                        {sku.barcode} · inmutable
                                                    </p>
                                                </div>
                                                <div className="w-40">
                                                    <label htmlFor="sku-edit-color" className={claseLabel}>
                                                        Color
                                                    </label>
                                                    <input
                                                        id="sku-edit-color"
                                                        type="text"
                                                        value={editColor}
                                                        onChange={(e) => setEditColor(e.target.value)}
                                                        className={claseInput}
                                                    />
                                                    {erroresEdicion.color && (
                                                        <p role="alert" className={claseError}>
                                                            {erroresEdicion.color}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="w-24">
                                                    <label htmlFor="sku-edit-talla" className={claseLabel}>
                                                        Talla
                                                    </label>
                                                    <input
                                                        id="sku-edit-talla"
                                                        type="text"
                                                        value={editSize}
                                                        onChange={(e) => setEditSize(e.target.value)}
                                                        className={claseInput}
                                                    />
                                                    {erroresEdicion.size && (
                                                        <p role="alert" className={claseError}>
                                                            {erroresEdicion.size}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex gap-4">
                                                    <button
                                                        type="submit"
                                                        disabled={guardando}
                                                        className="bg-neutral-900 hover:bg-black text-white text-[10px] uppercase tracking-widest px-4 py-2 transition-colors disabled:opacity-40"
                                                    >
                                                        {guardando ? "Guardando..." : "Guardar"}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditandoId(null)}
                                                        className="text-[10px] uppercase tracking-widest text-neutral-600 hover:text-neutral-900 underline underline-offset-4"
                                                    >
                                                        Cancelar
                                                    </button>
                                                </div>
                                            </form>
                                        </td>
                                    </tr>
                                ) : (
                                    <tr key={sku.id} className="border-b border-neutral-200">
                                        <td className="py-3 pr-4 text-neutral-900 whitespace-nowrap">
                                            {sku.barcode}
                                        </td>
                                        <td className="py-3 pr-4 text-neutral-900">{sku.color}</td>
                                        <td className="py-3 pr-4 text-neutral-900">{sku.size}</td>
                                        <td className="py-3 text-right whitespace-nowrap">
                                            <button
                                                type="button"
                                                onClick={() => empezarEdicion(sku)}
                                                className="text-[10px] uppercase tracking-widest text-neutral-600 hover:text-neutral-900 underline underline-offset-4 mr-4"
                                            >
                                                Editar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => borrarSku(sku)}
                                                className="text-[10px] uppercase tracking-widest text-neutral-600 hover:text-neutral-900 underline underline-offset-4"
                                            >
                                                Borrar
                                            </button>
                                        </td>
                                    </tr>
                                )
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
