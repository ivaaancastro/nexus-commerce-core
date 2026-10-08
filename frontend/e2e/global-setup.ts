// Tarea 4.2 (R2) — deja el entorno listo **antes** de la primera prueba.
//
// Es la pieza que sostiene todo lo demás: si no consigue dejar Postgres, el
// backend y la semilla en condiciones, nada de lo demás funciona. Por eso
// cada paso tiene su propio techo de tiempo y un mensaje que dice **qué
// falta**, en lugar de dejar un timeout críptico.
//
// El orden con respecto a `webServer` no está garantizado por Playwright, así
// que este setup **sólo habla con el backend (8080)**: no depende de que
// Next esté levantado para ninguna de las cuatro fases.

import { call, callOk } from "./helpers/api";
import { E2E_ADDRESS, E2E_USER, READY_TIMEOUT_MS, STOCK_SEED } from "./helpers/config";
import { exec, query } from "./helpers/db";

const log = (message: string) => console.log(`[e2e setup] ${message}`);

interface LoginResult {
    ok: boolean;
    status: number;
    body: string;
    token?: string;
}

async function attemptLogin(): Promise<LoginResult> {
    const res = await call("/api/v1/auth/login", {
        method: "POST",
        json: { email: E2E_USER.email, password: E2E_USER.password },
    });
    const body = await res.text();
    if (!res.ok) return { ok: false, status: res.status, body };

    const parsed = JSON.parse(body) as { token: string };
    return { ok: true, status: res.status, body, token: parsed.token };
}

/** Fase 1 — el backend responde y Flyway ha terminado de migrar. */
async function waitForBackend(): Promise<void> {
    const deadline = Date.now() + READY_TIMEOUT_MS;
    let lastError = "sin intento";

    while (Date.now() < deadline) {
        try {
            const res = await call("/api/v1/markets");
            if (res.ok) {
                log("backend listo en /api/v1/markets");
                return;
            }
            lastError = `HTTP ${res.status}`;
        } catch (err) {
            lastError = err instanceof Error ? err.message : String(err);
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error(
        `El backend no responde en 120 s (${lastError}).\n` +
            `  → Arranca PostgreSQL:  docker compose up -d\n` +
            `  → Arranca el backend:  cd backend && ./mvnw spring-boot:run\n` +
            `  → ¿Otro puerto?        E2E_API_URL=http://localhost:XXXX`
    );
}

/**
 * Fase 2 — usuario verificado, sin SMTP.
 *
 * El código de verificación sólo existe en la columna `verification_code` de
 * `users`: no hay servidor de correo en el entorno. Registrarlo por la API
 * real y leer ese código por SQL evita crear una migración de semilla (que
 * metería una contraseña conocida en el esquema) y además ejercita el
 * contrato de registro de verdad.
 *
 * Rama idempotente: si el login ya funciona, no se hace nada más.
 */
async function ensureUser(): Promise<string> {
    const existing = await attemptLogin();
    if (existing.ok) {
        log("usuario de prueba ya existía y está verificado");
        return existing.token as string;
    }

    log(`login previo falló (${existing.status}) — dando de alta al usuario`);
    const register = await call("/api/v1/auth/register", {
        method: "POST",
        json: {
            email: E2E_USER.email,
            password: E2E_USER.password,
            firstName: E2E_USER.firstName,
            lastName: E2E_USER.lastName,
            birthDate: E2E_USER.birthDate,
            gender: E2E_USER.gender,
        },
    });
    if (!register.ok) {
        // 409/400 es el caso normal de la segunda corrida: ya existía.
        const body = await register.text();
        log(`register devolvió ${register.status}: ${body.slice(0, 160)}`);
    }

    const rows = await query<{ verification_code: string | null; email_verified: boolean }>(
        "SELECT verification_code, email_verified FROM users WHERE lower(email) = lower($1)",
        [E2E_USER.email]
    );

    if (rows.length === 0) {
        throw new Error(
            `No se pudo crear el usuario ${E2E_USER.email}. ` +
                `Revisa el log del backend: el registro ha sido rechazado.`
        );
    }
    if (rows[0].email_verified) {
        // Existe y está verificado pero el login de arriba ha fallado: la
        // única causa posible es una contraseña distinta en la BD.
        throw new Error(
            `El usuario ${E2E_USER.email} existe y está verificado, pero el login ` +
                `ha devuelto ${existing.status}. ¿Se ha cambiado la contraseña de la ` +
                `semilla? Borra la fila para que el setup la vuelva a crear.`
        );
    }

    const code = rows[0].verification_code;
    if (!code) {
        throw new Error(
            `El usuario ${E2E_USER.email} existe sin código de verificación ` +
                `(verification_code NULL): el registro quedó a medias.`
        );
    }

    // `@PostMapping("/verify-email")` con `@RequestParam`: van por query
    // params, pero el método **tiene que ser POST** — con GET devuelve 405.
    await callOk(
        `/api/v1/auth/verify-email?email=${encodeURIComponent(E2E_USER.email)}` +
            `&code=${encodeURIComponent(code)}`,
        { method: "POST" }
    );
    log("usuario verificado con el código leído de la BD");

    const final = await attemptLogin();
    if (!final.ok) {
        throw new Error(
            `El usuario sigue sin poder iniciar sesión tras verificar ` +
                `(HTTP ${final.status}): ${final.body.slice(0, 300)}`
        );
    }
    return final.token as string;
}

/**
 * Fase 3 — dirección por defecto. El checkout exige `addressId` y el carrito
 * **precoselecciona** la marcada `defaultAddress`, así que ninguna prueba
 * tiene que tocar ese `select`.
 */
async function ensureAddress(token: string): Promise<void> {
    const addresses = await callOk<unknown[]>("/api/v1/users/me/addresses", { token });
    if (Array.isArray(addresses) && addresses.length > 0) {
        log(`dirección ya existente (${addresses.length})`);
        return;
    }
    await callOk("/api/v1/users/me/addresses", {
        method: "POST",
        json: E2E_ADDRESS,
        token,
    });
    log("dirección por defecto creada");
}

/**
 * Fase 4 — restaurar el stock **exacto** de la semilla. Se ejecuta siempre:
 * cada compra consume una unidad y, sin esto, la suite fallaría cuando el
 * almacén se agote.
 */
async function resetStock(): Promise<void> {
    const seedValues = STOCK_SEED.map(
        (row) =>
            `('${row.barcode}', '${row.warehouseCode}', ${row.available}, ${row.reserved})`
    ).join(",\n             ");

    await exec(
        `UPDATE stock_items st
         SET quantity_available = v.available,
             quantity_reserved   = v.reserved
         FROM skus s,
              warehouses w,
              (VALUES ${seedValues}) AS v(barcode, warehouse_code, available, reserved)
         WHERE st.sku_id = s.id
           AND s.barcode = v.barcode
           AND st.warehouse_id = w.id
           AND w.code = v.warehouse_code`,
        [],
        STOCK_SEED.length
    );
    log(`stock restaurado a la semilla (${STOCK_SEED.length} filas)`);
}

export default async function globalSetup(): Promise<void> {
    log("empezando la preparación del entorno");
    await waitForBackend();
    const token = await ensureUser();
    await ensureAddress(token);
    await resetStock();
    log("entorno listo");
}
