-- Ficha de pedido: snapshot de dirección de envío y método de pago (Tarea 5.5)
--
-- Las 6 columnas son NULLABLE y NO se rellenan: las órdenes anteriores a esta
-- migración quedan con NULL y el frontend no pinta esas secciones (spec R7).
--
-- La dirección es un SNAPSHOT INMUTABLE — se copia al hacer checkout. Si el
-- usuario edita su Address después, el pedido sigue mostrando la que se usó.
ALTER TABLE orders ADD COLUMN shipping_full_name    VARCHAR(100);
ALTER TABLE orders ADD COLUMN shipping_street       VARCHAR(255);
ALTER TABLE orders ADD COLUMN shipping_city         VARCHAR(100);
ALTER TABLE orders ADD COLUMN shipping_postal_code  VARCHAR(20);
ALTER TABLE orders ADD COLUMN shipping_country_code VARCHAR(5);

-- Preferencia declarada por el usuario. NO procesa pagos: no se pide número de
-- tarjeta ni se tokeniza — no existe pasarela de pago en el proyecto.
ALTER TABLE orders ADD COLUMN payment_method VARCHAR(16);
