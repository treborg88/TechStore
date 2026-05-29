-- =============================================================================
-- Eonsclover — Demo Seed Data
-- =============================================================================
-- Run AFTER seed.sql to populate a polished first-impression store.
-- Creates: 10 sample tech products with gallery images, promo text, and
-- refined hero / category settings so the store looks ready on day one.
-- NOTE: This file always runs in the tenant schema context (search_path already set).
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. HERO & PROMO SETTINGS  (override seed.sql defaults with demo-quality copy)
-- ---------------------------------------------------------------------------
UPDATE app_settings SET value = 'La Mejor Tecnología a Tu Alcance'
WHERE id = 'heroTitle';

UPDATE app_settings SET value = 'Descubre nuestra selección de smartphones, auriculares y accesorios con las mejores ofertas del mercado.'
WHERE id = 'heroDescription';

UPDATE app_settings SET value = 'Comprar ahora'
WHERE id = 'heroPrimaryBtn';

UPDATE app_settings SET value = 'Ver Ofertas'
WHERE id = 'heroSecondaryBtn';

-- Hero background image (full-width behind text)
UPDATE app_settings SET value = '/storage/products/seedhero.jpg'
WHERE id = 'heroImage';

-- Dark overlay on the bg image so white text stays readable (0.0–1.0)
UPDATE app_settings SET value = '0.50'
WHERE id = 'heroOverlayOpacity';

-- Taller hero to give the banner overlay more room
UPDATE app_settings SET value = '420'
WHERE id = 'heroHeight';

-- Banner overlay image (Imagen Superpuesta del Banner — product floating right)
UPDATE app_settings SET value = '/storage/products/seedoverhero.jpg'
WHERE id = 'heroBannerImage';

UPDATE app_settings SET value = '280'
WHERE id = 'heroBannerSize';

UPDATE app_settings SET value = 'right'
WHERE id = 'heroBannerPositionX';

UPDATE app_settings SET value = 'center'
WHERE id = 'heroBannerPositionY';

UPDATE app_settings SET value = '100'
WHERE id = 'heroBannerOpacity';

-- Promo section image (Imagen de Promoción)
INSERT INTO app_settings (id, value) VALUES
    ('promoText',  '🔥 ¡Oferta del Mes! Obtén un 20% de descuento en todos nuestros accesorios al comprar cualquier smartphone.'),
    ('promoImage', '/storage/products/seed-airpods-1.jpg')
ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value;


-- ---------------------------------------------------------------------------
-- 2. SAMPLE PRODUCTS — tech store with rich descriptions & gallery images
-- ---------------------------------------------------------------------------

-- ── Smartphones ─────────────────────────────────────────────────────────────

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'iPhone 15 Pro Max 256GB',
        '<p>El smartphone más avanzado de Apple. Fabricado en <strong>titanio de grado aeroespacial</strong>, el iPhone 15 Pro Max redefine lo que es posible en la palma de tu mano.</p>
<ul>
  <li><strong>Chip A17 Pro</strong>: el procesador móvil más potente del mercado con acelerador de IA neuronal</li>
  <li><strong>Cámara Pro de 48 MP</strong>: lente tetraprismática con zoom óptico 5× y vídeo ProRes 4K 120fps</li>
  <li><strong>Pantalla Super Retina XDR</strong>: 6.7" con ProMotion 120 Hz, brillo máximo de 2000 nits</li>
  <li><strong>USB-C USB 3</strong>: transferencias hasta 20 Gb/s y compatibilidad con monitores externos</li>
  <li><strong>Action Button</strong>: botón personalizable para acceso rápido a tus funciones favoritas</li>
  <li><strong>Batería</strong>: hasta 29 horas de reproducción continua de vídeo</li>
</ul>
<p>Disponible en Titanio Negro, Titanio Blanco, Titanio Azul y Titanio Natural. Incluye cargador USB-C y cable USB-C.</p>',
        1199.00,
        'Smartphones',
        15,
        '/storage/products/seed-iphone-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-iphone-1.jpg'),
    ('/storage/products/seed-iphone-2.jpg'),
    ('/storage/products/seed-iphone-3.jpg')
) AS imgs(img);

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Samsung Galaxy S24 Ultra',
        '<p>La máxima expresión de Android con <strong>inteligencia artificial Galaxy AI</strong> integrada en cada función. Diseñado para quienes no aceptan compromisos.</p>
<ul>
  <li><strong>Snapdragon 8 Gen 3</strong>: rendimiento de élite con IA nativa para productividad y creatividad</li>
  <li><strong>S Pen integrado</strong>: escribe, esboza y controla con precisión milimétrica</li>
  <li><strong>Cámara cuádruple 200 MP</strong>: zoom espacial 100× y vídeo 8K para capturas cinematográficas</li>
  <li><strong>Pantalla Dynamic AMOLED 2X</strong>: 6.8" con 120 Hz adaptativo y brillo de 2600 nits</li>
  <li><strong>Galaxy AI</strong>: traducción en vivo, resumen de notas, Circle to Search y edición generativa</li>
  <li><strong>Batería 5000 mAh</strong>: carga rápida de 45 W y carga inalámbrica de 15 W</li>
</ul>
<p>Incluye S Pen integrado. Disponible en Titanium Black, Titanium Gray, Titanium Violet y Titanium Yellow.</p>',
        999.00,
        'Smartphones',
        20,
        '/storage/products/seed-samsung-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-samsung-1.jpg'),
    ('/storage/products/seed-samsung-2.jpg'),
    ('/storage/products/seed-samsung-3.jpg')
) AS imgs(img);

-- ── Auriculares ──────────────────────────────────────────────────────────────

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Sony WH-1000XM5',
        '<p>Reconocidos mundialmente como los <strong>mejores auriculares inalámbricos con cancelación de ruido</strong>, los WH-1000XM5 elevan la experiencia auditiva a un nivel sin precedentes.</p>
<ul>
  <li><strong>Cancelación de ruido líder</strong>: 8 micrófonos y 2 procesadores (QN1e + HD Noise Cancelling) eliminan el ruido de fondo con precisión</li>
  <li><strong>Audio Hi-Res Wireless</strong>: compatible con LDAC para streaming a 990 kbps — casi sin pérdidas</li>
  <li><strong>30 horas de batería</strong>: con cancelación activa; solo 3 minutos de carga = 3 horas de reproducción</li>
  <li><strong>Multiconexión Bluetooth</strong>: conecta y cambia entre 2 dispositivos simultáneamente</li>
  <li><strong>Speak-to-Chat</strong>: pausa automática la música en cuanto comienzas a hablar</li>
  <li><strong>Nuevo diseño rediseñado</strong>: más ligero, almohadillas más suaves, arco más flexible para uso prolongado</li>
</ul>
<p>Incluye funda de transporte, cable USB-C y cable de audio de 3.5 mm. Disponible en Negro y Plata.</p>',
        349.99,
        'Auriculares',
        30,
        '/storage/products/seed-sony-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-sony-1.jpg'),
    ('/storage/products/seed-sony-2.jpg'),
    ('/storage/products/seed-sony-3.jpg')
) AS imgs(img);

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'AirPods Pro (2da Generación)',
        '<p>Los <strong>AirPods Pro de segunda generación</strong> ofrecen cancelación activa de ruido mejorada, audio espacial personalizado y hasta 30 horas de batería total.</p>
<ul>
  <li><strong>Chip H2</strong>: cancelación de ruido activa 2× más potente que la primera generación</li>
  <li><strong>Audio Espacial Personalizado</strong>: se adapta a la anatomía única de tus orejas para un sonido inmersivo</li>
  <li><strong>Modo Transparencia Adaptativo</strong>: escucha el ambiente que te rodea con naturalidad</li>
  <li><strong>Batería</strong>: hasta 6 horas por carga y 30 horas totales con la funda MagSafe</li>
  <li><strong>Funda MagSafe</strong>: carga inalámbrica, compatible con Apple Watch y Qi; altavoz integrado para localización</li>
  <li><strong>Resistencia al agua</strong>: IPX4 en auriculares y funda para protección frente a salpicaduras</li>
</ul>
<p>Incluye funda de carga MagSafe con USB-C y tres tallas de almohadillas (XS/S/M/L). Compatible con iPhone, iPad, Mac y Apple Watch.</p>',
        249.99,
        'Auriculares',
        25,
        '/storage/products/seed-airpods-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-airpods-1.jpg'),
    ('/storage/products/seed-airpods-2.jpg'),
    ('/storage/products/seed-airpods-3.jpg')
) AS imgs(img);

-- ── Luces LED ────────────────────────────────────────────────────────────────

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Tira LED RGB 5 Metros',
        '<p>Transforma cualquier espacio con <strong>16 millones de colores</strong> y efectos de iluminación dinámicos. Compatible con voz y aplicación móvil para un control total.</p>
<ul>
  <li><strong>5 metros de LEDs de alta densidad</strong>: 60 LEDs/metro para una iluminación uniforme y brillante</li>
  <li><strong>16 millones de colores RGB</strong>: personaliza cada tono y elige entre más de 20 modos de efecto</li>
  <li><strong>App Smart Life / Tuya</strong>: controla desde tu smartphone con programación horaria y escenas</li>
  <li><strong>Compatibilidad con voz</strong>: funciona con Amazon Alexa, Google Assistant y Siri Shortcuts</li>
  <li><strong>Adhesivo 3M resistente</strong>: se adhiere en superficies planas y se corta cada 3 LEDs a medida</li>
  <li><strong>Bajo consumo</strong>: solo 24 W para los 5 metros completos</li>
</ul>
<p>Ideal para dormitorios, escritorios, TV backlight y decoración de fiestas. Incluye controlador WiFi y fuente de alimentación.</p>',
        19.99,
        'Luces LED',
        100,
        '/storage/products/seed-led-strip-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-led-strip-1.jpg'),
    ('/storage/products/seed-led-strip-2.jpg'),
    ('/storage/products/seed-led-strip-3.jpg')
) AS imgs(img);

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Foco LED Inteligente WiFi 10W',
        '<p>Iluminación inteligente <strong>E27 de 10 W</strong> con control por voz y aplicación. Ahorra hasta un 80% de energía frente a focos incandescentes tradicionales.</p>
<ul>
  <li><strong>Ajuste de temperatura</strong>: de 2700 K (cálido) a 6500 K (frío) para cada momento del día</li>
  <li><strong>Brillo regulable</strong>: 0–100% para crear el ambiente perfecto</li>
  <li><strong>Control por voz</strong>: compatible con Alexa, Google Assistant y Apple HomeKit</li>
  <li><strong>App Smart Life</strong>: programación horaria, escenas de luz y control remoto desde cualquier lugar</li>
  <li><strong>Equivalente a 75 W</strong>: 806 lúmenes con solo 10 W de consumo real</li>
  <li><strong>Vida útil de 25 000 horas</strong>: más de 22 años a 3 horas/día</li>
</ul>
<p>Base E27 estándar. Compatible con la mayoría de lámparas domésticas. No requiere hub — conexión WiFi directa 2.4 GHz.</p>',
        15.99,
        'Luces LED',
        80,
        '/storage/products/seed-bulb-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-bulb-1.jpg'),
    ('/storage/products/seed-led-strip-3.jpg')
) AS imgs(img);

-- ── Casa Inteligente ─────────────────────────────────────────────────────────

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Amazon Echo Dot (5ta Generación)',
        '<p>El altavoz inteligente más popular del mundo en su versión más avanzada. Con <strong>Alexa integrada</strong>, controla tu hogar, reproduce música y responde cualquier pregunta.</p>
<ul>
  <li><strong>Sonido mejorado</strong>: altavoz de 1.73" rediseñado para bajos más profundos y sonido más nítido</li>
  <li><strong>Sensor de temperatura ambiental</strong>: monitoriza la temperatura de la habitación desde la app Alexa</li>
  <li><strong>Modo Tapón Earplugs</strong>: detecta sonidos como alarmas de humo y te notifica en el móvil</li>
  <li><strong>Centro de control del hogar inteligente</strong>: Zigbee, Matter y Thread integrados — sin hub adicional</li>
  <li><strong>Privacidad garantizada</strong>: botón físico para desactivar el micrófono cuando lo desees</li>
  <li><strong>Conecta con todo</strong>: más de 100 000 dispositivos compatibles de cientos de marcas</li>
</ul>
<p>Disponible en Gris Carbón, Azul Glaciar y Blanco Nube. Incluye adaptador de corriente.</p>',
        49.99,
        'Casa Inteligente',
        40,
        '/storage/products/seed-echo-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-echo-1.jpg'),
    ('/storage/products/seed-echo-2.jpg'),
    ('/storage/products/seed-echo-3.jpg')
) AS imgs(img);

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Enchufe Inteligente WiFi 16A',
        '<p>Convierte cualquier electrodoméstico en <strong>inteligente en segundos</strong>. Monitoriza el consumo eléctrico en tiempo real y programa el encendido y apagado desde cualquier lugar.</p>
<ul>
  <li><strong>Control remoto</strong>: enciende y apaga cualquier dispositivo desde tu smartphone, estés donde estés</li>
  <li><strong>Monitor de consumo</strong>: mide vatios, amperios y kWh en tiempo real para optimizar tu factura</li>
  <li><strong>16 A / 3680 W</strong>: apto para electrodomésticos de alta potencia (lavadora, aire acondicionado)</li>
  <li><strong>Programación horaria</strong>: temporizadores diarios y semanales con múltiples horarios</li>
  <li><strong>Compatible con voz</strong>: funciona con Alexa, Google Assistant y Apple HomeKit</li>
  <li><strong>Diseño compacto</strong>: no bloquea el enchufe adyacente; LED de estado visible</li>
</ul>
<p>Compatible con enchufes estándar europeos (tipo F/Schuko). Conexión WiFi 2.4 GHz. No requiere hub.</p>',
        15.99,
        'Casa Inteligente',
        60,
        '/storage/products/seed-plug-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-plug-1.jpg'),
    ('/storage/products/seed-led-strip-1.jpg')
) AS imgs(img);

-- ── Accesorios ───────────────────────────────────────────────────────────────

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Razer DeathAdder V3',
        '<p>El ratón gaming <strong>más vendido de la historia</strong>, ahora en su versión más ligera y precisa. Diseñado para competir al máximo nivel con un perfil ergonómico insuperable.</p>
<ul>
  <li><strong>Sensor Focus Pro 30K</strong>: hasta 30 000 DPI con seguimiento óptico de precisión absoluta en cualquier superficie</li>
  <li><strong>Switches ópticos Razer Gen-3</strong>: 90 millones de clics de vida útil con activación instantánea sin rebote</li>
  <li><strong>Diseño ergonómico optimizado</strong>: 59 g ultraligero con forma estudiada para grip palmar y clawgrip</li>
  <li><strong>HyperPolling 8000 Hz</strong>: 8 veces más respuesta que los ratones estándar de 1000 Hz</li>
  <li><strong>Cable SpeedFlex</strong>: ultraflexible, simula la sensación de un ratón inalámbrico</li>
  <li><strong>Razer Synapse 3</strong>: personalización avanzada de botones, sensibilidad y macros</li>
</ul>
<p>Con cable USB-A. Compatible con Windows, macOS y Linux. Dimensiones: 128.1 × 68.0 × 44.0 mm. Peso: 59 g.</p>',
        89.99,
        'Accesorios',
        25,
        '/storage/products/seed-mouse-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-mouse-1.jpg'),
    ('/storage/products/seed-mouse-2.jpg'),
    ('/storage/products/seed-mouse-3.jpg')
) AS imgs(img);

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Cable USB-C 100W 2 Metros',
        '<p>Cable USB-C de alta velocidad con soporte para <strong>carga rápida 100 W</strong> y transferencia de datos USB 3.2 Gen 2. Construido para durar con trenzado de nylon reforzado.</p>
<ul>
  <li><strong>Carga rápida 100 W</strong>: carga tu laptop, tablet y smartphone a máxima velocidad con cualquier cargador USB-C PD</li>
  <li><strong>USB 3.2 Gen 2</strong>: transferencia de datos a 10 Gbps — 10× más rápido que USB 2.0</li>
  <li><strong>Compatibilidad universal</strong>: MacBook, iPad Pro, Galaxy S24, iPhone 15, Nintendo Switch y cualquier dispositivo USB-C</li>
  <li><strong>Nylon trenzado reforzado</strong>: resistencia a más de 25 000 dobleces sin dañar el cable</li>
  <li><strong>Cabezales de aluminio</strong>: conectores robustos con diseño reversible para no equivocarte al conectar</li>
  <li><strong>2 metros de longitud</strong>: perfecta para escritorio, cama o escritorio en cualquier posición</li>
</ul>
<p>Incluye 1 cable USB-C a USB-C de 2 m. Certificado USB-IF. Compatible con Thunderbolt 3/4 para vídeo 4K (requiere cable Thunderbolt nativo para velocidades máximas).</p>',
        12.99,
        'Accesorios',
        150,
        '/storage/products/seed-cable-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-cable-1.jpg'),
    ('/storage/products/seed-hero-bg.jpg')
) AS imgs(img);
