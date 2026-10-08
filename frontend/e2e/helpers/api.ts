// Tarea 4.2 — cliente HTTP mínimo contra el backend para el `globalSetup`.
//
// Se usa `fetch` crudo (disponible en Node 18+) en vez de `page.request`:
// el setup necesita hablar con Spring **antes** de que exista un navegador y
// posiblemente antes de que exista el servidor de Next.

import { BACKEND_URL } from "./config";

export class ApiError extends Error {
    constructor(
        readonly status: number,
        readonly path: string,
        readonly body: string
    ) {
        super(`API ${status} en ${path}: ${body.slice(0, 400)}`);
        this.name = "ApiError";
    }
}

interface CallOptions {
    method?: "GET" | "POST" | "DELETE";
    json?: unknown;
    token?: string;
}

export async function call(path: string, options: CallOptions = {}): Promise<Response> {
    const { method = "GET", json, token } = options;
    const headers: Record<string, string> = {};
    if (json !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers["Authorization"] = `Bearer ${token}`;

    return fetch(`${BACKEND_URL}${path}`, {
        method,
        headers,
        body: json === undefined ? undefined : JSON.stringify(json),
    });
}

/**
 * Igual que `call`, pero **lanza** si la respuesta no es 2xx, con el cuerpo
 * de la respuesta dentro del mensaje — si no, un `400` de validación de
 * Spring llegaría como un fallo mudo en mitad del setup.
 */
export async function callOk<T>(path: string, options: CallOptions = {}): Promise<T> {
    const res = await call(path, options);
    const body = await res.text();
    if (!res.ok) throw new ApiError(res.status, path, body);
    return (body ? (JSON.parse(body) as T) : (undefined as T)) as T;
}
