// ChatBot.jsx - Widget de chat con LLM (conecta al backend /api/chatbot)
// Modular, lazy-loaded. Se puede desactivar desde admin o eliminando del App.jsx.
import { useState, useRef, useEffect, useCallback } from 'react';
import { apiFetch, apiUrl } from '../../services/apiClient';
import './ChatBot.css';

// --- Constantes ---
const BOT_NAME = 'Asistente';
const FALLBACK_ICON = '🤖';
const FALLBACK_TOGGLE = '💬';

/**
 * Renderiza texto con negritas (**texto**) y listas (• item)
 */
const renderText = (text) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
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
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [siteLogo, setSiteLogo] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const configLoaded = useRef(false);

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
  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const maxMessages = config?.maxMessages || 30;

    // Agregar mensaje del usuario
    const userMsg = { from: 'user', text: trimmed };
    setMessages(prev => {
      const updated = [...prev, userMsg];
      return updated.length > maxMessages ? updated.slice(-maxMessages) : updated;
    });
    setInput('');
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

      const res = await apiFetch(apiUrl('/chatbot/message'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history })
      });

      const data = await res.json();
      const botText = data.reply || data.message || 'No pude responder. Intenta de nuevo.';

      setMessages(prev => {
        const updated = [...prev, { from: 'bot', text: botText }];
        return updated.length > maxMessages ? updated.slice(-maxMessages) : updated;
      });
    } catch {
      setMessages(prev => [
        ...prev,
        { from: 'bot', text: 'Error de conexión. Intenta de nuevo en un momento.' }
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, config]);

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
