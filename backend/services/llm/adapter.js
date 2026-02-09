// services/llm/adapter.js - Capa de abstracción para proveedores LLM
// Soporta Groq, OpenAI, Google AI, OpenRouter y cualquier API compatible con OpenAI.
// Para cambiar proveedor: actualizar CHATBOT_LLM_PROVIDER en app_settings o .env

/**
 * Configuración de proveedores soportados.
 * Cada uno define baseURL y cómo se construye el header de autenticación.
 */
const PROVIDERS = {
  groq: {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: 'llama-3.3-70b-versatile',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  google: {
    name: 'Google AI',
    // Google Gemini usa endpoint distinto pero compatible via OpenAI shim
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    defaultModel: 'gemini-2.0-flash',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  // Custom: cualquier API compatible con OpenAI (ej: Ollama, Together, etc.)
  custom: {
    name: 'Custom',
    baseUrl: '', // Se configura en settings
    defaultModel: '',
    authHeader: (key) => key ? { Authorization: `Bearer ${key}` } : {},
  }
};

/**
 * Envía un mensaje al LLM y retorna la respuesta como texto.
 * @param {Object} options
 * @param {string} options.provider - Clave del proveedor (groq, openai, etc.)
 * @param {string} options.apiKey - API key del proveedor
 * @param {string} [options.model] - Modelo a usar (usa default del proveedor si no se pasa)
 * @param {Array} options.messages - Array de mensajes [{role, content}]
 * @param {number} [options.maxTokens=500] - Máximo de tokens en la respuesta
 * @param {number} [options.temperature=0.3] - Temperatura (creatividad)
 * @param {string} [options.customBaseUrl] - URL base para proveedor custom
 * @returns {Promise<{text: string, usage: Object|null}>}
 */
const chatCompletion = async ({
  provider = 'groq',
  apiKey,
  model,
  messages,
  maxTokens = 500,
  temperature = 0.3,
  customBaseUrl = ''
}) => {
  const config = PROVIDERS[provider] || PROVIDERS.custom;
  const url = provider === 'custom' && customBaseUrl ? customBaseUrl : config.baseUrl;
  const usedModel = model || config.defaultModel;

  if (!url) {
    throw new Error(`LLM provider "${provider}" no tiene URL configurada.`);
  }

  const headers = {
    'Content-Type': 'application/json',
    ...config.authHeader(apiKey)
  };

  const body = {
    model: usedModel,
    messages,
    max_tokens: maxTokens,
    temperature,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`LLM API error ${response.status}: ${errorBody.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    const usage = data.usage || null;

    return { text: text.trim(), usage };
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Retorna lista de proveedores disponibles (para panel admin)
 */
const getProviderList = () =>
  Object.entries(PROVIDERS).map(([id, p]) => ({
    id,
    name: p.name,
    defaultModel: p.defaultModel
  }));

module.exports = { chatCompletion, getProviderList, PROVIDERS };
