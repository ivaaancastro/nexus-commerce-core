export interface Sku {
    id: number;
    barcode: string;
    size: string;
    color: string;
}

export interface Product {
    id: number;
    referenceCode: string;
    name: string;
    family: string;
    description?: string;
    skus: Sku[];
}

export interface SemanticSearchResult {
    productId: number;
    referenceCode: string;
    name: string;
    family: string;
    description: string;
    similarityScore: number;
    tags: string[];
}

export interface PriceBreakdown {
    skuId: number;
    marketCode: string;
    currency: string;
    finalPrice: number;
    originalPrice: number;
    hasDiscount: boolean;
    netAmount: number;
    taxAmount: number;
    taxRate: number;
}

export interface WarehouseStock {
    warehouseCode: string;
    warehouseName: string;
    countryCode: string;
    quantityAvailable: number;
    quantityReserved: number;
    netAvailable: number;
}

export interface StockInfo {
    skuId: number;
    totalAvailable: number;
    inStock: boolean;
    breakdown: WarehouseStock[];
}

export interface CheckoutItemRequest {
    skuId: number;
    warehouseCode: string;
    quantity: number;
}

export interface CheckoutRequest {
    marketCode: string;
    items: CheckoutItemRequest[];
    destinationCountryCode?: string;
    destinationLatitude?: number;
    destinationLongitude?: number;
}

export interface OrderItem {
    id: number;
    skuId: number;
    skuCode: string;
    warehouseCode: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    taxAmount: number;
    totalAmount: number;
    /** `true` solo si cumple R1 (30 días) + R2 (DELIVERED) + R3 (sin devolución previa). */
    returnEligible: boolean;
    /** Motivo de inelegibilidad, o `null` si la línea es devolvible. */
    returnIneligibleReason: ReturnIneligibleReason | null;
}

/**
 * Motivo por el que una línea no admite devolución. Refleja los valores de
 * `returnIneligibleReason` del backend (spec Tarea 5.4, R8).
 */
export type ReturnIneligibleReason =
    | "NOT_DELIVERED"
    | "EXPIRED"
    | "ALREADY_RETURNED";

/** Estados de una devolución. Refleja el enum `ReturnStatus` del backend. */
export type ReturnStatus = "REQUESTED" | "REJECTED" | "REFUNDED";

/**
 * Devolución de una línea. Corresponde a `ReturnResponse`.
 * `refundAmount` es un registro contable: no hay pasarela de pago, no mueve dinero.
 */
export interface ProductReturn {
    id: number;
    orderItemId: number;
    skuCode: string;
    status: ReturnStatus;
    reason: string;
    currency: string;
    refundAmount: number;
    requestedAt: string;
}

export interface CreateReturnPayload {
    orderItemId: number;
    reason: string;
}

/**
 * Estados del pedido. Refleja el enum `OrderStatus` del backend.
 */
export type OrderStatus =
    | "PENDING"
    | "CONFIRMED"
    | "SHIPPED"
    | "DELIVERED"
    | "CANCELLED";

export interface Order {
    id: number;
    orderNumber: string;
    idempotencyKey: string;
    marketCode: string;
    currency: string;
    status: OrderStatus;
    subtotalAmount: number;
    taxAmount: number;
    totalAmount: number;
    createdAt: string;
    items: OrderItem[];
}

/**
 * Fila del historial de pedidos. Corresponde a `OrderSummaryResponse`.
 * No incluye las líneas: solo el número de artículos.
 */
export interface OrderSummary {
    id: number;
    orderNumber: string;
    status: OrderStatus;
    currency: string;
    totalAmount: number;
    createdAt: string;
    itemCount: number;
}

/**
 * Página del historial. Corresponde a `OrderPageResponse`.
 */
export interface OrderPage {
    orders: OrderSummary[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
}

export interface CartItem {
    productId: number;
    referenceCode: string;
    name: string;
    family: string;
    skuId: number;
    size: string;
    color: string;
    quantity: number;
    unitPrice: number;
    currency: string;
    imageUrl?: string;
}

export interface CartState {
    items: CartItem[];
}

export type CartAction =
    | { type: "ADD_ITEM"; payload: CartItem }
    | { type: "REMOVE_ITEM"; payload: { skuId: number; size: string } }
    | { type: "UPDATE_QUANTITY"; payload: { skuId: number; size: string; quantity: number } }
    | { type: "CLEAR_CART" }
    | { type: "HYDRATE"; payload: CartItem[] };