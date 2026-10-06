"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import BackLink from "@/components/BackLink";
import Header from "@/components/Header";
import ProtectedRoute from "@/components/ProtectedRoute";
import { api } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/errors";
import type { Address, AddressData } from "@/types/auth";

const MAX_ADDRESSES = 2;

const EMPTY_FORM: AddressData = {
    fullName: "",
    street: "",
    city: "",
    postalCode: "",
    countryCode: "ES",
    defaultAddress: false,
};

function AddressesContent() {
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<AddressData>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const [confirmingId, setConfirmingId] = useState<number | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    // El efecto es dueño del fetch; las mutaciones solo fuerzan una recarga,
    // evitando llamar a setState de forma síncrona dentro del efecto.
    const [reloadKey, setReloadKey] = useState(0);
    const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

    useEffect(() => {
        let active = true;

        api.getAddresses()
            .then((data) => {
                if (active) setAddresses(data);
            })
            .catch((err: unknown) => {
                if (active) setError(getFriendlyErrorMessage(err));
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [reloadKey]);

    const atLimit = addresses.length >= MAX_ADDRESSES;

    const openCreate = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setError(null);
        setNotice(null);
        setShowForm(true);
    };

    const openEdit = (address: Address) => {
        setEditingId(address.id);
        setForm({
            fullName: address.fullName,
            street: address.street,
            city: address.city,
            postalCode: address.postalCode,
            countryCode: address.countryCode,
            defaultAddress: address.defaultAddress,
        });
        setError(null);
        setNotice(null);
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
    };

    const validate = (): string | null => {
        if (!form.fullName.trim()) return "El nombre del destinatario es obligatorio";
        if (!form.street.trim()) return "La calle es obligatoria";
        if (!form.city.trim()) return "La ciudad es obligatoria";
        if (!form.postalCode.trim()) return "El código postal es obligatorio";
        if (!form.countryCode.trim()) return "El país es obligatorio";
        return null;
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }

        setSaving(true);
        try {
            if (editingId !== null) {
                await api.updateAddress(editingId, form);
                setNotice("Dirección actualizada correctamente");
            } else {
                await api.createAddress(form);
                setNotice("Dirección añadida correctamente");
            }
            closeForm();
            refresh();
        } catch (err: unknown) {
            setError(getFriendlyErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        setDeletingId(id);
        setError(null);
        try {
            await api.deleteAddress(id);
            setNotice("Dirección eliminada");
            setConfirmingId(null);
            refresh();
        } catch (err: unknown) {
            setError(getFriendlyErrorMessage(err));
        } finally {
            setDeletingId(null);
        }
    };

    const handleMakeDefault = async (address: Address) => {
        setError(null);
        try {
            await api.updateAddress(address.id, { ...address, defaultAddress: true });
            refresh();
        } catch (err: unknown) {
            setError(getFriendlyErrorMessage(err));
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center py-24">
                <span className="text-xs uppercase tracking-widest text-neutral-500">
                    Cargando direcciones...
                </span>
            </div>
        );
    }

    return (
        <main className="flex-1 px-6 py-12">
            <div className="max-w-2xl mx-auto">
                {/* R5: este botón ya existía, pero llamaba a `window.history.back()`
                    a secas y se quedaba mudo al entrar directamente en la URL.
                    `BackLink` añade el fallback a `/profile`. */}
                <div className="mb-6">
                    <BackLink href="/profile" label="Volver al perfil" />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-lg font-medium uppercase tracking-wider text-neutral-900">
                            Mis Direcciones
                        </h1>
                        <p className="text-xs text-neutral-500 mt-2">
                            {addresses.length} de {MAX_ADDRESSES} direcciones guardadas
                        </p>
                    </div>
                </div>

                {error && (
                    <div
                        role="alert"
                        className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-xs"
                    >
                        {error}
                    </div>
                )}

                {notice && (
                    <div
                        role="status"
                        className="mb-6 p-3 bg-green-50 border border-green-200 text-green-700 text-xs uppercase tracking-wide"
                    >
                        ✓ {notice}
                    </div>
                )}

                {/* Lista */}
                <div className="space-y-4">
                    {addresses.length === 0 && (
                        <div className="bg-white border border-neutral-200 p-8 text-center">
                            <p className="text-xs text-neutral-500">
                                Todavía no has guardado ninguna dirección.
                            </p>
                        </div>
                    )}

                    {addresses.map((address) => (
                        <div
                            key={address.id}
                            className="bg-white border border-neutral-200 p-6"
                            data-testid={`address-${address.id}`}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-medium uppercase tracking-wide text-neutral-900">
                                            {address.fullName}
                                        </span>
                                        {address.defaultAddress && (
                                            <span className="text-[10px] uppercase tracking-widest bg-neutral-900 text-white px-2 py-0.5">
                                                Principal
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-neutral-600 mt-2">
                                        {address.street}
                                    </p>
                                    <p className="text-xs text-neutral-600">
                                        {address.postalCode} {address.city}
                                    </p>
                                    <p className="text-xs text-neutral-500 mt-1">
                                        {address.countryCode}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-neutral-100 flex-wrap">
                                <button
                                    onClick={() => openEdit(address)}
                                    className="text-xs text-neutral-500 hover:text-black underline transition-colors"
                                >
                                    Editar
                                </button>

                                {!address.defaultAddress && (
                                    <button
                                        onClick={() => handleMakeDefault(address)}
                                        className="text-xs text-neutral-500 hover:text-black underline transition-colors"
                                    >
                                        Hacer principal
                                    </button>
                                )}

                                {confirmingId === address.id ? (
                                    <span className="flex items-center gap-2 text-xs">
                                        <span className="text-neutral-500">¿Eliminar?</span>
                                        <button
                                            onClick={() => handleDelete(address.id)}
                                            disabled={deletingId === address.id}
                                            className="text-red-600 hover:text-red-800 underline disabled:opacity-40"
                                        >
                                            {deletingId === address.id ? "Eliminando..." : "Sí, eliminar"}
                                        </button>
                                        <button
                                            onClick={() => setConfirmingId(null)}
                                            className="text-neutral-500 hover:text-black underline"
                                        >
                                            Cancelar
                                        </button>
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => setConfirmingId(address.id)}
                                        className="text-xs text-neutral-500 hover:text-red-600 underline transition-colors"
                                    >
                                        Eliminar
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Añadir */}
                {!showForm && (
                    <div className="mt-6">
                        <button
                            onClick={openCreate}
                            disabled={atLimit}
                            className="w-full bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest py-3 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Añadir dirección
                        </button>
                        {atLimit && (
                            <p className="text-[11px] text-neutral-500 text-center mt-2">
                                Has alcanzado el máximo de {MAX_ADDRESSES} direcciones.
                                Elimina una para añadir otra.
                            </p>
                        )}
                    </div>
                )}

                {/* Formulario */}
                {showForm && (
                    <div className="mt-6 bg-white border border-neutral-200 p-6">
                        <h2 className="text-[11px] uppercase tracking-widest text-neutral-900 mb-5">
                            {editingId !== null ? "Editar dirección" : "Nueva dirección"}
                        </h2>

                        <form onSubmit={handleSubmit} noValidate className="space-y-4">
                            <div>
                                <label
                                    htmlFor="fullName"
                                    className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1"
                                >
                                    Nombre del destinatario
                                </label>
                                <input
                                    id="fullName"
                                    type="text"
                                    value={form.fullName}
                                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                                    required
                                    className="w-full border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="street"
                                    className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1"
                                >
                                    Calle y número
                                </label>
                                <input
                                    id="street"
                                    type="text"
                                    value={form.street}
                                    onChange={(e) => setForm({ ...form, street: e.target.value })}
                                    required
                                    className="w-full border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="sm:col-span-1">
                                    <label
                                        htmlFor="postalCode"
                                        className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1"
                                    >
                                        Código postal
                                    </label>
                                    <input
                                        id="postalCode"
                                        type="text"
                                        value={form.postalCode}
                                        onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                                        required
                                        className="w-full border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                    />
                                </div>

                                <div className="sm:col-span-1">
                                    <label
                                        htmlFor="city"
                                        className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1"
                                    >
                                        Ciudad
                                    </label>
                                    <input
                                        id="city"
                                        type="text"
                                        value={form.city}
                                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                                        required
                                        className="w-full border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                    />
                                </div>

                                <div className="sm:col-span-1">
                                    <label
                                        htmlFor="countryCode"
                                        className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1"
                                    >
                                        País
                                    </label>
                                    <input
                                        id="countryCode"
                                        type="text"
                                        maxLength={5}
                                        value={form.countryCode}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                countryCode: e.target.value.toUpperCase(),
                                            })
                                        }
                                        required
                                        className="w-full border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                    />
                                </div>
                            </div>

                            <label className="flex items-center gap-3 pt-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.defaultAddress}
                                    onChange={(e) =>
                                        setForm({ ...form, defaultAddress: e.target.checked })
                                    }
                                    className="w-4 h-4 accent-neutral-900"
                                />
                                <span className="text-xs text-neutral-700">
                                    Usar como dirección principal
                                </span>
                            </label>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest py-3 transition-colors disabled:opacity-40"
                                >
                                    {saving ? "Guardando..." : "Guardar"}
                                </button>
                                <button
                                    type="button"
                                    onClick={closeForm}
                                    className="flex-1 border border-neutral-300 hover:border-neutral-900 text-neutral-900 text-xs uppercase tracking-widest py-3 transition-colors"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </main>
    );
}

export default function AddressesPage() {
    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-neutral-50 flex flex-col font-sans">
                <Header />
                <AddressesContent />
            </div>
        </ProtectedRoute>
    );
}
