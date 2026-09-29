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
}

export interface Order {
    id: number;
    orderNumber: string;
    idempotencyKey: string;
    marketCode: string;
    currency: string;
    status: "PENDING" | "CONFIRMED" | "CANCELLED";
    subtotalAmount: number;
    taxAmount: number;
    totalAmount: number;
    createdAt: string;
    items: OrderItem[];
}