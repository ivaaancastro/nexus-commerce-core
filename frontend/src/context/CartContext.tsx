"use client";

import {
    createContext,
    useContext,
    useEffect,
    useReducer,
    useRef,
    useState,
    type ReactNode,
} from "react";
import {
    CartItem,
    CartState,
    CartAction,
    RepriceResult,
} from "@/types/commerce";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useMarket } from "@/context/MarketContext";
import { api } from "@/lib/api";

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
    /** R6: true mientras se refetchan los precios del nuevo mercado. */
    isRepricing: boolean;
    /** R6/D6: true si algún artículo no tiene precio en el mercado activo. */
    hasUnavailableItems: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

/**
 * Aplica los resultados del re-precificado a los artículos.
 *
 * Devuelve **el mismo array** cuando nada cambia. Eso es lo que hace posible
 * que el reducer devuelva el estado idéntico y que el efecto detecte «no había
 * nada que tocar»: sin esta propiedad, cada re-precificado generaría un estado
 * nuevo y entraría en bucle de re-render.
 *
 * D6: un artículo sin precio **nunca se borra** — se marca y bloquea el checkout.
 */
function applyRepriceToItems(
    items: CartItem[],
    results: RepriceResult[]
): CartItem[] {
    let changed = false;

    const next = items.map((item) => {
        const result = results.find(
            (r) => r.skuId === item.skuId && r.size === item.size
        );
        if (!result) return item;

        const unitPrice = result.unitPrice;
        const currency = result.currency;

        if (unitPrice === undefined || currency === undefined) {
            // El mercado activo no tiene precio para este SKU.
            if (item.priceUnavailable) return item;
            changed = true;
            return { ...item, priceUnavailable: true };
        }

        if (
            item.unitPrice === unitPrice &&
            item.currency === currency &&
            !item.priceUnavailable
        ) {
            return item;
        }

        changed = true;
        return {
            ...item,
            unitPrice,
            currency,
            priceUnavailable: false,
        };
    });

    return changed ? next : items;
}

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

        case "REPRICE": {
            const items = applyRepriceToItems(state.items, action.payload);
            // Mismo array → mismo estado → no hay nada que re-renderizar.
            return items === state.items ? state : { items };
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
    // Mercado para el que los precios de la bolsa ya están validados. Mientras
    // no coincida con el activo, hay un re-precificado en curso. Se deriva en
    // render en lugar de con `setState` dentro del efecto, que dispara el
    // warning react-hooks/set-state-in-effect.
    const [pricedMarket, setPricedMarket] = useState<string | null>(null);

    // layout.tsx monta MarketProvider envolviendo a CartProvider (D5). Sin
    // provider, useMarket devuelve el mercado por defecto (ES) — ver MarketContext.
    const { market } = useMarket();
    const marketCode = market.code;

    useEffect(() => {
        if (isHydrated) {
            dispatch({ type: "HYDRATE", payload: items });
        }
    }, [items, isHydrated]);

    // Refleja `setItems` (identidad inestable) para poder usarlo dentro del
    // efecto de abajo sin meterlo en sus dependencias, lo que dispararía un
    // bucle de fetch.
    const setItemsRef = useRef(setItems);
    useEffect(() => {
        setItemsRef.current = setItems;
    }, [setItems]);

    // R6 — al cambiar de mercado se refetchan los precios de la bolsa para que
    // lo que vea el usuario coincida con lo que cobrará el servidor.
    //
    // `state.items` va también en las dependencias: al montar, el carrito llega
    // de localStorage mediante HYDRATE en un render posterior al del primer
    // disparo del efecto, y sin esto la primera carga quedaría sin re-precificar.
    // No puede haber bucle porque `applyRepriceToItems` devuelve el mismo array
    // cuando nada cambia y el reducer entonces devuelve el estado idéntico.
    useEffect(() => {
        if (!isHydrated) return;

        if (state.items.length === 0) return;

        let cancelled = false;

        Promise.all(
            state.items.map((item) =>
                api
                    .getPrice(item.skuId, marketCode)
                    .then((price) => ({
                        skuId: item.skuId,
                        size: item.size,
                        unitPrice: price.finalPrice,
                        currency: price.currency,
                    }))
                    .catch(() => ({
                        skuId: item.skuId,
                        size: item.size,
                        priceUnavailable: true,
                    }))
            )
        ).then((results) => {
            if (cancelled) return;

            const next = applyRepriceToItems(state.items, results);
            if (next !== state.items) {
                dispatch({ type: "REPRICE", payload: results });
                setItemsRef.current(() => next);
            }
            setPricedMarket(marketCode);
        });

        return () => {
            cancelled = true;
        };
    }, [marketCode, isHydrated, state.items]);

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
    // R8: la tasa sale del mercado activo — antes era TAX_RATE = 0.21 fijo (ES).
    const taxEstimate = subtotal * (market.taxRate / 100);
    const currency = market.currency;
    const hasUnavailableItems = state.items.some((item) => item.priceUnavailable === true);
    // Derivado: true mientras los precios no estén validados para el mercado activo.
    const isRepricing = state.items.length > 0 && pricedMarket !== marketCode;

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
                isRepricing,
                hasUnavailableItems,
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
