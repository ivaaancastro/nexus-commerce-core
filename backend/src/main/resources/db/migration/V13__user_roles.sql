-- V13 — Tarea 7.1 (Fase 7 · Panel de administración): roles de usuario
--
-- El modelo no tenía NINGÚN concepto de rol: la API no podía responder
-- «¿quién tiene permiso para hacer esto?» (spec specs/admin-roles/, R1).
--
-- 1) Columna `role` con DEFAULT 'USER': todos los usuarios existentes quedan
--    clasificados como USER sin un UPDATE manual (el DEFAULT hace de backfill)
--    y NOT NULL impide el estado «sin rol». `IF NOT EXISTS` hace inocuo
--    reejecutar el fichero (CA de R1: dos ejecuciones seguidas no fallan).
--
-- 2) Semilla del primer admin (idempotente con ON CONFLICT, patrón de V11/V12):
--    sin él, /api/v1/admin/** no tendría un solo usuario capaz de llamarlo.
--    · Nace con email_verified = TRUE — el login exige la verificación.
--    · password_hash = BCrypt coste 12 (misma que exige SecurityConfig) de la
--      contraseña por defecto documentada en el README. Cambiarla en el
--      primer arranque.

ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'USER';

INSERT INTO users (email, password_hash, first_name, last_name, birth_date,
                   gender, email_verified, role)
VALUES (
    'admin@nexus.dev',
    '$2a$12$h3jcGaSiAWFCsNvE6qAyHeOMnTCFOPpdkkw7O0ypSqx4n1Wkhbpjq',
    'Admin',
    'Nexus',
    DATE '1990-01-01',
    'OTHER',
    TRUE,
    'ADMIN'
)
ON CONFLICT (email) DO NOTHING;
