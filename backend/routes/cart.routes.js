// routes/cart.routes.js - Shopping cart routes
const express = require('express');
const router = express.Router();

const { statements } = require('../database');
const { authenticateToken } = require('../middleware/auth');

/**
 * Helper: resolve effective stock and price for a product/variant pair
 */
const resolveStockAndPrice = async (product, variantId) => {
    if (!variantId) return { stock: product.stock, price: product.price, variant: null };
    const variant = await statements.getVariantById(variantId);
    // Coerce to Number — Supabase may return string IDs vs numeric IDs
    if (!variant || Number(variant.product_id) !== Number(product.id) || !variant.is_active) return null;
    return {
        stock: variant.stock,
        price: (variant.price_override != null) ? variant.price_override : product.price,
        variant
    };
};

/**
 * GET /api/cart
 * Get current user's cart
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const cart = await statements.getCartByUserId(req.user.id);
        res.json(cart);
    } catch (error) {
        console.error('Error obteniendo carrito:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * POST /api/cart
 * Add item to cart (optional variantId for variant products)
 */
router.post('/', authenticateToken, async (req, res) => {
    const productId = Number.parseInt(req.body?.productId, 10);
    const quantity = Number.parseInt(req.body?.quantity, 10);
    const variantId = req.body?.variantId ? Number.parseInt(req.body.variantId, 10) : null;

    if (!Number.isFinite(productId) || !Number.isFinite(quantity) || quantity <= 0) {
        return res.status(400).json({ message: 'ID de producto o cantidad inválida.' });
    }

    try {
        const product = await statements.getProductById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }

        // Enforce variant selection on variant-enabled products
        if (product.has_variants && !variantId) {
            return res.status(400).json({ message: 'Debe seleccionar una variante para este producto.' });
        }

        // Resolve stock source (variant or product)
        const resolved = await resolveStockAndPrice(product, variantId);
        if (!resolved) {
            return res.status(400).json({ message: 'Variante no válida o inactiva.' });
        }
        const { stock } = resolved;

        if (stock <= 0) {
            return res.status(400).json({ message: `Producto "${product.name}" está agotado.` });
        }

        const existingItem = await statements.getCartItem(req.user.id, productId, variantId);

        if (existingItem) {
            const newQuantity = existingItem.quantity + quantity;
            if (newQuantity > stock) {
                return res.status(400).json({
                    message: `No hay suficiente stock para ${product.name}. Stock disponible: ${stock}, en carrito ya tiene: ${existingItem.quantity}`,
                    availableStock: stock,
                    currentCartQuantity: existingItem.quantity
                });
            }
            await statements.updateCartItem(newQuantity, req.user.id, productId, variantId);
        } else {
            if (quantity > stock) {
                return res.status(400).json({
                    message: `No hay suficiente stock para ${product.name}. Stock disponible: ${stock}`,
                    availableStock: stock
                });
            }
            await statements.addToCart(req.user.id, productId, quantity, variantId);
        }

        const cart = await statements.getCartByUserId(req.user.id);
        console.log('Carrito actualizado para usuario', req.user.id, ':', cart);
        res.status(201).json(cart);
    } catch (error) {
        console.error('Error agregando al carrito:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * PUT /api/cart/:productId
 * Update cart item quantity (variantId in body for variant items)
 */
router.put('/:productId', authenticateToken, async (req, res) => {
    const productId = parseInt(req.params.productId, 10);
    const quantity = Number.parseInt(req.body?.quantity, 10);
    const variantId = req.body?.variantId ? Number.parseInt(req.body.variantId, 10) : null;

    if (!Number.isFinite(productId) || !Number.isFinite(quantity) || quantity < 0) {
        return res.status(400).json({ message: 'Cantidad inválida.' });
    }

    try {
        if (quantity === 0) {
            await statements.removeFromCart(req.user.id, productId, variantId);
        } else {
            const product = await statements.getProductById(productId);
            if (!product) {
                return res.status(404).json({ message: 'Producto no encontrado' });
            }
            const resolved = await resolveStockAndPrice(product, variantId);
            if (!resolved) {
                return res.status(400).json({ message: 'Variante no válida o inactiva.' });
            }
            if (quantity > resolved.stock) {
                return res.status(400).json({
                    message: `No hay suficiente stock para ${product.name}. Stock disponible: ${resolved.stock}`,
                    availableStock: resolved.stock
                });
            }
            await statements.updateCartItem(quantity, req.user.id, productId, variantId);
        }

        const cart = await statements.getCartByUserId(req.user.id);
        res.json(cart);
    } catch (error) {
        console.error('Error actualizando carrito:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * DELETE /api/cart/:productId
 * Remove item from cart (variantId via query param for variant items)
 */
router.delete('/:productId', authenticateToken, async (req, res) => {
    const productId = parseInt(req.params.productId, 10);
    const variantId = req.query.variantId ? parseInt(req.query.variantId, 10) : null;
    try {
        await statements.removeFromCart(req.user.id, productId, variantId);

        const cart = await statements.getCartByUserId(req.user.id);
        console.log('Item eliminado del carrito del usuario', req.user.id, ':', cart);
        res.json(cart);
    } catch (error) {
        console.error('Error eliminando del carrito:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * DELETE /api/cart
 * Clear entire cart
 */
router.delete('/', authenticateToken, async (req, res) => {
    try {
        await statements.clearCart(req.user.id);
        res.json({ message: 'Carrito vaciado exitosamente', cart: [] });
    } catch (error) {
        console.error('Error vaciando carrito:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

module.exports = router;
