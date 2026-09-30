-- Añadir coordenadas geográficas a almacenes para selección óptima por distancia
ALTER TABLE warehouses ADD COLUMN latitude DOUBLE PRECISION;
ALTER TABLE warehouses ADD COLUMN longitude DOUBLE PRECISION;

-- Asignar coordenadas por defecto a TODOS los almacenes (Madrid como fallback)
UPDATE warehouses SET latitude = 40.4168, longitude = -3.7038 WHERE latitude IS NULL;

-- Actualizar almacenes conocidos con sus coordenadas reales
UPDATE warehouses SET latitude = 41.3874, longitude = 2.1686 WHERE code = 'WH-BCN-01';
UPDATE warehouses SET latitude = 39.4699, longitude = -0.3763 WHERE code = 'WH-VAL-01';
