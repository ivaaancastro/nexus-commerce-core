import {
    Product,
    Sku,
    FamilyResponse,
    ProductFilters,
    SemanticSearchResult,
    PriceBreakdown,
    Market,
    StockInfo,
    CheckoutRequest,
    Order,
    OrderPage,
    ProductReturn,
    CreateReturnPayload,
    ProductCreateData,
    ProductUpdateData,
    SkuCreateData,
    SkuUpdateData,
    StockMatrix,
    StockCell,
    StockUpdateData,
    SkuPrice,
    PriceUpdateData,
    OrderStatus,
    AdminOrderPage,
    AdminOrderDetail,
    AdminOrderStatusData,
    AdminOrderTrackingData,
    AdminDashboard,
    Wishlist,
    ProductReview,
    ReviewSummaryResponse,
    AdminReviewPageResponse,
    CreateReviewRequest,
    WishlistItem,
    CouponValidateRequest,
    CouponValidationResponse,
    AdminCouponPageResponse,
    AdminCouponCreateRequest,
    AdminCouponUpdateRequest,
    AdminCouponDetailResponse,
} from "@/types/commerce";
import { RegisterData, LoginData, AuthResponse, User, Address, AddressData, ProfileUpdateData, SizeRecommendation, AdminUserPage, AdminUser, AdminUserRoleData, AdminUserSuspensionData } from "@/types/auth";

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
    return token ? { Authorization: `Bearer ${token}` } : {
}
}

export const api = {
    // Catálogo — los filtros se traducen a query params. Todos son opcionales:
    // sin argumentos la llamada es idéntica a la de siempre (R2).
    getProducts: async (filters?: ProductFilters): Promise<Product[]> => {
        const params = new URLSearchParams();

        // Sólo se emiten los parámetros con valor real; los vacíos y el orden
        // por defecto no viajan, para que la URL compartible quede limpia (R5).
        if (filters?.family) params.set("family", filters.family);
        if (filters?.size) params.set("size", filters.size);
        if (filters?.color) params.set("color", filters.color);
        if (filters?.sort && filters.sort !== "default") params.set("sort", filters.sort);

        const query = params.toString();
        const res = await fetch(`${BASE_URL}/api/v1/products${query ? `?${query}` : ""}`, {
            cache: "no-store",
        });
        return handleResponse<Product[]>(res);
    },

    // Taxonomía del catálogo: familias con su recuento (Tarea 3.1, R1)
    getFamilies: async (): Promise<FamilyResponse[]> => {
        const res = await fetch(`${BASE_URL}/api/v1/products/families`, { cache: "no-store" });
        return handleResponse<FamilyResponse[]>(res);
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

    // Mercados (selector de divisa — Tarea 3.2, R1)
    getMarkets: async (): Promise<Market[]> => {
        const res = await fetch(`${BASE_URL}/api/v1/markets`, { cache: "no-store" });
        return handleResponse<Market[]>(res);
    },

    // Precios — `market` es obligatorio: el precio siempre pertenece a un mercado (R4)
    getPrice: async (skuId: number, market: string): Promise<PriceBreakdown> => {
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

    // ── Devoluciones (Tarea 5.4) ────────────────────────────────────────────

    getMyReturns: async (orderNumber: string): Promise<ProductReturn[]> => {
        const res = await fetch(
            `${BASE_URL}/api/v1/users/me/orders/${encodeURIComponent(orderNumber)}/returns`,
            { headers: getAuthHeaders(), cache: "no-store" }
        );
        return handleResponse<ProductReturn[]>(res);
    },

    createReturn: async (
        orderNumber: string,
        payload: CreateReturnPayload
    ): Promise<ProductReturn> => {
        const res = await fetch(
            `${BASE_URL}/api/v1/users/me/orders/${encodeURIComponent(orderNumber)}/returns`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                body: JSON.stringify(payload),
            }
        );
        return handleResponse<ProductReturn>(res);
    },

    // ── Favoritos (spec V3 wishlist, R3/R4) ────────────────────────────────
    // Los 4 endpoints son authenticated(): sin el header el backend responde
    // 401 y el corazón redirige a /login antes de llegar aquí (R5.3).

    getWishlist: async (): Promise<Wishlist> => {
        const res = await fetch(`${BASE_URL}/api/v1/wishlist`, {
            headers: getAuthHeaders(),
            cache: "no-store",
        });
        return handleResponse<Wishlist>(res);
    },

    /** Idempotente: repetir devuelve el ítem existente (200) sin fila nueva (R3.2). */
    addWishlistItem: async (productId: number): Promise<WishlistItem> => {
        const res = await fetch(`${BASE_URL}/api/v1/wishlist/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify({ productId }),
        });
        return handleResponse<WishlistItem>(res);
    },

    /** 204 siempre, exista o no el ítem (R3.3) — `handleResponse` tolera el vacío. */
    removeWishlistItem: async (productId: number): Promise<void> => {
        const res = await fetch(`${BASE_URL}/api/v1/wishlist/items/${productId}`, {
            method: "DELETE",
            headers: getAuthHeaders(),
        });
        return handleResponse<void>(res);
    },

    clearWishlist: async (): Promise<void> => {
        const res = await fetch(`${BASE_URL}/api/v1/wishlist`, {
            method: "DELETE",
            headers: getAuthHeaders(),
        });
        return handleResponse<void>(res);
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

    // ── Admin · Catálogo (Tarea 7.2) ───────────────────────────────────────
    // Zona /api/v1/admin/**: sin el header de sesión el backend responde 401
    // y con rol USER, 403. Las lecturas devuelven los mismos Product/Sku de
    // la vitrina; los borrados toleran el 204 sin cuerpo (regla 8).

    listAdminProducts: async (): Promise<Product[]> => {
        const res = await fetch(`${BASE_URL}/api/v1/admin/products`, {
            headers: getAuthHeaders(),
            cache: "no-store",
        });
        return handleResponse<Product[]>(res);
    },

    getAdminProduct: async (id: number): Promise<Product> => {
        const res = await fetch(`${BASE_URL}/api/v1/admin/products/${id}`, {
            headers: getAuthHeaders(),
            cache: "no-store",
        });
        return handleResponse<Product>(res);
    },

    createAdminProduct: async (data: ProductCreateData): Promise<Product> => {
        const res = await fetch(`${BASE_URL}/api/v1/admin/products`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify(data),
        });
        return handleResponse<Product>(res);
    },

    updateAdminProduct: async (id: number, data: ProductUpdateData): Promise<Product> => {
        const res = await fetch(`${BASE_URL}/api/v1/admin/products/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify(data),
        });
        return handleResponse<Product>(res);
    },

    deleteAdminProduct: async (id: number): Promise<void> => {
        const res = await fetch(`${BASE_URL}/api/v1/admin/products/${id}`, {
            method: "DELETE",
            headers: getAuthHeaders(),
        });
        await handleResponse(res);
    },

    createAdminSku: async (productId: number, data: SkuCreateData): Promise<Sku> => {
        const res = await fetch(`${BASE_URL}/api/v1/admin/products/${productId}/skus`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify(data),
        });
        return handleResponse<Sku>(res);
    },

    updateAdminSku: async (
        productId: number,
        skuId: number,
        data: SkuUpdateData
    ): Promise<Sku> => {
        const res = await fetch(`${BASE_URL}/api/v1/admin/products/${productId}/skus/${skuId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify(data),
        });
        return handleResponse<Sku>(res);
    },

    deleteAdminSku: async (productId: number, skuId: number): Promise<void> => {
        const res = await fetch(`${BASE_URL}/api/v1/admin/products/${productId}/skus/${skuId}`, {
            method: "DELETE",
            headers: getAuthHeaders(),
        });
        await handleResponse(res);
    },

    // ── Admin · Stock y precios (Tarea 7.3) ────────────────────────────────
    // Misma zona /api/v1/admin/**: 401 sin sesión, 403 con rol USER. Los PUTs
    // devuelven la celda/fila resultante para actualizar la UI sin re-fetch.

    getAdminStock: async (): Promise<StockMatrix> => {
        const res = await fetch(`${BASE_URL}/api/v1/admin/stock`, {
            headers: getAuthHeaders(),
            cache: "no-store",
        });
        return handleResponse<StockMatrix>(res);
    },

    updateAdminStockCell: async (
        skuId: number,
        warehouseCode: string,
        data: StockUpdateData
    ): Promise<StockCell> => {
        const res = await fetch(`${BASE_URL}/api/v1/admin/stock/${skuId}/${warehouseCode}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify(data),
        });
        return handleResponse<StockCell>(res);
    },

    getAdminSkuPrices: async (skuId: number): Promise<SkuPrice[]> => {
        const res = await fetch(`${BASE_URL}/api/v1/admin/skus/${skuId}/prices`, {
            headers: getAuthHeaders(),
            cache: "no-store",
        });
        return handleResponse<SkuPrice[]>(res);
    },

    updateAdminSkuPrice: async (
        skuId: number,
        marketCode: string,
        data: PriceUpdateData
    ): Promise<SkuPrice> => {
        const res = await fetch(`${BASE_URL}/api/v1/admin/skus/${skuId}/prices/${marketCode}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify(data),
        });
        return handleResponse<SkuPrice>(res);
    },

    // ── Admin · Pedidos (Tarea 7.4) ────────────────────────────────────────
    // Misma zona /api/v1/admin/**: 401 sin sesión, 403 con rol USER. Los PUTs
    // devuelven el detalle actualizado para refrescar el panel sin re-fetch.

    /**
     * Listado paginado con filtros opcionales (R1). `q` en blanco se omite en
     * la URL — quien filtra es el servidor (R1.3), no hay filtrado en cliente.
     */
    getAdminOrders: async (params?: {
        page?: number;
        status?: OrderStatus;
        q?: string;
    }): Promise<AdminOrderPage> => {
        const query = new URLSearchParams();
        if (params?.page !== undefined) query.set("page", String(params.page));
        if (params?.status) query.set("status", params.status);
        if (params?.q) query.set("q", params.q);
        const qs = query.toString();
        const res = await fetch(`${BASE_URL}/api/v1/admin/orders${qs ? `?${qs}` : ""}`, {
            headers: getAuthHeaders(),
            cache: "no-store",
        });
        return handleResponse<AdminOrderPage>(res);
    },

    getAdminOrder: async (orderNumber: string): Promise<AdminOrderDetail> => {
        const res = await fetch(`${BASE_URL}/api/v1/admin/orders/${orderNumber}`, {
            headers: getAuthHeaders(),
            cache: "no-store",
        });
        return handleResponse<AdminOrderDetail>(res);
    },

    updateAdminOrderStatus: async (
        orderNumber: string,
        data: AdminOrderStatusData
    ): Promise<AdminOrderDetail> => {
        const res = await fetch(`${BASE_URL}/api/v1/admin/orders/${orderNumber}/status`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify(data),
        });
        return handleResponse<AdminOrderDetail>(res);
    },

    updateAdminOrderTracking: async (
        orderNumber: string,
        data: AdminOrderTrackingData
    ): Promise<AdminOrderDetail> => {
        const res = await fetch(`${BASE_URL}/api/v1/admin/orders/${orderNumber}/tracking`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify(data),
        });
        return handleResponse<AdminOrderDetail>(res);
    },

    // ── Admin · Usuarios (Tarea 7.5) ───────────────────────────────────────
    // Misma zona /api/v1/admin/**: 401 sin sesión, 403 con rol USER. Los PUTs
    // devuelven el usuario actualizado para refrescar la fila sin re-fetch.

    /**
     * Listado paginado con búsqueda opcional (R1). `q` en blanco se omite en
     * la URL — quien filtra es el servidor, no hay filtrado en cliente.
     */
    getAdminUsers: async (params?: { page?: number; q?: string }): Promise<AdminUserPage> => {
        const query = new URLSearchParams();
        if (params?.page !== undefined) query.set("page", String(params.page));
        if (params?.q) query.set("q", params.q);
        const qs = query.toString();
        const res = await fetch(`${BASE_URL}/api/v1/admin/users${qs ? `?${qs}` : ""}`, {
            headers: getAuthHeaders(),
            cache: "no-store",
        });
        return handleResponse<AdminUserPage>(res);
    },

    updateAdminUserRole: async (id: number, data: AdminUserRoleData): Promise<AdminUser> => {
        const res = await fetch(`${BASE_URL}/api/v1/admin/users/${id}/role`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify(data),
        });
        return handleResponse<AdminUser>(res);
    },

    setAdminUserSuspension: async (
        id: number,
        data: AdminUserSuspensionData
    ): Promise<AdminUser> => {
        const res = await fetch(`${BASE_URL}/api/v1/admin/users/${id}/suspension`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify(data),
        });
        return handleResponse<AdminUser>(res);
    },

    // ── Admin · Dashboard (Tarea 7.6) ──────────────────────────────────────
    // Misma zona /api/v1/admin/**: 401 sin sesión, 403 con rol USER. Sólo
    // lectura: la portada pinta la foto del negocio sin escribir nada (R5).

    /**
     * Foto del negocio para la portada del panel (R1). `days` opcional
     * 1–365 (la UI ofrece 7/30/90); sin `days` el backend aplica su default
     * de 30 — no se duplica la constante aquí.
     */
    getAdminDashboard: async (days?: number): Promise<AdminDashboard> => {
        const qs = days !== undefined ? `?days=${days}` : "";
        const res = await fetch(`${BASE_URL}/api/v1/admin/dashboard${qs}`, {
            headers: getAuthHeaders(),
            cache: "no-store",
        });
        return handleResponse<AdminDashboard>(res);
    },

    // ── Reseñas de producto (V4 Reviews) ──────────────────────────────────

    getProductReviews: async (productId: number): Promise<ReviewSummaryResponse> => {
        const res = await fetch(`${BASE_URL}/api/v1/products/${productId}/reviews`, {
            cache: "no-store",
        });
        return handleResponse<ReviewSummaryResponse>(res);
    },

    createProductReview: async (productId: number, data: CreateReviewRequest): Promise<ProductReview> => {
        const res = await fetch(`${BASE_URL}/api/v1/products/${productId}/reviews`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify(data),
        });
        return handleResponse<ProductReview>(res);
    },

    deleteProductReview: async (productId: number, reviewId: number): Promise<void> => {
        const res = await fetch(`${BASE_URL}/api/v1/products/${productId}/reviews/${reviewId}`, {
            method: "DELETE",
            headers: getAuthHeaders(),
        });
        await handleResponse(res);
    },

    adminDeleteProductReview: async (reviewId: number): Promise<void> => {
        const res = await fetch(`${BASE_URL}/api/v1/admin/reviews/${reviewId}`, {
            method: "DELETE",
            headers: getAuthHeaders(),
        });
        await handleResponse(res);
    },
    // V5: Validar cupón promocional
    validateCoupon: async (data: CouponValidateRequest): Promise<CouponValidationResponse> => {
        const res = await fetch(`${BASE_URL}/api/v1/coupons/validate`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify(data),
        });
        return handleResponse<CouponValidationResponse>(res);
    },
    // V5: Admin coupon endpoints
    getAdminCoupons: async (page: number = 0, size: number = 20, code?: string, type?: string, active?: boolean) => {
        const query = new URLSearchParams();
        if (page) query.set('page', String(page));
        if (size) query.set('size', String(size));
        if (code) query.set('code', code);
        if (type) query.set('type', type);
        if (active !== undefined) query.set('active', String(active));
        const qs = query.toString();
        const res = await fetch(`${BASE_URL}/api/v1/admin/coupons${qs ? '?' + qs : ''}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            cache: 'no-store'
        });
        return handleResponse<AdminCouponPageResponse>(res);
    },

<<<<<<< HEAD
<<<<<<< HEAD
    getAdminReviews: async (page: number = 0, size: number = 20): Promise<AdminReviewPageResponse> => {
        const res = await fetch(`${BASE_URL}/api/v1/admin/reviews?page=${page}&size=${size}`, {
            headers: getAuthHeaders(),
            cache: "no-store",
        });
        return handleResponse<AdminReviewPageResponse>(res);
    },

    // V5: Validar cupón promocional
    validateCoupon: async (data: CouponValidateRequest): Promise<CouponValidationResponse> => {
        const res = await fetch(`${BASE_URL}/api/v1/coupons/validate`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify(data),
        });
        return handleResponse<CouponValidationResponse>(res);
    },

=======
    createAdminCoupon: async (coupon: AdminCouponCreateRequest) => {
        const res = await fetch(`${BASE_URL}/api/v1/admin/coupons`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(coupon),
        });
        return handleResponse<AdminCouponDetailResponse>(res);
    },

    updateAdminCoupon: async (id: number, coupon: AdminCouponUpdateRequest) => {
        const res = await fetch(`${BASE_URL}/api/v1/admin/coupons/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(coupon),
        });
        return handleResponse<AdminCouponDetailResponse>(res);
    },

    deleteAdminCoupon: async (id: number) => {
        const res = await fetch(`${BASE_URL}/api/v1/admin/coupons/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        await handleResponse(res);
    },


>>>>>>> 4057d62 (feat(coupons): V5 complete - admin API endpoints, types, docs, changelog)
};
=======
    createAdminCoupon: async (coupon: AdminCouponCreateRequest) => {
        const res = await fetch(`${BASE_URL}/api/v1/admin/coupons`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(coupon),
        });
        return handleResponse<AdminCouponDetailResponse>(res);
    },

    updateAdminCoupon: async (id: number, coupon: AdminCouponUpdateRequest) => {
        const res = await fetch(`${BASE_URL}/api/v1/admin/coupons/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(coupon),
        });
        return handleResponse<AdminCouponDetailResponse>(res);
    },

    deleteAdminCoupon: async (id: number) => {
        const res = await fetch(`${BASE_URL}/api/v1/admin/coupons/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        await handleResponse(res);
    },


};
>>>>>>> 4057d62 (feat(coupons): V5 complete - admin API endpoints, types, docs, changelog)
