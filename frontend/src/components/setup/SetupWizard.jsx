// SetupWizard.jsx - Initial setup wizard for PostgreSQL database configuration
import { useState, useCallback } from 'react';
import { apiFetch, apiUrl } from '../../services/apiClient';
import './SetupWizard.css';

/**
 * Setup Wizard — shown when the backend has no database configured.
 * 2-step flow: Credentials → Success
 * Schema creation is automatic via direct PostgreSQL connection.
 */
function SetupWizard({ onSetupComplete }) {
  // Steps: 1 = credentials, 2 = success
  const [step, setStep] = useState(1);

  // Credential fields
  const [connString, setConnString] = useState('');

  // Connection state
  const [connected, setConnected] = useState(false);
  const [schemaReady, setSchemaReady] = useState(false);

  // UI state
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  /**
   * Test the connection — reports whether schema tables exist
   */
  const handleTestConnection = useCallback(async () => {
    if (!connString.trim()) {
      setStatus({ type: 'error', message: 'Completa el Connection String' });
      return;
    }

    setTesting(true);
    setStatus(null);

    try {
      const res = await apiFetch(apiUrl('/setup/test-connection'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionString: connString.trim() })
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
  }, [connString]);

  /**
   * Save credentials and activate the app.
   * If schema is missing, auto-creates tables first.
   */
  const handleConfigure = useCallback(async () => {
    if (!connString.trim()) {
      setStatus({ type: 'error', message: 'Completa el Connection String' });
      return;
    }

    setSaving(true);
    setStatus(null);

    try {
      // 1. If schema not ready → auto-create tables via pg
      if (!schemaReady) {
        setStatus({ type: 'info', message: 'Creando tablas y datos iniciales...' });

        const initRes = await apiFetch(apiUrl('/setup/initialize-schema'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connectionString: connString.trim() })
        });
        const initData = await initRes.json();

        if (!initRes.ok) {
          setStatus({ type: 'error', message: initData.message || 'Error creando tablas' });
          return;
        }
      }

      // 2. Save credentials and activate
      setStatus({ type: 'info', message: 'Guardando configuración...' });

      const res = await apiFetch(apiUrl('/setup/configure'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionString: connString.trim() })
      });

      const data = await res.json();

      if (res.ok) {
        setStep(2); // success
      } else {
        setStatus({ type: 'error', message: data.message || 'Error al configurar' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: `Error: ${err.message}` });
    } finally {
      setSaving(false);
    }
  }, [connString, schemaReady]);

  // Reset connection state when credentials change
  const handleConnStringChange = (e) => { setConnString(e.target.value); setConnected(false); setSchemaReady(false); };

  // Helper: are the required fields filled?
  const credentialsFilled = connString.trim().length > 0;

  // Helper: is the configure button enabled?
  const configureEnabled = connected && (schemaReady || connString.trim().length > 0);

  return (
    <div className="setup-wizard">
      <div className="setup-card">
        {/* Header */}
        <div className="setup-header">
          <div className="setup-logo">🚀</div>
          <h1>Configuración Inicial</h1>
          <p>Configura la base de datos PostgreSQL para comenzar a usar tu tienda</p>
        </div>

        {/* Steps indicator (2 steps) */}
        <div className="setup-steps">
          {[
            { num: 1, label: 'Credenciales' },
            { num: 2, label: 'Listo' }
          ].map((s, i) => (
            <div key={s.num} style={{ display: 'contents' }}>
              {i > 0 && <div className={`step-connector ${step > s.num - 1 ? 'completed' : ''}`} />}
              <div className="setup-step">
                <div className={`step-dot ${s.num < step ? 'completed' : s.num === step ? 'active' : 'pending'}`}>
                  {step > s.num ? '✓' : s.num}
                </div>
                <span className="step-label">{s.label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Step 1: PostgreSQL Credentials + automatic schema creation */}
        {step === 1 && (
          <>
            <div className="setup-form">
              <div className="setup-field">
                <label htmlFor="setup-connstr-pg">🐘 Connection String de PostgreSQL</label>
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
              <a href="https://hub.docker.com/_/postgres" target="_blank" rel="noopener noreferrer">
                ¿Necesitas PostgreSQL? Usa Docker: docker run -e POSTGRES_PASSWORD=secret -p 5432:5432 postgres →
              </a>
            </div>
          </>
        )}

        {/* Step 2: Success */}
        {step === 2 && (
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
