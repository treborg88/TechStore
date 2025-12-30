-- Ejecuta este script en el Editor SQL de tu panel de Supabase
-- para agregar las columnas necesarias para el seguimiento de envíos y notas internas.

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS internal_notes TEXT,
ADD COLUMN IF NOT EXISTS carrier TEXT,
ADD COLUMN IF NOT EXISTS tracking_number TEXT;

-- Opcional: Crear índices si planeas buscar por estos campos frecuentemente
-- CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON orders(tracking_number);
