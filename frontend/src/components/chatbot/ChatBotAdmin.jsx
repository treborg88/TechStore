// ChatBotAdmin.jsx - Sección de configuración del chatbot para SettingsManager
// Se integra como pestaña dentro del panel de Ajustes
import { useState, useEffect, useCallback } from 'react';
import { apiFetch, apiUrl } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import './ChatBotAdmin.css';

/**
 * Sección de configuración del chatbot.
 * Recibe props del SettingsManager padre: settings, onChange, setSettings
 */
function ChatBotAdmin({ settings, onChange, setSettings }) {
  const [providers, setProviders] = useState([]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Cargar lista de proveedores LLM al montar
  useEffect(() => {
    const loadProviders = async () => {
      try {
        const res = await apiFetch(apiUrl('/chatbot/providers'));
        if (res.ok) setProviders(await res.json());
      } catch (err) {
        console.error('Error loading LLM providers:', err);
      }
    };
    loadProviders();
  }, []);

  // Helper: actualizar un campo en settings del padre
  const updateField = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, [setSettings]);

  // Probar conexión con el LLM (guarda primero vía parent form submit pattern)
  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Guardar settings actuales para que backend los use
      await apiFetch(apiUrl('/settings'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const res = await apiFetch(apiUrl('/chatbot/test'), { method: 'POST' });
      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        toast.success('¡Conexión exitosa!');
      } else {
        toast.error(`Error: ${data.error}`);
      }
    } catch {
      setTestResult({ success: false, error: 'Error de conexión' });
      toast.error('Error de conexión');
    } finally {
      setTesting(false);
    }
  };

  // Proveedor seleccionado
  const selectedProvider = providers.find(p => p.id === settings.chatbotLlmProvider);

  return (
    <div className="chatbot-admin">

      {/* --- Activar/Desactivar --- */}
      <section className="chatbot-admin__section">
        <h3>Estado</h3>
        <label className="chatbot-admin__toggle-label">
          <input
            type="checkbox"
            checked={settings.chatbotEnabled === 'true'}
            onChange={e => updateField('chatbotEnabled', e.target.checked ? 'true' : 'false')}
          />
          <span>Chatbot {settings.chatbotEnabled === 'true' ? 'activado' : 'desactivado'}</span>
        </label>
      </section>

      {/* --- Proveedor LLM --- */}
      <section className="chatbot-admin__section">
        <h3>Proveedor de IA</h3>
        <div className="chatbot-admin__field">
          <label>Proveedor</label>
          <select
            value={settings.chatbotLlmProvider || 'groq'}
            onChange={e => updateField('chatbotLlmProvider', e.target.value)}
          >
            {providers.map(p => (
              <option key={p.id} value={p.id}>{p.name}{p.defaultModel ? ` (${p.defaultModel})` : ''}</option>
            ))}
          </select>
        </div>

        <div className="chatbot-admin__field">
          <label>API Key</label>
          <input
            type="password"
            value={settings.chatbotLlmApiKey || ''}
            onChange={e => updateField('chatbotLlmApiKey', e.target.value)}
            placeholder="sk-... o gsk_..."
          />
          <small>Se encripta al guardar. También puedes usar la variable CHATBOT_LLM_API_KEY en .env</small>
        </div>

        <div className="chatbot-admin__field">
          <label>Modelo (opcional)</label>
          <input
            type="text"
            value={settings.chatbotLlmModel || ''}
            onChange={e => updateField('chatbotLlmModel', e.target.value)}
            placeholder={selectedProvider?.defaultModel || 'Modelo por defecto del proveedor'}
          />
          <small>Dejar vacío para usar el modelo por defecto: {selectedProvider?.defaultModel || 'N/A'}</small>
        </div>

        {(settings.chatbotLlmProvider === 'custom') && (
          <div className="chatbot-admin__field">
            <label>URL Base (Custom)</label>
            <input
              type="text"
              value={settings.chatbotLlmCustomUrl || ''}
              onChange={e => updateField('chatbotLlmCustomUrl', e.target.value)}
              placeholder="https://api.example.com/v1/chat/completions"
            />
            <small>URL compatible con el formato de OpenAI</small>
          </div>
        )}

        {/* Botón de test */}
        <button
          type="button"
          className="chatbot-admin__btn chatbot-admin__btn--test"
          onClick={handleTest}
          disabled={testing || !settings.chatbotLlmApiKey || settings.chatbotLlmApiKey === '********'}
        >
          {testing ? 'Probando...' : '⚡ Probar conexión'}
        </button>
        {testResult && (
          <div className={`chatbot-admin__test-result ${testResult.success ? 'success' : 'error'}`}>
            {testResult.success
              ? `✅ ${testResult.response}`
              : `❌ ${testResult.error}`
            }
            {testResult.usage && (
              <small> — Tokens: {testResult.usage.total_tokens}</small>
            )}
          </div>
        )}
      </section>

      {/* --- Personalidad y verbosidad --- */}
      <section className="chatbot-admin__section">
        <h3>Comportamiento</h3>

        <div className="chatbot-admin__field">
          <label>Personalidad</label>
          <select
            value={settings.chatbotPersonality || 'friendly'}
            onChange={e => updateField('chatbotPersonality', e.target.value)}
          >
            <option value="formal">🎩 Formal — Trato de "usted", profesional</option>
            <option value="friendly">😊 Amigable — Cálido, cercano (recomendado)</option>
            <option value="casual">😎 Casual — Relajado, usa emojis</option>
          </select>
        </div>

        <div className="chatbot-admin__field">
          <label>Verbosidad</label>
          <select
            value={settings.chatbotVerbosity || 'normal'}
            onChange={e => updateField('chatbotVerbosity', e.target.value)}
          >
            <option value="brief">Breve — 1-2 oraciones</option>
            <option value="normal">Normal — 2-4 oraciones (recomendado)</option>
            <option value="detailed">Detallado — Respuestas completas con listas</option>
          </select>
        </div>

        <div className="chatbot-admin__field">
          <label>Temperatura (creatividad)</label>
          <div className="chatbot-admin__range-row">
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={settings.chatbotTemperature || '0.3'}
              onChange={e => updateField('chatbotTemperature', e.target.value)}
            />
            <span className="chatbot-admin__range-value">{settings.chatbotTemperature || '0.3'}</span>
          </div>
          <small>0 = preciso y repetible, 1 = creativo y variado</small>
        </div>

        <div className="chatbot-admin__field">
          <label>Max tokens por respuesta</label>
          <input
            type="number"
            min="50"
            max="2000"
            value={settings.chatbotMaxTokens || '500'}
            onChange={e => updateField('chatbotMaxTokens', e.target.value)}
          />
          <small>Controla el largo máximo de cada respuesta (500 recomendado)</small>
        </div>
      </section>

      {/* --- Apariencia --- */}
      <section className="chatbot-admin__section">
        <h3>Apariencia</h3>

        <div className="chatbot-admin__field">
          <label>Mensaje de bienvenida</label>
          <textarea
            rows={2}
            value={settings.chatbotGreeting || '¡Hola! 👋 ¿En qué puedo ayudarte?'}
            onChange={e => updateField('chatbotGreeting', e.target.value)}
            placeholder="¡Hola! ¿En qué puedo ayudarte?"
          />
        </div>

        <div className="chatbot-admin__field">
          <label>Placeholder del input</label>
          <input
            type="text"
            value={settings.chatbotPlaceholder || 'Escribe tu pregunta...'}
            onChange={e => updateField('chatbotPlaceholder', e.target.value)}
            placeholder="Escribe tu pregunta..."
          />
        </div>

        <div className="chatbot-admin__field">
          <label>Color del widget</label>
          <div className="chatbot-admin__color-row">
            <input
              type="color"
              value={settings.chatbotColor || '#2563eb'}
              onChange={e => updateField('chatbotColor', e.target.value)}
            />
            <input
              type="text"
              value={settings.chatbotColor || ''}
              onChange={e => updateField('chatbotColor', e.target.value)}
              placeholder="#2563eb (vacío = azul por defecto)"
            />
          </div>
        </div>

        <div className="chatbot-admin__field">
          <label>Max mensajes en pantalla</label>
          <input
            type="number"
            min="10"
            max="100"
            value={settings.chatbotMaxMessages || '30'}
            onChange={e => updateField('chatbotMaxMessages', e.target.value)}
          />
        </div>
      </section>

      {/* --- Prompt personalizado --- */}
      <section className="chatbot-admin__section">
        <h3>Instrucciones adicionales</h3>
        <div className="chatbot-admin__field">
          <label>System prompt adicional (opcional)</label>
          <textarea
            rows={4}
            value={settings.chatbotSystemPrompt || ''}
            onChange={e => updateField('chatbotSystemPrompt', e.target.value)}
            placeholder="Ej: No ofrezcas descuentos. Siempre recomienda visitar la tienda física."
          />
          <small>Estas instrucciones se agregan al contexto base del asistente. Úsalas para personalizar el comportamiento.</small>
        </div>
      </section>
    </div>
  );
}

export default ChatBotAdmin;
