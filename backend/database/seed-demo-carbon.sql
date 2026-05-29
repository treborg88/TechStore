-- =============================================================================
-- Eonsclover — Demo Seed Data: Carbón (Automotriz & Herramientas)
-- =============================================================================
-- Run AFTER seed.sql to populate a polished automotive & tools store.
-- Creates: 10 professional hardware/auto products with gallery images, promo
-- text, and refined hero / category settings for a bold, industrial brand.
-- NOTE: This file always runs in the tenant schema context (search_path already set).
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. HERO & PROMO SETTINGS
-- ---------------------------------------------------------------------------
UPDATE app_settings SET value = 'Herramientas para los que Hacen'
WHERE id = 'heroTitle';

UPDATE app_settings SET value = 'Equipamiento profesional, accesorios automotrices y herramientas de alta calidad para quienes no aceptan productos que fallen cuando más se necesitan.'
WHERE id = 'heroDescription';

UPDATE app_settings SET value = 'Ver Herramientas'
WHERE id = 'heroPrimaryBtn';

UPDATE app_settings SET value = 'Accesorios Auto'
WHERE id = 'heroSecondaryBtn';

-- Hero background (dark tools / industrial)
UPDATE app_settings SET value = '/storage/products/seed-carbon-hero-bg.jpg'
WHERE id = 'heroImage';

-- Darker overlay to complement the carbon/dark aesthetic
UPDATE app_settings SET value = '0.55'
WHERE id = 'heroOverlayOpacity';

UPDATE app_settings SET value = '420'
WHERE id = 'heroHeight';

-- Banner overlay (car / tool product floating right)
UPDATE app_settings SET value = '/storage/products/seed-carbon-banner.jpg'
WHERE id = 'heroBannerImage';

UPDATE app_settings SET value = '260'
WHERE id = 'heroBannerSize';

UPDATE app_settings SET value = 'right'
WHERE id = 'heroBannerPositionX';

UPDATE app_settings SET value = 'center'
WHERE id = 'heroBannerPositionY';

UPDATE app_settings SET value = '100'
WHERE id = 'heroBannerOpacity';

-- Category filters — automotive & tools categories
UPDATE app_settings SET value = '{"useDefault":false,"categories":[{"id":"todos","name":"Todos","icon":"🔧","slug":"todos","image":""},{"id":"herramientas","name":"Herramientas","icon":"🔧","slug":"Herramientas","image":""},{"id":"automotriz","name":"Automotriz","icon":"🚗","slug":"Automotriz","image":""},{"id":"equipamiento","name":"Equipamiento","icon":"🎒","slug":"Equipamiento","image":""},{"id":"electronica","name":"Electrónica","icon":"🔋","slug":"Electrónica","image":""},{"id":"seguridad","name":"Seguridad","icon":"🦺","slug":"Seguridad","image":""}],"styles":{}}'
WHERE id = 'categoryFiltersConfig';

-- Promo section
INSERT INTO app_settings (id, value) VALUES
    ('promoText',  '🔧 ¡Oferta del Mes! Lleva cualquier juego de herramientas y obtén un 25% de descuento en todos los accesorios automotrices seleccionados.'),
    ('promoImage', '/storage/products/seed-carbon-promo.jpg')
ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value;


-- ---------------------------------------------------------------------------
-- 2. SAMPLE PRODUCTS — automotive & tools store
-- ---------------------------------------------------------------------------

-- ── Herramientas ─────────────────────────────────────────────────────────────

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Juego de Herramientas Profesional 108 Piezas',
        '<p>El juego de herramientas más completo para el taller doméstico o profesional. <strong>108 piezas de cromo vanadio</strong> organizadas en un maletín de aluminio con espuma moldeada — todo en su lugar, siempre.</p>
<ul>
  <li><strong>Acero cromo vanadio (Cr-V)</strong>: aleación de alta resistencia a la torsión, duración y acabado espejo resistente a la corrosión</li>
  <li><strong>Juego completo</strong>: 22 vasos métricos y SAE (1/4" y 3/8"), 2 trinquetes, 8 destornilladores, 10 llaves combinadas, 5 llaves allen, 3 alicates y mucho más</li>
  <li><strong>Trinquete de 72 dientes</strong>: arco de giro mínimo de 5° — trabaja en espacios reducidos sin comprometer el par</li>
  <li><strong>Maletín de aluminio</strong>: cierres metálicos con bisagras reforzadas y espuma EVA moldeada por CNC para cada pieza</li>
  <li><strong>Certificado DIN/ISO</strong>: cumple con estándares europeos de calidad para uso profesional</li>
  <li><strong>Garantía de por vida</strong>: cambio inmediato de cualquier pieza defectuosa sin preguntas</li>
</ul>
<p>Peso total del set: 8.2 kg. Dimensiones del maletín: 45 × 35 × 15 cm. El regalo perfecto para el mecánico, el carpintero o el manitas de la familia.</p>',
        89.99,
        'Herramientas',
        25,
        '/storage/products/seed-carbon-tools-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-carbon-tools-1.jpg'),
    ('/storage/products/seed-carbon-tools-2.jpg'),
    ('/storage/products/seed-carbon-tools-3.jpg')
) AS imgs(img);

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Multímetro Digital Profesional AutoRango',
        '<p>El multímetro que usan los profesionales. Con <strong>rango automático, pantalla LCD con retroiluminación</strong> y categoría de seguridad CAT III 600V, mide con precisión en entornos industriales y domésticos.</p>
<ul>
  <li><strong>AutoRango inteligente</strong>: selecciona automáticamente el rango óptimo — sin ajuste manual, lecturas más rápidas</li>
  <li><strong>Mediciones completas</strong>: tensión AC/DC (600V), corriente AC/DC (10A), resistencia (60MΩ), continuidad, diodo, temperatura y frecuencia</li>
  <li><strong>Pantalla LCD 4000 conteos</strong>: retroiluminación azul, retención de datos (HOLD), lectura relativa (REL)</li>
  <li><strong>CAT III 600V</strong>: categoría de seguridad para paneles eléctricos, armarios de distribución y equipos industriales</li>
  <li><strong>Sonda de temperatura tipo K incluida</strong>: mide desde -40°C hasta 400°C para HVAC y electrónica</li>
  <li><strong>Carcasa de doble inyección</strong>: protección contra caídas desde 1 m, resistente a polvo y líquidos</li>
</ul>
<p>Incluye puntas de prueba profesionales con aislamiento 1000V, bolsa de transporte y 2 baterías AAA. Certificado CE y RoHS.</p>',
        34.99,
        'Herramientas',
        40,
        '/storage/products/seed-carbon-multimeter-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-carbon-multimeter-1.jpg'),
    ('/storage/products/seed-carbon-multimeter-2.jpg'),
    ('/storage/products/seed-carbon-tools-1.jpg')
) AS imgs(img);

-- ── Automotriz ────────────────────────────────────────────────────────────────

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Compresor de Aire Portátil 12V 150 PSI',
        '<p>Infla tus neumáticos en minutos desde cualquier lugar. El <strong>compresor digital de 12V con pantalla LCD</strong> que se conecta al encendedor del auto y alcanza 150 PSI — suficiente para coches, SUVs, pickups y bicicletas.</p>
<ul>
  <li><strong>Presión máxima 150 PSI</strong>: infla un neumático P215/65R16 desde 0 hasta 35 PSI en menos de 6 minutos</li>
  <li><strong>Pantalla digital LCD</strong>: lectura en PSI, BAR, KPA o kg/cm² — selección de unidades con un botón</li>
  <li><strong>Apagado automático</strong>: programa la presión objetivo y se detiene solo — sin sobreinflado nunca</li>
  <li><strong>Cable de 3 metros</strong>: longitud suficiente para llegar a los 4 neumáticos desde el habitáculo</li>
  <li><strong>Linterna LED integrada</strong>: útil para emergencias nocturnas o en garajes con poca luz</li>
  <li><strong>Boquillas de repuesto</strong>: incluye adaptadores para válvulas Presta, pelotas deportivas y colchones</li>
</ul>
<p>Peso: 0.85 kg. Cable de alimentación con fusible de protección. Bolsa de transporte incluida. Temperatura de trabajo: -20°C a +60°C.</p>',
        49.99,
        'Automotriz',
        35,
        '/storage/products/seed-carbon-compressor-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-carbon-compressor-1.jpg'),
    ('/storage/products/seed-carbon-banner.jpg'),
    ('/storage/products/seed-carbon-tools-2.jpg')
) AS imgs(img);

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Dashcam 4K Ultra HD con GPS y Visión Nocturna',
        '<p>Protege tu auto y tus derechos en cualquier situación. La <strong>cámara de tablero 4K con SONY STARVIS</strong> graba cada detalle de la carretera — incluso de noche — con GPS integrado para rastrear velocidad y ruta.</p>
<ul>
  <li><strong>Grabación 4K 30fps</strong>: sensor SONY STARVIS de gran tamaño con apertura f/1.8 — imagen nítida de día y de noche</li>
  <li><strong>Ángulo de 170°</strong>: campo de visión ultraancho que cubre todos los carriles y los laterales del vehículo</li>
  <li><strong>GPS integrado</strong>: registra velocidad, coordenadas y ruta en cada clip de vídeo para máxima evidencia</li>
  <li><strong>WDR (Wide Dynamic Range)</strong>: equilibra automáticamente la exposición en túneles, sol directo y faros nocturnos</li>
  <li><strong>Modo Parking</strong>: monitorea el vehículo aparcado y graba solo si detecta movimiento o impacto</li>
  <li><strong>Instalación sin cables visibles</strong>: cable ultra-delgado que se oculta por la junta del parabrisas</li>
</ul>
<p>Compatible con tarjetas microSD hasta 256 GB (no incluida). App móvil para revisión en tiempo real. Soporte de ventosa 3M incluido. Garantía 2 años.</p>',
        79.99,
        'Automotriz',
        20,
        '/storage/products/seed-carbon-dashcam-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-carbon-dashcam-1.jpg'),
    ('/storage/products/seed-carbon-dashcam-2.jpg'),
    ('/storage/products/seed-carbon-dashcam-3.jpg')
) AS imgs(img);

-- ── Equipamiento ─────────────────────────────────────────────────────────────

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Linterna Táctica LED 1000 Lúmenes Recargable',
        '<p>La linterna que no te deja sin luz cuando más la necesitas. <strong>1000 lúmenes de potencia real</strong>, cuerpo en aluminio aeronáutico T6 y batería recargable por USB-C para tener siempre luz máxima disponible.</p>
<ul>
  <li><strong>LED CREE XHP50</strong>: 1000 lúmenes reales (verificado) con alcance de hasta 300 metros en modo máximo</li>
  <li><strong>5 modos de iluminación</strong>: Turbo (1000 lm) / Alto (500 lm) / Medio (200 lm) / Bajo (50 lm) / Stroboscópico de emergencia</li>
  <li><strong>Batería 5000 mAh integrada</strong>: hasta 8 horas en modo medio — carga por USB-C en 3 horas</li>
  <li><strong>Cuerpo de aluminio T6</strong>: grado aeronáutico, resistente a impactos de 2 metros y clasificación IP68 (sumergible)</li>
  <li><strong>Zoom telescópico</strong>: ajusta el haz de flood a spot para iluminar cerca o a distancia</li>
  <li><strong>Memoria de modo</strong>: recuerda el último modo usado al encender para no deslumbrarte de madrugada</li>
</ul>
<p>Peso: 185 g con batería. Cable de carga USB-C y correa de mano incluidos. Certificado IP68. Temperatura de trabajo: -30°C a +50°C.</p>',
        24.99,
        'Equipamiento',
        60,
        '/storage/products/seed-carbon-flashlight-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-carbon-flashlight-1.jpg'),
    ('/storage/products/seed-carbon-tools-2.jpg'),
    ('/storage/products/seed-carbon-tools-3.jpg')
) AS imgs(img);

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Navaja Multiusos 18 Funciones Acero Inoxidable',
        '<p>La herramienta de bolsillo que resuelve cualquier situación. Con <strong>18 funciones en acero inoxidable 440C</strong> y mango de aluminio anodizado, es compacta, robusta y siempre lista.</p>
<ul>
  <li><strong>18 funciones integradas</strong>: hoja, sierra, destornillador plano y Phillips, abrelatas, sacacorchos, lima, tijeras, alicate y más</li>
  <li><strong>Acero inoxidable 440C</strong>: alta dureza (58 HRC), resistencia a la corrosión y filo duradero que no se oxida</li>
  <li><strong>Mango de aluminio anodizado</strong>: ligero, robusto y con grip de textura diamond para agarre seguro mojado</li>
  <li><strong>Cierre de seguridad</strong>: bloqueo de hoja con mecanismo de seguridad que previene cierres accidentales</li>
  <li><strong>Apertura con una mano</strong>: hoja principal con muesca para apertura rápida de pulgar</li>
  <li><strong>Clip de cinturón reversible</strong>: discreto, resistente y extraíble — llévala siempre contigo</li>
</ul>
<p>Peso: 120 g. Dimensiones plegada: 11 × 3.5 cm. Funda de nylon MOLLE incluida. Certificado CPSC. No apta para menores de 18 años.</p>',
        19.99,
        'Equipamiento',
        75,
        '/storage/products/seed-carbon-knife-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-carbon-knife-1.jpg'),
    ('/storage/products/seed-carbon-tools-1.jpg'),
    ('/storage/products/seed-carbon-flashlight-1.jpg')
) AS imgs(img);

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Mochila Táctica Impermeable 40L MOLLE',
        '<p>La mochila diseñada para los que no se quedan en casa. Con <strong>40 litros de capacidad y sistema MOLLE</strong>, es la compañera ideal para senderismo, camping, viajes o la ciudad.</p>
<ul>
  <li><strong>Nylon 900D ripstop</strong>: tela de alta densidad con tratamiento DWR — repele agua, soporta rasgados y abrasión</li>
  <li><strong>Sistema MOLLE en exterior</strong>: filas de webbing para añadir bolsillos, fundas y accesorios modulares</li>
  <li><strong>40 L de capacidad organizada</strong>: compartimento principal, funda hidratación 3L, bolsillo laptop 17", 4 bolsillos exteriores</li>
  <li><strong>Soporte lumbar acolchado</strong>: panel trasero con canales de ventilación y correas de pecho y cadera ajustables</li>
  <li><strong>Acceso lateral</strong>: abre desde los lados para sacar objetos del fondo sin vaciar la mochila</li>
  <li><strong>Asas de carga reforzadas</strong>: costuras dobles en puntos de estrés máximo para cargas de hasta 30 kg</li>
</ul>
<p>Peso vacío: 1.4 kg. Incluye cubierta impermeable de lluvia. Compatible con sistemas de hidratación de 2-3L. Colores: Negro táctico, Verde militar, Gris urbano.</p>',
        59.99,
        'Equipamiento',
        30,
        '/storage/products/seed-carbon-backpack-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-carbon-backpack-1.jpg'),
    ('/storage/products/seed-carbon-backpack-2.jpg'),
    ('/storage/products/seed-carbon-promo.jpg')
) AS imgs(img);

-- ── Electrónica ───────────────────────────────────────────────────────────────

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Cargador Solar Portátil + Power Bank 20000mAh',
        '<p>Energía ilimitada donde no llega el enchufe. El <strong>panel solar de alta eficiencia (28%) combinado con batería de 20000 mAh</strong> mantiene todos tus dispositivos cargados en camping, senderismo o emergencias.</p>
<ul>
  <li><strong>Panel solar SunPower 28% eficiencia</strong>: los más eficientes del mercado — genera 18W en condiciones óptimas de sol directo</li>
  <li><strong>Batería de 20000 mAh integrada</strong>: almacena la energía solar para usar de noche o bajo techo — hasta 5 cargas completas de smartphone</li>
  <li><strong>Carga rápida USB-C 18W PD</strong>: carga un iPhone de 0 a 100% en 1.5 horas desde la batería interna</li>
  <li><strong>3 puertos de salida</strong>: USB-C PD 18W + 2× USB-A 12W — carga hasta 3 dispositivos simultáneamente</li>
  <li><strong>Resistente IP67</strong>: protegido contra polvo y sumergible hasta 1 metro durante 30 minutos</li>
  <li><strong>Mosquetones de enganche</strong>: cuelga del exterior de la mochila mientras caminas para cargar en movimiento</li>
</ul>
<p>Peso: 680 g. Dimensiones desplegado: 39 × 18 cm. Carcasa de PET reciclado. Incluye cables USB-C y USB-A. Garantía 18 meses.</p>',
        44.99,
        'Electrónica',
        35,
        '/storage/products/seed-carbon-solar-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-carbon-solar-1.jpg'),
    ('/storage/products/seed-carbon-solar-2.jpg'),
    ('/storage/products/seed-carbon-backpack-1.jpg')
) AS imgs(img);

-- ── Seguridad ─────────────────────────────────────────────────────────────────

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Guantes de Trabajo Anticorte Nivel 5 Talla L',
        '<p>Los guantes que protegen de verdad. Con <strong>recubrimiento de nitrilo en palma y nivel de corte A5 (EN388)</strong>, estos guantes defienden tus manos contra objetos afilados, abrasión y punciones sin sacrificar la destreza.</p>
<ul>
  <li><strong>Nivel de corte A5 (ANSI/ISEA 105)</strong>: el estándar más alto para trabajo con vidrio, chapa, cuchillas y metales</li>
  <li><strong>Fibra HPPE + acero inoxidable</strong>: núcleo de alta resistencia que no se comprime ni se deforma bajo presión de corte</li>
  <li><strong>Recubrimiento de nitrilo espumado</strong>: agarre excepcional en superficies húmedas, aceitosas y secas</li>
  <li><strong>Palma reforzada zona pulgar</strong>: la zona de mayor fricción lleva doble capa de nitrilo para mayor durabilidad</li>
  <li><strong>Dorso transpirable</strong>: tejido de punto fino que permite ventilación y flexibilidad total de los dedos</li>
  <li><strong>Talla L ajustada</strong>: disponible en S, M, L, XL y XXL — consulta tabla de tallas en imágenes del producto</li>
</ul>
<p>Lavables a máquina a 40°C. Certificado EN388 4X43F, EN ISO 21420. Peso por par: 68 g. Apto para automoción, logística, construcción y jardinería.</p>',
        14.99,
        'Seguridad',
        90,
        '/storage/products/seed-carbon-gloves-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-carbon-gloves-1.jpg'),
    ('/storage/products/seed-carbon-gloves-2.jpg'),
    ('/storage/products/seed-carbon-tools-1.jpg')
) AS imgs(img);
