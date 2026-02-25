// SetupWizard.jsx - Initial setup wizard for database configuration
import { useState, useCallback } from 'react';
import { apiFetch, apiUrl } from '../../services/apiClient';
import './SetupWizard.css';

/**
 * Setup Wizard — shown when the backend has no database configured.
 * 3-step flow: Provider → Credentials → Success
 * Schema creation is automatic via direct PostgreSQL connection (no manual SQL copy).
 */
function SetupWizard({ onSetupComplete }) {
  // Steps: 1 = provider, 2 = credentials, 3 = success
  const [step, setStep] = useState(1);
  const [provider, setProvider] = useState('supabase');

  // Credential fields
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [connString, setConnString] = useState('');

  // Connection state
  const [connected, setConnected] = useState(false);
  const [schemaReady, setSchemaReady] = useState(false);

  // UI state
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  // Available providers
  const providers = [
    { id: 'supabase', name: 'Supabase', icon: '⚡', description: 'PostgreSQL gestionado en la nube', enabled: true, badge: 'Cloud' },
    { id: 'postgres', name: 'PostgreSQL', icon: '🐘', description: 'PostgreSQL nativo (Docker, VPS, cualquier host)', enabled: true, badge: 'Self-hosted' },
  ];

  /**
   * Test the connection — reports whether schema tables exist
   */
  const handleTestConnection = useCallback(async () => {
    // Validate required fields per provider
    if (provider === 'postgres') {
      if (!connString.trim()) {
        setStatus({ type: 'error', message: 'Completa el Connection String' });
        return;
      }
    } else {
      if (!url.trim() || !key.trim()) {
        setStatus({ type: 'error', message: 'Completa URL y Key' });
        return;
      }
    }

    setTesting(true);
    setStatus(null);

    try {
      // Build payload based on provider
      const payload = provider === 'postgres'
        ? { provider, connectionString: connString.trim() }
        : { provider, url: url.trim(), key: key.trim() };

      const res = await apiFetch(apiUrl('/setup/test-connection'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && data.connected) {
        setConnected(true);
        setSchemaReady(data.schemaReady);
        setStatus({
          type: data.schemaReady ? 'success' : 'warning',
          message: data.schemaReady
            ? 'Conexión exitosa — base de datos lista'
            : 'Conectado, pero las tablas no existen. Se crearán automáticamente al configurar.'
        });
      } else {
        setConnected(false);
        setSchemaReady(false);
        setStatus({ type: 'error', message: data.message || 'Error de conexión' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: `Error de red: ${err.message}` });
    } finally {
      setTesting(false);
    }
  }, [url, key, connString, provider]);

  /**
   * Save credentials and activate the app.
   * If schema is missing, auto-creates tables first via direct PostgreSQL connection.
   */
  const handleConfigure = useCallback(async () => {
    // Validate required fields per provider
    const isPostgres = provider === 'postgres';
    if (isPostgres) {
      if (!connString.trim()) {
        setStatus({ type: 'error', message: 'Completa el Connection String' });
        return;
      }
    } else {
      if (!url.trim() || !key.trim()) {
        setStatus({ type: 'error', message: 'Completa URL y Key' });
        return;
      }
      // Supabase: connection string only required when tables don't exist
      if (!schemaReady && !connString.trim()) {
        setStatus({ type: 'error', message: 'Pega el Connection String de Supabase para crear las tablas' });
        return;
      }
    }

    setSaving(true);
    setStatus(null);

    try {
      // 1. If schema not ready → auto-create tables via pg
      if (!schemaReady) {
        setStatus({ type: 'info', message: 'Creando tablas y datos iniciales...' });

        // For postgres, use the same connString; for Supabase, it's the Session mode string
        const schemaConnString = isPostgres ? connString.trim() : connString.trim();

        const initRes = await apiFetch(apiUrl('/setup/initialize-schema'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connectionString: schemaConnString, provider })
        });
        const initData = await initRes.json();

        if (!initRes.ok) {
          setStatus({ type: 'error', message: initData.message || 'Error creando tablas' });
          return;
        }
      }

      // 2. Save credentials and activate
      setStatus({ type: 'info', message: 'Guardando configuración...' });

      const configPayload = isPostgres
        ? { provider, connectionString: connString.trim() }
        : { provider, url: url.trim(), key: key.trim() };

      const res = await apiFetch(apiUrl('/setup/configure'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configPayload)
      });

      const data = await res.json();

      if (res.ok) {
        setStep(3); // success
      } else {
        setStatus({ type: 'error', message: data.message || 'Error al configurar' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: `Error: ${err.message}` });
    } finally {
      setSaving(false);
    }
  }, [url, key, connString, provider, schemaReady]);

  // Reset connection state when credentials change
  const handleUrlChange = (e) => { setUrl(e.target.value); setConnected(false); setSchemaReady(false); };
  const handleKeyChange = (e) => { setKey(e.target.value); setConnected(false); setSchemaReady(false); };
  const handleConnStringChange = (e) => { setConnString(e.target.value); setConnected(false); setSchemaReady(false); };

  // Helper: are the required fields filled?
  const credentialsFilled = provider === 'postgres'
    ? connString.trim().length > 0
    : url.trim().length > 0 && key.trim().length > 0;

  // Helper: is the configure button enabled?
  const configureEnabled = connected && (schemaReady || connString.trim().length > 0);

  // Step indicator helper
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

        {/* Steps indicator (3 steps) */}
        <div className="setup-steps">
          {[
            { num: 1, label: 'Proveedor' },
            { num: 2, label: 'Credenciales' },
            { num: 3, label: 'Listo' }
          ].map((s, i) => (
            <div key={s.num} style={{ display: 'contents' }}>
              {i > 0 && <div className={`step-connector ${step > s.num - 1 ? 'completed' : ''}`} />}
              <div className="setup-step">
                <div className={`step-dot ${getStepClass(s.num)}`}>
                  {step > s.num ? '✓' : s.num}
                </div>
                <span className="step-label">{s.label}</span>
              </div>
            </div>
          ))}
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
              <button className="setup-btn primary" onClick={() => setStep(2)}>
                Continuar →
              </button>
            </div>
          </>
        )}

        {/* Step 2: Credentials + automatic schema creation */}
        {step === 2 && (
          <>
            <div className="setup-form">
              {/* Supabase fields: URL + Key */}
              {provider === 'supabase' && (
                <>
                  <div className="setup-field">
                    <label htmlFor="setup-url">Supabase URL</label>
                    <input
                      id="setup-url"
                      type="url"
                      placeholder="https://xxxxx.supabase.co"
                      value={url}
                      onChange={handleUrlChange}
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
                      onChange={handleKeyChange}
                    />
                  </div>
                </>
              )}

              {/* PostgreSQL field: Connection String */}
              {provider === 'postgres' && (
                <div className="setup-field">
                  <label htmlFor="setup-connstr-pg">Connection String</label>
                  <input
                    id="setup-connstr-pg"
                    type="password"
                    placeholder="postgresql://user:password@host:5432/dbname"
                    value={connString}
                    onChange={handleConnStringChange}
                    autoFocus
                  />
                  <small className="setup-field-help">
                    Formato: <code>postgresql://usuario:contraseña@host:5432/basedatos</code>
                  </small>
                </div>
              )}

              {/* Supabase: Connection String for schema creation (only when connected but schema missing) */}
              {provider === 'supabase' && connected && !schemaReady && (
                <div className="setup-field setup-field-highlight">
                  <label htmlFor="setup-connstr">
                    Connection String (Session mode)
                    <span className="setup-field-hint">
                      Supabase Dashboard → Connect → Session mode (puerto 5432, NO 6543)
                    </span>
                  </label>
                  <input
                    id="setup-connstr"
                    type="password"
                    placeholder="postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-0-...pooler.supabase.com:5432/postgres"
                    value={connString}
                    onChange={handleConnStringChange}
                    autoFocus
                  />
                  <small className="setup-field-help">
                    ⚠️ Usa <strong>Session mode</strong> (puerto 5432). Transaction mode (6543) no soporta creación de tablas.
                  </small>
                </div>
              )}
            </div>

            {status && (
              <div className={`setup-status ${status.type}`}>
                {status.type === 'success' && '✅ '}
                {status.type === 'error' && '❌ '}
                {status.type === 'warning' && '⚠️ '}
                {status.type === 'info' && '⏳ '}
                {status.message}
              </div>
            )}

            <div className="setup-actions">
              <button
                className="setup-btn secondary"
                onClick={() => { setStep(1); setStatus(null); setConnected(false); setSchemaReady(false); }}
              >
                ← Atrás
              </button>
              <button
                className="setup-btn secondary"
                onClick={handleTestConnection}
                disabled={testing || !credentialsFilled}
              >
                {testing ? <span className="setup-spinner" /> : '🔌'}
                {testing ? 'Probando...' : 'Probar Conexión'}
              </button>
              <button
                className="setup-btn primary"
                onClick={handleConfigure}
                disabled={saving || !configureEnabled}
              >
                {saving ? <span className="setup-spinner" /> : null}
                {saving
                  ? (schemaReady ? 'Configurando...' : 'Creando tablas...')
                  : (schemaReady ? '💾 Configurar' : '🚀 Crear Tablas y Configurar')
                }
              </button>
            </div>

            <div className="setup-help">
              {provider === 'supabase' ? (
                <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">
                  ¿No tienes cuenta? Crea un proyecto en Supabase →
                </a>
              ) : (
                <a href="https://hub.docker.com/_/postgres" target="_blank" rel="noopener noreferrer">
                  ¿Necesitas PostgreSQL? Usa Docker: docker run -e POSTGRES_PASSWORD=secret -p 5432:5432 postgres →
                </a>
              )}
            </div>
          </>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <div className="setup-success">
            <div className="setup-success-icon">🎉</div>
            <h2>¡Configuración Completada!</h2>
            <p>La base de datos está conectada y las tablas están listas. Tu tienda está operativa.</p>
            <div className="setup-actions">
              <button className="setup-btn success" onClick={onSetupComplete}>
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
