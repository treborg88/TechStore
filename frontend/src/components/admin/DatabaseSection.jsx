import React, { useState, useEffect, useRef } from 'react';
import { apiFetch, apiUrl } from '../../services/apiClient';

/**
 * Editable database settings section
 * Allows admin to configure Supabase URL & Key, and shows live connection status
 */
function DatabaseSection({ settings, onChange, setSettings }) {
  const [showKey, setShowKey] = useState(false);
  const [dbStatus, setDbStatus] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState(null);
  const hasSynced = useRef(false);

  // Fetch live DB status on mount
  useEffect(() => {
    fetchDbStatus();
  }, []);

  // Pre-populate editable fields from live env when settings are empty (first time)
  useEffect(() => {
    if (dbStatus && !hasSynced.current) {
      hasSynced.current = true;
      setSettings(prev => {
        const updates = {};
        // Only fill if the field is empty (no saved value yet)
        if (!prev.dbSupabaseUrl && dbStatus.url) {
          updates.dbSupabaseUrl = dbStatus.url;
        }
        if (!prev.dbSupabaseKey && dbStatus.maskedKey) {
          updates.dbSupabaseKey = dbStatus.maskedKey;
        }
        return Object.keys(updates).length ? { ...prev, ...updates } : prev;
      });
    }
  }, [dbStatus, setSettings]);

  // Fetches connection status from the backend
  const fetchDbStatus = async () => {
    try {
      setTesting(true);
      setTestError(null);
      const res = await apiFetch(apiUrl('/settings/db-status'));
      if (!res.ok) throw new Error('No se pudo obtener el estado');
      const data = await res.json();
      setDbStatus(data);
    } catch (err) {
      setTestError(err.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="settings-section">
      <h3>🗄️ Base de Datos</h3>
      <p className="section-description">
        Configura las credenciales de conexión a Supabase y verifica el estado.
      </p>

      {/* Connection status badge */}
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        {dbStatus && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: 600,
            color: dbStatus.connected ? '#065f46' : '#991b1b',
            background: dbStatus.connected ? '#d1fae5' : '#fee2e2'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: dbStatus.connected ? '#10b981' : '#ef4444',
              display: 'inline-block'
            }} />
            {dbStatus.connected ? 'Conectada' : 'Sin conexión'}
          </span>
        )}
        <button
          type="button"
          onClick={fetchDbStatus}
          disabled={testing}
          style={{
            padding: '6px 14px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            background: '#ffffff',
            fontSize: '13px',
            fontWeight: 500,
            color: '#111827',
            cursor: testing ? 'wait' : 'pointer'
          }}
        >
          {testing ? 'Probando...' : '🔄 Probar Conexión'}
        </button>
      </div>

      {testError && (
        <p style={{ color: '#ef4444', padding: '0 0 12px' }}>❌ {testError}</p>
      )}

      {/* Editable credentials */}
      <div className="settings-grid">
        <div className="form-group">
          <label>Proveedor</label>
          <input type="text" value="Supabase (PostgreSQL)" disabled />
        </div>
        <div className="form-group">
          <label>URL del Proyecto (SUPABASE_URL)</label>
          <input
            type="text"
            name="dbSupabaseUrl"
            value={settings.dbSupabaseUrl || ''}
            onChange={onChange}
            placeholder="https://xxxxx.supabase.co"
          />
        </div>
        <div className="form-group">
          <label>API Key (SUPABASE_KEY)</label>
          <div className="password-field">
            <input
              type={showKey ? 'text' : 'password'}
              name="dbSupabaseKey"
              value={settings.dbSupabaseKey || ''}
              onChange={onChange}
              placeholder="eyJhbGciOiJI..."
            />
            <button
              type="button"
              className="toggle-password-btn"
              onClick={() => setShowKey(prev => !prev)}
            >
              {showKey ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </div>
      </div>

      {/* Live status details (read-only) */}
      {dbStatus && (
        <>
          <h4 style={{ margin: '20px 0 10px', fontSize: '14px', color: '#374151' }}>
            Estado Actual del Servidor
          </h4>
          <div className="settings-grid">
            <div className="form-group">
              <label>Referencia del Proyecto</label>
              <input type="text" value={dbStatus.projectRef || 'N/A'} disabled />
            </div>
            <div className="form-group">
              <label>Tablas detectadas</label>
              <input
                type="text"
                value={dbStatus.connected ? `${dbStatus.tableCount} tablas accesibles` : 'No disponible'}
                disabled
              />
            </div>
            {dbStatus.dashboardUrl && (
              <div className="form-group">
                <label>Panel de Supabase</label>
                <a
                  href={dbStatus.dashboardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block',
                    padding: '8px 16px',
                    background: '#111827',
                    color: '#fff',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    fontSize: '13px',
                    fontWeight: 500
                  }}
                >
                  🔗 Abrir Dashboard
                </a>
              </div>
            )}
          </div>

          <p className="field-hint" style={{ marginTop: '16px' }}>
            ⚠️ Los valores editables se guardan como referencia. Para aplicar cambios reales en la conexión,
            actualiza <strong>SUPABASE_URL</strong> y <strong>SUPABASE_KEY</strong> en el archivo <code>.env</code> del backend y reinicia el servidor.
          </p>
        </>
      )}
    </section>
  );
}

export default DatabaseSection;
