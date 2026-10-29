"use client";

import { useState, type FormEvent } from "react";
import { AdminCouponDetailResponse, CouponType } from "@/types/commerce";
import { api } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/errors";
import Toast from "@/components/Toast";

/** Mismo patrón que el `@Pattern` del `CouponCreateRequest` del backend. */
const PATRON_CODIGO = /^[A-Z0-9-]+$/;

/**
 * El `datetime-local` sólo tiene precisión de **minuto**: elegir «ahora»
 * trunca los segundos a `:00` y, cuando la petición llega a Spring, ese
 * instante ya es pasado — el `@FutureOrPresent` del backend responde 400
 * (medido en navegador 2026-10-28: «validFrom: La fecha de inicio no puede
 * ser pasada»). Con este margen de 5 s, elegir «ahora» significa de verdad
 * «desde ya», igual que en el E2E de `coupons.spec.ts`.
 */
function isoVigente(valor: string): string {
    const elegido = new Date(valor).getTime();
    return new Date(Math.max(elegido, Date.now() + 5_000)).toISOString();
}

interface AdminCouponFormProps {
    /** Presente → modo edición (el código queda deshabilitado, §2.2); ausente → creación. */
    cupon?: AdminCouponDetailResponse;
    /** Tras guardar en modo edición, el padre refresca su estado. */
    onCuponGuardado?: (cupon: AdminCouponDetailResponse) => void;
}

interface ErroresCampo {
    code?: string;
    type?: string;
    value?: string;
    validFrom?: string;
    validUntil?: string;
    usageLimit?: string;
    perUserLimit?: string;
    maxDiscountAmount?: string;
}

/**
 * Validación espejo de las anotaciones `jakarta` del backend (patrón D8 de la
 * Tarea 7.2, decidido para V5 con el usuario 2026-10-28 en sustitución de
 * react-hook-form + zod): se ejecuta antes de llamar a la API y traduce cada
 * restricción al mismo mensaje que el servidor.
 */
function validar(campos: {
    code: string;
    type: CouponType;
    value: string;
    validFrom: string;
    validUntil: string;
    usageLimit: string;
    perUserLimit: string;
    maxDiscountAmount: string;
    modoEdicion: boolean;
}): ErroresCampo {
    const errores: ErroresCampo = {};

    if (!campos.modoEdicion) {
        const code = campos.code.trim().toUpperCase();
        if (!code) {
            errores.code = "El código es obligatorio.";
        } else if (code.length > 20) {
            errores.code = "Máximo 20 caracteres.";
        } else if (!PATRON_CODIGO.test(code)) {
            errores.code = "Sólo mayúsculas, números y guiones (ej. SAVE10).";
        }
    }

    const value = Number(campos.value);
    if (campos.value === "" || Number.isNaN(value)) {
        errores.value = "El valor es obligatorio.";
    } else if (value < 0.01) {
        errores.value = "El valor debe ser mayor que 0.";
    } else if (campos.type === "PERCENTAGE" && value > 100) {
        errores.value = "Un porcentaje no puede superar 100.";
    }

    if (!campos.validFrom) {
        errores.validFrom = "La fecha de inicio es obligatoria.";
    }
    if (!campos.validUntil) {
        errores.validUntil = "La fecha de fin es obligatoria.";
    } else if (campos.validFrom && new Date(campos.validUntil) <= new Date(campos.validFrom)) {
        errores.validUntil = "La fecha de fin debe ser posterior a la de inicio.";
    }

    // Los límites son enteros ≥ 0; vacío = sin límite (0).
    for (const [campo, valor] of [
        ["usageLimit", campos.usageLimit],
        ["perUserLimit", campos.perUserLimit],
    ] as const) {
        if (valor !== "" && (!/^\d+$/.test(valor) || Number(valor) < 0)) {
            errores[campo] = "Entero ≥ 0 (0 = sin límite).";
        }
    }

    if (campos.maxDiscountAmount !== "") {
        const tope = Number(campos.maxDiscountAmount);
        if (Number.isNaN(tope) || tope < 0.01) {
            errores.maxDiscountAmount = "El tope debe ser mayor que 0 (vacío = sin tope).";
        }
    }

    return errores;
}

/** Formulario de cupón del panel (V5, spec §2.4): crear y editar en uno. */
export default function AdminCouponForm({ cupon, onCuponGuardado }: AdminCouponFormProps) {
    const modoEdicion = cupon !== undefined;

    const [code, setCode] = useState(cupon?.code ?? "");
    const [type, setType] = useState<CouponType>(cupon?.type ?? "PERCENTAGE");
    const [value, setValue] = useState(cupon ? String(cupon.value) : "");
    const [minOrderAmount, setMinOrderAmount] = useState(
        cupon?.minOrderAmount !== undefined ? String(cupon.minOrderAmount) : ""
    );
    const [maxDiscountAmount, setMaxDiscountAmount] = useState(
        cupon?.maxDiscountAmount !== undefined ? String(cupon.maxDiscountAmount) : ""
    );
    // datetime-local usa «YYYY-MM-DDTHH:mm» — el backend espera ISO-8601.
    const [validFrom, setValidFrom] = useState(cupon?.validFrom?.slice(0, 16) ?? "");
    const [validUntil, setValidUntil] = useState(cupon?.validUntil?.slice(0, 16) ?? "");
    const [usageLimit, setUsageLimit] = useState(
        cupon?.usageLimit ? String(cupon.usageLimit) : ""
    );
    const [perUserLimit, setPerUserLimit] = useState(
        cupon?.perUserLimit ? String(cupon.perUserLimit) : ""
    );

    const [errores, setErrores] = useState<ErroresCampo>({});
    const [apiError, setApiError] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [toastVisible, setToastVisible] = useState(false);

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();

        const encontrados = validar({
            code,
            type,
            value,
            validFrom,
            validUntil,
            usageLimit,
            perUserLimit,
            maxDiscountAmount,
            modoEdicion,
        });
        setErrores(encontrados);
        if (Object.keys(encontrados).length > 0) return;

        setGuardando(true);
        setApiError(null);

        try {
            if (cupon) {
                // El código es inmutable: no viaja en el payload (§2.2).
                const guardado = await api.updateAdminCoupon(cupon.id, {
                    type,
                    value: Number(value),
                    minOrderAmount: minOrderAmount === "" ? undefined : Number(minOrderAmount),
                    maxDiscountAmount:
                        maxDiscountAmount === "" ? undefined : Number(maxDiscountAmount),
                    validFrom: new Date(validFrom).toISOString(),
                    validUntil: new Date(validUntil).toISOString(),
                    usageLimit: usageLimit === "" ? undefined : Number(usageLimit),
                    perUserLimit: perUserLimit === "" ? undefined : Number(perUserLimit),
                });
                setToastMessage("Cambios guardados");
                onCuponGuardado?.(guardado);
            } else {
                const created = await api.createAdminCoupon({
                    code: code.trim().toUpperCase(),
                    type,
                    value: Number(value),
                    minOrderAmount: minOrderAmount === "" ? undefined : Number(minOrderAmount),
                    maxDiscountAmount:
                        maxDiscountAmount === "" ? undefined : Number(maxDiscountAmount),
                    validFrom: isoVigente(validFrom),
                    validUntil: new Date(validUntil).toISOString(),
                    usageLimit: usageLimit === "" ? undefined : Number(usageLimit),
                    perUserLimit: perUserLimit === "" ? undefined : Number(perUserLimit),
                });
                setToastMessage(`Cupón ${created.code} creado`);
                setCode("");
                setValue("");
                setMinOrderAmount("");
                setMaxDiscountAmount("");
                setValidFrom("");
                setValidUntil("");
                setUsageLimit("");
                setPerUserLimit("");
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
                <label htmlFor="cupon-codigo" className={claseLabel}>
                    Código
                </label>
                <input
                    id="cupon-codigo"
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    disabled={modoEdicion}
                    aria-describedby={modoEdicion ? "cupon-codigo-nota" : undefined}
                    aria-invalid={errores.code ? true : undefined}
                    placeholder="SAVE10"
                    className={claseInput}
                />
                {modoEdicion && (
                    <p id="cupon-codigo-nota" className="mt-1 text-xs font-light text-neutral-500">
                        El código es inmutable: se fija al crear el cupón.
                    </p>
                )}
                {errores.code && (
                    <p role="alert" className={claseError}>
                        {errores.code}
                    </p>
                )}
            </div>

            <div>
                <label htmlFor="cupon-tipo" className={claseLabel}>
                    Tipo
                </label>
                <select
                    id="cupon-tipo"
                    value={type}
                    onChange={(e) => setType(e.target.value as CouponType)}
                    className={claseInput}
                >
                    <option value="PERCENTAGE">Porcentaje (%)</option>
                    <option value="FIXED">Importe fijo</option>
                </select>
            </div>

            <div>
                <label htmlFor="cupon-valor" className={claseLabel}>
                    {type === "PERCENTAGE" ? "Porcentaje de descuento" : "Importe del descuento"}
                </label>
                <input
                    id="cupon-valor"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    aria-invalid={errores.value ? true : undefined}
                    className={claseInput}
                />
                {errores.value && (
                    <p role="alert" className={claseError}>
                        {errores.value}
                    </p>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="cupon-minimo" className={claseLabel}>
                        Importe mínimo del pedido (opcional)
                    </label>
                    <input
                        id="cupon-minimo"
                        type="number"
                        step="0.01"
                        min="0"
                        value={minOrderAmount}
                        onChange={(e) => setMinOrderAmount(e.target.value)}
                        className={claseInput}
                    />
                </div>
                <div>
                    <label htmlFor="cupon-tope" className={claseLabel}>
                        Descuento máximo (opcional)
                    </label>
                    <input
                        id="cupon-tope"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={maxDiscountAmount}
                        onChange={(e) => setMaxDiscountAmount(e.target.value)}
                        aria-invalid={errores.maxDiscountAmount ? true : undefined}
                        className={claseInput}
                    />
                    {errores.maxDiscountAmount && (
                        <p role="alert" className={claseError}>
                            {errores.maxDiscountAmount}
                        </p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="cupon-desde" className={claseLabel}>
                        Válido desde
                    </label>
                    <input
                        id="cupon-desde"
                        type="datetime-local"
                        value={validFrom}
                        onChange={(e) => setValidFrom(e.target.value)}
                        aria-invalid={errores.validFrom ? true : undefined}
                        className={claseInput}
                    />
                    {errores.validFrom && (
                        <p role="alert" className={claseError}>
                            {errores.validFrom}
                        </p>
                    )}
                </div>
                <div>
                    <label htmlFor="cupon-hasta" className={claseLabel}>
                        Válido hasta
                    </label>
                    <input
                        id="cupon-hasta"
                        type="datetime-local"
                        value={validUntil}
                        onChange={(e) => setValidUntil(e.target.value)}
                        aria-invalid={errores.validUntil ? true : undefined}
                        className={claseInput}
                    />
                    {errores.validUntil && (
                        <p role="alert" className={claseError}>
                            {errores.validUntil}
                        </p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="cupon-limite-usos" className={claseLabel}>
                        Límite total de usos (0 = ilimitado)
                    </label>
                    <input
                        id="cupon-limite-usos"
                        type="number"
                        min="0"
                        step="1"
                        value={usageLimit}
                        onChange={(e) => setUsageLimit(e.target.value)}
                        aria-invalid={errores.usageLimit ? true : undefined}
                        className={claseInput}
                    />
                    {errores.usageLimit && (
                        <p role="alert" className={claseError}>
                            {errores.usageLimit}
                        </p>
                    )}
                </div>
                <div>
                    <label htmlFor="cupon-limite-usuario" className={claseLabel}>
                        Usos por usuario (0 = ilimitado)
                    </label>
                    <input
                        id="cupon-limite-usuario"
                        type="number"
                        min="0"
                        step="1"
                        value={perUserLimit}
                        onChange={(e) => setPerUserLimit(e.target.value)}
                        aria-invalid={errores.perUserLimit ? true : undefined}
                        className={claseInput}
                    />
                    {errores.perUserLimit && (
                        <p role="alert" className={claseError}>
                            {errores.perUserLimit}
                        </p>
                    )}
                </div>
            </div>

            {apiError && (
                <p role="alert" className="text-sm text-red-700">
                    {apiError}
                </p>
            )}

            <button
                type="submit"
                disabled={guardando}
                className="self-start bg-neutral-900 text-white px-6 py-3 text-[11px] uppercase tracking-widest hover:bg-black disabled:opacity-50"
            >
                {guardando ? "Guardando..." : modoEdicion ? "Guardar cambios" : "Crear cupón"}
            </button>

            <Toast message={toastMessage} isVisible={toastVisible} onClose={() => setToastVisible(false)} />
        </form>
    );
}
