// SetupWizard.jsx - Initial setup wizard for database configuration
import { useState, useCallback, useEffect } from 'react';
import { apiFetch, apiUrl } from '../../services/apiClient';
import './SetupWizard.css';

/**
 * Setup Wizard — shown when the backend has no database configured.
 * 3-step flow: Provider → Credentials → Success
 * For PostgreSQL: auto-detects local DB from env, user only enters password.
 */
function SetupWizard({ onSetupComplete }) {
  // Steps: 1 = provider, 2 = credentials, 3 = success
  const [step, setStep] = useState(1);
  const [provider, setProvider] = useState('supabase');

  // Credential fields (Supabase)
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [connString, setConnString] = useState('');

  // PostgreSQL individual fields
  const [pgHost, setPgHost] = useState('');
  const [pgPort, setPgPort] = useState('5432');
  const [pgDatabase, setPgDatabase] = useState('');
  const [pgUser, setPgUser] = useState('');
  const [pgPassword, setPgPassword] = useState('');

  // Auto-detection state
  const [detected, setDetected] = useState(null);   // null = not checked, object = result
  const [detecting, setDetecting] = useState(false);

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
   * Auto-detect local PostgreSQL when entering step 2 with postgres provider.
   * Reads DATABASE_URL from the backend env and pre-fills fields.
   */
  useEffect(() => {
    if (step !== 2 || provider !== 'postgres' || detected !== null) return;

    let cancelled = false;
    const detect = async () => {
      setDetecting(true);
      try {
        const res = await apiFetch(apiUrl('/setup/detect'));
        const data = await res.json();
        if (cancelled) return;
        setDetected(data);
        // Pre-fill fields from detected config
        if (data.detected) {
          setPgHost(data.host || '');
          setPgPort(data.port || '5432');
          setPgDatabase(data.database || '');
          setPgUser(data.user || '');
          // If already reachable + schema ready, mark as connected
          if (data.reachable && data.schemaReady) {
            setConnected(true);
            setSchemaReady(true);
            setStatus({ type: 'success', message: '✅ Base de datos detectada y lista — solo ingresa la contraseña para confirmar' });
          } else if (data.reachable) {
            setStatus({ type: 'warning', message: 'Base de datos detectada pero las tablas no existen. Se crearán automáticamente.' });
          }
        }
      } catch {
        if (!cancelled) setDetected({ detected: false });
      } finally {
        if (!cancelled) setDetecting(false);
      }
    };
    detect();
    return () => { cancelled = true; };
  }, [step, provider, detected]);

  /**
   * Build PostgreSQL payload from individual fields
   */
  const buildPgPayload = useCallback(() => ({
    provider: 'postgres',
    host: pgHost.trim(),
    port: pgPort.trim() || '5432',
    database: pgDatabase.trim(),
    user: pgUser.trim(),
    password: pgPassword,
  }), [pgHost, pgPort, pgDatabase, pgUser, pgPassword]);

  /**
   * Test the connection — reports whether schema tables exist
   */
  const handleTestConnection = useCallback(async () => {
    // Validate required fields per provider
    if (provider === 'postgres') {
      if (!pgHost.trim() || !pgUser.trim() || !pgPassword) {
        setStatus({ type: 'error', message: 'Completa host, usuario y contraseña' });
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
        ? buildPgPayload()
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
  }, [url, key, provider, buildPgPayload, pgHost, pgUser, pgPassword]);

  /**
   * Save credentials and activate the app.
   * If schema is missing, auto-creates tables first via direct PostgreSQL connection.
   */
  const handleConfigure = useCallback(async () => {
    const isPostgres = provider === 'postgres';
    if (isPostgres) {
      if (!pgHost.trim() || !pgUser.trim() || !pgPassword) {
        setStatus({ type: 'error', message: 'Completa host, usuario y contraseña' });
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
      // Build the connection string for schema init (PostgreSQL uses individual fields)
      const pgPayload = isPostgres ? buildPgPayload() : null;
      const pgConnStr = isPostgres
        ? `postgresql://${encodeURIComponent(pgUser)}:${encodeURIComponent(pgPassword)}@${pgHost.trim()}:${pgPort.trim() || '5432'}/${pgDatabase.trim() || 'postgres'}`
        : null;

      // 1. If schema not ready → auto-create tables via pg
      if (!schemaReady) {
        setStatus({ type: 'info', message: 'Creando tablas y datos iniciales...' });

        const schemaConnString = isPostgres ? pgConnStr : connString.trim();

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
        ? pgPayload
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
  }, [url, key, connString, provider, schemaReady, buildPgPayload, pgUser, pgPassword, pgHost, pgPort, pgDatabase]);

  // Reset connection state when credentials change
  const handleUrlChange = (e) => { setUrl(e.target.value); setConnected(false); setSchemaReady(false); };
  const handleKeyChange = (e) => { setKey(e.target.value); setConnected(false); setSchemaReady(false); };
  const handleConnStringChange = (e) => { setConnString(e.target.value); setConnected(false); setSchemaReady(false); };
  const handlePgFieldChange = (setter) => (e) => { setter(e.target.value); setConnected(false); setSchemaReady(false); setStatus(null); };

  // Helper: are the required fields filled?
  const credentialsFilled = provider === 'postgres'
    ? pgHost.trim().length > 0 && pgUser.trim().length > 0 && pgPassword.length > 0
    : url.trim().length > 0 && key.trim().length > 0;

  // Helper: is the configure button enabled?
  const configureEnabled = connected && (schemaReady || (provider === 'postgres' ? pgPassword.length > 0 : connString.trim().length > 0));

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

              {/* PostgreSQL: auto-detected fields + password input */}
              {provider === 'postgres' && (
                detecting ? (
                  <div className="setup-detecting">
                    <span className="setup-spinner" />
                    <span>Detectando base de datos...</span>
                  </div>
                ) : (
                  <>
                    {/* Detected DB info banner */}
                    {detected?.detected && (
                      <div className="setup-detected-info">
                        <div className="detected-icon">🐘</div>
                        <div className="detected-details">
                          <strong>{detected.database}</strong>
                          <span className="detected-host">{detected.user}@{detected.host}:{detected.port}</span>
                        </div>
                        <span className={`detected-badge ${detected.reachable ? 'online' : 'offline'}`}>
                          {detected.reachable ? '● Activa' : '● Sin conexión'}
                        </span>
                      </div>
                    )}

                    {/* Host + Port row */}
                    <div className="setup-field-row">
                      <div className="setup-field" style={{ flex: 2 }}>
                        <label htmlFor="setup-pg-host">Host</label>
                        <input
                          id="setup-pg-host"
                          type="text"
                          placeholder="localhost o database"
                          value={pgHost}
                          onChange={handlePgFieldChange(setPgHost)}
                          readOnly={!!detected?.detected}
                        />
                      </div>
                      <div className="setup-field" style={{ flex: 1 }}>
                        <label htmlFor="setup-pg-port">Puerto</label>
                        <input
                          id="setup-pg-port"
                          type="text"
                          placeholder="5432"
                          value={pgPort}
                          onChange={handlePgFieldChange(setPgPort)}
                          readOnly={!!detected?.detected}
                        />
                      </div>
                    </div>

                    {/* Database + User row */}
                    <div className="setup-field-row">
                      <div className="setup-field">
                        <label htmlFor="setup-pg-db">Base de datos</label>
                        <input
                          id="setup-pg-db"
                          type="text"
                          placeholder="techstore"
                          value={pgDatabase}
                          onChange={handlePgFieldChange(setPgDatabase)}
                          readOnly={!!detected?.detected}
                        />
                      </div>
                      <div className="setup-field">
                        <label htmlFor="setup-pg-user">Usuario</label>
                        <input
                          id="setup-pg-user"
                          type="text"
                          placeholder="techstore"
                          value={pgUser}
                          onChange={handlePgFieldChange(setPgUser)}
                          readOnly={!!detected?.detected}
                        />
                      </div>
                    </div>

                    {/* Password — always editable, the only required input */}
                    <div className="setup-field setup-field-highlight">
                      <label htmlFor="setup-pg-pass">Contraseña</label>
                      <input
                        id="setup-pg-pass"
                        type="password"
                        placeholder="Ingresa la contraseña de la base de datos"
                        value={pgPassword}
                        onChange={handlePgFieldChange(setPgPassword)}
                        autoFocus
                      />
                    </div>
                  </>
                )
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
                onClick={() => { setStep(1); setStatus(null); setConnected(false); setSchemaReady(false); setDetected(null); }}
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
