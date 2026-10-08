// Tarea 4.3 (R2) — garantiza **un pedido real** para las rutas parametrizadas
// de la auditoría (`/orders/[orderNumber]` y `/receipt/[orderNumber]`).
//
// Por qué no basta con esperar a la suite de humo:
//
//   1. En CI cada corrida arranca con una BD **recién migrada** → 0 pedidos.
//   2. `a11y.spec.ts` se ejecuta **antes** que `smoke.spec.ts` (orden
//      alfabético), así que esperar a ese fichero sería esperar en vano.
//
// Por eso la auditoría asegura su propio pedido **por la API real**: si ya
// existe se reutiliza; si no, se hace el checkout con la misma cadena que el
// usuario (login → producto → dirección → `POST /orders/checkout`). No se
// inventa ni se hardcodea un número de pedido, y no se duplica la prueba de UI
// de la compra — eso sí lo cubre `smoke.spec.ts`.

import { callOk } from "./api";
import { E2E_USER, PRODUCT } from "./config";

interface TokenResponse {
    token: string;
}

interface OrderListResponse {
    orders: { orderNumber: string }[];
}

interface AddressDto {
    id: number;
    countryCode: string;
    defaultAddress: boolean;
}

interface ProductResponse {
    skus: { id: number; size: string }[];
}

interface OrderCreatedResponse {
    orderNumber: string;
}

/**
 * Los mismos valores que envía el carrito (`src/app/cart/page.tsx`): almacén
 * `AUTO` y las coordenadas fijas con las que se decide la proximidad. No se
 * cambian aquí porque cambiarlas cambiaría qué almacén se consume.
 */
const CHECKOUT = {
    marketCode: "ES",
    warehouseCode: "AUTO",
    latitude: 40.4168,
    longitude: -3.7038,
} as const;

async function loginApi(): Promise<string> {
    const { token } = await callOk<TokenResponse>("/api/v1/auth/login", {
        method: "POST",
        json: { email: E2E_USER.email, password: E2E_USER.password },
    });
    return token;
}

/** Número del pedido más reciente de la cuenta, o `undefined` si no hay. */
async function latestOrderNumber(token: string): Promise<string | undefined> {
    const page = await callOk<OrderListResponse>("/api/v1/users/me/orders?page=0&size=1", { token });
    return page.orders[0]?.orderNumber;
}

/**
 * Devuelve un número de pedido **real** de la cuenta, creándolo si no existe.
 *
 * El `skuId` se busca por talla en la respuesta del producto en vez de
 * hardcodearlo: es un identificador de BD y depende de la semilla.
 */
export async function ensureOrderNumber(): Promise<string> {
    const token = await loginApi();

    const existing = await latestOrderNumber(token);
    if (existing) return existing;

    const product = await callOk<ProductResponse>(
        `/api/v1/products/search?reference=${encodeURIComponent(PRODUCT.reference)}`
    );
    const sku = product.skus.find((s) => s.size === PRODUCT.size);
    if (!sku) {
        throw new Error(`No hay SKU de talla ${PRODUCT.size} en ${PRODUCT.reference}: la auditoría no puede montar la ruta.`);
    }

    const addresses = await callOk<AddressDto[]>("/api/v1/users/me/addresses", { token });
    const address = addresses.find((a) => a.defaultAddress) ?? addresses[0];
    if (!address) throw new Error("El usuario de prueba no tiene dirección de envío.");

    const order = await callOk<OrderCreatedResponse>("/api/v1/orders/checkout", {
        method: "POST",
        token,
        headers: { "Idempotency-Key": crypto.randomUUID() },
        json: {
            marketCode: CHECKOUT.marketCode,
            items: [{ skuId: sku.id, warehouseCode: CHECKOUT.warehouseCode, quantity: 1 }],
            destinationCountryCode: address.countryCode,
            destinationLatitude: CHECKOUT.latitude,
            destinationLongitude: CHECKOUT.longitude,
            addressId: address.id,
            paymentMethod: "CARD",
        },
    });

    return order.orderNumber;
}
