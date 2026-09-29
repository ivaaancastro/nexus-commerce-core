import {
    Product,
    SemanticSearchResult,
    PriceBreakdown,
    StockInfo,
    CheckoutRequest,
    Order,
} from "@/types/commerce";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

async function handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API Error [${res.status}]: ${errorText || res.statusText}`);
    }
    return res.json();
}

export const api = {
    // Catálogo
    getProducts: async (): Promise<Product[]> => {
        const res = await fetch(`${BASE_URL}/api/v1/products`, { cache: "no-store" });
        return handleResponse<Product[]>(res);
    },

    searchByReference: async (ref: string): Promise<Product> => {
        const res = await fetch(`${BASE_URL}/api/v1/products/search?reference=${encodeURIComponent(ref)}`);
        return handleResponse<Product>(res);
    },

    // Búsqueda Semántica Vectorial (pgvector)
    searchSemantic: async (query: string, limit: number = 8): Promise<SemanticSearchResult[]> => {
        const res = await fetch(
            `${BASE_URL}/api/v1/products/search/semantic?query=${encodeURIComponent(query)}&limit=${limit}`
        );
        return handleResponse<SemanticSearchResult[]>(res);
    },

    // Precios
    getPrice: async (skuId: number, market: string = "ES"): Promise<PriceBreakdown> => {
        const res = await fetch(`${BASE_URL}/api/v1/pricing/skus/${skuId}?market=${market}`);
        return handleResponse<PriceBreakdown>(res);
    },

    // Inventario
    getStock: async (skuId: number): Promise<StockInfo> => {
        const res = await fetch(`${BASE_URL}/api/v1/inventory/skus/${skuId}`);
        return handleResponse<StockInfo>(res);
    },

    // Checkout e Idempotencia
    checkout: async (request: CheckoutRequest, idempotencyKey: string): Promise<Order> => {
        const res = await fetch(`${BASE_URL}/api/v1/orders/checkout`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": idempotencyKey,
            },
            body: JSON.stringify(request),
        });
        return handleResponse<Order>(res);
    },

    // Pedidos
    getOrder: async (orderNumber: string): Promise<Order> => {
        const res = await fetch(`${BASE_URL}/api/v1/orders/${encodeURIComponent(orderNumber)}`, {
            cache: "no-store",
        });
        return handleResponse<Order>(res);
    },
};