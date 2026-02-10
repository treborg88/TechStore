// routes/chatbot.routes.js - Chatbot API routes
// POST /api/chatbot/message  — envía mensaje del usuario al LLM con contexto
// GET  /api/chatbot/config   — config pública del chatbot (enabled, greeting, etc.)
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const { chatCompletion, getProviderList } = require('../services/llm/adapter');
const { buildDynamicContext, getSuggestions } = require('../services/llm/contextBuilder');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { decryptSetting } = require('../services/encryption.service');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

/**
 * Extrae datos del usuario del JWT sin exigir autenticación.
 * Retorna { name, userId } o nulls si no hay token válido.
 */
const extractUserFromToken = (req) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || req.cookies?.auth_token;
    if (!token) return { name: null, userId: null };
    const decoded = jwt.verify(token, JWT_SECRET);
    const name = (decoded.name || '').trim();
    // Descartar nombre si es un email o solo números
    const safeName = (name && !name.includes('@') && !/^\d+$/.test(name)) ? name : null;
    return { name: safeName, userId: decoded.id || null };
  } catch {
    return { name: null, userId: null };
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
  const { statements } = require('../database');
  const allSettings = await statements.getSettings();
  const map = {};
  for (const { id, value } of allSettings) {
    if (id.startsWith('chatbot')) map[id] = value;
  }
  return map;
};

// --- Caché del system prompt LIGERO (solo reglas y personalidad, sin productos) ---
let _promptCache = { text: null, expiry: 0 };
const PROMPT_CACHE_TTL = 15 * 60 * 1000; // 15 minutos

/**
 * Obtiene el system prompt cacheado, o lo reconstruye si expiró.
 * NOTA: Este prompt es LIGERO — no incluye productos ni datos dinámicos.
 * El contexto relevante se inyecta en el user message por el contextBuilder.
 */
const getCachedSystemPrompt = async (settings) => {
  const now = Date.now();
  if (_promptCache.text && now < _promptCache.expiry) {
    return _promptCache.text;
  }
  const prompt = await buildSlimSystemPrompt(settings);
  _promptCache = { text: prompt, expiry: now + PROMPT_CACHE_TTL };
  return prompt;
};

/**
 * System prompt SLIM: solo reglas, personalidad e info de la tienda.
 * Los datos dinámicos (productos, pedidos, KB) se inyectan aparte.
 */
const buildSlimSystemPrompt = async (settings) => {
  // Info de la tienda desde settings
  const { statements } = require('../database');
  const allSettings = await statements.getSettings();
  const store = {};
  for (const { id, value } of allSettings) store[id] = value;

  // Personalidad y verbosidad configurables
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
- NUNCA inventes productos, precios o información que no esté en el contexto proporcionado.
- Si no tienes la información, sugiere contactar directamente a la tienda.
- NO generes código, HTML ni contenido técnico.
- Puedes agregar links de productos si están disponibles.
- Formatea con **negritas** lo importante. Usa • para listas.
- SOLO menciona el stock si está bajo (menos de 5 unidades) o agotado.
- Usa SOLO la información del CONTEXTO DINÁMICO proporcionado en cada mensaje.

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

${customPrompt ? `INSTRUCCIONES ADICIONALES DEL ADMINISTRADOR:\n${customPrompt}` : ''}`;
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
 * Recibe mensaje del usuario, genera respuesta con LLM.
 * Body: { message: string, history: [{role, content}], pageContext?: {page, productId, cartItemCount} }
 * Response: { reply: string, usage?: Object, suggestions?: string[] }
 */
router.post('/message', chatLimiter, async (req, res) => {
  try {
    const { message, history = [], pageContext } = req.body;

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

    // System prompt SLIM (reglas + tienda, cacheado 15 min)
    let systemPrompt = await getCachedSystemPrompt(settings);

    // Extraer identidad del usuario del JWT
    const { name: userName, userId } = extractUserFromToken(req);
    if (userName) {
      systemPrompt += `\n\nEl usuario actual se llama ${userName}. Usa su nombre de forma natural.`;
    }

    // Armar historial reciente para contexto conversacional (últimos 6 mensajes)
    const recentHistory = history.slice(-6).map(h => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: String(h.content).slice(0, 500)
    }));

    // --- Contexto dinámico según intención + página + conversación ---
    const { dynamicContext, intentInfo } = await buildDynamicContext({
      message: message.trim(),
      history: recentHistory,
      pageContext: pageContext || null,
      userId,
      settings
    });

    // Inyectar contexto dinámico en el user message (ahorra tokens vs system prompt)
    const userMessageWithContext = dynamicContext
      ? `[CONTEXTO DINÁMICO para esta pregunta:\n${dynamicContext}\n]\n\nPregunta del usuario: ${message.trim()}`
      : message.trim();

    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentHistory,
      { role: 'user', content: userMessageWithContext }
    ];

    // Log del contexto para debug (intención + contexto dinámico)
    console.log(`\n🤖 Chatbot | Intent: ${intentInfo.primaryIntent} | Page: ${pageContext?.page || 'N/A'} | User: ${userName || 'anon'} | Context: ${dynamicContext.length} chars`);

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

    // Generar sugerencias contextuales (quick replies)
    const suggestions = getSuggestions(intentInfo, pageContext);

    res.json({ reply: text, usage, suggestions });

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
