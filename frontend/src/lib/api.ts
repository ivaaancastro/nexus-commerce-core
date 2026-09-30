import {
    Product,
    SemanticSearchResult,
    PriceBreakdown,
    StockInfo,
    CheckoutRequest,
    Order,
} from "@/types/commerce";
import { RegisterData, LoginData, AuthResponse, User } from "@/types/auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

async function handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API Error [${res.status}]: ${errorText || res.statusText}`);
    }
    return res.json();
}

function getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem("nexus-auth-token");
    return token ? { Authorization: `Bearer ${token}` } : {};
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

    // Autenticación
    register: async (data: RegisterData): Promise<void> => {
        const res = await fetch(`${BASE_URL}/api/v1/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        await handleResponse(res);
    },

    login: async (data: LoginData): Promise<AuthResponse> => {
        const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        return handleResponse<AuthResponse>(res);
    },

    verifyEmail: async (email: string, code: string): Promise<void> => {
        const res = await fetch(
            `${BASE_URL}/api/v1/auth/verify-email?email=${encodeURIComponent(email)}&code=${code}`,
            { method: "POST" }
        );
        await handleResponse(res);
    },

    forgotPassword: async (email: string): Promise<void> => {
        const res = await fetch(
            `${BASE_URL}/api/v1/auth/forgot-password?email=${encodeURIComponent(email)}`,
            { method: "POST" }
        );
        await handleResponse(res);
    },

    resetPassword: async (email: string, code: string, newPassword: string): Promise<void> => {
        const res = await fetch(
            `${BASE_URL}/api/v1/auth/reset-password?email=${encodeURIComponent(email)}&code=${code}&newPassword=${encodeURIComponent(newPassword)}`,
            { method: "POST" }
        );
        await handleResponse(res);
    },

    getCurrentUser: async (): Promise<User> => {
        const res = await fetch(`${BASE_URL}/api/v1/auth/me`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<User>(res);
    },
};