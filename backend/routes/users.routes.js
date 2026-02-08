// routes/users.routes.js - User management routes (admin)
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

const { statements } = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

/**
 * POST /api/users
 * Create a new user (admin only)
 */
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    const { name, email, password, role } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Nombre, email y contraseña son requeridos' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Formato de email inválido' });
    }

    // Validate password (min 8 chars, uppercase, lowercase, number)
    if (password.length < 8) {
        return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres' });
    }

    // Validate role
    const validRole = ['admin', 'customer'].includes(role) ? role : 'customer';

    try {
        // Check if email already exists
        const existingUser = await statements.getUserByEmail(email.toLowerCase());
        if (existingUser) {
            return res.status(409).json({ message: 'El email ya está registrado' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user (not guest)
        const result = await statements.createUser(
            name.trim(),
            email.toLowerCase().trim(),
            hashedPassword,
            validRole,
            0 // is_guest = false
        );

        const newUser = await statements.getUserById(result.lastInsertRowid);
        console.log('Usuario creado por admin:', { id: newUser.id, email: newUser.email, role: validRole });
        res.status(201).json({ message: 'Usuario creado exitosamente', user: newUser });
    } catch (error) {
        console.error('Error creando usuario:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * GET /api/users
 * Get paginated users (admin only)
 */
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const role = req.query.role || 'all';
    const status = req.query.status || 'all';

    try {
        const { data: users, total } = await statements.getUsersPaginated(page, limit, search, role, status);
        
        res.json({
            data: users,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Error obteniendo usuarios:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * PUT /api/users/:id/role
 * Update user role (admin only)
 */
router.put('/:id/role', authenticateToken, requireAdmin, async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    const { role } = req.body;

    if (!role || !['admin', 'customer'].includes(role)) {
        return res.status(400).json({ message: 'Rol inválido. Debe ser "admin" o "customer"' });
    }

    // Prevent self-demotion from admin
    if (userId === req.user.id && role === 'customer') {
        return res.status(400).json({ message: 'No puedes cambiar tu propio rol de administrador' });
    }

    try {
        const result = await statements.updateUserRole(role, userId);
        
        if (result) {
            const updatedUser = await statements.getUserById(userId);
            console.log('Rol de usuario actualizado:', updatedUser);
            res.json({ message: 'Rol actualizado exitosamente', user: updatedUser });
        } else {
            res.status(404).json({ message: 'Usuario no encontrado' });
        }
    } catch (error) {
        console.error('Error actualizando rol de usuario:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * PUT /api/users/:id/status
 * Toggle user active status (admin only)
 */
router.put('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
        return res.status(400).json({ message: 'Estado inválido. Debe ser true o false' });
    }

    // Prevent self-deactivation
    if (userId === req.user.id && !is_active) {
        return res.status(400).json({ message: 'No puedes desactivar tu propia cuenta' });
    }

    try {
        const result = await statements.updateUserStatus(is_active, userId);
        
        if (result) {
            const updatedUser = await statements.getUserById(userId);
            console.log('Estado de usuario actualizado:', updatedUser);
            res.json({ message: 'Estado actualizado exitosamente', user: updatedUser });
        } else {
            res.status(404).json({ message: 'Usuario no encontrado' });
        }
    } catch (error) {
        console.error('Error actualizando estado de usuario:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

module.exports = router;
