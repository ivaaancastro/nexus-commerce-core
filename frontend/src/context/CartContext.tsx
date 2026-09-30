"use client";

import { createContext, useContext, useReducer, useEffect, type ReactNode } from "react";
import { CartItem, CartState, CartAction } from "@/types/commerce";
import { useLocalStorage } from "@/hooks/useLocalStorage";

interface CartContextType {
    items: CartItem[];
    addItem: (item: CartItem) => void;
    removeItem: (skuId: number, size: string) => void;
    updateQuantity: (skuId: number, size: string, quantity: number) => void;
    clearCart: () => void;
    totalItems: number;
    subtotal: number;
    taxEstimate: number;
    currency: string;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const TAX_RATE = 0.21; // IVA por defecto (ES)

function cartReducer(state: CartState, action: CartAction): CartState {
    switch (action.type) {
        case "HYDRATE":
            return { items: action.payload };

        case "ADD_ITEM": {
            const existingIndex = state.items.findIndex(
                (item) => item.skuId === action.payload.skuId && item.size === action.payload.size
            );

            if (existingIndex >= 0) {
                const updated = [...state.items];
                updated[existingIndex] = {
                    ...updated[existingIndex],
                    quantity: updated[existingIndex].quantity + action.payload.quantity,
                };
                return { items: updated };
            }

            return { items: [...state.items, action.payload] };
        }

        case "REMOVE_ITEM":
            return {
                items: state.items.filter(
                    (item) => !(item.skuId === action.payload.skuId && item.size === action.payload.size)
                ),
            };

        case "UPDATE_QUANTITY": {
            if (action.payload.quantity <= 0) {
                return {
                    items: state.items.filter(
                        (item) =>
                            !(item.skuId === action.payload.skuId && item.size === action.payload.size)
                    ),
                };
            }
            return {
                items: state.items.map((item) =>
                    item.skuId === action.payload.skuId && item.size === action.payload.size
                        ? { ...item, quantity: action.payload.quantity }
                        : item
                ),
            };
        }

        case "CLEAR_CART":
            return { items: [] };

        default:
            return state;
    }
}

export function CartProvider({ children }: { children: ReactNode }) {
    const [items, setItems, isHydrated] = useLocalStorage<CartItem[]>("nexus-cart", []);
    const [state, dispatch] = useReducer(cartReducer, { items: [] });

    useEffect(() => {
        if (isHydrated) {
            dispatch({ type: "HYDRATE", payload: items });
        }
    }, [items, isHydrated]);

    const addItem = (item: CartItem) => {
        dispatch({ type: "ADD_ITEM", payload: item });
        setItems((prev: CartItem[]) => {
            const existingIndex = prev.findIndex(
                (i) => i.skuId === item.skuId && i.size === item.size
            );
            if (existingIndex >= 0) {
                const updated = [...prev];
                updated[existingIndex] = {
                    ...updated[existingIndex],
                    quantity: updated[existingIndex].quantity + item.quantity,
                };
                return updated;
            }
            return [...prev, item];
        });
    };

    const removeItem = (skuId: number, size: string) => {
        dispatch({ type: "REMOVE_ITEM", payload: { skuId, size } });
        setItems((prev: CartItem[]) =>
            prev.filter((i) => !(i.skuId === skuId && i.size === size))
        );
    };

    const updateQuantity = (skuId: number, size: string, quantity: number) => {
        dispatch({ type: "UPDATE_QUANTITY", payload: { skuId, size, quantity } });
        setItems((prev: CartItem[]) =>
            quantity <= 0
                ? prev.filter((i) => !(i.skuId === skuId && i.size === size))
                : prev.map((i) =>
                      i.skuId === skuId && i.size === size ? { ...i, quantity } : i
                  )
        );
    };

    const clearCart = () => {
        dispatch({ type: "CLEAR_CART" });
        setItems([]);
    };

    const totalItems = state.items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = state.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const taxEstimate = subtotal * TAX_RATE;
    const currency = state.items[0]?.currency ?? "EUR";

    return (
        <CartContext.Provider
            value={{
                items: state.items,
                addItem,
                removeItem,
                updateQuantity,
                clearCart,
                totalItems,
                subtotal,
                taxEstimate,
                currency,
            }}
        >
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error("useCart debe usarse dentro de un CartProvider");
    }
    return context;
}
