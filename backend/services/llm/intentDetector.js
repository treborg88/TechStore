// services/llm/intentDetector.js - Detección de intención por keywords
// Clasifica el mensaje del usuario para cargar contexto dinámico (on-demand)

/**
 * Intenciones soportadas con sus keywords y sinónimos
 */
const INTENT_PATTERNS = {
  PRODUCT_SEARCH: {
    // Preguntas sobre productos, precios, disponibilidad
    keywords: [
      'producto', 'productos', 'precio', 'precios', 'cuesta', 'cuestan', 'vale',
      'tienen', 'tienes', 'venden', 'vendes', 'disponible', 'disponibilidad',
      'busco', 'comprar', 'quiero', 'necesito', 'hay', 'ofrecen',
      'catálogo', 'catalogo', 'categoría', 'categoria', 'marca',
      'talla', 'tallas', 'color', 'colores', 'tamaño', 'modelo',
      'stock', 'agotado', 'quedan', 'unidades',
      'barato', 'económico', 'oferta', 'descuento', 'promoción',
      'nuevo', 'nuevos', 'reciente', 'recientes',
      'similar', 'parecido', 'alternativa', 'recomend'
    ],
    priority: 2
  },
  ORDER_STATUS: {
    // Consultas sobre pedidos, envíos, tracking
    keywords: [
      'pedido', 'pedidos', 'orden', 'ordenes', 'factura', 'facturas',
      'envío', 'envio', 'enviado', 'entrega', 'entregado', 'llegó', 'llego',
      'rastrear', 'rastreo', 'tracking', 'seguimiento', 'estado',
      'dónde está', 'donde esta', 'cuándo llega', 'cuando llega',
      'mi compra', 'mis compras', 'mi orden',
      'cancelar', 'cancelación', 'devolver', 'devolución', 'devolucion'
    ],
    priority: 3
  },
  POLICIES: {
    // Términos, condiciones, políticas
    keywords: [
      'política', 'politica', 'políticas', 'politicas',
      'término', 'termino', 'términos', 'terminos', 'condiciones',
      'devolución', 'devolucion', 'devoluciones', 'reembolso',
      'garantía', 'garantia', 'cambio', 'cambios',
      'envío gratis', 'costo envío', 'costo de envio',
      'privacidad', 'datos personales',
      'pago', 'pagos', 'método de pago', 'metodo de pago',
      'tarjeta', 'transferencia', 'efectivo', 'paypal', 'stripe'
    ],
    priority: 2
  },
  STORE_INFO: {
    // Info de contacto, horarios, ubicación
    keywords: [
      'horario', 'horarios', 'hora', 'abierto', 'cerrado',
      'dirección', 'direccion', 'ubicación', 'ubicacion', 'dónde están', 'donde estan',
      'teléfono', 'telefono', 'llamar', 'whatsapp', 'contacto', 'contactar',
      'email', 'correo', 'escribir',
      'sucursal', 'tienda física', 'tienda fisica'
    ],
    priority: 1
  },
  HOW_TO_BUY: {
    // Cómo comprar, proceso de compra
    keywords: [
      'cómo compro', 'como compro', 'cómo comprar', 'como comprar',
      'cómo pedir', 'como pedir', 'cómo hago', 'como hago',
      'proceso de compra', 'carrito', 'checkout', 'pagar',
      'registrarme', 'crear cuenta', 'invitado',
      'agregar al carrito', 'añadir al carrito'
    ],
    priority: 1
  }
};

/**
 * Normaliza texto para matching: minúsculas, sin acentos, sin puntuación.
 */
const normalizeText = (text) => text.toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[¿¡!?.,;:()]/g, ' ')
  .trim();

/**
 * Detecta la intención principal considerando el mensaje actual Y el historial.
 * Combina el mensaje con los últimos mensajes del usuario para mantener
 * coherencia conversacional (ej: "¿tienen zapatos?" → "¿en qué colores?").
 * @param {string} message — Mensaje actual del usuario
 * @param {Array} [history=[]] — Historial reciente [{role, content}]
 * @returns {{ intents: string[], primaryIntent: string, searchTerms: string[] }}
 */
const detectIntent = (message, history = []) => {
  // Extraer mensajes previos del usuario (últimos 3) para contexto conversacional
  const prevUserMessages = history
    .filter(h => h.role === 'user')
    .slice(-3)
    .map(h => String(h.content).slice(0, 200));

  // El texto para detectar intención combina historial + mensaje actual
  // Se da más peso al mensaje actual (se analiza primero), pero el historial
  // aporta keywords que el mensaje actual puede no tener.
  const conversationText = [...prevUserMessages, message].join(' ');
  const normalized = normalizeText(conversationText);
  // También normalizar solo el mensaje actual para extraer searchTerms frescos
  const normalizedCurrent = normalizeText(message);

  const scores = {};

  // Puntuar cada intención según matches de keywords
  for (const [intent, config] of Object.entries(INTENT_PATTERNS)) {
    let score = 0;

    for (const keyword of config.keywords) {
      const normalizedKeyword = keyword
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      if (normalized.includes(normalizedKeyword)) {
        score += config.priority;
      }
    }

    if (score > 0) {
      scores[intent] = score;
    }
  }

  // Ordenar intenciones por score descendente
  const intents = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([intent]) => intent);

  // Extraer términos de búsqueda del mensaje actual + historial reciente
  // El mensaje actual tiene prioridad, pero se complementa con el historial
  const stopWords = new Set([
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del',
    'en', 'con', 'por', 'para', 'que', 'qué', 'como', 'cómo', 'es', 'son',
    'hay', 'tiene', 'tienen', 'puede', 'quiero', 'necesito', 'busco',
    'me', 'te', 'se', 'lo', 'le', 'nos', 'les', 'su', 'sus', 'mi', 'mis',
    'al', 'y', 'o', 'pero', 'si', 'no', 'muy', 'más', 'mas', 'este',
    'esta', 'ese', 'esa', 'algo', 'todo', 'cuanto', 'cuánto', 'donde', 'dónde',
    'viene', 'vienen', 'esos', 'esas', 'estos', 'estas', 'cual', 'cuales',
    'otro', 'otra', 'otros', 'otras', 'tambien', 'también', 'solo', 'ahi'
  ]);

  // Primero el mensaje actual, luego historial (para que los términos frescos estén primero)
  const currentTerms = normalizedCurrent.split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
  const historyTerms = prevUserMessages
    .map(m => normalizeText(m))
    .join(' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  // Combinar sin duplicados, priorizando los del mensaje actual
  const searchTerms = [...new Set([...currentTerms, ...historyTerms])];

  return {
    intents: intents.length > 0 ? intents : ['GENERAL'],
    primaryIntent: intents[0] || 'GENERAL',
    searchTerms
  };
};

module.exports = { detectIntent };
