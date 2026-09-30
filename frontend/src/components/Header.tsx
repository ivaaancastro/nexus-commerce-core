"use client";

import Link from "next/link";
import CartIcon from "@/components/CartIcon";
import { useCartDrawer } from "@/context/CartDrawerContext";
import { useAuth } from "@/context/AuthContext";

export default function Header() {
    const { openDrawer } = useCartDrawer();
    const { user, isAuthenticated, logout } = useAuth();

    return (
        <header className="border-b border-neutral-200 bg-white sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                <div className="flex items-center space-x-8">
                    <Link href="/" className="text-xl font-semibold tracking-widest uppercase">
                        Nexus Core
                    </Link>
                    <span className="text-xs tracking-wider text-neutral-400 uppercase hidden sm:inline">
                        Edition 2026 / Editorial Retail
                    </span>
                </div>

                <div className="flex items-center space-x-6 text-xs uppercase tracking-wider text-neutral-600 font-medium">
                    <span className="hover:text-black cursor-pointer transition-colors">
                        Colección
                    </span>
                    <span className="hover:text-black cursor-pointer transition-colors">
                        Búsqueda Vectorial
                    </span>
                    <div className="h-4 w-px bg-neutral-200" />
                    <span className="text-neutral-400">ES / EUR</span>

                    {isAuthenticated ? (
                        <div className="flex items-center space-x-4">
                            <Link href="/profile" className="hover:text-black transition-colors">
                                {user?.firstName}
                            </Link>
                            <button
                                onClick={logout}
                                className="text-neutral-400 hover:text-black transition-colors"
                            >
                                Salir
                            </button>
                        </div>
                    ) : (
                        <Link href="/login" className="hover:text-black transition-colors">
                            Entrar
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
