// SetupWizard.jsx - Initial setup wizard for database configuration
import { useState, useCallback } from 'react';
import { apiFetch, apiUrl } from '../../services/apiClient';
import './SetupWizard.css';

/**
 * Setup Wizard — shown when the backend has no database configured.
 * Guides the user through selecting a DB provider and entering credentials.
 * On success, the backend hot-reconnects (no server restart needed).
 */
function SetupWizard({ onSetupComplete }) {
  // Current step: 1 = provider selection, 2 = credentials, 3 = success
  const [step, setStep] = useState(1);
  const [provider, setProvider] = useState('supabase');

  // Credential fields
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');

  // UI state
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success'|'error'|'info'|'warning', message }

  // Available providers (extensible for future Docker, etc.)
  const providers = [
    { id: 'supabase', name: 'Supabase', icon: '⚡', description: 'PostgreSQL gestionado en la nube', enabled: true, badge: 'Recomendado' },
    { id: 'docker', name: 'Docker PostgreSQL', icon: '🐳', description: 'Base de datos local en contenedor', enabled: false, badge: 'Próximamente' },
  ];

  /**
   * Test the connection without saving
   */
  const handleTestConnection = useCallback(async () => {
    if (!url.trim() || !key.trim()) {
      setStatus({ type: 'error', message: 'Completa ambos campos' });
      return;
    }

    setTesting(true);
    setStatus(null);

    try {
      const res = await apiFetch(apiUrl('/setup/test-connection'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, url: url.trim(), key: key.trim() })
      });

      const data = await res.json();

      if (res.ok && data.connected) {
        // Connection successful
        const type = data.schemaReady ? 'success' : 'warning';
        setStatus({ type, message: data.message });
      } else {
        setStatus({ type: 'error', message: data.message || 'Error de conexión' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: `Error de red: ${err.message}` });
    } finally {
      setTesting(false);
    }
  }, [url, key, provider]);

  /**
   * Save credentials and activate the app
   */
  const handleConfigure = useCallback(async () => {
    if (!url.trim() || !key.trim()) {
      setStatus({ type: 'error', message: 'Completa ambos campos' });
      return;
    }

    setSaving(true);
    setStatus(null);

    try {
      const res = await apiFetch(apiUrl('/setup/configure'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, url: url.trim(), key: key.trim() })
      });

      const data = await res.json();

      if (res.ok) {
        // Move to success step
        setStep(3);
      } else {
        setStatus({ type: 'error', message: data.message || 'Error al configurar' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: `Error de red: ${err.message}` });
    } finally {
      setSaving(false);
    }
  }, [url, key, provider]);

  /**
   * Navigate to the app after successful setup
   */
  const handleGoToApp = useCallback(() => {
    if (onSetupComplete) {
      onSetupComplete();
    }
  }, [onSetupComplete]);

  // Step indicator icons
  const getStepClass = (s) => {
    if (s < step) return 'completed';
    if (s === step) return 'active';
    return 'pending';
  };

  return (
    <div className="setup-wizard">
      <div className="setup-card">
        {/* Header */}
        <div className="setup-header">
          <div className="setup-logo">🚀</div>
          <h1>Configuración Inicial</h1>
          <p>Configura la base de datos para comenzar a usar tu tienda</p>
        </div>

        {/* Steps indicator */}
        <div className="setup-steps">
          <div className="setup-step">
            <div className={`step-dot ${getStepClass(1)}`}>
              {step > 1 ? '✓' : '1'}
            </div>
            <span className="step-label">Proveedor</span>
          </div>
          <div className={`step-connector ${step > 1 ? 'completed' : ''}`} />
          <div className="setup-step">
            <div className={`step-dot ${getStepClass(2)}`}>
              {step > 2 ? '✓' : '2'}
            </div>
            <span className="step-label">Credenciales</span>
          </div>
          <div className={`step-connector ${step > 2 ? 'completed' : ''}`} />
          <div className="setup-step">
            <div className={`step-dot ${getStepClass(3)}`}>
              {step > 3 ? '✓' : '3'}
            </div>
            <span className="step-label">Listo</span>
          </div>
        </div>

        {/* Step 1: Provider Selection */}
        {step === 1 && (
          <>
            <div className="setup-providers">
              {providers.map(p => (
                <div
                  key={p.id}
                  className={`provider-card ${provider === p.id ? 'selected' : ''} ${!p.enabled ? 'disabled' : ''}`}
                  onClick={() => p.enabled && setProvider(p.id)}
                >
                  <div className="provider-icon">{p.icon}</div>
                  <div className="provider-info">
                    <h3>{p.name}</h3>
                    <p>{p.description}</p>
                  </div>
                  <span className={`provider-badge ${!p.enabled ? 'soon' : ''}`}>
                    {p.badge}
                  </span>
                </div>
              ))}
            </div>
            <div className="setup-actions">
              <button
                className="setup-btn primary"
                onClick={() => setStep(2)}
              >
                Continuar →
              </button>
            </div>
          </>
        )}

        {/* Step 2: Credentials */}
        {step === 2 && (
          <>
            <div className="setup-form">
              <div className="setup-field">
                <label htmlFor="setup-url">Supabase URL</label>
                <input
                  id="setup-url"
                  type="url"
                  placeholder="https://xxxxx.supabase.co"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="setup-field">
                <label htmlFor="setup-key">Supabase Anon Key</label>
                <input
                  id="setup-key"
                  type="password"
                  placeholder="eyJhbGciOi..."
                  value={key}
                  onChange={e => setKey(e.target.value)}
                />
              </div>
            </div>

            {/* Status message */}
            {status && (
              <div className={`setup-status ${status.type}`}>
                {status.type === 'success' && '✅'}
                {status.type === 'error' && '❌'}
                {status.type === 'warning' && '⚠️'}
                {status.type === 'info' && 'ℹ️'}
                {status.message}
              </div>
            )}

            <div className="setup-actions">
              <button
                className="setup-btn secondary"
                onClick={() => { setStep(1); setStatus(null); }}
              >
                ← Atrás
              </button>
              <button
                className="setup-btn secondary"
                onClick={handleTestConnection}
                disabled={testing || !url.trim() || !key.trim()}
              >
                {testing ? <span className="setup-spinner" /> : '🔌'}
                {testing ? 'Probando...' : 'Probar'}
              </button>
              <button
                className="setup-btn primary"
                onClick={handleConfigure}
                disabled={saving || !url.trim() || !key.trim()}
              >
                {saving ? <span className="setup-spinner" /> : '💾'}
                {saving ? 'Guardando...' : 'Configurar'}
              </button>
            </div>

            <div className="setup-help">
              <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">
                ¿No tienes cuenta? Crea un proyecto en Supabase →
              </a>
            </div>
          </>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <div className="setup-success">
            <div className="setup-success-icon">🎉</div>
            <h2>¡Configuración Completada!</h2>
            <p>La base de datos está conectada. Tu tienda está lista para usar.</p>
            <div className="setup-actions">
              <button className="setup-btn success" onClick={handleGoToApp}>
                Ir a la Tienda →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SetupWizard;
