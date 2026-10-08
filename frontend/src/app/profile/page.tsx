"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import BackLink from "@/components/BackLink";
import Header from "@/components/Header";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/errors";

const GENDER_OPTIONS = [
    { value: "FEMALE", label: "Mujer" },
    { value: "MALE", label: "Hombre" },
    { value: "OTHER", label: "Otro" },
    { value: "PREFER_NOT_TO_SAY", label: "Prefiero no decirlo" },
] as const;

const MIN_BIRTH_DATE = "1900-01-01";

function ProfileContent() {
    const { user, refreshUser } = useAuth();
    const router = useRouter();

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phone, setPhone] = useState("");
    const [birthDate, setBirthDate] = useState("");
    const [gender, setGender] = useState("");
    const [height, setHeight] = useState("");
    const [weight, setWeight] = useState("");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (!user) return;

        api.getProfile()
            .then((profile) => {
                setFirstName(profile.firstName ?? "");
                setLastName(profile.lastName ?? "");
                setPhone(profile.phone ?? "");
                setBirthDate(profile.birthDate ?? "");
                setGender(profile.gender ?? "");
                setHeight(profile.height != null ? String(profile.height) : "");
                setWeight(profile.weight != null ? String(profile.weight) : "");
            })
            .catch((err: unknown) => setError(getFriendlyErrorMessage(err)))
            .finally(() => setLoading(false));
    }, [user]);

    const validate = (): string | null => {
        if (!firstName.trim()) return "El nombre es obligatorio";
        if (!lastName.trim()) return "El apellido es obligatorio";

        if (birthDate) {
            if (birthDate > new Date().toISOString().slice(0, 10)) {
                return "La fecha de nacimiento no puede ser futura";
            }
            if (birthDate < MIN_BIRTH_DATE) {
                return "La fecha de nacimiento no puede ser anterior a 1900";
            }
        }

        if (height.trim()) {
            const value = Number(height);
            if (Number.isNaN(value)) return "La altura debe ser un número";
            if (value < 100 || value > 250) return "La altura debe estar entre 100 y 250 cm";
        }

        if (weight.trim()) {
            const value = Number(weight);
            if (Number.isNaN(value)) return "El peso debe ser un número";
            if (value < 30 || value > 250) return "El peso debe estar entre 30 y 250 kg";
        }

        return null;
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSaved(false);
        setError(null);

        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }

        setSaving(true);
        try {
            await api.updateProfile({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                phone: phone.trim(),
                birthDate: birthDate || undefined,
                gender: (gender || undefined) as
                    | "MALE"
                    | "FEMALE"
                    | "OTHER"
                    | "PREFER_NOT_TO_SAY"
                    | undefined,
                height: height.trim() ? Number(height) : undefined,
                weight: weight.trim() ? Number(weight) : undefined,
            });
            await refreshUser();
            setSaved(true);
        } catch (err: unknown) {
            setError(getFriendlyErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center py-24">
                <span className="text-xs uppercase tracking-widest text-neutral-500">
                    Cargando perfil...
                </span>
            </div>
        );
    }

    return (
        <main className="flex-1 px-6 py-12">
            <div className="max-w-2xl mx-auto">
                {/* R5 */}
                <div className="mb-6">
                    <BackLink href="/" />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-lg font-medium uppercase tracking-wider text-neutral-900">
                            Mi Perfil
                        </h1>
                        <p className="text-xs text-neutral-500 mt-2">
                            Tus medidas se usan para recomendarte la talla que mejor te siente.
                        </p>
                    </div>

                    <div className="flex gap-4 text-xs text-neutral-500">
                        <button
                            onClick={() => router.push("/addresses")}
                            className="underline hover:text-black transition-colors"
                        >
                            Mis direcciones
                        </button>
                        <button
                            onClick={() => router.push("/orders")}
                            className="underline hover:text-black transition-colors"
                        >
                            Mis pedidos
                        </button>
                    </div>
                </div>

                <div className="bg-white border border-neutral-200 p-8">
                    {error && (
                        <div
                            role="alert"
                            className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-xs"
                        >
                            {error}
                        </div>
                    )}

                    {saved && (
                        <div
                            role="status"
                            className="mb-6 p-3 bg-green-50 border border-green-200 text-green-700 text-xs uppercase tracking-wide"
                        >
                            ✓ Perfil actualizado correctamente
                        </div>
                    )}

                    <form onSubmit={handleSubmit} noValidate className="space-y-6">
                        {/* Cuenta — solo lectura */}
                        <div>
                            <label
                                htmlFor="email"
                                className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1"
                            >
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={user?.email ?? ""}
                                readOnly
                                disabled
                                className="w-full border border-neutral-100 bg-neutral-50 px-3 py-2 text-sm text-neutral-500 cursor-not-allowed"
                            />
                            <p className="text-[11px] text-neutral-600 mt-1">
                                El email no puede modificarse desde aquí.
                            </p>
                        </div>

                        {/* Datos personales */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label
                                    htmlFor="firstName"
                                    className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1"
                                >
                                    Nombre
                                </label>
                                <input
                                    id="firstName"
                                    type="text"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    required
                                    className="w-full border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="lastName"
                                    className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1"
                                >
                                    Apellido
                                </label>
                                <input
                                    id="lastName"
                                    type="text"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    required
                                    className="w-full border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="phone"
                                    className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1"
                                >
                                    Teléfono
                                </label>
                                <input
                                    id="phone"
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="birthDate"
                                    className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1"
                                >
                                    Fecha de nacimiento
                                </label>
                                <input
                                    id="birthDate"
                                    type="date"
                                    value={birthDate}
                                    min={MIN_BIRTH_DATE}
                                    max={new Date().toISOString().slice(0, 10)}
                                    onChange={(e) => setBirthDate(e.target.value)}
                                    className="w-full border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label
                                    htmlFor="gender"
                                    className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1"
                                >
                                    Género
                                </label>
                                <select
                                    id="gender"
                                    value={gender}
                                    onChange={(e) => setGender(e.target.value)}
                                    className="w-full border border-neutral-200 px-3 py-2 text-sm text-neutral-900 bg-white focus:outline-none focus:border-neutral-400"
                                >
                                    <option value="">Seleccionar...</option>
                                    {GENDER_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Medidas */}
                        <div className="pt-6 border-t border-neutral-100">
                            <h2 className="text-[11px] uppercase tracking-widest text-neutral-900 mb-1">
                                Medidas
                            </h2>
                            <p className="text-[11px] text-neutral-500 mb-4">
                                Opcional. Necesarias para recomendarte tallas.
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label
                                        htmlFor="height"
                                        className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1"
                                    >
                                        Altura (cm)
                                    </label>
                                    <input
                                        id="height"
                                        type="number"
                                        inputMode="decimal"
                                        step="0.5"
                                        min={100}
                                        max={250}
                                        value={height}
                                        onChange={(e) => setHeight(e.target.value)}
                                        placeholder="175"
                                        className="w-full border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-400"
                                    />
                                    <p className="text-[11px] text-neutral-600 mt-1">Entre 100 y 250 cm</p>
                                </div>

                                <div>
                                    <label
                                        htmlFor="weight"
                                        className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1"
                                    >
                                        Peso (kg)
                                    </label>
                                    <input
                                        id="weight"
                                        type="number"
                                        inputMode="decimal"
                                        step="0.5"
                                        min={30}
                                        max={250}
                                        value={weight}
                                        onChange={(e) => setWeight(e.target.value)}
                                        placeholder="70"
                                        className="w-full border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-400"
                                    />
                                    <p className="text-[11px] text-neutral-600 mt-1">Entre 30 y 250 kg</p>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest py-3 transition-colors disabled:opacity-40"
                        >
                            {saving ? "Guardando..." : "Guardar cambios"}
                        </button>
                    </form>
                </div>
            </div>
        </main>
    );
}

export default function ProfilePage() {
    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-neutral-50 flex flex-col font-sans">
                <Header />
                <ProfileContent />
            </div>
        </ProtectedRoute>
    );
}
