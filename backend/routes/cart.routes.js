// routes/cart.routes.js - Shopping cart routes
const express = require('express');
const router = express.Router();

const { statements } = require('../database');
const { authenticateToken } = require('../middleware/auth');

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
 * Add item to cart
 */
router.post('/', authenticateToken, async (req, res) => {
    const productId = Number.parseInt(req.body?.productId, 10);
    const quantity = Number.parseInt(req.body?.quantity, 10);

    if (!Number.isFinite(productId) || !Number.isFinite(quantity) || quantity <= 0) {
        return res.status(400).json({ message: 'ID de producto o cantidad inválida.' });
    }

    try {
        const product = await statements.getProductById(productId);

        if (!product) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }
        if (product.stock <= 0) {
            return res.status(400).json({ message: `Producto "${product.name}" está agotado.` });
        }

        const existingItem = await statements.getCartItem(req.user.id, productId);

        if (existingItem) {
            const newQuantity = existingItem.quantity + quantity;
            if (newQuantity > product.stock) {
                return res.status(400).json({
                    message: `No hay suficiente stock para ${product.name}. Stock disponible: ${product.stock}, en carrito ya tiene: ${existingItem.quantity}`,
                    availableStock: product.stock,
                    currentCartQuantity: existingItem.quantity
                });
            }
            await statements.updateCartItem(newQuantity, req.user.id, productId);
        } else {
            if (quantity > product.stock) {
                return res.status(400).json({
                    message: `No hay suficiente stock para ${product.name}. Stock disponible: ${product.stock}`,
                    availableStock: product.stock
                });
            }
            await statements.addToCart(req.user.id, productId, quantity);
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
 * Update cart item quantity
 */
router.put('/:productId', authenticateToken, async (req, res) => {
    const productId = parseInt(req.params.productId, 10);
    const quantity = Number.parseInt(req.body?.quantity, 10);

    if (!Number.isFinite(productId) || !Number.isFinite(quantity) || quantity < 0) {
        return res.status(400).json({ message: 'Cantidad inválida.' });
    }

    try {
        if (quantity === 0) {
            await statements.removeFromCart(req.user.id, productId);
        } else {
            const product = await statements.getProductById(productId);
            if (!product) {
                return res.status(404).json({ message: 'Producto no encontrado' });
            }
            if (quantity > product.stock) {
                return res.status(400).json({
                    message: `No hay suficiente stock para ${product.name}. Stock disponible: ${product.stock}`,
                    availableStock: product.stock
                });
            }
            await statements.updateCartItem(quantity, req.user.id, productId);
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
 * Remove item from cart
 */
router.delete('/:productId', authenticateToken, async (req, res) => {
    const productId = parseInt(req.params.productId, 10);
    try {
        await statements.removeFromCart(req.user.id, productId);

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
