// Tarea 4.2 — constantes compartidas entre el `globalSetup` y las pruebas.
//
// Todo lo que un dato sembrado necesita saber vive aquí: si cambia una
// migración, cambia en un solo sitio.

/**
 * El setup habla con **Spring directamente** (puerto 8080), no a través del
 * rewrite de Next: `globalSetup` puede ejecutarse antes de que el frontend
 * esté levantado, y así el sondeo valida el backend por sí solo.
 */
export const BACKEND_URL = process.env.E2E_API_URL ?? "http://localhost:8080";

/** Techo del sondeo de arranque. Un arranque frío de Maven ronda el minuto. */
export const READY_TIMEOUT_MS = 120_000;

export const E2E_USER = {
    email: "e2e@nexus.dev",
    password: "E2ePrueba1234",
    firstName: "Prueba",
    lastName: "E2E",
    // LocalDate de Jackson: `YYYY-MM-DD`.
    birthDate: "1994-06-15",
    // Enum `Gender`: MALE | FEMALE | OTHER | PREFER_NOT_TO_SAY.
    gender: "OTHER",
} as const;

/** El checkout exige `addressId`; el carrito precoselecciona la por defecto. */
export const E2E_ADDRESS = {
    fullName: "Prueba E2E",
    street: "Calle Gran Via 1",
    city: "Madrid",
    postalCode: "28013",
    countryCode: "ES",
    defaultAddress: true,
} as const;

export const PRODUCT = {
    reference: "0432/021",
    name: "Blazer Cruzada Estructura",
    /**
     * **Talla M — obligatoria**. `843321900102` (talla L) no tiene ninguna
     * fila de `stock_items` en ninguna migración, así que el checkout
     * devolvería `409`. M no es una preferencia, es condición de que el
     * flujo funcione.
     */
    size: "M",
    barcode: "843321900101",
} as const;

/**
 * Valores exactos de la semilla de `V1__initial_schema.sql` para el SKU que
 * la suite compra. **No** son un «40» genérico: `V12` sólo siembra stock de
 * sus propios 4 barcodes (80 en ARTEIXO, 40 en ZARAGOZA) y el blazer viene de
 * `V1`, donde los valores son 150/5 y 80/0.
 *
 * Se restauran **ambos** almacenes porque el que se consume depende de la
 * selección por proximidad y la suite no debe acoplarlo.
 */
export const STOCK_SEED = [
    { barcode: PRODUCT.barcode, warehouseCode: "WH_ARTEIXO", available: 150, reserved: 5 },
    { barcode: PRODUCT.barcode, warehouseCode: "WH_ZARAGOZA", available: 80, reserved: 0 },
] as const;
