// routes/products.routes.js - Product management routes
const express = require('express');
const multer = require('multer');
const router = express.Router();

const { statements } = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { productImagesUpload, singleImageUpload } = require('../middleware/upload');

const VALID_PRODUCT_UNIT_TYPES = ['unidad', 'paquete', 'caja', 'docena', 'lb', 'kg', 'g', 'l', 'ml', 'm'];

const normalizeProductUnitType = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return VALID_PRODUCT_UNIT_TYPES.includes(normalized) ? normalized : 'unidad';
};

const parseImageUrls = (raw) => {
    if (!raw) return [];

    let candidates = [];

    if (Array.isArray(raw)) {
        candidates = raw;
    } else if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (!trimmed) return [];

        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                candidates = parsed;
            } else {
                candidates = [trimmed];
            }
        } catch {
            candidates = [trimmed];
        }
    } else {
        candidates = [raw];
    }

    return candidates
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .filter((value) => /^https?:\/\//i.test(value));
};

/**
 * GET /api/products/attribute-types
 * List available attribute types (public — used by variant selector UI)
 * MUST be defined before /:id to avoid Express param collision
 */
router.get('/attribute-types', async (_req, res) => {
    try {
        const types = await statements.getAttributeTypes();
        res.json(types);
    } catch (error) {
        console.error('Error obteniendo tipos de atributo:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * GET /api/products
 * Get paginated products with optional filters
 */
router.get('/', async (req, res) => {
    const categoryFilter = req.query.category;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const sort = req.query.sort || '';

    try {
        const { data: products, total } = await statements.getProductsPaginated(
            page, 
            limit, 
            search, 
            categoryFilter && categoryFilter.toLowerCase() !== 'todos' ? categoryFilter : 'all',
            sort
        );

        // Add images to each product and migrate legacy images
        const productsWithImages = await Promise.all(products.map(async (product) => {
            let images = await statements.getProductImages(product.id);
            
            // Migrate legacy image to product_images table if needed
            if (images.length === 0 && product.image) {
                await statements.addProductImage(product.id, product.image);
                images = await statements.getProductImages(product.id);
            }
            
            return { 
                ...product, 
                unit_type: normalizeProductUnitType(product.unit_type),
                images,
                image: images.length > 0 ? images[0].image_path : product.image
            };
        }));

        res.json({
            data: productsWithImages,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Error obteniendo productos:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * GET /api/products/:id
 * Get single product by ID
 */
router.get('/:id', async (req, res) => {
    const productId = parseInt(req.params.id, 10);
    try {
        const product = await statements.getProductById(productId);

        if (product) {
            let images = await statements.getProductImages(productId);
            
            // Migrate legacy image to product_images table if needed
            if (images.length === 0 && product.image) {
                await statements.addProductImage(productId, product.image);
                images = await statements.getProductImages(productId);
            }

            // Include variants + attribute types if product uses variant-level stock/pricing
            let variants = [];
            let attributeTypes = [];
            if (product.has_variants) {
                variants = await statements.getVariantsByProduct(productId);
                attributeTypes = await statements.getAttributeTypes();
            }
            
            res.json({ 
                ...product, 
                unit_type: normalizeProductUnitType(product.unit_type),
                images,
                image: images.length > 0 ? images[0].image_path : product.image,
                variants,
                attributeTypes
            });
        } else {
            res.status(404).json({ message: 'Producto no encontrado' });
        }
    } catch (error) {
        console.error('Error obteniendo producto:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * POST /api/products
 * Create new product (admin only)
 */
router.post('/', authenticateToken, requireAdmin, productImagesUpload, async (req, res) => {
    try {
        const { name, description, price, category, stock, unitType } = req.body;
        const imageUrls = parseImageUrls(req.body.imageUrls);

        if (!name || !price || !category || stock === undefined) {
            return res.status(400).json({ message: 'Faltan campos requeridos (nombre, precio, categoría, stock).' });
        }
        if ((!req.files || req.files.length === 0) && imageUrls.length === 0) {
            return res.status(400).json({ message: 'Se requiere al menos una imagen (archivo o URL).' });
        }

        const result = await statements.createProduct(
            name,
            description || '',
            parseFloat(price),
            category,
            parseInt(stock, 10),
            normalizeProductUnitType(unitType)
        );

        const productId = result.lastInsertRowid;

        // Add images to Supabase Storage
        for (const file of req.files) {
            const publicUrl = await statements.uploadImage(file);
            await statements.addProductImage(productId, publicUrl);
        }

        // Add image URLs provided from admin form
        for (const imageUrl of imageUrls) {
            await statements.addProductImage(productId, imageUrl);
        }

        const newProduct = await statements.getProductById(productId);
        const images = await statements.getProductImages(productId);

        const productWithImage = {
            ...newProduct,
            unit_type: normalizeProductUnitType(newProduct.unit_type),
            images,
            image: images.length > 0 ? images[0].image_path : newProduct.image
        };

        console.log('Producto guardado correctamente:', productWithImage);
        res.status(201).json(productWithImage);

    } catch (err) {
        console.error('Error al guardar producto:', err);
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ message: `Error de Multer: ${err.message}` });
        } else if (err.message === '¡Solo se permiten archivos de imagen!') {
            return res.status(400).json({ message: err.message });
        }
        res.status(500).json({ message: 'Error interno del servidor al guardar el producto.' });
    }
});

/**
 * PUT /api/products/:id
 * Update product (admin only)
 */
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    const productId = parseInt(req.params.id, 10);
    const updatedData = req.body;
    
    try {
        const existingProduct = await statements.getProductById(productId);

        if (!existingProduct) {
            return res.status(404).json({ message: 'Producto no encontrado para actualizar' });
        }

        await statements.updateProduct(
            updatedData.name || existingProduct.name,
            updatedData.description !== undefined ? updatedData.description : existingProduct.description,
            updatedData.price !== undefined ? parseFloat(updatedData.price) : existingProduct.price,
            updatedData.category || existingProduct.category,
            updatedData.stock !== undefined ? parseInt(updatedData.stock, 10) : existingProduct.stock,
            productId,
            updatedData.unitType !== undefined
                ? normalizeProductUnitType(updatedData.unitType)
                : existingProduct.unit_type,
            updatedData.isHidden !== undefined ? updatedData.isHidden : existingProduct.is_hidden
        );

        const updatedProduct = await statements.getProductById(productId);
        const images = await statements.getProductImages(productId);

        const productWithImage = {
            ...updatedProduct,
            unit_type: normalizeProductUnitType(updatedProduct.unit_type),
            images,
            image: images.length > 0 ? images[0].image_path : updatedProduct.image
        };

        console.log('Producto actualizado:', productWithImage);
        res.json(productWithImage);
    } catch (error) {
        console.error('Error actualizando producto:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * DELETE /api/products/:id
 * Delete product (admin only)
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    const productId = parseInt(req.params.id, 10);
    
    try {
        // Delete all images first
        await statements.deleteAllProductImages(productId);
        await statements.deleteProduct(productId);

        res.json({ message: 'Producto eliminado exitosamente' });
    } catch (error) {
        console.error('Error eliminando producto:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * POST /api/products/:id/images
 * Add images to product (admin only)
 */
router.post('/:id/images', authenticateToken, requireAdmin, productImagesUpload, async (req, res) => {
    const productId = parseInt(req.params.id, 10);
    
    try {
        const product = await statements.getProductById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No se recibió ningún archivo de imagen.' });
        }

        // Add images to Supabase Storage
        for (const file of req.files) {
            const publicUrl = await statements.uploadImage(file);
            await statements.addProductImage(productId, publicUrl);
        }

        const images = await statements.getProductImages(productId);
        res.status(201).json(images);
    } catch (err) {
        console.error('Error agregando imágenes:', err);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * POST /api/products/:id/images/links
 * Add image URLs to product (admin only)
 * Body: { imageUrls: string[] }
 */
router.post('/:id/images/links', authenticateToken, requireAdmin, async (req, res) => {
    const productId = parseInt(req.params.id, 10);

    try {
        const product = await statements.getProductById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }

        const imageUrls = parseImageUrls(req.body.imageUrls);
        if (imageUrls.length === 0) {
            return res.status(400).json({ message: 'No se recibió ninguna URL válida de imagen.' });
        }

        for (const imageUrl of imageUrls) {
            await statements.addProductImage(productId, imageUrl);
        }

        const images = await statements.getProductImages(productId);
        res.status(201).json(images);
    } catch (error) {
        console.error('Error agregando URLs de imágenes:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * DELETE /api/products/:id/images/:imageId
 * Delete product image (admin only)
 */
router.delete('/:id/images/:imageId', authenticateToken, requireAdmin, async (req, res) => {
    const productId = parseInt(req.params.id, 10);
    const imageId = parseInt(req.params.imageId, 10);
    
    try {
        const product = await statements.getProductById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }

        await statements.deleteProductImage(imageId, productId);

        const images = await statements.getProductImages(productId);
        res.json({ message: 'Imagen eliminada exitosamente', images });
    } catch (error) {
        console.error('Error eliminando imagen:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});


// ── Product Variants ───────────────────────────────────────────────────────

/**
 * POST /api/products/:id/variants/upload-image
 * Upload a single image for a variant (admin only)
 * Returns { image_url } with the public URL of the uploaded image
 */
router.post('/:id/variants/upload-image', authenticateToken, requireAdmin, singleImageUpload, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No se recibió ningún archivo de imagen.' });
        }
        const publicUrl = await statements.uploadImage(req.file);
        res.json({ image_url: publicUrl });
    } catch (error) {
        console.error('Error subiendo imagen de variante:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * GET /api/products/:id/variants
 * List all variants for a product (public)
 */
router.get('/:id/variants', async (req, res) => {
    const productId = parseInt(req.params.id, 10);
    try {
        const product = await statements.getProductById(productId);
        if (!product) return res.status(404).json({ message: 'Producto no encontrado' });

        const variants = await statements.getVariantsByProduct(productId);
        // Also return available attribute types for the selector UI
        const attributeTypes = await statements.getAttributeTypes();
        res.json({ variants, attributeTypes });
    } catch (error) {
        console.error('Error obteniendo variantes:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * POST /api/products/:id/variants
 * Create a new variant for a product (admin only)
 * Body: { sku?, price?, stock, image_url?, attributes: [{ type, value }] }
 */
router.post('/:id/variants', authenticateToken, requireAdmin, async (req, res) => {
    const productId = parseInt(req.params.id, 10);
    try {
        const product = await statements.getProductById(productId);
        if (!product) return res.status(404).json({ message: 'Producto no encontrado' });

        const { sku, price, stock, image_url, attributes } = req.body;

        // Validate: at least one attribute required
        if (!attributes || !Array.isArray(attributes) || attributes.length === 0) {
            return res.status(400).json({ message: 'Se requiere al menos un atributo (ej. Color, Talla).' });
        }

        // Validate each attribute has type and value
        for (const attr of attributes) {
            if (!attr.type || !attr.value) {
                return res.status(400).json({ message: 'Cada atributo requiere type y value.' });
            }
        }

        const variant = await statements.createVariant(productId, {
            sku,
            price: price !== undefined ? parseFloat(price) : null,
            stock: parseInt(stock, 10) || 0,
            image_url,
            attributes
        });

        res.status(201).json(variant);
    } catch (error) {
        console.error('Error creando variante:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * PUT /api/products/:id/variants/:variantId
 * Update an existing variant (admin only)
 * Body: { sku?, price?, stock?, image_url?, is_active?, attributes?: [{ type, value }] }
 */
router.put('/:id/variants/:variantId', authenticateToken, requireAdmin, async (req, res) => {
    const productId = parseInt(req.params.id, 10);
    const variantId = parseInt(req.params.variantId, 10);
    try {
        // Verify variant belongs to the product (Number() coercion — DB may return string IDs)
        const variant = await statements.getVariantById(variantId);
        if (!variant || Number(variant.product_id) !== productId) {
            return res.status(404).json({ message: 'Variante no encontrada para este producto' });
        }

        const { sku, price, stock, image_url, is_active, attributes } = req.body;

        const updated = await statements.updateVariant(variantId, {
            sku,
            price: price !== undefined ? parseFloat(price) : undefined,
            stock: stock !== undefined ? parseInt(stock, 10) : undefined,
            image_url,
            is_active,
            attributes
        });

        res.json(updated);
    } catch (error) {
        console.error('Error actualizando variante:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * DELETE /api/products/:id/variants/:variantId
 * Delete a variant (admin only) — cascade deletes attributes
 */
router.delete('/:id/variants/:variantId', authenticateToken, requireAdmin, async (req, res) => {
    const productId = parseInt(req.params.id, 10);
    const variantId = parseInt(req.params.variantId, 10);
    try {
        // Verify variant belongs to the product (Number() coercion — DB may return string IDs)
        const variant = await statements.getVariantById(variantId);
        if (!variant || Number(variant.product_id) !== productId) {
            return res.status(404).json({ message: 'Variante no encontrada para este producto' });
        }

        await statements.deleteVariant(variantId);
        res.json({ message: 'Variante eliminada exitosamente' });
    } catch (error) {
        console.error('Error eliminando variante:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

module.exports = router;
