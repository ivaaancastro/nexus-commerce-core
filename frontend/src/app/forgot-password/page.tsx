"use client";

import { useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { useAuth } from "@/context/AuthContext";
import { getFriendlyErrorMessage } from "@/lib/errors";

export default function ForgotPasswordPage() {
    const { forgotPassword, resetPassword } = useAuth();
    const [step, setStep] = useState<"request" | "reset">("request");
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await forgotPassword(email);
            setStep("reset");
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? getFriendlyErrorMessage(err)
                    : "Error al solicitar recuperación"
            );
        } finally {
            setLoading(false);
        }
    };

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await resetPassword(email, code, newPassword);
            setStep("request");
            setEmail("");
            setCode("");
            setNewPassword("");
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? getFriendlyErrorMessage(err)
                    : "Error al resetear contraseña"
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col font-sans">
            <Header />
            <main className="flex-1 flex items-center justify-center px-6">
                <div className="w-full max-w-md">
                    <div className="bg-white border border-neutral-200 p-8">
                        <h1 className="text-lg font-medium uppercase tracking-wider text-neutral-900 mb-6 text-center">
                            {step === "request" ? "Recuperar Contraseña" : "Nueva Contraseña"}
                        </h1>

                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs">
                                {error}
                            </div>
                        )}

                        {step === "request" ? (
                            <form onSubmit={handleRequest} className="space-y-4">
                                <div>
                                    <label htmlFor="email" className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1">
                                        Email
                                    </label>
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest py-3 transition-colors disabled:opacity-40"
                                >
                                    {loading ? "Enviando..." : "Enviar código"}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleReset} className="space-y-4">
                                <div>
                                    <label htmlFor="code" className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1">
                                        Código de recuperación
                                    </label>
                                    <input
                                        id="code"
                                        type="text"
                                        value={code}
                                        onChange={(e) => setCode(e.target.value)}
                                        required
                                        maxLength={6}
                                        placeholder="123456"
                                        className="w-full border border-neutral-200 px-3 py-2 text-sm text-neutral-900 text-center tracking-widest focus:outline-none focus:border-neutral-400"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="newPassword" className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1">
                                        Nueva contraseña
                                    </label>
                                    <input
                                        id="newPassword"
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                        minLength={8}
                                        className="w-full border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest py-3 transition-colors disabled:opacity-40"
                                >
                                    {loading ? "Guardando..." : "Guardar contraseña"}
                                </button>
                            </form>
                        )}

                        <p className="mt-6 text-center text-xs text-neutral-500">
                            <Link href="/login" className="underline hover:text-black">
                                Volver a iniciar sesión
                            </Link>
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
