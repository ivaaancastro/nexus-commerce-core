-- Corregir tipo de columnas de medidas a double precision
ALTER TABLE users ALTER COLUMN height TYPE DOUBLE PRECISION;
ALTER TABLE users ALTER COLUMN weight TYPE DOUBLE PRECISION;
