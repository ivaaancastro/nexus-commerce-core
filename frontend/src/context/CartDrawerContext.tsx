"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface CartDrawerContextType {
    isOpen: boolean;
    openDrawer: () => void;
    closeDrawer: () => void;
    toggleDrawer: () => void;
}

const CartDrawerContext = createContext<CartDrawerContextType | undefined>(undefined);

export function CartDrawerProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);

    const openDrawer = () => setIsOpen(true);
    const closeDrawer = () => setIsOpen(false);
    const toggleDrawer = () => setIsOpen((prev) => !prev);

    return (
        <CartDrawerContext.Provider value={{ isOpen, openDrawer, closeDrawer, toggleDrawer }}>
            {children}
        </CartDrawerContext.Provider>
    );
}

export function useCartDrawer() {
    const context = useContext(CartDrawerContext);
    if (context === undefined) {
        throw new Error("useCartDrawer debe usarse dentro de un CartDrawerProvider");
    }
    return context;
}
