"use client";

import {
    createContext,
    useCallback,
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
import { taxesIncludedAmount } from "@/lib/taxes";

interface CartContextType {
    items: CartItem[];
    addItem: (item: CartItem) => void;
    removeItem: (skuId: number, size: string) => void;
    updateQuantity: (skuId: number, size: string, quantity: number) => void;
    clearCart: () => void;
    totalItems: number;
    subtotal: number;
    /**
     * Parte del `subtotal` que ya lleva el impuesto **dentro** (spec
     * `final-price-display`, D3). Sólo presentación: `subtotal` ya es el
     * importe que cobra el checkout, y este número **no se suma** a él.
     */
    taxIncluded: number;
    /**
     * Tasa del mercado activo, **la misma** con la que se calcula
     * `taxIncluded` — el copy necesita el porcentaje y exponerla aquí evita
     * que dos superficies se lean la tasa de sitios distintos.
     */
    taxRate: number;
    currency: string;
    /** R6: true mientras se refetchan los precios del nuevo mercado. */
    isRepricing: boolean;
    /** R6/D6: true si algún artículo no tiene precio en el mercado activo. */
    hasUnavailableItems: boolean;
    /** R5-V5: código de cupón aplicado en el carrito. */
    couponCode?: string;
    /** R5-V5: importe del descuento derivado de cupón aplicado (0 sin cupón). */
    couponDiscount: number;
    /**
     * R5-V5 (spec §2.4): aplica un código de cupón. La validación es en
     * tiempo real contra `POST /api/v1/coupons/validate` — el estado sólo
     * se consolida (`couponCode`) cuando el servidor responde `valid`.
     */
    applyCoupon: (code: string) => void;
    /** R5-V5: quita el cupón (✕ del resumen o input vacío). */
    removeCoupon: () => void;
    /** Mensaje de la última validación («Cupón aplicado» o por qué no aplica). */
    couponMessage: string | null;
    /** Estado de la validación: el input muestra «Validando...» con `validating`. */
    couponStatus: CouponStatus;
}

/** R5-V5: ciclo de vida de la validación del cupón. */
export type CouponStatus = "idle" | "validating" | "valid" | "invalid";

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

    // R5-V5: Estado del cupón (spec §2.4). `couponCode` sólo se consolida
    // tras una validación exitosa — criterio de aceptación de la spec: el
    // intento inválido deja mensaje pero nunca un cupón aplicado.
    const [couponCode, setCouponCode] = useState<string | undefined>(undefined);
    const [couponDiscount, setCouponDiscount] = useState<number>(0);
    const [couponMessage, setCouponMessage] = useState<string | null>(null);
    const [couponStatus, setCouponStatus] = useState<CouponStatus>("idle");
    // Descarta respuestas de validación obsoletas (código o subtotal cambió
    // mientras la petición anterior volvía).
    const couponSeqRef = useRef(0);

    // layout.tsx monta MarketProvider envolviendo a CartProvider (D5). Sin
    // provider, useMarket devuelve el mercado por defecto (ES) — ver MarketContext.
    const { market } = useMarket();
    const marketCode = market.code;

    // Derivados de render — calculados AQUÍ porque la validación del cupón
    // (más abajo) necesita `subtotal`: antes vivían tras los efectos y por eso
    // el validate de cupón tuvo que inventar un subtotal.
    const totalItems = state.items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = state.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    // R8: la tasa sale del mercado activo — antes era TAX_RATE = 0.21 fijo (ES).
    // D3: `subtotal` **ya es precio final** (los precios de `market_prices`
    // incluyen el impuesto), así que la parte incluida se *deriva* dividiendo:
    // 79,95 al 21 % → 13,88. Sumarle el 21 % encima (el viejo `taxEstimate`)
    // enseñaba 96,74 en pantalla cuando el backend cobra 79,95.
    const taxIncluded = taxesIncludedAmount(subtotal, market.taxRate);
    const currency = market.currency;
    const hasUnavailableItems = state.items.some((item) => item.priceUnavailable === true);
    // Derivado: true mientras los precios no estén validados para el mercado activo.
    const isRepricing = state.items.length > 0 && pricedMarket !== marketCode;

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

    // R5-V5 (spec §2.4): validar el cupón en backend cuando cambia el código
    // o el subtotal («Validar al actualizar importe» de la spec). El endpoint
    // exige sesión (SecurityConfig), así que `api.validateCoupon` lleva los
    // headers de auth — el fetch suelto anterior recibía 401.
    useEffect(() => {
        const code = couponCode?.trim() ?? "";
        if (code.length < 3) {
            // Sin `setState` aquí (regla `react-hooks/set-state-in-effect`):
            // `removeCoupon` ya pone estado a idle en su handler y `applyCoupon`
            // sólo se invoca con ≥3 caracteres; este ramo sólo puede alcanzarse
            // con el estado ya correcto.
            return;
        }

        // Subtotal real del carrito en unidades mayores (§2.6A) — el `10000`
        // hardcodeado anterior no tenía relación con el carrito. `toFixed(2)`
        // elimina el ruido de punto flotante antes del JSON.stringify.
        const subtotalSnapshot = subtotal;
        const seq = ++couponSeqRef.current;

        api.validateCoupon({ code: code.toUpperCase(), subtotal: Number(subtotalSnapshot.toFixed(2)) })
            .then((res) => {
                // Descarta respuestas obsoletas (otro código o subtotal ganó).
                if (seq !== couponSeqRef.current) return;
                if (res.valid) {
                    setCouponStatus("valid");
                    setCouponMessage(res.message ?? "Cupón aplicado");
                    setCouponDiscount(res.discountAmount ?? 0);
                } else {
                    // §2.4: un intento inválido deja mensaje pero **nunca** un
                    // cupón aplicado — se retira el código para que el checkout
                    // no lo envíe y el resumen no lo pinte.
                    setCouponStatus("invalid");
                    setCouponMessage(res.message ?? "Cupón no válido");
                    setCouponDiscount(0);
                    setCouponCode(undefined);
                }
            })
            .catch(() => {
                if (seq !== couponSeqRef.current) return;
                setCouponStatus("invalid");
                setCouponMessage("No se pudo validar el cupón. Inténtalo de nuevo.");
                setCouponDiscount(0);
                setCouponCode(undefined);
            });
    }, [couponCode, subtotal]);

    const applyCoupon = useCallback(
        (code: string) => {
            // Mismo código ya consolidado: no se re-dispara (evita un bucle de
            // validación con el debounce del input).
            if (code === couponCode) return;
            // Handler de evento (no efecto): puede marcar «Validando...» al
            // instante; el efecto de arriba se dispara con el nuevo código.
            setCouponStatus("validating");
            setCouponCode(code);
        },
        [couponCode]
    );

    const removeCoupon = useCallback(() => {
        couponSeqRef.current++; // invalida cualquier validación en vuelo
        setCouponCode(undefined);
        setCouponDiscount(0);
        setCouponMessage(null);
        setCouponStatus("idle");
    }, []);

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
        // El pedido desaparece: el cupón aplicado sobre él tampoco aplica.
        removeCoupon();
    };

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
                taxIncluded,
                taxRate: market.taxRate,
                currency,
                isRepricing,
                hasUnavailableItems,
                couponCode,
                couponDiscount,
                applyCoupon,
                removeCoupon,
                couponMessage,
                couponStatus,
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
