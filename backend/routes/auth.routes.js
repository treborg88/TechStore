// routes/auth.routes.js - Authentication routes
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();

const { statements } = require('../database');
const { JWT_SECRET } = require('../config');
const { authenticateToken, blacklistToken } = require('../middleware/auth');
const { setAuthCookies, setCsrfCookie, clearAuthCookies, getCookieOptions } = require('../middleware/csrf');
const { sendMailWithSettings } = require('../services/email.service');

// Token expiry constant (24 hours)
const TOKEN_EXPIRY = '24h';
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * GET /api/auth/csrf
 * Get/refresh CSRF token
 * Returns token in both cookie and response body for mobile compatibility
 */
router.get('/csrf', (req, res) => {
    // Always set fresh CSRF cookie and return token in response
    const csrfToken = setCsrfCookie(req, res);
    
    res.json({ success: true, csrfToken });
});

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, code } = req.body;

        // Basic validation
        if (!name || !email || !password || !code) {
            return res.status(400).json({ 
                message: 'Nombre, email, contraseña y código de verificación son requeridos' 
            });
        }

        // Validate verification code
        const verificationRecord = await statements.getVerificationCode(email.toLowerCase(), code, 'register');
        if (!verificationRecord) {
            return res.status(400).json({ 
                message: 'Código de verificación inválido o expirado' 
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                message: 'Formato de email inválido' 
            });
        }

        // Validate password complexity
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({ 
                message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula y un número' 
            });
        }

        // Check if email exists
        const existingUser = await statements.getUserByEmail(email.toLowerCase());
        if (existingUser) {
            return res.status(409).json({ 
                message: 'El email ya está registrado' 
            });
        }

        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create user
        const result = await statements.createUser(
            name.trim(),
            email.toLowerCase().trim(),
            hashedPassword,
            'customer',
            0  // is_guest = false
        );

        const newUserId = result.lastInsertRowid;
        const newUser = await statements.getUserById(newUserId);

        // Delete used verification code
        await statements.deleteVerificationCodes(email.toLowerCase(), 'register');

        // Generate JWT
        const token = jwt.sign(
            { 
                id: newUser.id, 
                email: newUser.email,
                name: newUser.name,
                role: newUser.role 
            },
            JWT_SECRET,
            { expiresIn: TOKEN_EXPIRY }
        );

        const csrfToken = setAuthCookies(req, res, token);

        const userResponse = {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            createdAt: newUser.created_at
        };

        console.log('Usuario registrado exitosamente:', userResponse);
        res.status(201).json({
            message: 'Usuario registrado exitosamente',
            user: userResponse,
            token,
            csrfToken
        });

    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * POST /api/auth/login
 * User login
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email y contraseña son requeridos' });
        }

        const user = await statements.getUserByEmail(email.toLowerCase());
        if (!user) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        if (!user.is_active) {
            return res.status(401).json({ message: 'Cuenta desactivada. Contacta al soporte' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        await statements.updateLastLogin(user.id);

        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email,
                name: user.name,
                role: user.role 
            },
            JWT_SECRET,
            { expiresIn: TOKEN_EXPIRY }
        );

        const csrfToken = setAuthCookies(req, res, token);

        const userResponse = {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            street: user.street,
            sector: user.sector,
            city: user.city,
            country: user.country,
            role: user.role,
            createdAt: user.created_at,
            lastLogin: user.last_login
        };

        console.log('Usuario logueado exitosamente:', userResponse.email);
        res.json({
            message: 'Login exitoso',
            user: userResponse,
            token,
            csrfToken
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * GET /api/auth/check-email
 * Check if email is registered
 */
router.get('/check-email', async (req, res) => {
    try {
        const { email } = req.query;

        if (!email) {
            return res.status(400).json({ message: 'Email es requerido' });
        }

        const normalizedEmail = String(email).toLowerCase().trim();
        const user = await statements.getUserByEmail(normalizedEmail);

        return res.json({ exists: !!user });
    } catch (error) {
        console.error('Error checking email:', error);
        return res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * POST /api/auth/forgot-password
 * Send password reset code
 */
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email es requerido' });
    }

    try {
        const user = await statements.getUserByEmail(email.toLowerCase());
        if (!user) {
            // Security: don't reveal if email exists
            return res.json({ 
                success: true, 
                message: 'Si el email está registrado, recibirás un código de verificación' 
            });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        await statements.deleteVerificationCodes(email.toLowerCase(), 'password_reset');
        await statements.createVerificationCode(email.toLowerCase(), code, 'password_reset', expiresAt);

        const mailOptions = {
            from: process.env.EMAIL_USER || 'noreply@techstore.com',
            to: email,
            subject: 'Restablecer contraseña - TechStore',
            text: `Tu código para restablecer la contraseña es: ${code}. Expira en 10 minutos.`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #007bff;">Restablecer Contraseña</h2>
                    <p>Has solicitado restablecer tu contraseña en TechStore.</p>
                    <p>Tu código de verificación es:</p>
                    <h1 style="letter-spacing: 5px; background: #f4f4f4; padding: 10px; display: inline-block; border-radius: 5px;">${code}</h1>
                    <p>Este código expira en 10 minutos.</p>
                    <p>Si no solicitaste esto, puedes ignorar este correo.</p>
                </div>
            `
        };

        await sendMailWithSettings(mailOptions);
        res.json({ success: true, message: 'Código enviado correctamente' });

    } catch (error) {
        console.error('Error en forgot-password:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * POST /api/auth/reset-password
 * Reset password with verification code
 */
router.post('/reset-password', async (req, res) => {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
        return res.status(400).json({ 
            message: 'Email, código y nueva contraseña son requeridos' 
        });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
        return res.status(400).json({ 
            message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula y un número' 
        });
    }

    try {
        const verificationRecord = await statements.getVerificationCode(email.toLowerCase(), code, 'password_reset');
        if (!verificationRecord) {
            return res.status(400).json({ 
                message: 'Código de verificación inválido o expirado' 
            });
        }

        const user = await statements.getUserByEmail(email.toLowerCase());
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await statements.updateUserPassword(hashedPassword, user.id);
        await statements.deleteVerificationCodes(email.toLowerCase(), 'password_reset');

        res.json({ success: true, message: 'Contraseña actualizada correctamente' });

    } catch (error) {
        console.error('Error en reset-password:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await statements.getUserById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        const userResponse = {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            street: user.street,
            sector: user.sector,
            city: user.city,
            country: user.country,
            role: user.role,
            createdAt: user.created_at,
            lastLogin: user.last_login
        };

        // Refresh CSRF cookie if missing
        if (!req.cookies?.['XSRF-TOKEN'] && req.cookies?.auth_token) {
            setCsrfCookie(req, res);
        }

        res.json(userResponse);
    } catch (error) {
        console.error('Error obteniendo perfil:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * PUT /api/auth/profile
 * Update user profile
 */
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { name, phone, street, sector, city, country, currentPassword, newPassword } = req.body;
        const user = await statements.getUserById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Update profile data
        await statements.updateUser(
            name !== undefined ? name.trim() : user.name,
            phone !== undefined ? phone.trim() : (user.phone || ''),
            street !== undefined ? street.trim() : (user.street || ''),
            sector !== undefined ? sector.trim() : (user.sector || ''),
            city !== undefined ? city.trim() : (user.city || ''),
            country !== undefined ? country.trim() : (user.country || ''),
            user.id
        );

        // Change password if provided
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ 
                    message: 'Contraseña actual requerida para cambiar contraseña' 
                });
            }

            const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
            if (!isCurrentPasswordValid) {
                return res.status(400).json({ message: 'Contraseña actual incorrecta' });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({ 
                    message: 'La nueva contraseña debe tener al menos 6 caracteres' 
                });
            }

            const hashedNewPassword = await bcrypt.hash(newPassword, 10);
            await statements.updateUserPassword(hashedNewPassword, user.id);
        }

        const updatedUser = await statements.getUserById(user.id);

        const userResponse = {
            id: updatedUser.id,
            name: updatedUser.name,
            email: updatedUser.email,
            phone: updatedUser.phone,
            street: updatedUser.street,
            sector: updatedUser.sector,
            city: updatedUser.city,
            country: updatedUser.country,
            role: updatedUser.role,
            updatedAt: updatedUser.updated_at
        };

        res.json({
            message: 'Perfil actualizado exitosamente',
            user: userResponse
        });

    } catch (error) {
        console.error('Error actualizando perfil:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * POST /api/auth/logout
 * Logout and invalidate token
 */
router.post('/logout', authenticateToken, (req, res) => {
    const { secure, sameSite } = getCookieOptions(req);
    res.clearCookie('auth_token', { path: '/', secure, sameSite });
    res.clearCookie('XSRF-TOKEN', { path: '/', secure, sameSite });
    
    // Add token to blacklist
    blacklistToken(req.token, TOKEN_EXPIRY_MS);
    
    res.json({ message: 'Logout exitoso' });
});

module.exports = router;
