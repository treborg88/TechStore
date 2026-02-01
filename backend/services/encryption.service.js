// services/encryption.service.js - Encryption utilities for sensitive settings
const crypto = require('crypto');
const { SETTINGS_ENCRYPTION_SECRET } = require('../config');

const ENCRYPTION_PREFIX = 'enc:';

// Generate encryption key from secret
const ENCRYPTION_KEY = SETTINGS_ENCRYPTION_SECRET
    ? crypto.createHash('sha256').update(String(SETTINGS_ENCRYPTION_SECRET)).digest()
    : null;

/**
 * Encrypt a sensitive value using AES-256-GCM
 * @param {string} value - The value to encrypt
 * @returns {string} - Encrypted value with prefix
 */
const encryptSetting = (value) => {
    if (!ENCRYPTION_KEY || !value) return value;
    
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    
    return `${ENCRYPTION_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
};

/**
 * Decrypt an encrypted setting value
 * @param {string} value - The encrypted value
 * @returns {string} - Decrypted value or original if not encrypted
 */
const decryptSetting = (value) => {
    if (!ENCRYPTION_KEY || !value || typeof value !== 'string') return value;
    if (!value.startsWith(ENCRYPTION_PREFIX)) return value;
    
    try {
        const payload = value.slice(ENCRYPTION_PREFIX.length);
        const [ivB64, tagB64, dataB64] = payload.split(':');
        
        if (!ivB64 || !tagB64 || !dataB64) return value;
        
        const iv = Buffer.from(ivB64, 'base64');
        const tag = Buffer.from(tagB64, 'base64');
        const data = Buffer.from(dataB64, 'base64');
        
        const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
        
        return decrypted.toString('utf8');
    } catch (error) {
        console.error('❌ Error decrypting setting - the encryption key may have changed or the value is corrupted');
        console.error('   This typically happens when SETTINGS_ENCRYPTION_SECRET or JWT_SECRET changes.');
        console.error('   You may need to re-enter the password in the admin settings.');
        console.error('   Error details:', error.message);
        // Return null to indicate decryption failed (not the encrypted value)
        return null;
    }
};

module.exports = {
    encryptSetting,
    decryptSetting,
    ENCRYPTION_PREFIX
};
