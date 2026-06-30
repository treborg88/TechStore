// routes/products.routes.js - Product management routes
const express = require('express');
const multer = require('multer');
const router = express.Router();

const { statements, withTransaction } = require('../database');
const { deleteUploadedFile } = require('../database');
const { authenticateToken, optionalAuth, requireAdmin } = require('../middleware/auth');
const { productImagesUpload, singleImageUpload } = require('../middleware/upload');
const { checkLimit } = require('../middleware/planLimits');
const { normalizeProductUnitType } = require('../utils/productUnits');

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
router.get('/', optionalAuth, async (req, res) => {
    const categoryFilter = req.query.category;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const sort = req.query.sort || '';
    const isAdmin = req.user?.role === 'admin';

    try {
        const { data: products, total } = await statements.getProductsPaginated(
            page, 
            limit, 
            search, 
            categoryFilter && categoryFilter.toLowerCase() !== 'todos' ? categoryFilter : 'all',
            sort,
            isAdmin
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
router.get('/:id', optionalAuth, async (req, res) => {
    const productId = parseInt(req.params.id, 10);
    const isAdmin = req.user?.role === 'admin';
    try {
        const product = await statements.getProductById(productId, isAdmin);

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
                try {
                    variants = await statements.getVariantsByProduct(productId);
                } catch (err) {
                    if (err.code === '42P01') { console.warn('Variant tables not found — run migration'); variants = []; }
                    else throw err;
                }
                try {
                    attributeTypes = await statements.getAttributeTypes();
                } catch (err) {
                    if (err.code === '42P01') { attributeTypes = []; }
                    else throw err;
                }
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
router.post('/', authenticateToken, requireAdmin, checkLimit('products'), productImagesUpload, async (req, res) => {
    try {
        const { name, description, price, category, stock, unitType } = req.body;
        const imageUrls = parseImageUrls(req.body.imageUrls);

        if (!name || !price || !category || stock === undefined) {
            return res.status(400).json({ message: 'Faltan campos requeridos (nombre, precio, categoría, stock).' });
        }
        if ((!req.files || req.files.length === 0) && imageUrls.length === 0) {
            return res.status(400).json({ message: 'Se requiere al menos una imagen (archivo o URL).' });
        }

        // 1. Upload files to disk first — no DB row exists yet, so a failure here
        //    leaves nothing to clean up in the database.
        const uploadedPaths = [];
        for (const file of req.files) {
            const publicUrl = await statements.uploadImage(file);
            uploadedPaths.push(publicUrl);
        }

        // 2. Wrap all DB writes in a transaction. If any insert fails, the product
        //    row and all image rows are rolled back, then uploaded files are removed.
        let productId;
        try {
            const result = await withTransaction(async () => {
                const r = await statements.createProduct(
                    name,
                    description || '',
                    parseFloat(price),
                    category,
                    parseInt(stock, 10),
                    normalizeProductUnitType(unitType)
                );
                const id = r.lastInsertRowid;
                for (const publicUrl of uploadedPaths) {
                    await statements.addProductImage(id, publicUrl);
                }
                for (const imageUrl of imageUrls) {
                    await statements.addProductImage(id, imageUrl);
                }
                return r;
            });
            productId = result.lastInsertRowid;
        } catch (txErr) {
            // DB transaction failed — delete any files that were already uploaded
            uploadedPaths.forEach((p) => deleteUploadedFile(p));
            throw txErr;
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
        // Collect image paths before deletion (they're gone from DB after deleteProduct)
        const images = await statements.getProductImages(productId);

        // Delete DB row first — ON DELETE CASCADE removes product_images rows atomically.
        // If this fails, no files are touched and the product remains intact.
        await statements.deleteProduct(productId);

        // DB is consistent now; clean up orphaned filesystem files (best-effort)
        images.forEach((img) => deleteUploadedFile(img.image_path));

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

        // Add images to storage
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
 * Accepts both JSON (single image_url) and FormData (file uploads + imageUrls)
 *
 * JSON body: { sku?, price?, stock?, image_url?, description?, attributes: [{ type, value, color_hex? }] }
 * FormData:  sku, price, stock, image_url?, description, attributes (JSON string),
 *            imageUrls (JSON string array), + files under key "images"
 */
router.post('/:id/variants', authenticateToken, requireAdmin, productImagesUpload, async (req, res) => {
    const productId = parseInt(req.params.id, 10);
    try {
        const product = await statements.getProductById(productId);
        if (!product) return res.status(404).json({ message: 'Producto no encontrado' });

        const isMultipart = req.is('multipart/form-data');

        let sku, price, stock, image_url, description, attributes, imageUrls;

        if (isMultipart) {
            // FormData mode — fields come from req.body, files from req.files
            sku = req.body.sku;
            price = req.body.price;
            stock = req.body.stock;
            image_url = req.body.image_url || null;
            description = req.body.description || null;
            try {
                attributes = JSON.parse(req.body.attributes || '[]');
            } catch {
                attributes = [];
            }
            try {
                imageUrls = JSON.parse(req.body.imageUrls || '[]');
            } catch {
                imageUrls = [];
            }
        } else {
            // JSON mode
            sku = req.body.sku;
            price = req.body.price;
            stock = req.body.stock;
            image_url = req.body.image_url;
            description = req.body.description;
            attributes = req.body.attributes;
        }

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
            price: price !== undefined && price !== '' ? parseFloat(price) : null,
            stock: parseInt(stock, 10) || 0,
            image_url,
            description,
            attributes
        });

        // Handle uploaded files (FormData)
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const publicUrl = await statements.uploadImage(file);
                await statements.createVariantImage(variant.id, publicUrl);
            }
        }

        // Handle image URLs
        if (imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0) {
            const validUrls = parseImageUrls(imageUrls);
            for (const url of validUrls) {
                await statements.createVariantImage(variant.id, url);
            }
        }

        // Reload variant with images
        const fullVariant = await statements.getVariantById(variant.id);
        res.status(201).json(fullVariant);
    } catch (error) {
        console.error('Error creando variante:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * PUT /api/products/:id/variants/:variantId
 * Update an existing variant (admin only)
 * Body: { sku?, price?, stock?, image_url?, description?, is_active?, attributes?: [{ type, value, color_hex? }] }
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

        const { sku, price, stock, image_url, description, is_active, attributes } = req.body;

        const updated = await statements.updateVariant(variantId, {
            sku,
            price: price !== undefined ? parseFloat(price) : undefined,
            stock: stock !== undefined ? parseInt(stock, 10) : undefined,
            image_url,
            description,
            is_active,
            attributes
        });

        // Reload variant with images
        const fullVariant = await statements.getVariantById(variantId);
        res.json(fullVariant);
    } catch (error) {
        console.error('Error actualizando variante:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * DELETE /api/products/:id/variants/:variantId
 * Delete a variant (admin only) — cascade deletes attributes + images
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


// ── Variant Images ────────────────────────────────────────────────────────────

/**
 * POST /api/products/:id/variants/:variantId/images
 * Upload images to a variant (admin only)
 */
router.post('/:id/variants/:variantId/images', authenticateToken, requireAdmin, productImagesUpload, async (req, res) => {
    const variantId = parseInt(req.params.variantId, 10);
    try {
        const variant = await statements.getVariantById(variantId);
        if (!variant) return res.status(404).json({ message: 'Variante no encontrada' });

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No se recibió ningún archivo de imagen.' });
        }

        for (const file of req.files) {
            const publicUrl = await statements.uploadImage(file);
            await statements.createVariantImage(variantId, publicUrl);
        }

        const images = await statements.getVariantImages(variantId);
        res.status(201).json(images);
    } catch (error) {
        console.error('Error agregando imágenes a variante:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * POST /api/products/:id/variants/:variantId/images/links
 * Add image URLs to a variant (admin only)
 * Body: { imageUrls: string[] }
 */
router.post('/:id/variants/:variantId/images/links', authenticateToken, requireAdmin, async (req, res) => {
    const variantId = parseInt(req.params.variantId, 10);
    try {
        const variant = await statements.getVariantById(variantId);
        if (!variant) return res.status(404).json({ message: 'Variante no encontrada' });

        const imageUrls = parseImageUrls(req.body.imageUrls);
        if (imageUrls.length === 0) {
            return res.status(400).json({ message: 'No se recibió ninguna URL válida de imagen.' });
        }

        for (const imageUrl of imageUrls) {
            await statements.createVariantImage(variantId, imageUrl);
        }

        const images = await statements.getVariantImages(variantId);
        res.status(201).json(images);
    } catch (error) {
        console.error('Error agregando URLs de imágenes a variante:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * DELETE /api/products/:id/variants/:variantId/images/:imageId
 * Delete a variant image (admin only)
 */
router.delete('/:id/variants/:variantId/images/:imageId', authenticateToken, requireAdmin, async (req, res) => {
    const variantId = parseInt(req.params.variantId, 10);
    const imageId = parseInt(req.params.imageId, 10);
    try {
        const variant = await statements.getVariantById(variantId);
        if (!variant) return res.status(404).json({ message: 'Variante no encontrada' });

        await statements.deleteVariantImage(imageId);

        const images = await statements.getVariantImages(variantId);
        res.json({ message: 'Imagen eliminada exitosamente', images });
    } catch (error) {
        console.error('Error eliminando imagen de variante:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

module.exports = router;
