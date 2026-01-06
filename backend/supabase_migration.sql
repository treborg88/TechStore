-- Ejecuta este script en el Editor SQL de tu panel de Supabase
-- para agregar las columnas necesarias para el seguimiento de envíos y notas internas.

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS internal_notes TEXT,
ADD COLUMN IF NOT EXISTS carrier TEXT,
ADD COLUMN IF NOT EXISTS tracking_number TEXT;

-- Opcional: Crear índices si planeas buscar por estos campos frecuentemente
-- CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON orders(tracking_number);

-- Tabla para ajustes globales de la aplicación
CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY,
    value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configuración inicial por defecto
INSERT INTO app_settings (id, value) VALUES 
('siteName', 'TechStore'),
('siteIcon', '🛍️'),
('heroTitle', 'La Mejor Tecnología a Tu Alcance'),
('heroDescription', 'Descubre nuestra selección de smartphones y accesorios con las mejores ofertas del mercado.'),
('heroPrimaryBtn', 'Ver Productos'),
('heroSecondaryBtn', 'Ofertas Especiales'),
('heroImage', ''),
('headerBgColor', '#2563eb'),
('headerTransparency', '100')
ON CONFLICT (id) DO NOTHING;

-- Tabla para códigos de verificación (Email)
CREATE TABLE IF NOT EXISTS verification_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    purpose TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
