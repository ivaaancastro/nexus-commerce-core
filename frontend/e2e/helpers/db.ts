// Tarea 4.2 — acceso mínimo a PostgreSQL desde el `globalSetup`.
//
// Dos operaciones y ninguna más: leer el código de verificación (que sólo
// existe en la BD porque no hay SMTP) y restaurar el stock que cada compra
// consume. **Ningún dato de negocio se escribe directamente**: pedidos,
// líneas y reservas los crea siempre el backend.
//
// La conexión sigue las variables estándar `PG*` con los valores por defecto
// de `application.properties`; en CI se sobrescriben igual que se hace con
// `SPRING_DATASOURCE_*` en el job de backend.

import { Client } from "pg";

export const DB_CONFIG = {
    host: process.env.PGHOST ?? "localhost",
    port: Number(process.env.PGPORT ?? "5432"),
    database: process.env.PGDATABASE ?? "commerce_db",
    user: process.env.PGUSER ?? "dev_user",
    password: process.env.PGPASSWORD ?? "dev_password",
};

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const client = new Client(DB_CONFIG);
    await client.connect();
    try {
        const result = await client.query(sql, params);
        return result.rows as T[];
    } finally {
        // Siempre, aunque falle: una conexión colgada en el setup deja el
        // pool de Postgres lleno para la siguiente corrida.
        await client.end();
    }
}

/** Igual que `query`, pero comprueba que se ha afectado a `expected` filas. */
export async function exec(sql: string, params: unknown[], expected: number): Promise<void> {
    const client = new Client(DB_CONFIG);
    await client.connect();
    try {
        const result = await client.query(sql, params);
        if (result.rowCount !== expected) {
            throw new Error(
                `Se esperaban ${expected} filas afectadas y fueron ${result.rowCount}. ` +
                    `¿Han cambiado las migraciones de stock (V1/V12)?`
            );
        }
    } finally {
        await client.end();
    }
}
