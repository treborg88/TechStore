// config/index.js - Environment variables and constants
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error('❌ ERROR CRÍTICO: JWT_SECRET no está definido en el archivo .env.');
    console.error('El servidor no puede iniciar sin una clave secreta para los tokens JWT por motivos de seguridad.');
    process.exit(1);
}

module.exports = {
    PORT: process.env.PORT || 5001,
    JWT_SECRET,
    SETTINGS_ENCRYPTION_SECRET: process.env.SETTINGS_ENCRYPTION_SECRET || JWT_SECRET,
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_PASS: process.env.EMAIL_PASS,
    EMAIL_HOST: process.env.EMAIL_HOST,
    EMAIL_PORT: process.env.EMAIL_PORT || 587,
    EMAIL_SERVICE: process.env.EMAIL_SERVICE || 'gmail',
    NODE_ENV: process.env.NODE_ENV || 'development',
    FRONTEND_URL: process.env.FRONTEND_URL,
    BASE_URL: process.env.BASE_URL,
    // Stripe configuration
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET
};
