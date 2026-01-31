// services/email.service.js - Email sending utilities
const nodemailer = require('nodemailer');
const { statements } = require('../database');
const { decryptSetting } = require('./encryption.service');
const { EMAIL_USER, EMAIL_PASS, EMAIL_HOST, EMAIL_PORT, EMAIL_SERVICE } = require('../config');

/**
 * Get settings as a key-value map with decrypted values
 */
const getSettingsMap = async () => {
    const settings = await statements.getSettings();
    const map = {};
    for (const { id, value } of settings) {
        // Decrypt sensitive fields
        if (id === 'mailPassword') {
            map[id] = decryptSetting(value);
        } else {
            map[id] = value;
        }
    }
    return map;
};

/**
 * Create a nodemailer transporter based on settings and env
 * @param {Object} settings - Decrypted settings map
 * @returns {Object|null} - Nodemailer transporter or null
 */
const createMailTransporter = (settings = {}) => {
    const settingsUser = settings.mailUser || '';
    const settingsPass = settings.mailPassword || '';
    const envUser = EMAIL_USER || '';
    const envPass = EMAIL_PASS || '';

    const useSettingsCreds = settingsUser && settingsPass;
    const user = useSettingsCreds ? settingsUser : envUser;
    const pass = useSettingsCreds ? settingsPass : envPass;

    if (!user || !pass) {
        return null;
    }

    const host = (settings.mailHost || '').trim() || EMAIL_HOST;
    const portValue = settings.mailPort || EMAIL_PORT || 587;
    const port = Number(portValue) || 587;
    const useTls = settings.mailUseTls === true || settings.mailUseTls === 'true';
    const secure = port === 465;

    if (host) {
        return nodemailer.createTransport({
            host,
            port,
            secure,
            auth: { user, pass },
            ...(useTls ? { requireTLS: true, tls: { rejectUnauthorized: false } } : {})
        });
    }

    return nodemailer.createTransport({
        service: EMAIL_SERVICE || 'gmail',
        auth: { user, pass }
    });
};

/**
 * Format currency in Dominican Pesos
 * @param {number} value - Amount to format
 * @returns {string} - Formatted currency string
 */
const formatCurrency = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString('es-DO', { style: 'currency', currency: 'DOP' });
};

/**
 * Render a template with data placeholders
 * @param {string} template - Template string with {{key}} placeholders
 * @param {Object} data - Data object with values
 * @returns {string} - Rendered template
 */
const renderTemplate = (template, data) => {
    if (!template) return '';
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            return data[key];
        }
        return '';
    });
};

/**
 * Send email using configured settings
 * @param {Object} mailOptions - Nodemailer mail options
 */
const sendMailWithSettings = async (mailOptions) => {
    const settings = await getSettingsMap();
    const transporter = createMailTransporter(settings);
    
    if (!transporter) {
        throw new Error('Email transport not configured');
    }

    const fromEmail = settings.mailFrom || settings.mailUser || EMAIL_USER || mailOptions.from;
    const fromName = settings.mailFromName || settings.siteName || 'TechStore';
    const from = fromEmail ? `${fromName} <${fromEmail}>` : mailOptions.from;

    await transporter.sendMail({
        ...mailOptions,
        from
    });
};

/**
 * Send order confirmation email
 * @param {Object} params - Email parameters
 * @param {Object} params.order - Order object
 * @param {Array} params.items - Order items
 * @param {Object} params.customer - Customer info (name, email, phone)
 * @param {Object} params.shipping - Shipping info (address)
 * @param {Object} [params.attachment] - Optional attachment
 * @returns {boolean} - Success status
 */
const sendOrderEmail = async ({ order, items, customer, shipping, attachment }) => {
    try {
        // Validate required email recipient
        const recipientEmail = (customer?.email || '').trim();
        if (!recipientEmail) {
            console.error('sendOrderEmail: No recipient email provided');
            throw new Error('No se proporcionó email de destinatario');
        }

        // Basic email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(recipientEmail)) {
            console.error('sendOrderEmail: Invalid email format:', recipientEmail);
            throw new Error(`Formato de email inválido: ${recipientEmail}`);
        }

        const settings = await getSettingsMap();
        const transporter = createMailTransporter(settings);
        
        if (!transporter) {
            console.warn('No email transporter available. Missing mailUser/mailPassword.');
            throw new Error('Transporte de email no configurado. Falta mailUser/mailPassword en configuración o variables de entorno.');
        }

        const fromEmail = settings.mailFrom || settings.mailUser || EMAIL_USER;
        const fromName = settings.mailFromName || settings.siteName || 'TechStore';
        const from = `${fromName} <${fromEmail}>`;

        // Build items table HTML
        const itemRows = items.map((item) => `
            <tr>
                <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;">${item.name}</td>
                <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
                <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatCurrency(item.price)}</td>
                <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatCurrency(item.price * item.quantity)}</td>
            </tr>
        `).join('');

        const itemsTable = `
            <table style="width:100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                    <tr>
                        <th style="text-align:left; padding:8px 6px; border-bottom:2px solid #e5e7eb;">Producto</th>
                        <th style="text-align:center; padding:8px 6px; border-bottom:2px solid #e5e7eb;">Cantidad</th>
                        <th style="text-align:right; padding:8px 6px; border-bottom:2px solid #e5e7eb;">Precio</th>
                        <th style="text-align:right; padding:8px 6px; border-bottom:2px solid #e5e7eb;">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemRows}
                </tbody>
            </table>
        `;

        // Default email template
        const defaultTemplate = `
            <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
                <div style="background: #111827; color: #fff; padding: 16px 20px; border-radius: 10px 10px 0 0;">
                    <h2 style="margin: 0;">${settings.siteIcon || '🛍️'} ${settings.siteName || 'TechStore'}</h2>
                    <p style="margin: 4px 0 0;">Tu pedido fue recibido</p>
                </div>
                <div style="border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 10px 10px;">
                    <p>Hola <strong>${customer.name}</strong>,</p>
                    <p>Tu orden <strong>${order.order_number || `#${order.id}`}</strong> fue tomada y está en proceso de preparación para envío. Te contactaremos si es necesario.</p>

                    <h3 style="margin-top: 20px;">Resumen de la orden</h3>
                    ${itemsTable}

                    <div style="margin-top: 16px; display: flex; justify-content: space-between;">
                        <div>
                            <p style="margin: 4px 0;"><strong>Dirección:</strong> ${shipping.address}</p>
                            <p style="margin: 4px 0;"><strong>Teléfono:</strong> ${customer.phone || 'N/A'}</p>
                            <p style="margin: 4px 0;"><strong>Método de pago:</strong> ${order.payment_method === 'cash' ? 'Contra Entrega' : order.payment_method === 'transfer' ? 'Transferencia' : order.payment_method}</p>
                        </div>
                        <div style="text-align:right;">
                            <p style="margin: 4px 0;"><strong>Total:</strong> ${formatCurrency(order.total)}</p>
                            <p style="margin: 4px 0; color: #6b7280;">Estado: ${order.status}</p>
                        </div>
                    </div>

                    <p style="margin-top: 20px;">Gracias por comprar con nosotros.</p>
                </div>
            </div>
        `;

        // Use custom template if available
        const template = settings.mailTemplateHtml || '';
        const html = template
            ? renderTemplate(template, {
                siteName: settings.siteName || 'TechStore',
                siteIcon: settings.siteIcon || '🛍️',
                orderNumber: order.order_number || `#${order.id}`,
                customerName: customer.name,
                customerEmail: customer.email,
                customerPhone: customer.phone || 'N/A',
                shippingAddress: shipping.address,
                paymentMethod: order.payment_method === 'cash' ? 'Contra Entrega' : order.payment_method === 'transfer' ? 'Transferencia' : order.payment_method,
                status: order.status,
                total: formatCurrency(order.total),
                itemsTable
            })
            : defaultTemplate;

        const mailOptions = {
            from,
            to: recipientEmail,
            subject: `Orden recibida ${order.order_number ? order.order_number : `#${order.id}`}`,
            html
        };

        if (attachment) {
            mailOptions.attachments = [attachment];
        }

        console.log('Sending order email to:', recipientEmail, 'Order:', order.order_number || order.id);
        await transporter.sendMail(mailOptions);
        console.log('Order email sent successfully to:', recipientEmail);
        return true;
    } catch (error) {
        console.error('Error enviando email de orden:', error.message);
        console.error('Email details - To:', customer?.email, 'Order:', order?.order_number || order?.id);
        // Re-throw the error with details so caller can handle it
        throw error;
    }
};

module.exports = {
    getSettingsMap,
    createMailTransporter,
    formatCurrency,
    renderTemplate,
    sendMailWithSettings,
    sendOrderEmail
};
