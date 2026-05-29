-- =============================================================================
-- Eonsclover — Demo Seed Data: Esmeralda (Salud & Bienestar)
-- =============================================================================
-- Run AFTER seed.sql to populate a polished health & wellness store.
-- Creates: 10 organic/health products with gallery images, promo text, and
-- refined hero / category settings for a natural, wellness-focused brand.
-- NOTE: This file always runs in the tenant schema context (search_path already set).
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. HERO & PROMO SETTINGS
-- ---------------------------------------------------------------------------
UPDATE app_settings SET value = 'Salud, Bienestar y Vida Orgánica'
WHERE id = 'heroTitle';

UPDATE app_settings SET value = 'Descubre nuestra selección de suplementos naturales, alimentos orgánicos certificados y todo lo que necesitas para llevar un estilo de vida saludable.'
WHERE id = 'heroDescription';

UPDATE app_settings SET value = 'Explorar Productos'
WHERE id = 'heroPrimaryBtn';

UPDATE app_settings SET value = 'Ver Orgánicos'
WHERE id = 'heroSecondaryBtn';

-- Hero background (fresh healthy food / nature)
UPDATE app_settings SET value = '/storage/products/seed-emerald-hero-bg.jpg'
WHERE id = 'heroImage';

-- Medium overlay — keep the green fresh feel visible
UPDATE app_settings SET value = '0.40'
WHERE id = 'heroOverlayOpacity';

UPDATE app_settings SET value = '420'
WHERE id = 'heroHeight';

-- Banner overlay (supplement jar / healthy product floating right)
UPDATE app_settings SET value = '/storage/products/seed-emerald-banner.jpg'
WHERE id = 'heroBannerImage';

UPDATE app_settings SET value = '260'
WHERE id = 'heroBannerSize';

UPDATE app_settings SET value = 'right'
WHERE id = 'heroBannerPositionX';

UPDATE app_settings SET value = 'center'
WHERE id = 'heroBannerPositionY';

UPDATE app_settings SET value = '100'
WHERE id = 'heroBannerOpacity';

-- Category filters — health & wellness categories
UPDATE app_settings SET value = '{"useDefault":false,"categories":[{"id":"todos","name":"Todos","icon":"🌿","slug":"todos","image":""},{"id":"suplementos","name":"Suplementos","icon":"💊","slug":"Suplementos","image":""},{"id":"alimentos","name":"Alimentos Orgánicos","icon":"🥦","slug":"Alimentos Orgánicos","image":""},{"id":"fitness","name":"Fitness","icon":"🏋️","slug":"Fitness","image":""},{"id":"cuidado","name":"Cuidado Natural","icon":"🌱","slug":"Cuidado Natural","image":""},{"id":"infusiones","name":"Infusiones","icon":"🍵","slug":"Infusiones","image":""}],"styles":{}}'
WHERE id = 'categoryFiltersConfig';

-- Promo section
INSERT INTO app_settings (id, value) VALUES
    ('promoText',  '🌿 ¡Semana Verde! Obtén un 20% de descuento en todos los suplementos certificados orgánicos al comprar dos o más productos.'),
    ('promoImage', '/storage/products/seed-emerald-promo.jpg')
ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value;


-- ---------------------------------------------------------------------------
-- 2. SAMPLE PRODUCTS — health & wellness store
-- ---------------------------------------------------------------------------

-- ── Suplementos ──────────────────────────────────────────────────────────────

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Colágeno Marino Hidrolizado Premium 300g',
        '<p>El suplemento de belleza y articulaciones más completo del mercado. Con <strong>10 g de colágeno marino tipo I y III</strong> por porción, junto con vitamina C y ácido hialurónico para una absorción máxima.</p>
<ul>
  <li><strong>Colágeno marino tipo I y III</strong>: péptidos ultrahidrolizados de peces de aguas frías — máxima biodisponibilidad</li>
  <li><strong>Vitamina C añadida</strong>: esencial para la síntesis natural de colágeno en la piel y articulaciones</li>
  <li><strong>Ácido hialurónico 50 mg</strong>: hidratación profunda de la piel desde adentro hacia afuera</li>
  <li><strong>Biotina + zinc</strong>: refuerzan cabello, uñas y la barrera cutánea</li>
  <li><strong>Sin sabor, sin azúcar</strong>: se disuelve perfectamente en agua, jugo o smoothies</li>
  <li><strong>30 porciones</strong>: suministro completo de un mes para resultados visibles</li>
</ul>
<p>Resultados visibles en 4-8 semanas: piel más firme, articulaciones más flexibles y cabello más fuerte. Libre de gluten, sin OMG. Fabricado en planta certificada GMP.</p>',
        39.99,
        'Suplementos',
        60,
        '/storage/products/seed-emerald-supplement-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-emerald-supplement-1.jpg'),
    ('/storage/products/seed-emerald-supplement-2.jpg'),
    ('/storage/products/seed-emerald-promo.jpg')
) AS imgs(img);

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Proteína Vegana de Guisante y Arroz 1kg',
        '<p>La proteína plant-based más completa para atletas y deportistas conscientes. <strong>25 g de proteína vegetal por porción</strong> con todos los aminoácidos esenciales en perfecto equilibrio.</p>
<ul>
  <li><strong>Blend guisante + arroz integral</strong>: perfil de aminoácidos completo comparable a la whey — sin lactosa, sin soja</li>
  <li><strong>25 g de proteína por porción</strong>: ideal para recuperación muscular y ganancia de masa sin restricciones dietéticas</li>
  <li><strong>Digestión fácil</strong>: enzimas digestivas añadidas (bromelina + papaína) para minimizar el malestar intestinal</li>
  <li><strong>Sabor chocolate negro</strong>: endulzado con stevia pura — sin azúcar añadida, sin edulcorantes artificiales</li>
  <li><strong>Sin alérgenos comunes</strong>: libre de gluten, lactosa, soja, nueces y OMG</li>
  <li><strong>33 porciones</strong>: bolsa con cierre zip reutilizable para conservar frescura</li>
</ul>
<p>Certificado orgánico y vegano. Ideal para batidos post-entreno, overnight oats, pancakes proteicos y recetas saludables.</p>',
        49.99,
        'Suplementos',
        45,
        '/storage/products/seed-emerald-protein-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-emerald-protein-1.jpg'),
    ('/storage/products/seed-emerald-protein-2.jpg'),
    ('/storage/products/seed-emerald-hero-bg.jpg')
) AS imgs(img);

-- ── Alimentos Orgánicos ───────────────────────────────────────────────────────

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Pack Verduras Orgánicas Certificadas de Temporada',
        '<p>Una caja cuidadosamente seleccionada con las mejores <strong>verduras orgánicas de temporada</strong> directamente del campo a tu mesa. Todo cultivado sin pesticidas ni fertilizantes químicos.</p>
<ul>
  <li><strong>6-8 variedades frescas</strong>: tomates cherry, espinacas, zanahorias, zucchini, pimientos y más según temporada</li>
  <li><strong>Certificación orgánica</strong>: todos los productores cuentan con sello USDA Organic o equivalente local</li>
  <li><strong>Recogida el día anterior</strong>: garantiza la máxima frescura y contenido nutricional en cada entrega</li>
  <li><strong>Productores locales</strong>: apoyamos granjas familiares dentro de un radio de 100 km</li>
  <li><strong>Caja biodegradable</strong>: empaque 100% compostable, cero plástico de un solo uso</li>
  <li><strong>Recetas incluidas</strong>: tarjeta con 3 recetas para aprovechar al máximo los productos del pack</li>
</ul>
<p>Pack estándar: aprox. 3.5 kg de verduras surtidas. Disponible en suscripción semanal o quincenal con descuento del 10%.</p>',
        24.99,
        'Alimentos Orgánicos',
        30,
        '/storage/products/seed-emerald-veggies-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-emerald-veggies-1.jpg'),
    ('/storage/products/seed-emerald-veggies-2.jpg'),
    ('/storage/products/seed-emerald-promo.jpg')
) AS imgs(img);

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Aceite de Oliva Extra Virgen Orgánico 500ml',
        '<p>Un aceite de oliva de categoría superior, extraído en frío de aceitunas <strong>Arbequina y Picual cultivadas orgánicamente</strong> en pequeñas fincas familiares del Mediterráneo.</p>
<ul>
  <li><strong>Primera prensada en frío</strong>: extracción mecánica sin solventes — preserva todos los polifenoles y vitamina E</li>
  <li><strong>Acidez ≤ 0.3%</strong>: supera el estándar de 0.8% exigido para la categoría extra virgen</li>
  <li><strong>Certificado orgánico USDA + EU Bio</strong>: sin pesticidas, herbicidas ni fertilizantes sintéticos</li>
  <li><strong>Alto en antioxidantes</strong>: oleocanthal, oleuropeína y escualeno para beneficios cardiovasculares</li>
  <li><strong>Botella de vidrio oscuro</strong>: protege el aceite de la oxidación por luz UV</li>
  <li><strong>Cosecha de temporada</strong>: etiquetado con año de cosecha para máxima trazabilidad</li>
</ul>
<p>Ideal en crudo para ensaladas, tostadas y salsas. También apto para cocinar a temperatura media. 500 ml / 16.9 fl oz.</p>',
        19.99,
        'Alimentos Orgánicos',
        80,
        '/storage/products/seed-emerald-oliveoil-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-emerald-oliveoil-1.jpg'),
    ('/storage/products/seed-emerald-veggies-1.jpg'),
    ('/storage/products/seed-emerald-veggies-2.jpg')
) AS imgs(img);

-- ── Fitness ───────────────────────────────────────────────────────────────────

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Esterilla de Yoga Antideslizante TPE 6mm',
        '<p>La esterilla que no se mueve contigo. Fabricada en <strong>TPE ecológico de doble capa</strong>, ofrece el agarre, la amortiguación y la alineación perfecta para cualquier práctica de yoga o pilates.</p>
<ul>
  <li><strong>Material TPE ecológico</strong>: libre de PVC, látex y metales pesados — biodegradable al final de su vida útil</li>
  <li><strong>6 mm de espesor</strong>: equilibrio ideal entre agarre y amortiguación para rodillas y articulaciones</li>
  <li><strong>Textura antideslizante doble cara</strong>: alineación de puntos grabados para posturas correctas</li>
  <li><strong>Superficie de humedad absorbente</strong>: mantiene el agarre incluso en sesiones intensas</li>
  <li><strong>Dimensiones</strong>: 183 × 61 cm — apta para cualquier estatura</li>
  <li><strong>Peso</strong>: 1.1 kg con correa de transporte incluida — llévala al estudio fácilmente</li>
</ul>
<p>Disponible en: Verde Bosque (este), Azul Pacífico, Lavanda y Gris Pizarra. Limpia con paño húmedo o lávala a mano con jabón neutro.</p>',
        34.99,
        'Fitness',
        55,
        '/storage/products/seed-emerald-yoga-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-emerald-yoga-1.jpg'),
    ('/storage/products/seed-emerald-yoga-2.jpg'),
    ('/storage/products/seed-emerald-bands-1.jpg')
) AS imgs(img);

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Set de Bandas Elásticas de Resistencia 5 Niveles',
        '<p>Entrena donde quieras con el set de bandas más completo del mercado. <strong>5 niveles de resistencia</strong> desde 2 hasta 45 kg para principiantes y atletas avanzados por igual.</p>
<ul>
  <li><strong>5 bandas de latex natural</strong>: Amarilla (2-4 kg), Verde (4-7 kg), Azul (7-14 kg), Roja (14-22 kg), Negra (22-45 kg)</li>
  <li><strong>Latex natural premium</strong>: mayor durabilidad y elasticidad que las bandas sintéticas — resisten más de 1000 repeticiones</li>
  <li><strong>Versatilidad total</strong>: sentadillas, press, remo, extensiones, asistencia en dominadas y más de 50 ejercicios</li>
  <li><strong>Sin látex alergénico</strong>: formulación especial apta para personas con sensibilidad</li>
  <li><strong>Set completo</strong>: 5 bandas + bolsa de malla transpirable + guía de ejercicios en PDF</li>
  <li><strong>Portátil y ligero</strong>: todo el set pesa 500 g y cabe en cualquier mochila</li>
</ul>
<p>Ideal para home gym, viajes o uso en el gimnasio como complemento de pesas. Garantía de 1 año contra roturas.</p>',
        22.99,
        'Fitness',
        70,
        '/storage/products/seed-emerald-bands-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-emerald-bands-1.jpg'),
    ('/storage/products/seed-emerald-bands-2.jpg'),
    ('/storage/products/seed-emerald-yoga-1.jpg')
) AS imgs(img);

-- ── Cuidado Natural ───────────────────────────────────────────────────────────

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Jabón Natural de Aloe Vera y Carbón Activado',
        '<p>Un jabón artesanal <strong>100% natural</strong> elaborado en frío con aloe vera orgánico y carbón activado de bambú. Limpia profundamente los poros sin agredir la barrera natural de la piel.</p>
<ul>
  <li><strong>Aloe vera orgánico al 30%</strong>: calma, hidrata y regenera — ideal para piel sensible, seca o con imperfecciones</li>
  <li><strong>Carbón activado de bambú</strong>: absorbe toxinas e impurezas del poro sin irritar la piel</li>
  <li><strong>Proceso cold process</strong>: preserva todos los nutrientes activos del aceite de coco, manteca de karité y aceite de oliva</li>
  <li><strong>Sin sulfatos, parabenos ni SLS</strong>: formulado para pieles reactivas y atópicas</li>
  <li><strong>Aroma natural de menta y eucalipto</strong>: aceites esenciales puros para un efecto refrescante y tonificante</li>
  <li><strong>Peso neto</strong>: 100 g — duración aproximada de 3-4 semanas con uso diario</li>
</ul>
<p>Apto para cara y cuerpo. Vegano, cruelty-free, sin microplásticos. Empaque en papel kraft 100% reciclado.</p>',
        9.99,
        'Cuidado Natural',
        100,
        '/storage/products/seed-emerald-soap-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-emerald-soap-1.jpg'),
    ('/storage/products/seed-emerald-cream-1.jpg'),
    ('/storage/products/seed-emerald-soap-1.jpg')
) AS imgs(img);

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Crema Corporal Nutritiva de Manteca de Karité 200ml',
        '<p>La crema corporal que transforma la piel más seca en una piel suave y luminosa. Con <strong>manteca de karité sin refinar al 40%</strong> y aceite de argán marroquí para una hidratación que dura todo el día.</p>
<ul>
  <li><strong>Manteca de karité cruda al 40%</strong>: concentración premium que repara grietas, nutela y suaviza la piel más seca</li>
  <li><strong>Aceite de argán de primera presión</strong>: rico en ácidos grasos omega y vitamina E para elasticidad y brillo</li>
  <li><strong>Vitamina E y C</strong>: antioxidantes que previenen el envejecimiento prematuro y unifican el tono</li>
  <li><strong>Aroma a vainilla y coco</strong>: fragancia delicada de aceites esenciales — sin artificiales</li>
  <li><strong>Textura rich & fast-absorb</strong>: se absorbe sin dejar residuo graso — aplicable antes de vestirse</li>
  <li><strong>Para todo el cuerpo</strong>: especialmente recomendada para codos, talones, manos y zonas secas</li>
</ul>
<p>Vegana, cruelty-free. Sin parabenos, sin silicones. 200 ml. Tarro de vidrio reutilizable con tapa de aluminio.</p>',
        19.99,
        'Cuidado Natural',
        65,
        '/storage/products/seed-emerald-cream-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-emerald-cream-1.jpg'),
    ('/storage/products/seed-emerald-soap-1.jpg'),
    ('/storage/products/seed-emerald-veggies-2.jpg')
) AS imgs(img);

-- ── Infusiones ────────────────────────────────────────────────────────────────

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Matcha Ceremonial Premium Japonés 100g',
        '<p>El matcha de más alta calidad: cultivado en <strong>Uji, Kyoto</strong> bajo técnica tradicional de sombreado (tana), molido en piedra de granito para obtener un polvo ultrafino de un verde vibrante e intenso.</p>
<ul>
  <li><strong>Grado ceremonial</strong>: primer ciclo de cosecha (Ichibancha, mayo) — el más suave, dulce y rico en L-teanina</li>
  <li><strong>L-Teanina + cafeína natural</strong>: energía sostenida sin nerviosismo ni crash — concentración y calma al mismo tiempo</li>
  <li><strong>EGCG (catequinas)</strong>: antioxidante 137× más potente que el té verde convencional</li>
  <li><strong>Color verde jade intenso</strong>: indicador de clorofila alta y frescura del polvo</li>
  <li><strong>Sabor umami complejo</strong>: notas de hierba fresca, almendra y dulzor natural — sin amargura</li>
  <li><strong>100 g en lata hermética</strong>: con válvula desoxigenante para conservar la frescura hasta 18 meses</li>
</ul>
<p>Preparación recomendada: 1 g de polvo + 70 ml de agua a 70°C. Ideal para latte de matcha, smoothies y repostería premium.</p>',
        24.99,
        'Infusiones',
        40,
        '/storage/products/seed-emerald-matcha-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-emerald-matcha-1.jpg'),
    ('/storage/products/seed-emerald-matcha-2.jpg'),
    ('/storage/products/seed-emerald-honey-1.jpg')
) AS imgs(img);

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Miel Pura de Abejas Artesanal con Panal 500g',
        '<p>Una miel cruda excepcional, directamente del colmenar a tu mesa. <strong>Sin filtrar, sin pasteurizar, sin mezclas</strong> — conserva todas las enzimas, propóleos y antioxidantes que la hacen única.</p>
<ul>
  <li><strong>Miel cruda sin procesar</strong>: nunca calentada por encima de los 40°C — preserva diastasas, invertasas y glucosa oxidasa</li>
  <li><strong>Con trozos de panal</strong>: cera de abejas natural rica en ésteres y fitoquímicos beneficiosos para la salud</li>
  <li><strong>Origen certificado</strong>: colmenas en zonas de montaña, libres de pesticidas y contaminación</li>
  <li><strong>Polifenoles y flavonoides</strong>: propiedades antimicrobianas, antiinflamatorias y antioxidantes comprobadas</li>
  <li><strong>Cristalización natural</strong>: señal de pureza — calienta levemente al baño María para volver líquida sin perder propiedades</li>
  <li><strong>Índice glucémico bajo</strong>: comparado con el azúcar refinada gracias a la fructosa natural presente</li>
</ul>
<p>Tarro de vidrio hermético 500 g. Ideal para endulzar infusiones, yogur, tostadas y como sustituto del azúcar en repostería saludable.</p>',
        14.99,
        'Infusiones',
        90,
        '/storage/products/seed-emerald-honey-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-emerald-honey-1.jpg'),
    ('/storage/products/seed-emerald-honey-2.jpg'),
    ('/storage/products/seed-emerald-matcha-2.jpg')
) AS imgs(img);
