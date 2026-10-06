"use client";

import Link from "next/link";
import CartIcon from "@/components/CartIcon";
import { useCartDrawer } from "@/context/CartDrawerContext";
import { useAuth } from "@/context/AuthContext";
import { useMarket } from "@/context/MarketContext";

export default function Header() {
    const { openDrawer } = useCartDrawer();
    const { isAuthenticated, logout } = useAuth();
    const { markets, market, setMarketCode } = useMarket();

    return (
        <header className="border-b border-neutral-200 bg-white sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                <div className="flex items-center space-x-8">
                    <Link
                        href="/"
                        className="text-xl font-semibold tracking-widest uppercase text-neutral-900"
                    >
                        Nexus Core
                    </Link>
                    <span className="text-xs tracking-wider text-neutral-400 uppercase hidden sm:inline">
                        Edition 2026 / Editorial Retail
                    </span>
                </div>

                <div className="flex items-center space-x-6 text-xs uppercase tracking-wider text-neutral-600 font-medium">
                    <Link href="/catalog" className="hover:text-black transition-colors">
                        Colección
                    </Link>
                    <Link href="/search" className="hover:text-black transition-colors">
                        Búsqueda Vectorial
                    </Link>
                    <div className="h-4 w-px bg-neutral-200" />
                    {markets.length > 0 && (
                        <span className="relative inline-flex items-center text-neutral-400">
                            <select
                                aria-label="Mercado y divisa"
                                value={market.code}
                                onChange={(event) => setMarketCode(event.target.value)}
                                className="appearance-none bg-transparent pr-4 uppercase cursor-pointer transition-colors hover:text-black focus:text-black focus:outline-none focus:border-b focus:border-neutral-400"
                            >
                                {markets.map((option) => (
                                    <option
                                        key={option.code}
                                        value={option.code}
                                        className="text-neutral-900"
                                    >
                                        {option.code} / {option.currency}
                                    </option>
                                ))}
                            </select>
                            <svg
                                aria-hidden="true"
                                className="pointer-events-none absolute right-0 w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={1.5}
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M19 9l-7 7-7-7"
                                />
                            </svg>
                        </span>
                    )}

                    {isAuthenticated ? (
                        <div className="flex items-center space-x-4">
                            <Link href="/orders" className="hover:text-black transition-colors">
                                Pedidos
                            </Link>
                            <Link href="/profile" className="hover:text-black transition-colors">
                                Cuenta
                            </Link>
                            <button
                                onClick={logout}
                                className="text-neutral-400 hover:text-black transition-colors"
                            >
                                Cerrar sesión
                            </button>
                        </div>
                    ) : (
                        <Link href="/login" className="hover:text-black transition-colors">
                            Iniciar sesión
                        </Link>
                    )}

                    <div onClick={openDrawer} className="cursor-pointer">
                        <CartIcon />
                    </div>
                </div>
            </div>
        </header>
    );
}
