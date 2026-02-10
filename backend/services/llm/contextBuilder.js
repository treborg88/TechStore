// services/llm/contextBuilder.js - Construye contexto dinámico según intención y página
// Reemplaza el bloque estático de 50 productos por contexto on-demand focalizado

const { statements } = require('../../database');
const { detectIntent } = require('./intentDetector');
const { FRONTEND_URL, BASE_URL } = require('../../config');

// URL base del frontend para generar links directos a productos
const getSiteUrl = () => FRONTEND_URL || BASE_URL || 'http://localhost:5173';

// --- Caché ligero para datos que cambian poco ---
let _storeInfoCache = { data: null, expiry: 0 };
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

/**
 * Lee info de la tienda desde settings (con caché)
 */
const getStoreInfo = async () => {
  const now = Date.now();
  if (_storeInfoCache.data && now < _storeInfoCache.expiry) return _storeInfoCache.data;

  const allSettings = await statements.getSettings();
  const store = {};
  for (const { id, value } of allSettings) store[id] = value;
  _storeInfoCache = { data: store, expiry: now + CACHE_TTL };
  return store;
};

/**
 * Formatea un producto como texto compacto para el LLM
 */
const formatProduct = (p, detailed = false) => {
  const stockNote = p.stock <= 0 ? ' [AGOTADO]' : (p.stock < 5 ? ` [Últimas ${p.stock} uds]` : '');
  const link = `${getSiteUrl()}/product/${p.id}`;
  const base = `• ${p.name} | ${p.category || 'General'} | $${p.price}${stockNote}\n  Link: ${link}`;
  if (detailed && p.description) {
    // Truncar descripción a 200 chars
    const desc = p.description.length > 200 ? p.description.slice(0, 200) + '...' : p.description;
    return `${base}\n  Descripción: ${desc}`;
  }
  return base;
};

/**
 * Formatea un pedido como texto compacto para el LLM
 */
const formatOrder = (o) => {
  const statusMap = {
    pending_payment: 'Pendiente de pago',
    paid: 'Pagado',
    processing: 'En proceso',
    shipped: 'Enviado',
    delivered: 'Entregado',
    cancelled: 'Cancelado'
  };
  const status = statusMap[o.status] || o.status;
  const date = new Date(o.created_at).toLocaleDateString('es-ES');
  const num = o.order_number || `#${o.id}`;
  return `• Pedido ${num} | ${status} | $${o.total} | ${date}`;
};

// ============================================================
// LOADERS: cada intención tiene su loader de contexto
// ============================================================

/**
 * Sinónimos comunes para expandir búsquedas (usuario puede decir "celular"
 * pero el producto se llama "Smartphone", etc.)
 */
const SYNONYMS = {
  celular: ['smartphone', 'teléfono', 'phone', 'móvil', 'celulares'],
  smartphone: ['celular', 'teléfono', 'phone', 'móvil'],
  telefono: ['celular', 'smartphone', 'phone', 'móvil'],
  laptop: ['portátil', 'notebook', 'computadora', 'laptops'],
  computadora: ['laptop', 'pc', 'ordenador', 'desktop'],
  tablet: ['tableta', 'ipad', 'tablets'],
  reloj: ['smartwatch', 'watch', 'relojes'],
  audifonos: ['auricular', 'headphone', 'earphone', 'earbuds', 'audífono'],
  zapatos: ['calzado', 'tenis', 'zapatilla', 'zapato'],
  camisa: ['camiseta', 'polo', 'blusa', 'playera', 'camisas'],
  pantalon: ['jeans', 'pantalones', 'pants', 'bermuda'],
};

/**
 * Expande términos de búsqueda con sinónimos para encontrar más resultados
 */
const expandSearchTerms = (terms) => {
  const expanded = new Set(terms);
  for (const term of terms) {
    const normalized = term.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const syns = SYNONYMS[normalized];
    if (syns) {
      for (const s of syns) expanded.add(s);
    }
  }
  return [...expanded];
};

/**
 * Detecta si la pregunta es comparativa (más caro, más barato, todos, cuántos)
 * y necesita cargar más productos para una respuesta precisa
 */
const isComparativeQuery = (searchTerms) => {
  const comparativeWords = [
    'caro', 'barato', 'mejor', 'peor', 'todos', 'todas',
    'cuantos', 'cuántos', 'cuantas', 'cuántas', 'lista', 'listar',
    'comparar', 'diferencia', 'económico', 'economico', 'premium',
    'popular', 'recomendado', 'ranking'
  ];
  return searchTerms.some(t => comparativeWords.includes(
    t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  ));
};

/**
 * Carga productos relevantes buscando por keywords + sinónimos del mensaje.
 * Para preguntas comparativas, aumenta el límite para incluir todos los relevantes.
 */
const loadProductContext = async (searchTerms, limit = 15) => {
  const allResults = new Map();

  // Expandir términos con sinónimos para no perder productos
  const expandedTerms = expandSearchTerms(searchTerms);

  // Si es pregunta comparativa, aumentar límite
  const effectiveLimit = isComparativeQuery(searchTerms) ? 50 : limit;

  // Buscar con cada término expandido (max 5 búsquedas)
  for (const term of expandedTerms.slice(0, 5)) {
    const { data } = await statements.getProductsPaginated(1, effectiveLimit, term, 'all');
    for (const p of (data || [])) {
      if (!allResults.has(p.id)) allResults.set(p.id, p);
    }
  }

  // Si no hay resultados con keywords, traer los más recientes
  if (allResults.size === 0) {
    const { data } = await statements.getProductsPaginated(1, limit, '', 'all');
    for (const p of (data || [])) allResults.set(p.id, p);
  }

  const products = [...allResults.values()].slice(0, effectiveLimit);
  if (products.length === 0) return '';

  // Para comparativas, indicar que se muestran TODOS los encontrados
  const header = isComparativeQuery(searchTerms)
    ? `\nTODOS LOS PRODUCTOS ENCONTRADOS (${products.length}):`
    : `\nPRODUCTOS ENCONTRADOS (${products.length}):`;

  return `${header}\n${products.map(p => formatProduct(p, true)).join('\n')}`;
};

/**
 * Carga los pedidos del usuario logueado
 */
const loadOrderContext = async (userId) => {
  if (!userId) {
    return '\n[El usuario no está logueado. Sugiérele iniciar sesión para consultar sus pedidos, o dar su número de pedido para rastrearlo en la página de seguimiento.]';
  }

  const orders = await statements.getOrdersByUserId(userId);
  if (!orders || orders.length === 0) {
    return '\n[El usuario no tiene pedidos registrados.]';
  }

  // Últimos 5 pedidos
  const recent = orders.slice(0, 5);
  return `\nPEDIDOS DEL USUARIO (últimos ${recent.length}):\n${recent.map(formatOrder).join('\n')}`;
};

/**
 * Carga contexto de la página actual (producto específico, carrito, etc.)
 */
const loadPageContext = async (pageContext) => {
  if (!pageContext || !pageContext.page) return '';

  const parts = [];

  // Si está viendo un producto específico, cargar detalle completo
  if (pageContext.page === 'product-detail' && pageContext.productId) {
    const product = await statements.getProductById(pageContext.productId);
    if (product) {
      parts.push(`\nPRODUCTO QUE EL USUARIO ESTÁ VIENDO AHORA:`);
      parts.push(formatProduct(product, true));
      if (product.stock > 0) {
        parts.push(`  Stock disponible: ${product.stock} unidades`);
      }
    }
  }

  // Info del carrito si viene
  if (pageContext.cartItemCount > 0) {
    parts.push(`\n[El usuario tiene ${pageContext.cartItemCount} artículo(s) en su carrito.]`);
  }

  // Indicar en qué página está
  const pageNames = {
    'home': 'página principal',
    'product-detail': 'detalle de producto',
    'cart': 'carrito de compras',
    'checkout': 'proceso de pago',
    'orders': 'mis pedidos',
    'contact': 'página de contacto',
    'profile': 'perfil de usuario'
  };
  if (pageNames[pageContext.page]) {
    parts.push(`\n[El usuario está en: ${pageNames[pageContext.page]}]`);
  }

  return parts.join('\n');
};

/**
 * Carga bloques de conocimiento (políticas, FAQ) desde settings
 */
const loadKnowledgeBase = async (store, intent) => {
  const blocks = [];

  if (intent === 'POLICIES' || intent === 'HOW_TO_BUY') {
    if (store.chatbotKbShipping) blocks.push(`POLÍTICA DE ENVÍO:\n${store.chatbotKbShipping}`);
    if (store.chatbotKbReturns) blocks.push(`POLÍTICA DE DEVOLUCIONES:\n${store.chatbotKbReturns}`);
    if (store.chatbotKbPayments) blocks.push(`MÉTODOS DE PAGO:\n${store.chatbotKbPayments}`);
    if (store.chatbotKbTerms) blocks.push(`TÉRMINOS Y CONDICIONES:\n${store.chatbotKbTerms}`);
  }

  // FAQ se carga siempre si existe (es ligero)
  if (store.chatbotKbFaq) blocks.push(`PREGUNTAS FRECUENTES:\n${store.chatbotKbFaq}`);

  return blocks.length > 0 ? '\n' + blocks.join('\n\n') : '';
};

/**
 * Carga resumen compacto de catálogo (para intent GENERAL o STORE_INFO).
 * Extrae categorías de los mismos productos consultados (1 sola query).
 */
const loadCatalogSummary = async () => {
  const { data: products } = await statements.getProductsPaginated(1, 15, '', 'all');
  const categories = [...new Set((products || []).map(p => p.category).filter(Boolean))];
  const summary = (products || []).map(p => formatProduct(p, false)).join('\n');

  return `\nCATEGORÍAS: ${categories.join(', ') || 'Ver en la tienda'}
\nPRODUCTOS DESTACADOS:\n${summary || 'No hay productos cargados.'}`;
};

// ============================================================
// BUILDER PRINCIPAL
// ============================================================

/**
 * Construye el contexto dinámico completo para inyectar en el mensaje.
 * @param {Object} opts
 * @param {string} opts.message — Mensaje actual del usuario
 * @param {Array} [opts.history=[]] — Historial reciente [{role, content}] para contexto conversacional
 * @param {Object} [opts.pageContext] — { page, productId, cartItemCount }
 * @param {string|null} [opts.userId] — ID del usuario logueado
 * @param {Object} opts.settings — Settings del chatbot (chatbotKb*, chatbotContext*)
 * @returns {Promise<{ dynamicContext: string, intentInfo: Object }>}
 */
const buildDynamicContext = async ({ message, history = [], pageContext, userId, settings }) => {
  const store = await getStoreInfo();
  // Pasar historial al detector para mantener coherencia conversacional
  const intentInfo = detectIntent(message, history);
  const { primaryIntent, searchTerms } = intentInfo;

  const contextParts = [];

  // 1. Contexto de página (siempre, si viene) — alta prioridad
  const pageCtx = await loadPageContext(pageContext);
  if (pageCtx) contextParts.push(pageCtx);

  // 2. Contexto según intención principal
  switch (primaryIntent) {
    case 'PRODUCT_SEARCH': {
      const productCtx = await loadProductContext(searchTerms);
      contextParts.push(productCtx);
      break;
    }
    case 'ORDER_STATUS': {
      // Solo cargar pedidos si el feature está habilitado
      if (settings.chatbotContextOrders !== 'false') {
        const orderCtx = await loadOrderContext(userId);
        contextParts.push(orderCtx);
      }
      break;
    }
    case 'POLICIES':
    case 'HOW_TO_BUY': {
      const kbCtx = await loadKnowledgeBase(store, primaryIntent);
      contextParts.push(kbCtx);
      break;
    }
    case 'STORE_INFO': {
      // Info de la tienda ya está en el system prompt, no agregar más
      break;
    }
    default: {
      // GENERAL: catálogo resumido
      const catalogCtx = await loadCatalogSummary();
      contextParts.push(catalogCtx);
    }
  }

  // 3. FAQ siempre disponible (ligero) si no se cargó ya con POLICIES/HOW_TO_BUY
  if (primaryIntent !== 'PRODUCT_SEARCH' && primaryIntent !== 'POLICIES' && primaryIntent !== 'HOW_TO_BUY') {
    if (store.chatbotKbFaq) {
      const faqCtx = await loadKnowledgeBase(store, 'GENERAL');
      if (faqCtx) contextParts.push(faqCtx);
    }
  }

  const dynamicContext = contextParts.filter(Boolean).join('\n');

  return { dynamicContext, intentInfo };
};

/**
 * Genera sugerencias (quick replies) según intención y contexto de página
 */
const getSuggestions = (intentInfo, pageContext) => {
  const suggestions = [];
  const page = pageContext?.page || 'home';

  // Sugerencias base según página actual
  if (page === 'product-detail') {
    suggestions.push('¿Está disponible?', '¿Cuánto cuesta el envío?', '¿Tienen más colores?');
  } else if (page === 'cart' || page === 'checkout') {
    suggestions.push('¿Cómo pago?', '¿Cuánto tarda el envío?', '¿Puedo pagar contra entrega?');
  } else if (page === 'home') {
    suggestions.push('¿Qué productos tienen?', '¿Cuál es el horario?', '¿Hacen envíos?');
  }

  // Sugerencias según intención detectada
  if (intentInfo.primaryIntent === 'PRODUCT_SEARCH') {
    suggestions.push('¿Tienen más opciones?', '¿Hay descuentos?');
  } else if (intentInfo.primaryIntent === 'ORDER_STATUS') {
    suggestions.push('¿Cuándo llega mi pedido?', '¿Puedo cancelar?');
  }

  // Limitar a 3 y evitar duplicados
  return [...new Set(suggestions)].slice(0, 3);
};

module.exports = { buildDynamicContext, getSuggestions };
