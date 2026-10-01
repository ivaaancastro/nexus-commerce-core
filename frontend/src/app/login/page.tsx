"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { useAuth } from "@/context/AuthContext";
import { getFriendlyErrorMessage, isUnverifiedEmailError } from "@/lib/errors";

export default function LoginPage() {
    const { login, resendVerificationCode } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [showResend, setShowResend] = useState(false);
    const [resendEmail, setResendEmail] = useState("");
    const [resendSuccess, setResendSuccess] = useState(false);
    const [resendError, setResendError] = useState<string | null>(null);
    const [resendLoading, setResendLoading] = useState(false);
    const [showVerify, setShowVerify] = useState(false);

    const validateForm = (): string | null => {
        if (!email.trim()) return "El email es obligatorio";
        if (!email.includes("@") || !email.includes(".")) return "Introduce un email válido";
        if (!password) return "La contraseña es obligatoria";
        if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres";
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setShowVerify(false);

        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            setLoading(false);
            return;
        }

        try {
            await login({ email, password });
            router.push("/");
        } catch (err: unknown) {
            setError(getFriendlyErrorMessage(err));
            setShowVerify(isUnverifiedEmailError(err));
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async (e: React.FormEvent) => {
        e.preventDefault();
        setResendLoading(true);
        setResendError(null);
        setResendSuccess(false);

        if (!resendEmail.trim()) {
            setResendError("El email es obligatorio");
            setResendLoading(false);
            return;
        }

        try {
            await resendVerificationCode(resendEmail);
            setResendSuccess(true);
        } catch (err: unknown) {
            setResendError(getFriendlyErrorMessage(err));
        } finally {
            setResendLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col font-sans">
            <Header />
            <main className="flex-1 flex items-center justify-center px-6">
                <div className="w-full max-w-md">
                    <div className="bg-white border border-neutral-200 p-8">
                        <h1 className="text-lg font-medium uppercase tracking-wider text-neutral-900 mb-6 text-center">
                            Iniciar Sesión
                        </h1>

                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs">
                                {error}
                                {showVerify && (
                                    <Link
                                        href={`/verify-email?email=${encodeURIComponent(email)}`}
                                        className="mt-3 inline-block bg-neutral-900 text-white text-[11px] uppercase tracking-widest px-4 py-2 hover:bg-black transition-colors"
                                    >
                                        Verificar ahora
                                    </Link>
                                )}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
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

                            <div>
                                <label htmlFor="password" className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1">
                                    Contraseña
                                </label>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
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
                                {loading ? "Entrando..." : "Entrar"}
                            </button>
                        </form>

                        <div className="mt-6 text-center space-y-3">
                            <div>
                                <button
                                    onClick={() => setShowResend(!showResend)}
                                    className="text-xs text-neutral-500 hover:text-black underline"
                                >
                                    Reenviar código de verificación
                                </button>
                            </div>

                            {showResend && (
                                <div className="p-4 bg-neutral-50 border border-neutral-200">
                                    {resendSuccess ? (
                                        <div className="text-center">
                                            <p className="text-xs text-green-600 mb-2">
                                                ✓ Código reenviado. Revisa tu bandeja de entrada.
                                            </p>
                                            <Link
                                                href={`/verify-email?email=${encodeURIComponent(resendEmail)}`}
                                                className="text-xs text-neutral-900 underline hover:text-black"
                                            >
                                                Ir a verificar
                                            </Link>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleResend} className="space-y-3">
                                            <input
                                                type="email"
                                                value={resendEmail}
                                                onChange={(e) => setResendEmail(e.target.value)}
                                                placeholder="Email"
                                                className="w-full border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                            />
                                            {resendError && (
                                                <p className="text-xs text-red-600">{resendError}</p>
                                            )}
                                            <button
                                                type="submit"
                                                disabled={resendLoading}
                                                className="w-full bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest py-2 transition-colors disabled:opacity-40"
                                            >
                                                {resendLoading ? "Enviando..." : "Reenviar"}
                                            </button>
                                        </form>
                                    )}
                                </div>
                            )}

                            <div>
                                <Link
                                    href="/verify-email"
                                    className="text-xs text-neutral-500 hover:text-black underline"
                                >
                                    ¿Ya tienes un código? Verifica tu cuenta
                                </Link>
                            </div>

                            <div className="pt-2 border-t border-neutral-100">
                                <Link
                                    href="/forgot-password"
                                    className="text-xs text-neutral-500 hover:text-black underline"
                                >
                                    ¿Olvidaste tu contraseña?
                                </Link>
                            </div>

                            <p className="text-xs text-neutral-500">
                                ¿No tienes cuenta?{" "}
                                <Link href="/register" className="underline hover:text-black">
                                    Regístrate
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
