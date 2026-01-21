// services/index.js - Export all services
const { encryptSetting, decryptSetting } = require('./encryption.service');
const { 
    getSettingsMap, 
    createMailTransporter, 
    formatCurrency, 
    renderTemplate, 
    sendMailWithSettings, 
    sendOrderEmail 
} = require('./email.service');

module.exports = {
    // Encryption
    encryptSetting,
    decryptSetting,
    
    // Email
    getSettingsMap,
    createMailTransporter,
    formatCurrency,
    renderTemplate,
    sendMailWithSettings,
    sendOrderEmail
};
