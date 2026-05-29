-- =============================================================================
-- Eonsclover — Demo Seed Data: Rosa (Belleza & Flores)
-- =============================================================================
-- Run AFTER seed.sql to populate a polished feminine beauty/floristry store.
-- Creates: 10 beauty & flowers products with gallery images, promo text, and
-- refined hero / category settings themed around beauty and romance.
-- NOTE: This file always runs in the tenant schema context (search_path already set).
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. HERO & PROMO SETTINGS
-- ---------------------------------------------------------------------------
UPDATE app_settings SET value = 'Belleza, Flores y Estilo para Ti'
WHERE id = 'heroTitle';

UPDATE app_settings SET value = 'Descubre nuestra colección de arreglos florales, cosméticos de lujo y accesorios pensados para cada momento especial en tu vida.'
WHERE id = 'heroDescription';

UPDATE app_settings SET value = 'Ver Colección'
WHERE id = 'heroPrimaryBtn';

UPDATE app_settings SET value = 'Regalos Especiales'
WHERE id = 'heroSecondaryBtn';

-- Hero background (romantic floral)
UPDATE app_settings SET value = '/storage/products/seed-rosa-hero-bg.jpg'
WHERE id = 'heroImage';

-- Lighter overlay — floral backgrounds work best with less darkness
UPDATE app_settings SET value = '0.35'
WHERE id = 'heroOverlayOpacity';

UPDATE app_settings SET value = '420'
WHERE id = 'heroHeight';

-- Banner overlay image (makeup/beauty product floating right)
UPDATE app_settings SET value = '/storage/products/seed-rosa-banner.jpg'
WHERE id = 'heroBannerImage';

UPDATE app_settings SET value = '260'
WHERE id = 'heroBannerSize';

UPDATE app_settings SET value = 'right'
WHERE id = 'heroBannerPositionX';

UPDATE app_settings SET value = 'center'
WHERE id = 'heroBannerPositionY';

UPDATE app_settings SET value = '100'
WHERE id = 'heroBannerOpacity';

-- Category filters — override tech defaults with feminine categories
UPDATE app_settings SET value = '{"useDefault":false,"categories":[{"id":"todos","name":"Todos","icon":"🌺","slug":"todos","image":""},{"id":"flores","name":"Flores","icon":"🌹","slug":"Flores","image":""},{"id":"maquillaje","name":"Maquillaje","icon":"💄","slug":"Maquillaje","image":""},{"id":"cuidado-piel","name":"Cuidado de Piel","icon":"✨","slug":"Cuidado de Piel","image":""},{"id":"perfumes","name":"Perfumes","icon":"🌸","slug":"Perfumes","image":""},{"id":"accesorios","name":"Accesorios","icon":"👜","slug":"Accesorios","image":""}],"styles":{}}'
WHERE id = 'categoryFiltersConfig';

-- Promo section
INSERT INTO app_settings (id, value) VALUES
    ('promoText',  '🌸 ¡Oferta del Mes! Compra cualquier arreglo floral y recibe un 15% de descuento en cosméticos seleccionados.'),
    ('promoImage', '/storage/products/seed-rosa-promo.jpg')
ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value;


-- ---------------------------------------------------------------------------
-- 2. SAMPLE PRODUCTS — beauty & flowers store
-- ---------------------------------------------------------------------------

-- ── Flores ───────────────────────────────────────────────────────────────────

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Arreglo de Rosas Rojas Premium 24 Tallos',
        '<p>El regalo más clásico y romántico: <strong>24 rosas rojas de tallo largo</strong> seleccionadas de los mejores cultivos de Ecuador. Cada rosa es elegida por su tamaño, color y frescura excepcionales.</p>
<ul>
  <li><strong>24 rosas ecuatorianas</strong>: tallos de 60 cm, pétalos aterciopelados, aroma intenso y natural</li>
  <li><strong>Entrega el mismo día</strong>: disponible en pedidos realizados antes de las 2:00 PM</li>
  <li><strong>Presentación de lujo</strong>: caja negra con lazo satinado y papel kraft personalizable</li>
  <li><strong>Tarjeta dedicatoria</strong>: incluida sin costo adicional, personalizable con tu mensaje</li>
  <li><strong>Frescura garantizada</strong>: nuestras rosas duran hasta 7 días con el cuidado adecuado</li>
  <li><strong>Vaso conservador incluido</strong>: para prolongar la vida de las flores al llegar a destino</li>
</ul>
<p>Ideal para San Valentín, aniversarios, cumpleaños o simplemente para decir "te quiero". También disponible en rosas blancas, rosadas y champagne.</p>',
        89.99,
        'Flores',
        20,
        '/storage/products/seed-rosa-roses-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-rosa-roses-1.jpg'),
    ('/storage/products/seed-rosa-roses-2.jpg'),
    ('/storage/products/seed-rosa-roses-3.jpg')
) AS imgs(img);

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Caja Floral Sorpresa "Te Quiero"',
        '<p>Una <strong>caja de flores sorpresa</strong> diseñada con amor para sorprender a alguien especial. Combina flores frescas de temporada con detalles únicos para una presentación que corta el aliento.</p>
<ul>
  <li><strong>Mix de flores frescas</strong>: rosas, peonías, alstroemerias y follaje verde de temporada</li>
  <li><strong>Caja de cartón rígido</strong>: con tapa sorpresa y diseño exclusivo en tonos pastel</li>
  <li><strong>Chocolates Ferrero Rocher</strong>: 4 unidades incluidas para endulzar el momento</li>
  <li><strong>Peluche de corazón</strong>: pequeño peluche de 10 cm incluido como detalle especial</li>
  <li><strong>Tarjeta personalizada</strong>: tu mensaje impreso en cartulina premium con sobre</li>
  <li><strong>Lazo de organza</strong>: acabado elegante con cinta en tono coral o nude</li>
</ul>
<p>Perfecta para cumpleaños, aniversarios o para alegrar el día de alguien sin una razón especial. El tamaño mediano incluye aprox. 15 flores. Disponible también en tamaño grande (25 flores).</p>',
        54.99,
        'Flores',
        15,
        '/storage/products/seed-rosa-flowerbox-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-rosa-flowerbox-1.jpg'),
    ('/storage/products/seed-rosa-flowerbox-2.jpg'),
    ('/storage/products/seed-rosa-roses-2.jpg')
) AS imgs(img);

-- ── Maquillaje ────────────────────────────────────────────────────────────────

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Set de Labiales Nude Mate 6 Colores',
        '<p>La colección de labiales más versátil para el día a día. <strong>6 tonos nude y tierra</strong> cuidadosamente seleccionados para complementar cualquier tono de piel y cualquier look.</p>
<ul>
  <li><strong>6 tonos exclusivos</strong>: desde el nude rosado hasta el terra cotta profundo — uno para cada ocasión</li>
  <li><strong>Fórmula mate de larga duración</strong>: hasta 10 horas sin retoque, sin resecar los labios</li>
  <li><strong>Enriquecido con vitamina E</strong>: hidrata y protege mientras luce impecable</li>
  <li><strong>Acabado mate aterciopelado</strong>: cobertura completa en una sola pasada</li>
  <li><strong>Apto para veganas</strong>: libre de crueldad animal, sin parabenos ni fragancias</li>
  <li><strong>Set de regalo listo</strong>: presentación en caja magnética reutilizable</li>
</ul>
<p>Colores incluidos: Barely There (nude claro), Chai Latte, Dusty Rose, Brick Lane, Terracotta Sunset y Mauve Dreams. Peso neto: 3.2 g cada uno.</p>',
        39.99,
        'Maquillaje',
        35,
        '/storage/products/seed-rosa-lipstick-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-rosa-lipstick-1.jpg'),
    ('/storage/products/seed-rosa-makeup-2.jpg'),
    ('/storage/products/seed-rosa-makeup-1.jpg')
) AS imgs(img);

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Paleta de Sombras "Rose Gold" 18 Tonos',
        '<p>Una paleta que lo tiene todo: <strong>18 sombras en tonos rosa, dorado y bronce</strong> con texturas variadas para crear desde el look más natural hasta el más dramático y glamuroso.</p>
<ul>
  <li><strong>18 tonos curados</strong>: matte, shimmer, glitter y foil — toda la versatilidad en una paleta</li>
  <li><strong>Pigmentación intensa</strong>: altamente pigmentadas desde la primera aplicación, con excelente difuminado</li>
  <li><strong>Larga duración</strong>: fórmula "stay-put" que resiste el calor, la humedad y la fricción</li>
  <li><strong>Espejo integrado</strong>: tamaño completo para aplicación en cualquier lugar</li>
  <li><strong>Sin gluten ni crueldad</strong>: fórmula vegana y certificada cruelty-free por PETA</li>
  <li><strong>Pincel doble incluido</strong>: para aplicar y difuminar con precisión profesional</li>
</ul>
<p>Dimensiones: 22 × 14 × 1.5 cm. Compatible con cualquier base de maquillaje. La paleta ideal tanto para principiantes como para maquillistas profesionales.</p>',
        49.99,
        'Maquillaje',
        28,
        '/storage/products/seed-rosa-makeup-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-rosa-makeup-1.jpg'),
    ('/storage/products/seed-rosa-makeup-2.jpg'),
    ('/storage/products/seed-rosa-banner.jpg')
) AS imgs(img);

-- ── Cuidado de Piel ───────────────────────────────────────────────────────────

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Sérum Vitamina C Iluminador Anti-Manchas 30ml',
        '<p>El sérum que transforma la piel en semanas. Con una concentración del <strong>20% de Vitamina C estabilizada</strong>, borra manchas, unifica el tono y devuelve el brillo natural de la piel.</p>
<ul>
  <li><strong>Vitamina C al 20%</strong>: la concentración más efectiva para resultados visibles desde la primera semana</li>
  <li><strong>Ácido hialurónico triple</strong>: hidratación en las 3 capas de la piel para efecto plumping duradero</li>
  <li><strong>Niacinamida al 5%</strong>: reduce manchas, minimiza poros y controla el exceso de sebo</li>
  <li><strong>Vitamina E y ferúlico</strong>: potencian la acción de la vitamina C y estabilizan la fórmula</li>
  <li><strong>Resultados en 4 semanas</strong>: tono más uniforme, manchas reducidas, piel más luminosa</li>
  <li><strong>Para todo tipo de piel</strong>: sin alcohol, sin fragancias, apto para piel sensible</li>
</ul>
<p>Modo de uso: aplicar 3-4 gotas sobre el rostro limpio y seco por la mañana, antes del protector solar. 30 ml / 1 oz. No testeado en animales.</p>',
        45.99,
        'Cuidado de Piel',
        40,
        '/storage/products/seed-rosa-serum-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-rosa-serum-1.jpg'),
    ('/storage/products/seed-rosa-serum-2.jpg'),
    ('/storage/products/seed-rosa-cream-1.jpg')
) AS imgs(img);

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Crema Hidratante con Rosa Mosqueta y Retinol',
        '<p>La crema perfecta para combatir los signos de la edad. Con <strong>aceite de rosa mosqueta y retinol encapsulado</strong>, regenera, firma y revitaliza la piel mientras duermes.</p>
<ul>
  <li><strong>Rosa mosqueta chilena al 5%</strong>: rica en ácidos grasos esenciales que regeneran la piel y reducen cicatrices</li>
  <li><strong>Retinol encapsulado 0.3%</strong>: el antienvejecimiento más efectivo en su versión más suave y tolerable</li>
  <li><strong>Ceramidas + escualano</strong>: restauran la barrera cutánea y previenen la pérdida de hidratación</li>
  <li><strong>Aroma a rosas naturales</strong>: fragancia delicada derivada de extracto de pétalos de rosa</li>
  <li><strong>Textura rich cream</strong>: se absorbe rápidamente sin dejar residuo graso</li>
  <li><strong>Uso nocturno</strong>: potencia la regeneración natural mientras descansas</li>
</ul>
<p>Contenido neto: 50 ml. Apta para pieles normales, secas y mixtas. No recomendada durante el embarazo. Sin parabenos, sin sulfatos.</p>',
        29.99,
        'Cuidado de Piel',
        50,
        '/storage/products/seed-rosa-cream-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-rosa-cream-1.jpg'),
    ('/storage/products/seed-rosa-serum-2.jpg'),
    ('/storage/products/seed-rosa-serum-1.jpg')
) AS imgs(img);

-- ── Perfumes ─────────────────────────────────────────────────────────────────

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Eau de Parfum "Bloom" Floral & Amaderado 50ml',
        '<p>Una fragancia que florece con tu calor corporal. <strong>"Bloom" EDP</strong> es una oda a la feminidad moderna: fresca en las notas de salida, cálida y seductora en el corazón y la estela.</p>
<ul>
  <li><strong>Notas de salida</strong>: pera japonesa, bergamota y rosas de mayo — frescura floral y afrutada</li>
  <li><strong>Notas de corazón</strong>: magnolia, jazmín sambac y peonía — el alma romántica de la fragancia</li>
  <li><strong>Notas de fondo</strong>: sándalo, almizcle blanco y ámbar — calidez sensual de larga duración</li>
  <li><strong>Concentración EDP</strong>: 20% de aceites esenciales para una duración de 8-10 horas</li>
  <li><strong>Frasco artesanal</strong>: vidrio facetado con atomizador plateado — diseñado para lucir en tu tocador</li>
  <li><strong>Sin parabenos</strong>: fórmula dermatológicamente probada, apta para piel sensible</li>
</ul>
<p>50 ml / 1.7 fl oz. Ideal para uso diario o para ocasiones especiales. Caja de regalo incluida. Familia olfativa: floral oriental.</p>',
        89.99,
        'Perfumes',
        18,
        '/storage/products/seed-rosa-perfume-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-rosa-perfume-1.jpg'),
    ('/storage/products/seed-rosa-perfume-2.jpg'),
    ('/storage/products/seed-rosa-perfume-3.jpg')
) AS imgs(img);

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Set Miniaturas de Perfume Florales 3 × 30ml',
        '<p>El set perfecto para quienes aman descubrir fragancias o para regalar sin dudar. <strong>Tres EDPs florales exclusivas</strong> en elegantes frascos de 30 ml — perfectas para el bolso o para viaje.</p>
<ul>
  <li><strong>Rose Elixir</strong>: rosa turca + sándalo + almizcle — clásica, elegante e intemporal</li>
  <li><strong>Cherry Blossom</strong>: flor de cerezo + mandarina + vainilla — dulce, joven y primaveral</li>
  <li><strong>Midnight Peony</strong>: peonía + pachulí + ámbar — sofisticada, misteriosa y sensual</li>
  <li><strong>30 ml cada una</strong>: tamaño perfecto para el bolso, viaje o para intercambiar</li>
  <li><strong>Atomizador de alta calidad</strong>: cada frasco cuenta con bomba precisa sin goteos</li>
  <li><strong>Estuche de regalo satinado</strong>: presentadas en estuche rígido con acabado premium</li>
</ul>
<p>Concentración EDP. Duración estimada: 6-8 horas. Apto para regalar en cumpleaños, Navidad, San Valentín o Día de la Madre. Fabricado en Francia.</p>',
        59.99,
        'Perfumes',
        22,
        '/storage/products/seed-rosa-perfumeset-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-rosa-perfumeset-1.jpg'),
    ('/storage/products/seed-rosa-perfume-2.jpg'),
    ('/storage/products/seed-rosa-perfume-1.jpg')
) AS imgs(img);

-- ── Accesorios ────────────────────────────────────────────────────────────────

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Collar Dorado Corazón con Cristales',
        '<p>Un collar delicado y sofisticado que complementa cualquier look. El <strong>colgante de corazón bañado en oro de 18K</strong> con incrustaciones de cristales es el regalo de joyería perfecto.</p>
<ul>
  <li><strong>Baño de oro 18K</strong>: acabado brillante resistente al desgaste, libre de níquel</li>
  <li><strong>Cristales de precisión</strong>: 9 cristales que capturan la luz de forma espectacular</li>
  <li><strong>Cadena ajustable</strong>: longitud 40-45 cm con cierre de langosta — se adapta a cualquier escote</li>
  <li><strong>Material base</strong>: plata de ley 925 con baño de oro — hipoalergénico, duradero</li>
  <li><strong>Caja de joyería incluida</strong>: presentación en estuche de terciopelo negro con lazo</li>
  <li><strong>Garantía de 1 año</strong>: contra decoloración y defectos de fabricación</li>
</ul>
<p>Dimensiones del colgante: 1.5 × 1.5 cm. Ideal como regalo de cumpleaños, aniversario o para completar un look especial. Envío con seguro incluido.</p>',
        24.99,
        'Accesorios',
        45,
        '/storage/products/seed-rosa-necklace-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-rosa-necklace-1.jpg'),
    ('/storage/products/seed-rosa-necklace-2.jpg'),
    ('/storage/products/seed-rosa-necklace-1.jpg')
) AS imgs(img);

WITH p AS (
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (
        'Bolso de Mano Acolchado Rosa Pastel',
        '<p>El bolso que lo combina todo: <strong>diseño acolchado con cadena dorada</strong> en el tono rosa pastel más tendencia de la temporada. Compacto, elegante y funcional para el día a día.</p>
<ul>
  <li><strong>Piel sintética vegana premium</strong>: acolchado en patrón diamond, resistente y fácil de limpiar</li>
  <li><strong>Cadena dorada entrelazada</strong>: cadena de metal con hilo de cuero para llevar al hombro o cruzado</li>
  <li><strong>Interior forrado en satén</strong>: bolsillo interior con cierre y 2 ranuras para tarjetas</li>
  <li><strong>Dimensiones</strong>: 20 × 14 × 6 cm — cabe el teléfono, tarjetero, llave, labial y más</li>
  <li><strong>Cierre de solapa magnético</strong>: apertura rápida y cierre seguro en todo momento</li>
  <li><strong>Bolsa de almacenamiento incluida</strong>: para proteger el bolso cuando no lo usas</li>
</ul>
<p>Disponible en: Rosa Pastel (este), Blanco Marfil, Beige Nude y Lila Vintage. No exponer a lluvia directa. Limpiar con paño suave húmedo.</p>',
        79.99,
        'Accesorios',
        30,
        '/storage/products/seed-rosa-bag-1.jpg'
    )
    RETURNING id
)
INSERT INTO product_images (product_id, image_path)
SELECT id, img FROM p, (VALUES
    ('/storage/products/seed-rosa-bag-1.jpg'),
    ('/storage/products/seed-rosa-bag-2.jpg'),
    ('/storage/products/seed-rosa-bag-3.jpg')
) AS imgs(img);
