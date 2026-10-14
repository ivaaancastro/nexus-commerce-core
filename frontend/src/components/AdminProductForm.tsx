"use client";

import { useState, type FormEvent } from "react";
import { Product } from "@/types/commerce";
import { api } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/errors";
import Toast from "@/components/Toast";

const PATRON_REFERENCIA = /^\d{4}\/\d{3}$/;
const PATRON_FAMILIA = /^[A-Z][A-Z0-9_]{1,49}$/;

interface AdminProductFormProps {
    /**
     * Presente → modo edición (la referencia queda deshabilitada, R2.4);
     * ausente → modo creación.
     */
    producto?: Product;
    /** Tras guardar en modo edición, el padre refresca su estado. */
    onProductoGuardado?: (producto: Product) => void;
}

interface ErroresCampo {
    referenceCode?: string;
    name?: string;
    family?: string;
    description?: string;
}

/** Validación espejo de la del backend (D8): se ejecuta antes de llamar a la API. */
function validar(
    referenceCode: string,
    name: string,
    family: string,
    description: string,
    modoEdicion: boolean
): ErroresCampo {
    const errores: ErroresCampo = {};

    if (!modoEdicion) {
        const referencia = referenceCode.trim();
        if (!referencia) {
            errores.referenceCode = "La referencia es obligatoria.";
        } else if (!PATRON_REFERENCIA.test(referencia)) {
            errores.referenceCode = "Formato NNNN/NNN (ej. 0432/021).";
        }
    }

    const nombre = name.trim();
    if (!nombre) {
        errores.name = "El nombre es obligatorio.";
    } else if (nombre.length > 100) {
        errores.name = "Máximo 100 caracteres.";
    }

    const familia = family.trim();
    if (!familia) {
        errores.family = "La familia es obligatoria.";
    } else if (!PATRON_FAMILIA.test(familia)) {
        errores.family = "En mayúsculas (ej. OUTERWEAR).";
    }

    if (description.length > 2000) {
        errores.description = "Máximo 2000 caracteres.";
    }

    return errores;
}

/**
 * Formulario de producto del panel (Tarea 7.2, E.4/E.5).
 *
 * Un solo componente para crear y editar, como pide la spec:
 *
 * - **Creación**: al guardar muestra el toast y deja el formulario listo para
 *   el siguiente (el listado se refresca solo al abrirse, `no-store`).
 * - **Edición**: la referencia se muestra deshabilitada — es inmutable (R2.4).
 * - Errores de campo en cliente antes de llamar a la API; si el backend
 *   responde igual (400/409), se traducen con `getFriendlyErrorMessage()`.
 */
export default function AdminProductForm({
    producto,
    onProductoGuardado,
}: AdminProductFormProps) {
    const modoEdicion = producto !== undefined;

    const [referenceCode, setReferenceCode] = useState(producto?.referenceCode ?? "");
    const [name, setName] = useState(producto?.name ?? "");
    const [family, setFamily] = useState(producto?.family ?? "");
    const [description, setDescription] = useState(producto?.description ?? "");

    const [errores, setErrores] = useState<ErroresCampo>({});
    const [apiError, setApiError] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [toastVisible, setToastVisible] = useState(false);

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();

        const encontrados = validar(referenceCode, name, family, description, modoEdicion);
        setErrores(encontrados);
        if (Object.keys(encontrados).length > 0) return;

        setGuardando(true);
        setApiError(null);

        try {
            if (producto) {
                const guardado = await api.updateAdminProduct(producto.id, {
                    name: name.trim(),
                    family: family.trim(),
                    description: description.trim() || undefined,
                });
                setToastMessage("Cambios guardados");
                onProductoGuardado?.(guardado);
            } else {
                await api.createAdminProduct({
                    referenceCode: referenceCode.trim(),
                    name: name.trim(),
                    family: family.trim(),
                    description: description.trim() || undefined,
                });
                setToastMessage(`Producto ${referenceCode.trim()} creado`);
                setReferenceCode("");
                setName("");
                setFamily("");
                setDescription("");
            }
            setToastVisible(true);
        } catch (err: unknown) {
            // 409 de unicidad, 400 de validación… ya vienen traducidos.
            setApiError(getFriendlyErrorMessage(err));
        } finally {
            setGuardando(false);
        }
    }

    const claseInput =
        "w-full border border-neutral-200 px-3 py-2 text-sm text-neutral-900 " +
        "focus:outline-none focus:border-neutral-400 disabled:bg-neutral-50 disabled:text-neutral-500";
    const claseLabel = "block text-[11px] uppercase tracking-wider text-neutral-500 mb-1";
    const claseError = "mt-1 text-xs text-red-700";

    return (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
            <div>
                <label htmlFor="producto-referencia" className={claseLabel}>
                    Referencia
                </label>
                <input
                    id="producto-referencia"
                    type="text"
                    value={referenceCode}
                    onChange={(e) => setReferenceCode(e.target.value)}
                    disabled={modoEdicion}
                    aria-describedby={modoEdicion ? "producto-referencia-nota" : undefined}
                    aria-invalid={errores.referenceCode ? true : undefined}
                    placeholder="0432/021"
                    className={claseInput}
                />
                {modoEdicion && (
                    <p
                        id="producto-referencia-nota"
                        className="mt-1 text-xs font-light text-neutral-500"
                    >
                        La referencia es inmutable: se fija al crear el producto.
                    </p>
                )}
                {errores.referenceCode && (
                    <p role="alert" className={claseError}>
                        {errores.referenceCode}
                    </p>
                )}
            </div>

            <div>
                <label htmlFor="producto-nombre" className={claseLabel}>
                    Nombre
                </label>
                <input
                    id="producto-nombre"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-invalid={errores.name ? true : undefined}
                    className={claseInput}
                />
                {errores.name && (
                    <p role="alert" className={claseError}>
                        {errores.name}
                    </p>
                )}
            </div>

            <div>
                <label htmlFor="producto-familia" className={claseLabel}>
                    Familia
                </label>
                <input
                    id="producto-familia"
                    type="text"
                    value={family}
                    onChange={(e) => setFamily(e.target.value)}
                    aria-invalid={errores.family ? true : undefined}
                    placeholder="OUTERWEAR"
                    className={claseInput}
                />
                <p className="mt-1 text-xs font-light text-neutral-500">
                    En mayúsculas. Una familia nueva aparece sola en el menú del catálogo.
                </p>
                {errores.family && (
                    <p role="alert" className={claseError}>
                        {errores.family}
                    </p>
                )}
            </div>

            <div>
                <label htmlFor="producto-descripcion" className={claseLabel}>
                    Descripción
                </label>
                <textarea
                    id="producto-descripcion"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    aria-invalid={errores.description ? true : undefined}
                    className={claseInput}
                />
                {errores.description && (
                    <p role="alert" className={claseError}>
                        {errores.description}
                    </p>
                )}
            </div>

            {apiError && (
                <div role="alert" className="p-4 bg-red-50 border border-red-200 text-red-800 text-xs">
                    {apiError}
                </div>
            )}

            <button
                type="submit"
                disabled={guardando}
                className="self-start bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest px-6 py-3 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
                {guardando
                    ? "Guardando..."
                    : modoEdicion
                      ? "Guardar cambios"
                      : "Crear producto"}
            </button>

            <Toast
                message={toastMessage}
                isVisible={toastVisible}
                onClose={() => setToastVisible(false)}
            />
        </form>
    );
}
