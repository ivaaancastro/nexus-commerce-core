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

/**
 * Familia textil con su recuento de productos (Tarea 3.1, R1).
 * Refleja exactamente `FamilyResponse` del backend.
 *
 * El portada y el menú de filtros se pintan únicamente de esta respuesta:
 * la taxonomía es dato del servidor, no algo que se derive en cliente.
 */
export interface FamilyResponse {
    family: string;
    productCount: number;
}

/** Orden admitido por `GET /api/v1/products?sort=`. El backend devuelve 400 ante uno desconocido. */
export type SortOption = "default" | "name-asc" | "name-desc";

/**
 * Filtros del catálogo (Tarea 3.1, R2). Todos opcionales y combinables con AND.
 * Se traducen 1:1 a query params — la URL es el estado, no una copia de él.
 *
 * No hay `page` ni `size` de paginación a propósito: es regla de producto que
 * el catálogo no se pagina y todo el contenido baje en continuo (D10).
 * El `size` de aquí es la **talla de SKU**, no un tamaño de página.
 */
export interface ProductFilters {
    family?: string;
    size?: string;
    color?: string;
    sort?: SortOption;
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

/**
 * Mercado disponible para el selector de divisa (Tarea 3.2).
 * Refleja exactamente `MarketResponse` del backend.
 */
export interface Market {
    code: string;
    name: string;
    currency: string;
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
    /** Obligatorio desde la Tarea 5.5 (R1): la dirección se copia a la orden. */
    addressId: number;
    /** Obligatorio desde la Tarea 5.5 (R2): preferencia declarada, no se procesa. */
    paymentMethod: PaymentMethod;
}

/**
 * Preferencia de pago declarada al hacer checkout (Tarea 5.5, R2).
 * Refleja el enum `PaymentMethod` del backend.
 *
 * **No procesa pagos**: no se pide número de tarjeta ni se tokeniza — el proyecto
 * no tiene pasarela de pago, igual que `refundAmount` es solo un registro contable.
 */
export type PaymentMethod = "CARD" | "BIZUM" | "PAYPAL" | "BANK_TRANSFER";

/**
 * Etiquetas visibles de cada método de pago. El orden es el del selector del
 * carrito.
 */
export const PAYMENT_METHODS: PaymentMethod[] = [
    "CARD",
    "BIZUM",
    "PAYPAL",
    "BANK_TRANSFER",
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
    CARD: "Tarjeta",
    BIZUM: "Bizum",
    PAYPAL: "PayPal",
    BANK_TRANSFER: "Transferencia bancaria",
};

/**
 * Snapshot inmutable de la dirección de envío usada en el pedido (Tarea 5.5, R1).
 * Es el valor que se copió al hacer checkout, no la dirección actual del usuario:
 * si él la edita después, el pedido no cambia.
 *
 * Corresponde a `ShippingAddressResponse`; llega en `null` en las órdenes
 * anteriores a la migración V10.
 */
export interface ShippingAddress {
    fullName: string;
    street: string;
    city: string;
    postalCode: string;
    countryCode: string;
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
    /** Nombre del producto, vía `OrderItem → Sku → Product` (Tarea 5.5, R3). */
    productName: string;
    productFamily: string;
    size: string;
    color: string;
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
    /**
     * Límite para solicitar la devolución: `createdAt + 30 días` (Tarea 5.5, R4).
     * Sale del backend para que los 30 días no se reimplementen en cliente.
     * `null` solo en la respuesta inmediata del checkout, cuando `createdAt`
     * aún no se ha fijado en el flush.
     */
    returnDeadline: string | null;
    /** `null` en las órdenes previas a V10 → la sección no se llega a pintar. */
    shippingAddress: ShippingAddress | null;
    /** `null` en las órdenes previas a V10. Preferencia declarada, no cobrada. */
    paymentMethod: PaymentMethod | null;
    items: OrderItem[];
}

/**
 * Línea resumida para la tarjeta del historial (Tarea 5.5, R9).
 * Corresponde a `OrderItemPreviewResponse`: solo lo que se pinta, sin precios
 * fiscales ni elegibilidad de devolución.
 */
export interface OrderItemPreview {
    productName: string;
    productFamily: string;
    size: string;
    color: string;
    quantity: number;
    totalAmount: number;
}

/**
 * Fila del historial de pedidos. Corresponde a `OrderSummaryResponse`.
 */
export interface OrderSummary {
    id: number;
    orderNumber: string;
    status: OrderStatus;
    currency: string;
    totalAmount: number;
    createdAt: string;
    itemCount: number;
    /** Líneas para pintar la tarjeta. */
    items: OrderItemPreview[];
    /** `true` si alguna línea tiene devolución solicitada (Tarea 5.5, R10). */
    returnRequested: boolean;
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
    /** Espec. R6/D6: true cuando el mercado activo no tiene precio para este SKU. */
    priceUnavailable?: boolean;
}

export interface CartState {
    items: CartItem[];
}

/**
 * Resultado de re-precificar un artículo en un nuevo mercado (Tarea 3.2, R6).
 * `unitPrice`/`currency` ausentes significa «ese mercado no tiene precio».
 */
export interface RepriceResult {
    skuId: number;
    size: string;
    unitPrice?: number;
    currency?: string;
    priceUnavailable?: boolean;
}

export type CartAction =
    | { type: "ADD_ITEM"; payload: CartItem }
    | { type: "REMOVE_ITEM"; payload: { skuId: number; size: string } }
    | { type: "UPDATE_QUANTITY"; payload: { skuId: number; size: string; quantity: number } }
    | { type: "CLEAR_CART" }
    | { type: "REPRICE"; payload: RepriceResult[] }
    | { type: "HYDRATE"; payload: CartItem[] };