import {
    Product,
    SemanticSearchResult,
    PriceBreakdown,
    StockInfo,
    CheckoutRequest,
    Order,
    OrderPage,
} from "@/types/commerce";
import { RegisterData, LoginData, AuthResponse, User, Address, AddressData, ProfileUpdateData, SizeRecommendation } from "@/types/auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

async function handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API Error [${res.status}]: ${errorText || res.statusText}`);
    }

    // Endpoints como register, verifyEmail o resetPassword devuelven 200/204 sin cuerpo.
    // res.json() lanzaría una excepción al no haber JSON que parsear.
    if (res.status === 204) {
        return undefined as T;
    }

    const text = await res.text();
    if (!text) {
        return undefined as T;
    }

    return JSON.parse(text) as T;
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
                // /api/v1/orders/** es authenticated() en SecurityConfig: sin este
                // header el backend rechaza la petición con 401.
                ...getAuthHeaders(),
            },
            body: JSON.stringify(request),
        });
        return handleResponse<Order>(res);
    },

    // Pedidos
    getOrder: async (orderNumber: string): Promise<Order> => {
        const res = await fetch(`${BASE_URL}/api/v1/orders/${encodeURIComponent(orderNumber)}`, {
            cache: "no-store",
            headers: getAuthHeaders(),
        });
        return handleResponse<Order>(res);
    },

    // ── Historial de pedidos (solo sesión) ──────────────────────────────────

    getMyOrders: async (page: number = 0, size: number = 20): Promise<OrderPage> => {
        const res = await fetch(
            `${BASE_URL}/api/v1/users/me/orders?page=${page}&size=${size}`,
            { headers: getAuthHeaders(), cache: "no-store" }
        );
        return handleResponse<OrderPage>(res);
    },

    getMyOrder: async (orderNumber: string): Promise<Order> => {
        const res = await fetch(
            `${BASE_URL}/api/v1/users/me/orders/${encodeURIComponent(orderNumber)}`,
            { headers: getAuthHeaders(), cache: "no-store" }
        );
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

    resendVerificationCode: async (email: string): Promise<void> => {
        const res = await fetch(
            `${BASE_URL}/api/v1/auth/resend-verification?email=${encodeURIComponent(email)}`,
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

    // ── Perfil ──────────────────────────────────────────────────────────────

    getProfile: async (): Promise<User> => {
        const res = await fetch(`${BASE_URL}/api/v1/users/me`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<User>(res);
    },

    updateProfile: async (data: ProfileUpdateData): Promise<User> => {
        const res = await fetch(`${BASE_URL}/api/v1/users/me`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify(data),
        });
        return handleResponse<User>(res);
    },

    // ── Direcciones ─────────────────────────────────────────────────────────

    getAddresses: async (): Promise<Address[]> => {
        const res = await fetch(`${BASE_URL}/api/v1/users/me/addresses`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<Address[]>(res);
    },

    createAddress: async (data: AddressData): Promise<Address> => {
        const res = await fetch(`${BASE_URL}/api/v1/users/me/addresses`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify(data),
        });
        return handleResponse<Address>(res);
    },

    updateAddress: async (id: number, data: AddressData): Promise<Address> => {
        const res = await fetch(`${BASE_URL}/api/v1/users/me/addresses/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify(data),
        });
        return handleResponse<Address>(res);
    },

    deleteAddress: async (id: number): Promise<void> => {
        const res = await fetch(`${BASE_URL}/api/v1/users/me/addresses/${id}`, {
            method: "DELETE",
            headers: getAuthHeaders(),
        });
        await handleResponse(res);
    },

    // ── Recomendación de talla ──────────────────────────────────────────────

    recommendSize: async (productId: number): Promise<SizeRecommendation> => {
        const res = await fetch(`${BASE_URL}/api/v1/users/me/size-recommendation`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify({ productId }),
        });
        return handleResponse<SizeRecommendation>(res);
    },
};