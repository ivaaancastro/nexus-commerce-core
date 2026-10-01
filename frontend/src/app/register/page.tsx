"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { useAuth } from "@/context/AuthContext";
import { getFriendlyErrorMessage } from "@/lib/errors";

export default function RegisterPage() {
    const { register } = useAuth();
    const router = useRouter();
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        phone: "",
        birthDate: "",
        gender: "" as "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY" | "",
        height: "",
        weight: "",
    });
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const validateForm = (): string | null => {
        if (!formData.firstName.trim()) return "El nombre es obligatorio";
        if (!formData.lastName.trim()) return "El apellido es obligatorio";
        if (!formData.email.trim()) return "El email es obligatorio";
        if (!formData.password || formData.password.length < 8) return "La contraseña debe tener al menos 8 caracteres";
        if (!formData.birthDate) return "La fecha de nacimiento es obligatoria";

        const birthDate = new Date(formData.birthDate);
        const today = new Date();
        if (birthDate > today) return "La fecha de nacimiento no puede ser futura";
        if (birthDate.getFullYear() < 1900) return "Introduce una fecha de nacimiento válida";

        if (!formData.gender) return "El género es obligatorio";

        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            setLoading(false);
            return;
        }

        try {
            await register({
                email: formData.email,
                password: formData.password,
                firstName: formData.firstName,
                lastName: formData.lastName,
                phone: formData.phone || undefined,
                birthDate: formData.birthDate,
                gender: formData.gender as "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY",
                height: formData.height ? parseFloat(formData.height) : undefined,
                weight: formData.weight ? parseFloat(formData.weight) : undefined,
            });
            setSuccess(true);
        } catch (err: unknown) {
            setError(getFriendlyErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-neutral-50 flex flex-col font-sans">
                <Header />
                <main className="flex-1 flex items-center justify-center px-6">
                    <div className="w-full max-w-md">
                        <div className="bg-white border border-neutral-200 p-8 text-center">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h1 className="text-lg font-medium uppercase tracking-wider text-neutral-900 mb-2">
                                ¡Cuenta creada!
                            </h1>
                            <p className="text-sm text-neutral-600 mb-6">
                                Hemos enviado un código de verificación a <strong>{formData.email}</strong>.
                                Introduce el código para activar tu cuenta.
                            </p>
                            <Link
                                href={`/verify-email?email=${encodeURIComponent(formData.email)}`}
                                className="inline-block w-full bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest py-3 transition-colors"
                            >
                                Verificar email
                            </Link>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col font-sans">
            <Header />
            <main className="flex-1 flex items-center justify-center px-6 py-12">
                <div className="w-full max-w-md">
                    <div className="bg-white border border-neutral-200 p-8">
                        <h1 className="text-lg font-medium uppercase tracking-wider text-neutral-900 mb-6 text-center">
                            Crear Cuenta
                        </h1>

                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1">
                                        Nombre
                                    </label>
                                    <input
                                        type="text"
                                        name="firstName"
                                        value={formData.firstName}
                                        onChange={handleChange}
                                        required
                                        className="w-full border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1">
                                        Apellido
                                    </label>
                                    <input
                                        type="text"
                                        name="lastName"
                                        value={formData.lastName}
                                        onChange={handleChange}
                                        required
                                        className="w-full border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    className="w-full border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1">
                                    Contraseña
                                </label>
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                    minLength={8}
                                    className="w-full border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1">
                                    Teléfono (opcional)
                                </label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className="w-full border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1">
                                    Fecha de nacimiento
                                </label>
                                <input
                                    type="date"
                                    name="birthDate"
                                    value={formData.birthDate}
                                    onChange={handleChange}
                                    required
                                    max={new Date().toISOString().split("T")[0]}
                                    className="w-full border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1">
                                    Género
                                </label>
                                <select
                                    name="gender"
                                    value={formData.gender}
                                    onChange={handleChange}
                                    required
                                    className="w-full border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                >
                                    <option value="">Seleccionar</option>
                                    <option value="MALE">Masculino</option>
                                    <option value="FEMALE">Femenino</option>
                                    <option value="OTHER">Otro</option>
                                    <option value="PREFER_NOT_TO_SAY">Prefiero no decir</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1">
                                        Altura (cm)
                                    </label>
                                    <input
                                        type="number"
                                        name="height"
                                        value={formData.height}
                                        onChange={handleChange}
                                        placeholder="175"
                                        className="w-full border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1">
                                        Peso (kg)
                                    </label>
                                    <input
                                        type="number"
                                        name="weight"
                                        value={formData.weight}
                                        onChange={handleChange}
                                        placeholder="70"
                                        className="w-full border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest py-3 transition-colors disabled:opacity-40"
                            >
                                {loading ? "Registrando..." : "Crear cuenta"}
                            </button>
                        </form>

                        <p className="mt-6 text-center text-xs text-neutral-500">
                            ¿Ya tienes cuenta?{" "}
                            <Link href="/login" className="underline hover:text-black">
                                Inicia sesión
                            </Link>
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
