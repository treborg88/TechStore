// SetupWizard.jsx - Initial setup wizard for database configuration
import { useState, useCallback } from 'react';
import { apiFetch, apiUrl } from '../../services/apiClient';
import './SetupWizard.css';

/**
 * Setup Wizard — shown when the backend has no database configured.
 * 4-step flow: Provider → Credentials → Schema → Success
 * On success, the backend hot-reconnects (no server restart needed).
 */
function SetupWizard({ onSetupComplete }) {
  // Steps: 1 = provider, 2 = credentials, 3 = schema init, 4 = success
  const [step, setStep] = useState(1);
  const [provider, setProvider] = useState('supabase');

  // Credential fields
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');

  // Schema state
  const [schemaSql, setSchemaSql] = useState('');
  const [schemaReady, setSchemaReady] = useState(false);
  const [copied, setCopied] = useState(false);

  // UI state
  const [testing, setTesting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  // Available providers
  const providers = [
    { id: 'supabase', name: 'Supabase', icon: '⚡', description: 'PostgreSQL gestionado en la nube', enabled: true, badge: 'Recomendado' },
    { id: 'docker', name: 'Docker PostgreSQL', icon: '🐳', description: 'Base de datos local en contenedor', enabled: false, badge: 'Próximamente' },
  ];

  /**
   * Test the connection — if connected, check schema and route accordingly
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
        if (data.schemaReady) {
          // Connection + schema OK → can configure directly
          setSchemaReady(true);
          setStatus({ type: 'success', message: data.message });
        } else {
          // Connected but no tables → need schema step
          setSchemaReady(false);
          setStatus({ type: 'warning', message: data.message });
        }
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
   * Proceed from step 2 — if schema ready go to configure, else go to schema step
   */
  const handleNextFromCredentials = useCallback(async () => {
    if (schemaReady) {
      // Schema exists, skip to configure directly
      handleConfigure();
    } else {
      // Need to initialize schema first — fetch SQL and go to step 3
      try {
        const res = await apiFetch(apiUrl('/setup/schema'));
        const data = await res.json();
        if (res.ok) {
          setSchemaSql(data.sql);
        }
      } catch {
        // Non-blocking: user can still copy from repo
      }
      setStep(3);
      setStatus(null);
    }
  }, [schemaReady]);

  /**
   * Verify schema tables exist after user runs SQL manually
   */
  const handleVerifySchema = useCallback(async () => {
    setVerifying(true);
    setStatus(null);

    try {
      const res = await apiFetch(apiUrl('/setup/check-schema'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), key: key.trim() })
      });

      const data = await res.json();

      if (res.ok && data.schemaReady) {
        setSchemaReady(true);
        setStatus({ type: 'success', message: 'Todas las tablas verificadas correctamente' });
      } else if (res.ok) {
        // Show which tables are missing
        const missing = Object.entries(data.tables || {})
          .filter(([, ok]) => !ok)
          .map(([name]) => name);
        setStatus({ 
          type: 'error', 
          message: `Tablas faltantes: ${missing.join(', ')}. Ejecuta el SQL completo.` 
        });
      } else {
        setStatus({ type: 'error', message: data.message || 'Error verificando' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: `Error: ${err.message}` });
    } finally {
      setVerifying(false);
    }
  }, [url, key]);

  /**
   * Copy SQL to clipboard
   */
  const handleCopySql = useCallback(() => {
    navigator.clipboard.writeText(schemaSql).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  }, [schemaSql]);

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
        setStep(4);
      } else {
        // If schema missing, redirect to schema step
        if (data.code === 'SCHEMA_MISSING') {
          try {
            const sqlRes = await apiFetch(apiUrl('/setup/schema'));
            const sqlData = await sqlRes.json();
            if (sqlRes.ok) setSchemaSql(sqlData.sql);
          } catch { /* non-blocking */ }
          setStep(3);
          setStatus({ type: 'warning', message: data.message });
        } else {
          setStatus({ type: 'error', message: data.message || 'Error al configurar' });
        }
      }
    } catch (err) {
      setStatus({ type: 'error', message: `Error de red: ${err.message}` });
    } finally {
      setSaving(false);
    }
  }, [url, key, provider]);

  /**
   * Build Supabase SQL Editor URL from project URL
   */
  const getSupabaseSqlEditorUrl = useCallback(() => {
    try {
      const projectRef = new URL(url).hostname.split('.')[0];
      return `https://supabase.com/dashboard/project/${projectRef}/sql/new`;
    } catch {
      return 'https://supabase.com/dashboard';
    }
  }, [url]);

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

        {/* Steps indicator (4 steps) */}
        <div className="setup-steps">
          {[
            { num: 1, label: 'Proveedor' },
            { num: 2, label: 'Credenciales' },
            { num: 3, label: 'Schema' },
            { num: 4, label: 'Listo' }
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

            {status && (
              <div className={`setup-status ${status.type}`}>
                {status.type === 'success' && '✅ '}
                {status.type === 'error' && '❌ '}
                {status.type === 'warning' && '⚠️ '}
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
                {testing ? 'Probando...' : 'Probar Conexión'}
              </button>
              <button
                className="setup-btn primary"
                onClick={handleNextFromCredentials}
                disabled={saving || !url.trim() || !key.trim() || status?.type === 'error'}
              >
                {saving ? <span className="setup-spinner" /> : null}
                {schemaReady ? '💾 Configurar' : 'Siguiente →'}
              </button>
            </div>

            <div className="setup-help">
              <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">
                ¿No tienes cuenta? Crea un proyecto en Supabase →
              </a>
            </div>
          </>
        )}

        {/* Step 3: Schema Initialization */}
        {step === 3 && (
          <>
            <div className="setup-schema">
              <div className="setup-schema-intro">
                <h3>📋 Inicializar Base de Datos</h3>
                <p>
                  La base de datos está conectada pero no tiene tablas.
                  Copia el SQL y ejecútalo en el <strong>SQL Editor</strong> de Supabase.
                </p>
              </div>

              {/* Instructions */}
              <div className="setup-schema-steps">
                <div className="schema-instruction">
                  <span className="schema-step-num">1</span>
                  <span>Copia el SQL con el botón de abajo</span>
                </div>
                <div className="schema-instruction">
                  <span className="schema-step-num">2</span>
                  <span>
                    Abre el{' '}
                    <a href={getSupabaseSqlEditorUrl()} target="_blank" rel="noopener noreferrer">
                      SQL Editor de Supabase ↗
                    </a>
                  </span>
                </div>
                <div className="schema-instruction">
                  <span className="schema-step-num">3</span>
                  <span>Pega el SQL y haz clic en <strong>Run</strong></span>
                </div>
                <div className="schema-instruction">
                  <span className="schema-step-num">4</span>
                  <span>Vuelve aquí y haz clic en <strong>Verificar</strong></span>
                </div>
              </div>

              {/* SQL preview */}
              {schemaSql && (
                <div className="setup-sql-container">
                  <pre className="setup-sql-preview">{schemaSql.slice(0, 500)}...</pre>
                  <button
                    className={`setup-btn ${copied ? 'success' : 'secondary'} setup-copy-btn`}
                    onClick={handleCopySql}
                  >
                    {copied ? '✅ Copiado' : '📋 Copiar SQL Completo'}
                  </button>
                </div>
              )}
            </div>

            {status && (
              <div className={`setup-status ${status.type}`}>
                {status.type === 'success' && '✅ '}
                {status.type === 'error' && '❌ '}
                {status.type === 'warning' && '⚠️ '}
                {status.message}
              </div>
            )}

            <div className="setup-actions">
              <button
                className="setup-btn secondary"
                onClick={() => { setStep(2); setStatus(null); }}
              >
                ← Atrás
              </button>
              <button
                className="setup-btn secondary"
                onClick={handleVerifySchema}
                disabled={verifying}
              >
                {verifying ? <span className="setup-spinner" /> : '🔍'}
                {verifying ? 'Verificando...' : 'Verificar Tablas'}
              </button>
              <button
                className="setup-btn primary"
                onClick={handleConfigure}
                disabled={!schemaReady || saving}
              >
                {saving ? <span className="setup-spinner" /> : '💾'}
                {saving ? 'Guardando...' : 'Configurar'}
              </button>
            </div>
          </>
        )}

        {/* Step 4: Success */}
        {step === 4 && (
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
