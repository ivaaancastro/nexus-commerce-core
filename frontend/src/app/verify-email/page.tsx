"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import { useAuth } from "@/context/AuthContext";

function VerifyEmailForm() {
    const { verifyEmail } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const emailFromUrl = searchParams.get("email") || "";

    const [email, setEmail] = useState(emailFromUrl);
    const [code, setCode] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await verifyEmail(email, code);
            router.push("/login");
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Error al verificar email");
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
                            Verificar Email
                        </h1>

                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-neutral-400"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1">
                                    Código de verificación
                                </label>
                                <input
                                    type="text"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    required
                                    maxLength={6}
                                    placeholder="123456"
                                    className="w-full border border-neutral-200 px-3 py-2 text-sm text-center tracking-widest focus:outline-none focus:border-neutral-400"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest py-3 transition-colors disabled:opacity-40"
                            >
                                {loading ? "Verificando..." : "Verificar"}
                            </button>
                        </form>

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

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<div>Cargando...</div>}>
            <VerifyEmailForm />
        </Suspense>
    );
}
