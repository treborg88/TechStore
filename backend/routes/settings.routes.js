// routes/settings.routes.js - Site settings routes (admin)
const express = require('express');
const router = express.Router();

const { statements } = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { singleImageUpload } = require('../middleware/upload');
const { encryptSetting, decryptSetting } = require('../services/encryption.service');

/**
 * GET /api/settings
 * Get all settings (admin only)
 */
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const settings = await statements.getSettings();
        
        // Convert to object and mask sensitive fields
        const settingsObj = {};
        for (const { id, value } of settings) {
            if (id === 'mailPassword') {
                // Don't send actual password, just indicate if set
                settingsObj[id] = value ? '********' : '';
            } else {
                settingsObj[id] = value;
            }
        }
        
        res.json(settingsObj);
    } catch (error) {
        console.error('Error obteniendo ajustes:', error);
        res.status(500).json({ message: 'Error al obtener los ajustes' });
    }
});

/**
 * PUT /api/settings
 * Update settings (admin only)
 */
router.put('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const settings = req.body;
        
        // Filter out empty password updates
        const entries = Object.entries(settings).filter(([key, value]) => {
            if (key !== 'mailPassword') return true;
            return value !== undefined && value !== null && String(value).trim() !== '';
        });
        
        const promises = entries.map(([key, value]) => {
            if (key === 'mailPassword') {
                const encrypted = encryptSetting(value);
                return statements.updateSetting(key, encrypted);
            }
            return statements.updateSetting(key, value);
        });
        
        await Promise.all(promises);
        res.json({ message: 'Ajustes actualizados correctamente' });
    } catch (error) {
        console.error('❌ Error actualizando ajustes:', error);
        res.status(500).json({ 
            message: 'Error al actualizar los ajustes',
            details: error.message 
        });
    }
});

/**
 * POST /api/settings/upload
 * Upload settings image (admin only)
 */
router.post('/upload', authenticateToken, requireAdmin, singleImageUpload, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No se subió ninguna imagen' });
        }

        const imageUrl = await statements.uploadImage(req.file);
        res.json({ url: imageUrl });
    } catch (error) {
        console.error('Error subiendo imagen de ajustes:', error);
        res.status(500).json({ message: 'Error al subir la imagen' });
    }
});

module.exports = router;
