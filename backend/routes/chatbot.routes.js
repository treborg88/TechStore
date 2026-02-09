// routes/chatbot.routes.js - Chatbot API routes
// POST /api/chatbot/message  — envía mensaje del usuario al LLM con contexto
// GET  /api/chatbot/config   — config pública del chatbot (enabled, greeting, etc.)
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const { statements } = require('../database');
const { chatCompletion, getProviderList } = require('../services/llm/adapter');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { decryptSetting } = require('../services/encryption.service');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

/**
 * Extrae el nombre del usuario del JWT sin exigir autenticación.
 * Retorna el nombre solo si es un nombre real (no email ni número).
 */
const extractUserName = (req) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || req.cookies?.auth_token;
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET);
    const name = (decoded.name || '').trim();
    if (!name) return null;
    // Descartar si es un email o solo números
    if (name.includes('@') || /^\d+$/.test(name)) return null;
    return name;
  } catch {
    return null;
  }
};

// --- Rate limiter específico para chatbot (más permisivo que auth) ---
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 15, // 15 mensajes por minuto por IP
  message: { message: 'Demasiados mensajes, espera un momento antes de continuar.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS'
});

// --- Helpers ---

/**
 * Lee configuración del chatbot desde app_settings
 */
const getChatbotSettings = async () => {
  const allSettings = await statements.getSettings();
  const map = {};
  for (const { id, value } of allSettings) {
    if (id.startsWith('chatbot')) map[id] = value;
  }
  return map;
};

// --- Caché del system prompt (evita consultas DB en cada mensaje) ---
let _promptCache = { text: null, expiry: 0 };
const PROMPT_CACHE_TTL = 15 * 60 * 1000; // 15 minutos

/**
 * Obtiene el system prompt cacheado, o lo reconstruye si expiró
 */
const getCachedSystemPrompt = async (settings) => {
  const now = Date.now();
  if (_promptCache.text && now < _promptCache.expiry) {
    return _promptCache.text;
  }
  const prompt = await buildSystemPrompt(settings);
  _promptCache = { text: prompt, expiry: now + PROMPT_CACHE_TTL };
  return prompt;
};

/**
 * Construye el system prompt con contexto de la tienda y productos
 */
const buildSystemPrompt = async (settings) => {
  // Info de la tienda desde settings públicos
  const allSettings = await statements.getSettings();
  const store = {};
  for (const { id, value } of allSettings) store[id] = value;

  // Productos (resumen compacto - solo mencionar stock si está bajo <5)
  const { data: products } = await statements.getProductsPaginated(1, 50, '', 'all');
  const productSummary = (products || []).map(p => {
    const stockNote = p.stock <= 0 ? ' [AGOTADO]' : (p.stock < 5 ? ` [Últimas ${p.stock} unidades]` : '');
    return `- ${p.name} | ${p.category || 'General'} | $${p.price}${stockNote}`;
  }).join('\n');

  // Categorías únicas
  const categories = [...new Set((products || []).map(p => p.category).filter(Boolean))];

  // System prompt configurable con contexto inyectado
  const personality = settings.chatbotPersonality || 'friendly';
  const verbosity = settings.chatbotVerbosity || 'normal';
  const customPrompt = settings.chatbotSystemPrompt || '';

  const verbosityGuide = {
    brief: 'Responde en 1-2 oraciones máximo. Sé conciso.',
    normal: 'Responde en 2-4 oraciones. Sé claro y útil.',
    detailed: 'Da respuestas completas con detalles. Usa listas cuando sea apropiado.'
  };

  const personalityGuide = {
    formal: 'Usa un tono profesional y formal. Trata al usuario de "usted".',
    friendly: 'Sé amigable y cercano. Usa un tono cálido pero profesional.',
    casual: 'Sé casual y relajado. Usa emojis ocasionalmente.'
  };

  return `Eres el asistente virtual de la tienda "${store.siteName || 'Tienda en línea'}".
Tu rol es SOLO informar. NO puedes realizar compras, modificar pedidos ni ejecutar acciones.

${personalityGuide[personality] || personalityGuide.friendly}
${verbosityGuide[verbosity] || verbosityGuide.normal}

REGLAS ESTRICTAS:
- Responde SOLO en español.
- Menciona el nombre de la tienda SOLO en el saludo inicial, no lo repitas después.
- Solo responde sobre la tienda, sus productos y procesos.
- Si preguntan algo fuera del ámbito de la tienda, di amablemente que solo puedes ayudar con temas de la tienda.
- NUNCA inventes productos, precios o información que no esté en el contexto.
- Si no tienes la información, sugiere contactar directamente a la tienda.
- NO generes código, HTML ni contenido técnico.
- puede agregar links de productos si estan disponible
- Formatea con **negritas** lo importante. Usa • para listas.
- SOLO menciona el stock si está bajo (menos de 5 unidades) o agotado.




INFORMACIÓN DE LA TIENDA:
• Nombre: ${store.siteName || 'Tienda en línea'}
• Teléfono: ${store.contactPhone || store.storePhone || 'Ver página de contacto'}
• Email: ${store.contactEmail || 'Ver página de contacto'}
• WhatsApp: ${store.contactWhatsapp || 'No disponible'}
• Dirección: ${store.contactAddress || store.storeAddress || 'Ver página de contacto'}
• Horario: ${store.contactHours || 'Consultar en página de contacto'}

CÓMO COMPRAR:
1. Navegar o buscar productos en la página principal
2. Hacer clic en "Agregar al carrito"
3. Ir al carrito y hacer clic en "Proceder al pago"
4. Completar datos personales y dirección
5. Confirmar la compra (como invitado o con cuenta)

RASTREO DE PEDIDOS:
- Ir a "Mis Pedidos" en el menú (si tiene cuenta)
- Usar el enlace de seguimiento enviado por email (compras de invitado)
- Estados posibles: pendiente, pagado, enviado, entregado, cancelado

CATEGORÍAS DISPONIBLES: ${categories.join(', ') || 'Ver en la tienda'}

PRODUCTOS DISPONIBLES:
${productSummary || 'No hay productos cargados actualmente.'}

${customPrompt ? `\nINSTRUCCIONES ADICIONALES DEL ADMINISTRADOR:\n${customPrompt}` : ''}`;
};

/**
 * GET /api/chatbot/config
 * Retorna configuración pública del chatbot (sin datos sensibles)
 */
router.get('/config', async (_req, res) => {
  try {
    const settings = await getChatbotSettings();
    res.json({
      enabled: settings.chatbotEnabled === 'true',
      greeting: settings.chatbotGreeting || '¡Hola! 👋 ¿En qué puedo ayudarte?',
      maxMessages: parseInt(settings.chatbotMaxMessages) || 30,
      placeholder: settings.chatbotPlaceholder || 'Escribe tu pregunta...',
      color: settings.chatbotColor || '',
    });
  } catch (error) {
    console.error('Error getting chatbot config:', error);
    res.json({ enabled: false });
  }
});

/**
 * POST /api/chatbot/message
 * Recibe mensaje del usuario, genera respuesta con LLM
 * Body: { message: string, history: [{role, content}] }
 */
router.post('/message', chatLimiter, async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ message: 'Mensaje vacío.' });
    }

    // Limitar largo del mensaje
    if (message.length > 500) {
      return res.status(400).json({ message: 'El mensaje es demasiado largo (máx. 500 caracteres).' });
    }

    // Leer config del chatbot
    const settings = await getChatbotSettings();

    // Verificar si está habilitado
    if (settings.chatbotEnabled !== 'true') {
      return res.status(403).json({ message: 'El chat no está disponible en este momento.' });
    }

    // Resolver proveedor y API key
    const provider = settings.chatbotLlmProvider || process.env.CHATBOT_LLM_PROVIDER || 'groq';
    let apiKey = process.env.CHATBOT_LLM_API_KEY || '';

    // Si hay API key encriptada en settings, usarla (prioridad)
    if (settings.chatbotLlmApiKey) {
      try {
        apiKey = decryptSetting(settings.chatbotLlmApiKey);
      } catch {
        // Si falla el decrypt, puede que esté en texto plano (migración)
        apiKey = settings.chatbotLlmApiKey;
      }
    }

    if (!apiKey) {
      return res.status(503).json({ 
        message: 'El asistente no está configurado. Contacta al administrador.' 
      });
    }

    const model = settings.chatbotLlmModel || '';
    const customBaseUrl = settings.chatbotLlmCustomUrl || '';
    const maxTokens = parseInt(settings.chatbotMaxTokens) || 500;
    const temperature = parseFloat(settings.chatbotTemperature) || 0.3;

    // Construir system prompt con contexto (cacheado 5 min)
    let systemPrompt = await getCachedSystemPrompt(settings);

    // Si el usuario está logueado, agregar su nombre al contexto
    const userName = extractUserName(req);
    if (userName) {
      systemPrompt += `\n\nEl usuario actual se llama ${userName}. Usa su nombre de forma natural en la conversación.`;
    }

    // Armar historial de conversación (limitar a últimos 6 mensajes para ahorrar tokens)
    const recentHistory = history.slice(-6).map(h => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: String(h.content).slice(0, 500)
    }));

    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentHistory,
      { role: 'user', content: message.trim() }
    ];

    // Llamar al LLM
    const { text, usage } = await chatCompletion({
      provider,
      apiKey,
      model,
      messages,
      maxTokens,
      temperature,
      customBaseUrl
    });

    if (!text) {
      return res.json({ 
        reply: 'No pude generar una respuesta. Por favor, intenta reformular tu pregunta.' 
      });
    }

    res.json({ reply: text, usage });

  } catch (error) {
    console.error('❌ Chatbot error:', error.message);

    // Respuesta amigable según tipo de error
    if (error.name === 'AbortError' || error.message.includes('abort')) {
      return res.json({ 
        reply: 'La respuesta tardó demasiado. Intenta con una pregunta más corta.' 
      });
    }

    res.json({ 
      reply: 'Tuve un problema al procesar tu mensaje. Intenta de nuevo en un momento.' 
    });
  }
});

/**
 * GET /api/chatbot/providers
 * Lista de proveedores LLM disponibles (admin only)
 */
router.get('/providers', authenticateToken, requireAdmin, (_req, res) => {
  res.json(getProviderList());
});

/**
 * POST /api/chatbot/test
 * Test de conexión con el LLM configurado (admin only)
 */
router.post('/test', authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const settings = await getChatbotSettings();
    const provider = settings.chatbotLlmProvider || process.env.CHATBOT_LLM_PROVIDER || 'groq';
    let apiKey = process.env.CHATBOT_LLM_API_KEY || '';

    if (settings.chatbotLlmApiKey) {
      try { apiKey = decryptSetting(settings.chatbotLlmApiKey); } 
      catch { apiKey = settings.chatbotLlmApiKey; }
    }

    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'No hay API key configurada.' });
    }

    const { text, usage } = await chatCompletion({
      provider,
      apiKey,
      model: settings.chatbotLlmModel || '',
      messages: [
        { role: 'system', content: 'Responde en español.' },
        { role: 'user', content: 'Di "Conexión exitosa" y nada más.' }
      ],
      maxTokens: 20,
      temperature: 0,
      customBaseUrl: settings.chatbotLlmCustomUrl || ''
    });

    res.json({ success: true, response: text, usage });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
