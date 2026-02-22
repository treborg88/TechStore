// routes/index.js - Combine all routes
const authRoutes = require('./auth.routes');
const productsRoutes = require('./products.routes');
const cartRoutes = require('./cart.routes');
const ordersRoutes = require('./orders.routes');
const usersRoutes = require('./users.routes');
const settingsRoutes = require('./settings.routes');
const verificationRoutes = require('./verification.routes');
const paymentsRoutes = require('./payments.routes');
const chatbotRoutes = require('./chatbot.routes');
const setupRoutes = require('./setup.routes');
const storageRoutes = require('./storage.routes');

module.exports = {
    authRoutes,
    productsRoutes,
    cartRoutes,
    ordersRoutes,
    usersRoutes,
    settingsRoutes,
    verificationRoutes,
    paymentsRoutes,
    chatbotRoutes,
    setupRoutes,
    storageRoutes
};
