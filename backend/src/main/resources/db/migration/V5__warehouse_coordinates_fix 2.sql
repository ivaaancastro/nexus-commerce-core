-- Fix: asignar coordenadas por defecto a almacenes sin latitud
UPDATE warehouses SET latitude = 40.4168, longitude = -3.7038 WHERE latitude IS NULL;
