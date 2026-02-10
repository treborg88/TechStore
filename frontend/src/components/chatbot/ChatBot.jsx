// ChatBot.jsx - Widget de chat con LLM (conecta al backend /api/chatbot)
// Modular, lazy-loaded. Se puede desactivar desde admin o eliminando del App.jsx.
import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { apiFetch, apiUrl } from '../../services/apiClient';
import './ChatBot.css';

// --- Constantes ---
const BOT_NAME = 'Asistente';
const FALLBACK_ICON = '🤖';

/**
 * Detecta la página actual y extrae metadata útil para el contexto del chatbot
 */
const detectPageContext = (pathname) => {
  // Mapear rutas a tipos de página con extracción de productId
  if (pathname.startsWith('/product/')) {
    const productId = pathname.split('/product/')[1]?.split('?')[0] || null;
    return { page: 'product-detail', productId };
  }
  if (pathname === '/cart') return { page: 'cart' };
  if (pathname === '/checkout') return { page: 'checkout' };
  if (pathname === '/orders' || pathname.startsWith('/orders')) return { page: 'orders' };
  if (pathname === '/contact') return { page: 'contact' };
  if (pathname === '/profile') return { page: 'profile' };
  if (pathname === '/login' || pathname === '/register') return { page: 'auth' };
  return { page: 'home' };
};

/**
 * Renderiza texto con negritas (**texto**), links (URLs) y listas (• item)
 */
const renderText = (text) => {
  // Separar por negritas y URLs
  const parts = text.split(/(\*\*[^*]+\*\*|https?:\/\/[^\s),]+)/g);
  return parts.map((part, i) => {
    // Negritas
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    // URLs — convertir a link clickeable
    if (/^https?:\/\//.test(part)) {
      return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="chatbot-link">{part}</a>;
    }
    return part;
  });
};

// ============================================================
// Componente principal
// ============================================================
function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState(null); // null = cargando, false = deshabilitado
  const [messages, setMessages] = useState([]);
  const [suggestions, setSuggestions] = useState([]); // Quick replies del backend
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [siteLogo, setSiteLogo] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const configLoaded = useRef(false);
  const location = useLocation();

  // Leer logo del sitio desde localStorage
  useEffect(() => {
    const logo = localStorage.getItem('siteLogo') || '';
    setSiteLogo(logo);
  }, []);

  // Cargar configuración del chatbot al montar
  useEffect(() => {
    if (configLoaded.current) return;
    configLoaded.current = true;

    const loadConfig = async () => {
      try {
        const res = await apiFetch(apiUrl('/chatbot/config'));
        if (!res.ok) { setConfig(false); return; }
        const data = await res.json();
        if (!data.enabled) { setConfig(false); return; }
        setConfig(data);
        // Mensaje inicial
        setMessages([{ from: 'bot', text: data.greeting || '¡Hola! 👋 ¿En qué puedo ayudarte?' }]);
      } catch {
        setConfig(false);
      }
    };
    loadConfig();
  }, []);

  // Auto-scroll al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input al abrir
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // Enviar mensaje al backend
  const handleSend = useCallback(async (overrideMessage) => {
    // Ignorar si overrideMessage es un evento de React (click del botón)
    const msg = (typeof overrideMessage === 'string') ? overrideMessage : input;
    const trimmed = msg.trim();
    if (!trimmed || loading) return;

    const maxMessages = config?.maxMessages || 30;

    // Agregar mensaje del usuario
    const userMsg = { from: 'user', text: trimmed };
    setMessages(prev => {
      const updated = [...prev, userMsg];
      return updated.length > maxMessages ? updated.slice(-maxMessages) : updated;
    });
    setInput('');
    setSuggestions([]); // Limpiar sugerencias al enviar
    setLoading(true);

    try {
      // Construir historial para contexto (solo últimos 6 pares)
      const history = messages
        .filter(m => m.from !== 'system')
        .slice(-12)
        .map(m => ({
          role: m.from === 'user' ? 'user' : 'assistant',
          content: m.text
        }));

      // Detectar contexto de página actual
      const pageContext = detectPageContext(location.pathname);

      // Agregar info del carrito si está disponible
      try {
        const cartData = JSON.parse(localStorage.getItem('cart_persistence') || '[]');
        pageContext.cartItemCount = cartData.length || 0;
      } catch { /* ignorar */ }

      const res = await apiFetch(apiUrl('/chatbot/message'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history, pageContext })
      });

      const data = await res.json();
      const botText = data.reply || data.message || 'No pude responder. Intenta de nuevo.';

      setMessages(prev => {
        const updated = [...prev, { from: 'bot', text: botText }];
        return updated.length > maxMessages ? updated.slice(-maxMessages) : updated;
      });

      // Mostrar sugerencias (quick replies) del backend
      if (data.suggestions && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { from: 'bot', text: 'Error de conexión. Intenta de nuevo en un momento.' }
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, config, location.pathname]);

  // Handler para click en sugerencia (quick reply)
  const handleSuggestionClick = useCallback((text) => {
    handleSend(text);
  }, [handleSend]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // No renderizar nada si está deshabilitado o cargando config
  if (config === null || config === false) return null;

  // Color personalizado del admin
  const accentColor = config.color || null;
  const toggleStyle = accentColor ? { background: accentColor } : {};
  const headerStyle = accentColor ? { background: accentColor } : {};
  const sendBtnStyle = accentColor ? { background: accentColor } : {};

  return (
    <>
      {/* Botón flotante */}
      <button
        className="chatbot-toggle"
        style={toggleStyle}
        onClick={() => setIsOpen(prev => !prev)}
        aria-label={isOpen ? 'Cerrar chat' : 'Abrir chat'}
        title="Asistente"
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {/* Panel del chat */}
      {isOpen && (
        <div className="chatbot-panel" role="dialog" aria-label="Chat de asistencia">
          {/* Header */}
          <div className="chatbot-header" style={headerStyle}>
            <span className="chatbot-header-icon">
              {siteLogo
                ? <img src={siteLogo} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
                : FALLBACK_ICON
              }
            </span>
            <span className="chatbot-header-title">{BOT_NAME}</span>
            <button className="chatbot-close" onClick={() => setIsOpen(false)} aria-label="Minimizar">˅</button>
          </div>

          {/* Mensajes */}
          <div className="chatbot-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`chatbot-msg chatbot-msg--${msg.from}`}>
                {msg.text.split('\n').map((line, j) => (
                  <p key={j}>{renderText(line)}</p>
                ))}
              </div>
            ))}
            {/* Indicador de "escribiendo..." */}
            {loading && (
              <div className="chatbot-msg chatbot-msg--bot chatbot-typing">
                <span className="chatbot-dot" /><span className="chatbot-dot" /><span className="chatbot-dot" />
              </div>
            )}
            {/* Quick replies (sugerencias contextuales) */}
            {!loading && suggestions.length > 0 && (
              <div className="chatbot-suggestions">
                {suggestions.map((s, i) => (
                  <button key={i} className="chatbot-suggestion-btn" onClick={() => handleSuggestionClick(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="chatbot-input-area">
            <input
              ref={inputRef}
              type="text"
              className="chatbot-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={config.placeholder || 'Escribe tu pregunta...'}
              maxLength={500}
              disabled={loading}
            />
            <button
              className="chatbot-send"
              style={sendBtnStyle}
              onClick={handleSend}
              disabled={!input.trim() || loading}
              aria-label="Enviar"
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default ChatBot;
