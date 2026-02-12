-- =============================================================================
-- TechStore — Seed Data
-- =============================================================================
-- Run AFTER schema.sql to populate initial data for a fresh installation.
-- Creates: admin user, default site settings, sample categories.
-- Safe to re-run: uses ON CONFLICT DO NOTHING.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. ADMIN USER
-- ---------------------------------------------------------------------------
-- Password: Admin123! (bcrypt 10 rounds — change immediately after first login)
-- Generate a new hash: node -e "require('bcrypt').hash('YourPass123!',10).then(console.log)"
INSERT INTO users (name, email, password, role)
VALUES (
    'Admin',
    'admin@techstore.com',
    '$2b$10$8KzQzx5Gg6q5PKmWzUqOYuJXJZV6R0j6x6YpJp0bXN0nM5GDXK5Hy',
    'admin'
)
ON CONFLICT (email) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 2. DEFAULT APP SETTINGS
-- ---------------------------------------------------------------------------
-- Branding
INSERT INTO app_settings (id, value) VALUES
    ('siteName',        'TechStore'),
    ('siteIcon',        '🛍️'),
    ('siteLogo',        ''),
    ('siteLogoSize',    '40'),
    ('siteNameImage',   ''),
    ('siteNameImageSize', '120'),
    ('siteDomain',      ''),
    -- Currency
    ('currencyCode',    'USD'),
    ('defaultCurrency', '$'),
    -- Hero section
    ('heroTitle',       'La Mejor Tecnología a Tu Alcance'),
    ('heroDescription', 'Descubre nuestra selección de smartphones y accesorios con las mejores ofertas del mercado.'),
    ('heroPrimaryBtn',  'Ver Productos'),
    ('heroSecondaryBtn','Ofertas Especiales'),
    ('heroImage',       ''),
    ('heroTitleSize',   '36'),
    ('heroDescriptionSize', '18'),
    ('heroPositionX',   '50'),
    ('heroPositionY',   '50'),
    ('heroImageWidth',  '100'),
    ('heroOverlayOpacity', '40'),
    ('heroHeight',      '500'),
    ('heroTextColor',   '#ffffff'),
    ('heroBannerImage', ''),
    ('heroBannerSize',  '200'),
    ('heroBannerPositionX', '50'),
    ('heroBannerPositionY', '50'),
    ('heroBannerOpacity', '100'),
    -- Header
    ('headerBgColor',       '#2563eb'),
    ('headerTransparency',  '100'),
    ('headerTextColor',     '#ffffff'),
    ('headerButtonColor',   '#ffffff'),
    ('headerButtonTextColor','#2563eb'),
    -- Theme colors
    ('primaryColor',    '#2563eb'),
    ('secondaryColor',  '#7c3aed'),
    ('accentColor',     '#f59e0b'),
    ('backgroundColor', '#f8fafc'),
    ('textColor',       '#030303ff'),
    -- Product detail hero
    ('productDetailHeroImage',          ''),
    ('productDetailUseHomeHero',        'false'),
    ('productDetailHeroHeight',         '300'),
    ('productDetailHeroOverlayOpacity', '40'),
    ('productDetailHeroBannerImage',    ''),
    ('productDetailHeroBannerSize',     '200'),
    ('productDetailHeroBannerPositionX','50'),
    ('productDetailHeroBannerPositionY','50'),
    ('productDetailHeroBannerOpacity',  '100'),
    -- Category filters (JSON string)
    ('categoryFiltersConfig', '{"useDefault":true,"categories":[]}'),
    -- Product card config (JSON string)
    ('productCardConfig', '{}'),
    -- Contact info
    ('contactTitle',       'Contáctanos'),
    ('contactSubtitle',    '¿Tienes preguntas? Estamos aquí para ayudarte'),
    ('contactCompany',     'TechStore'),
    ('contactEmail',       ''),
    ('contactPhone',       ''),
    ('contactWhatsapp',    ''),
    ('contactAddress',     ''),
    ('contactHours',       'Lunes a Viernes: 9:00 AM - 6:00 PM'),
    ('contactSupportLine', ''),
    ('contactMapUrl',      ''),
    -- Store info
    ('storePhone',   ''),
    ('storeAddress', ''),
    -- Payment methods (JSON string — empty = none configured)
    ('paymentMethodsConfig', '{}'),
    ('stripePublishableKey', ''),
    ('stripeSecretKey',      ''),
    ('paypalClientId',       ''),
    ('paypalClientSecret',   ''),
    -- Chatbot  
    ('chatbotEnabled',       'false'),
    ('chatbotGreeting',      '¡Hola! 👋 Soy el asistente de TechStore. ¿En qué puedo ayudarte?'),
    ('chatbotMaxMessages',   '50'),
    ('chatbotPlaceholder',   'Escribe tu mensaje...'),
    ('chatbotColor',         '#2563eb'),
    ('chatbotLlmProvider',   ''),
    ('chatbotLlmApiKey',     ''),
    ('chatbotLlmModel',      ''),
    ('chatbotLlmCustomUrl',  ''),
    ('chatbotMaxTokens',     '500'),
    ('chatbotTemperature',   '0.7'),
    ('chatbotPersonality',   'helpful'),
    ('chatbotVerbosity',     'normal'),
    ('chatbotSystemPrompt',  '')
ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 3. SAMPLE PRODUCTS (optional — remove if not needed)
-- ---------------------------------------------------------------------------
-- Uncomment to add sample products for testing:
/*
INSERT INTO products (name, description, price, category, stock) VALUES
    ('Smartphone Galaxy X', 'Pantalla AMOLED 6.5", 128GB, 8GB RAM', 599.99, 'Smartphones', 25),
    ('Auriculares Pro BT', 'Bluetooth 5.3, cancelación de ruido activa', 89.99, 'Auriculares', 50),
    ('Bombilla LED Smart', 'WiFi, 16M colores, compatible con Alexa', 19.99, 'Luces LED', 100),
    ('Hub Casa Inteligente', 'Zigbee + WiFi, compatible con todos los ecosistemas', 49.99, 'Casa Inteligente', 30),
    ('Cable USB-C 2m', 'Carga rápida 100W, trenzado de nylon', 12.99, 'Accesorios', 200)
ON CONFLICT DO NOTHING;
*/
