-- V17 — V1 order-status-emails: outbox de emails transaccionales
-- (spec specs/order-status-emails/, R4/R5/R8 · plan D2/D3/D9)
--
-- Por qué una tabla y no un envío directo en el momento:
--
-- 1) ATÓMICO CON EL NEGOCIO: la fila se inserta en LA MISMA transacción que
--    el cambio de estado (o el checkout). Si la transacción hace rollback
--    (p. ej. la guarda de stock al enviar) NO queda ningún email: el correo
--    cuenta lo que pasó de verdad (R5). Si committea, la intención queda
--    garantizada aunque el proceso se caiga después.
-- 2) LA RESPUESTA HTTP NUNCA ESPERA A SMTP (R4): un poller (@Scheduled)
--    envía después, fuera de la transacción.
-- 3) REINTENTOS CON BACKOFF (R8): `attempts` + `next_attempt_at`. Un fallo
--    reprograma (30 s, duplicando, tope ~1 h); a los 8 intentos la fila
--    queda FAILED con el motivo en `last_error` — nunca un bucle infinito.
--
-- `body_html`/`body_text` guardan el cuerpo YA RENDERIZADO (snapshot): el
-- email se lee como era en el momento del hecho, no como está la plantilla
-- hoy. `IF NOT EXISTS` reejecutable (patrón V13-V16).

CREATE TABLE IF NOT EXISTS email_outbox (
    id              BIGSERIAL PRIMARY KEY,
    recipient       VARCHAR(320) NOT NULL,
    subject         VARCHAR(200) NOT NULL,
    body_html       TEXT NOT NULL,
    body_text       TEXT NOT NULL,
    status          VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    attempts        INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_error      TEXT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at         TIMESTAMPTZ NULL,
    CONSTRAINT chk_email_outbox_status
        CHECK (status IN ('PENDING', 'SENDING', 'SENT', 'FAILED'))
);

-- El poller escanea «PENDING cuyo turno llegó»: índice en esa combinación.
CREATE INDEX IF NOT EXISTS idx_email_outbox_status_next
    ON email_outbox (status, next_attempt_at);
