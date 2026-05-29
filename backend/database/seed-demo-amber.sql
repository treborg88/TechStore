-- =============================================================================
-- Eonsclover — Demo Seed Data: Ámbar (Café & Artesanía)
-- =============================================================================
-- Run AFTER seed.sql to populate a polished artisan café & food store.
-- Creates: 10 coffee/bakery/artisan products with gallery images, promo text,
-- and refined hero / category settings for a warm, cozy brand.
-- NOTE: This file always runs in the tenant schema context (search_path already set).
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. HERO & PROMO SETTINGS
-- ---------------------------------------------------------------------------
UPDATE app_settings SET value = 'El Arte del Buen Sabor'
WHERE id = 'heroTitle';

UPDATE app_settings SET value = 'Café de origen, pan artesanal, chocolates y productos hechos con amor por productores locales. El sabor auténtico, directo a tu puerta.'
WHERE id = 'heroDescription';

UPDATE app_settings SET value = 'Descubrir Sabores'
WHERE id = 'heroPrimaryBtn';

UPDATE app_settings SET value = 'Café del Día'
WHERE id = 'heroSecondaryBtn';

-- Hero background (warm coffee / artisan food)
UPDATE app_settings SET value = '/storage/products/seed-amber-hero-bg.jpg'
WHERE id = 'heroImage';

-- Slightly warmer/darker overlay to complement coffee tones
UPDATE app_settings SET value = '0.45'
WHERE id = 'heroOverlayOpacity';

UPDATE app_settings SET value = '420'
WHERE id = 'heroHeight';

-- Banner overlay (coffee cup / artisan product floating right)
UPDATE app_settings SET value = '/storage/products/seed-amber-banner.jpg'
WHERE id = 'heroBannerImage';

UPDATE app_settings SET value = '260'
WHERE id = 'heroBannerSize';

UPDATE app_settings SET value = 'right'
WHERE id = 'heroBannerPositionX';

UPDATE app_settings SET value = 'center'
WHERE id = 'heroBannerPositionY';

UPDATE app_settings SET value = '100'
WHERE id = 'heroBannerOpacity';

-- Category filters — café & artisan food categories
UPDATE app_settings SET value = '{"useDefault":false,"categories":[{"id":"todos","name":"Todos","icon":"☕","slug":"todos","image":""},{"id":"cafe","name":"Café","icon":"☕","slug":"Café","image":""},{"id":"panaderia","name":"Panadería","icon":"🥐","slug":"Panadería","image":""},{"id":"artesanal","name":"Artesanal","icon":"🍯","slug":"Artesanal","image":""},{"id":"dulces","name":"Dulces","icon":"🍫","slug":"Dulces","image":""},{"id":"accesorios","name":"Accesorios","icon":"🫖","slug":"Accesorios","image":""}],"styles":{}}'
WHERE id = 'categoryFiltersConfig';

-- Promo section
INSERT INTO app_settings (id, value) VALUES
    ('promoText',  '☕ ¡Oferta del Mes! Compra cualquier pack de café de origen y llévate un paquete de galletas artesanales completamente gratis.'),
    ('promoImage', '/storage/products/seed-amber-promo.jpg')
ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value;


-- ---------------------------------------------------------------------------
-- 2. SAMPLE PRODUCTS — café & artisan food store
-- ---------------------------------------------------------------------------

-- ── Café ──────────────────────────────────────────────────────────────────────

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Café Single Origin Etiopía Yirgacheffe 250g',
        '<p>Un café que cuenta la historia de su tierra. Los granos <strong>Yirgacheffe procesados por vía húmeda</strong> de la región cafetalera más antigua del mundo ofrecen una taza limpia, brillante y llena de matices florales.</p>
<ul>
  <li><strong>Origen exclusivo Yirgacheffe</strong>: la variedad heirloom Etíope ofrece complejidad inalcanzable por otras regiones</li>
  <li><strong>Notas de cata</strong>: jazmín y bergamota en aroma, durazno, limón Meyer y chocolate negro en taza</li>
  <li><strong>Proceso lavado (washed)</strong>: claridad y acidez brillante que destaca cada nota frutal y floral</li>
  <li><strong>Tueste medio-claro</strong>: preserva los aceites aromáticos y la acidez viva del grano</li>
  <li><strong>Grano entero o molido</strong>: elige tu molienda al momento del pedido (espresso, filtro, prensa francesa)</li>
  <li><strong>Certificado de comercio justo</strong>: cooperativa de pequeños productores, precio justo garantizado</li>
</ul>
<p>Empaque en bolsa de válvula unidireccional con cierre zip para máxima frescura. Fecha de tueste impresa en cada bolsa. 250 g / 8.8 oz.</p>',
        18.99,
        'Café',
        50,
        '/storage/products/seed-amber-coffee-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-amber-coffee-1.jpg'),
    ('/storage/products/seed-amber-coffee-2.jpg'),
    ('/storage/products/seed-amber-coffee-3.jpg')
) AS imgs(img);

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Cold Brew Concentrado Artesanal 500ml',
        '<p>El cold brew más suave y concentrado que hayas probado. <strong>Maceración en frío durante 18 horas</strong> con agua filtrada y café de especialidad — una bebida limpia, sin amargura y lista para disfrutar.</p>
<ul>
  <li><strong>Proceso de inmersión 18 horas</strong>: maceración lenta en agua filtrada a 4°C para extraer dulzor y cuerpo sin acidez</li>
  <li><strong>Café 100% Arábica de especialidad</strong>: granos cuidadosamente tostados para el frío — profundo, achocolatado y suave</li>
  <li><strong>Concentrado 2× listo para diluir</strong>: mezcla 1:1 con agua, leche o bebida vegetal para la intensidad perfecta</li>
  <li><strong>Sin azúcar, sin aditivos</strong>: solo café y agua — úsalo como base para cualquier bebida fría</li>
  <li><strong>Alto en cafeína natural</strong>: aprox. 200 mg por porción de 240 ml (concentrado diluido)</li>
  <li><strong>Botella de vidrio retornable</strong>: devuelve la botella y recibe un 10% de descuento en tu próximo pedido</li>
</ul>
<p>Conservar refrigerado. Consumir antes de 14 días tras apertura. 500 ml — aprox. 4 porciones preparadas.</p>',
        12.99,
        'Café',
        35,
        '/storage/products/seed-amber-coldbrew-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-amber-coldbrew-1.jpg'),
    ('/storage/products/seed-amber-coldbrew-2.jpg'),
    ('/storage/products/seed-amber-coffee-2.jpg')
) AS imgs(img);

-- ── Panadería ─────────────────────────────────────────────────────────────────

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Pan Artesanal de Masa Madre con Semillas',
        '<p>El pan que recuerdas de siempre, hecho de la manera correcta. <strong>Fermentación natural de 24 horas</strong> con masa madre activa de más de 5 años para una miga abierta, corteza crujiente y sabor inigualable.</p>
<ul>
  <li><strong>Masa madre viva de 5 años</strong>: microbioma complejo que produce una fermentación profunda y un sabor complejo</li>
  <li><strong>Harina de trigo orgánica tipo T80</strong>: más nutritiva y con más fibra que la harina refinada</li>
  <li><strong>Fermentación 24 horas en frío</strong>: mejora la digestibilidad del gluten y desarrolla aromas complejos</li>
  <li><strong>Mix de semillas</strong>: lino, sésamo, amapola y girasol para un crujiente extra y valor nutricional añadido</li>
  <li><strong>Horneado en horno de leña</strong>: corteza oscura y caramelizada con interior suave y alveolado</li>
  <li><strong>Sin aditivos ni mejorantes</strong>: solo harina, agua, sal y masa madre — ingredientes de verdad</li>
</ul>
<p>Peso: aprox. 750 g. Horneado los martes, jueves y sábados. Recoge en tienda o entrega el mismo día de horneado.</p>',
        8.99,
        'Panadería',
        20,
        '/storage/products/seed-amber-bread-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-amber-bread-1.jpg'),
    ('/storage/products/seed-amber-bread-2.jpg'),
    ('/storage/products/seed-amber-hero-bg.jpg')
) AS imgs(img);

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Galletas de Avena y Chocolate Artesanales 12 uds',
        '<p>Las galletas que no puedes comer solo una. Elaboradas a mano con <strong>avena entera, mantequilla sin sal y pepitas de chocolate negro al 72%</strong> según receta familiar de tres generaciones.</p>
<ul>
  <li><strong>Avena entera tostada</strong>: textura crujiente por fuera y masticable por dentro — el equilibrio perfecto</li>
  <li><strong>Chocolate negro al 72%</strong>: pepitas grandes de chocolate de origen belga que se derriten en cada mordisco</li>
  <li><strong>Mantequilla artesanal local</strong>: sin sal, de vacas de pastoreo — rica en sabor y grasa de calidad</li>
  <li><strong>Sin conservantes artificiales</strong>: elaboradas diariamente con ingredientes frescos y naturales</li>
  <li><strong>Endulzadas con azúcar morena y miel</strong>: perfil de sabor más profundo y caramelizado</li>
  <li><strong>12 unidades por caja</strong>: presentación en caja kraft biodegradable con lazo de tela</li>
</ul>
<p>Sin frutos secos. Puede contener trazas de lácteos. Conservar en lugar fresco y seco. Consumir en 7 días para máxima frescura.</p>',
        11.99,
        'Panadería',
        30,
        '/storage/products/seed-amber-cookies-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-amber-cookies-1.jpg'),
    ('/storage/products/seed-amber-cookies-2.jpg'),
    ('/storage/products/seed-amber-promo.jpg')
) AS imgs(img);

-- ── Accesorios ────────────────────────────────────────────────────────────────

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Set de Tazas Artesanales de Cerámica 4 piezas',
        '<p>Tazas que transforman el ritual del café en una experiencia sensorial completa. Cada pieza es <strong>torneada y esmaltada a mano</strong> por artesanos locales — ninguna es igual a otra.</p>
<ul>
  <li><strong>Cerámica de gres de alta temperatura</strong>: más resistente que la loza, apta para microondas y lavavajillas</li>
  <li><strong>Esmaltado artesanal</strong>: glasas naturales de silicio, feldespato y óxidos minerales — sin plomo ni cadmio</li>
  <li><strong>Capacidad 350 ml</strong>: el tamaño ideal para café largo, cappuccino o té — manejable y con buen peso en mano</li>
  <li><strong>4 piezas tonos tierra</strong>: ocre, café tostado, arcilla y carbón — paleta cálida y acogedora</li>
  <li><strong>Apta para microondas y lavavajillas</strong>: cuidado fácil sin sacrificar la estética artesanal</li>
  <li><strong>Empaque regalo</strong>: caja de madera reutilizable con relleno de papel reciclado</li>
</ul>
<p>Cada pieza es única — pequeñas variaciones en forma y esmalte son parte del encanto artesanal. Set de 4 tazas.</p>',
        44.99,
        'Accesorios',
        25,
        '/storage/products/seed-amber-mugs-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-amber-mugs-1.jpg'),
    ('/storage/products/seed-amber-mugs-2.jpg'),
    ('/storage/products/seed-amber-coffee-3.jpg')
) AS imgs(img);

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Cafetera Italiana Moka de Aluminio 6 Tazas',
        '<p>El clásico italiano que no falla. La <strong>moka pot de aluminio fundido</strong> que prepara un café intenso, aromático y con cuerpo en apenas 5 minutos sobre cualquier fuente de calor.</p>
<ul>
  <li><strong>Aluminio fundido de alta calidad</strong>: distribución de calor uniforme para una extracción perfecta en cada preparación</li>
  <li><strong>Capacidad 6 tazas espresso</strong>: aprox. 240 ml de café concentrado por ciclo — suficiente para toda la familia</li>
  <li><strong>Válvula de seguridad</strong>: libera presión automáticamente si se supera el nivel seguro — uso tranquilo</li>
  <li><strong>Junta de silicona premium</strong>: crea sello perfecto y es más duradera que las juntas de goma convencionales</li>
  <li><strong>Compatible con gas, eléctrica e inducción</strong>: base de acero inoxidable para uso en cualquier cocina</li>
  <li><strong>Desmontable y fácil de limpiar</strong>: solo agua caliente — no usar detergente para preservar el aluminio</li>
</ul>
<p>Incluye embudo filtro y junta de repuesto. Dimensiones: 16 × 9 × 9 cm. La cafetera italiana por excelencia para los amantes del café con carácter.</p>',
        29.99,
        'Accesorios',
        40,
        '/storage/products/seed-amber-moka-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-amber-moka-1.jpg'),
    ('/storage/products/seed-amber-coffee-1.jpg'),
    ('/storage/products/seed-amber-mugs-1.jpg')
) AS imgs(img);

-- ── Artesanal ─────────────────────────────────────────────────────────────────

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Miel de Abeja con Panal Natural 350g',
        '<p>La miel más pura que encontrarás: <strong>cruda, sin filtrar y con trozos de panal real</strong> cosechada en colmenas de montaña alejadas de cultivos convencionales y contaminación urbana.</p>
<ul>
  <li><strong>Miel cruda sin pasteurizar</strong>: conserva todas sus enzimas, propóleos y más de 200 compuestos bioactivos</li>
  <li><strong>Panal real incluido</strong>: trozos de cera virgen con miel aún dentro — masticable y llena de propiedades</li>
  <li><strong>Origen de alta montaña</strong>: flora silvestre polifloral (tomillo, lavanda, romero, zarzamora) en zonas sin pesticidas</li>
  <li><strong>Polifenoles y antioxidantes</strong>: actividad antimicrobiana natural comprobada por análisis de laboratorio</li>
  <li><strong>Índice diastásico alto (>8)</strong>: indicador de frescura y ausencia de calentamiento industrial</li>
  <li><strong>Tarro de vidrio hermético</strong>: tapa de hojalata con precinto de seguridad para garantizar la cadena de custodia</li>
</ul>
<p>350 g netos. La cristalización es normal y señal de pureza. No recomendada para menores de 1 año. Miel de España, cosecha anual.</p>',
        15.99,
        'Artesanal',
        60,
        '/storage/products/seed-amber-honey-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-amber-honey-1.jpg'),
    ('/storage/products/seed-amber-jam-1.jpg'),
    ('/storage/products/seed-amber-honey-1.jpg')
) AS imgs(img);

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Set Mermelada Artesanal 3 Sabores 200g c/u',
        '<p>Un set de mermeladas <strong>elaboradas en pequeños lotes</strong> con fruta fresca de temporada y azúcar morena — sin pectina artificial, sin colorantes, sin conservantes añadidos.</p>
<ul>
  <li><strong>3 sabores de temporada</strong>: Fresa & Vainilla, Mango & Jengibre, y Frutos del Bosque — combinaciones únicas que no encontrarás en supermercados</li>
  <li><strong>Fruta al 65%</strong>: cada tarro contiene más fruta que azúcar — el estándar artesanal real</li>
  <li><strong>Sin pectina industrial</strong>: gelificación natural por cocción lenta en olla de cobre, como en casa de la abuela</li>
  <li><strong>Azúcar morena de caña</strong>: aporta profundidad de sabor y menor índice glucémico que el azúcar blanca</li>
  <li><strong>200 g por tarro</strong>: tamaño ideal para probar sin desperdiciar — 3 tarros en set de regalo</li>
  <li><strong>Etiqueta personalizable</strong>: añade un mensaje para regalar en cumpleaños o festividades</li>
</ul>
<p>Elaboradas por artesanos locales en cocinas certificadas. Conservar en lugar fresco y seco. Una vez abierto, refrigerar y consumir en 3 semanas.</p>',
        14.99,
        'Artesanal',
        45,
        '/storage/products/seed-amber-jam-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-amber-jam-1.jpg'),
    ('/storage/products/seed-amber-jam-2.jpg'),
    ('/storage/products/seed-amber-honey-1.jpg')
) AS imgs(img);

-- ── Dulces ────────────────────────────────────────────────────────────────────

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Caja de Chocolates Artesanales 20 piezas',
        '<p>El regalo perfecto para los amantes del chocolate fino. <strong>20 bombones artesanales</strong> elaborados con cobertura de cacao belga y rellenos de ganaches, pralinés y caramelos únicos.</p>
<ul>
  <li><strong>20 bombones surtidos</strong>: 5 variedades × 4 unidades — Caramelo Salado, Avellana Praliné, Frambuesa Ganache, Matcha Blanco y Toffee Bourbon</li>
  <li><strong>Cobertura de cacao belga al 70%</strong>: chocolate de origen único, templado a mano para un brillo y snap perfectos</li>
  <li><strong>Rellenos artesanales</strong>: ganaches preparados diariamente con crema fresca, mantequilla y saborizantes naturales</li>
  <li><strong>Sin conservantes</strong>: consumir en 15 días para máxima frescura — lo que significa que son muy frescos</li>
  <li><strong>Presentación premium</strong>: caja ballotin forrada en papel satinado negro con separadores individuales</li>
  <li><strong>Tarjeta dedicatoria</strong>: incluida con espacio para mensaje personalizado</li>
</ul>
<p>Puede contener trazas de frutos secos y lácteos. Conservar entre 15-18°C, lejos de la luz directa. Fabricado en taller artesano certificado.</p>',
        24.99,
        'Dulces',
        30,
        '/storage/products/seed-amber-chocolate-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-amber-chocolate-1.jpg'),
    ('/storage/products/seed-amber-chocolate-2.jpg'),
    ('/storage/products/seed-amber-cookies-1.jpg')
) AS imgs(img);

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Granola Artesanal con Frutos Secos y Semillas 500g',
        '<p>La granola que cambia el desayuno para siempre. <strong>Horneada en pequeños lotes</strong> con miel de abejas local, aceite de coco y una selección premium de copos, semillas y frutos secos tostados.</p>
<ul>
  <li><strong>Avena entera extra gruesa</strong>: copos de avena tostados lentamente para una textura crujiente y clusters perfectos</li>
  <li><strong>Mix premium de frutos secos</strong>: almendras laminadas, nueces de macadamia, anacardos y avellanas</li>
  <li><strong>Semillas funcionales</strong>: chía, lino dorado, cáñamo y semillas de girasol — omega 3 y proteína vegetal</li>
  <li><strong>Miel y aceite de coco</strong>: liga natural para los clusters — sin siropes de glucosa artificiales</li>
  <li><strong>Sin gluten certificado</strong>: elaborada en instalaciones 100% libres de gluten y trigo</li>
  <li><strong>Sin azúcar añadida</strong>: dulzor natural de la miel y las uvas pasas — máximo 8 g de azúcar por porción</li>
</ul>
<p>500 g en bolsa biodegradable con cierre zip. Ideal con yogur, leche vegetal, smoothie bowl o directamente como snack. Conservar en lugar fresco y seco.</p>',
        12.99,
        'Dulces',
        55,
        '/storage/products/seed-amber-granola-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-amber-granola-1.jpg'),
    ('/storage/products/seed-amber-promo.jpg'),
    ('/storage/products/seed-amber-honey-1.jpg')
) AS imgs(img);
