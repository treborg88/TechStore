import React, { useState, useEffect, useRef } from 'react';
import { apiFetch, apiUrl } from '../../services/apiClient';
import DatabaseManager from './DatabaseManager';

/**
 * Database settings section — PostgreSQL only
 * Shows connection status, credentials (read-only), and backup/restore.
 */
function DatabaseSection({ settings, setSettings }) {
  const [showKey, setShowKey] = useState(false);
  const [dbStatus, setDbStatus] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const hasSynced = useRef(false);

  // Fetch live DB status on mount
  useEffect(() => {
    fetchDbStatus();
  }, []);

  // Pre-populate connection URL from live env when settings are empty (first time)
  useEffect(() => {
    if (dbStatus && !hasSynced.current) {
      hasSynced.current = true;
      setSettings(prev => {
        if (!prev.dbConnectionUrl && dbStatus.url) {
          return { ...prev, dbConnectionUrl: dbStatus.url };
        }
        return prev;
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
        Configuración y estado de la conexión a PostgreSQL.
      </p>

      {/* Connection status badge + test button */}
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
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

      {/* Provider info */}
      <div className="settings-grid">
        <div className="form-group">
          <label>Proveedor</label>
          <input type="text" value={`🐘 ${dbStatus?.provider || 'PostgreSQL'}`} disabled />
        </div>
      </div>

      {/* PostgreSQL credentials (read-only, come from env) */}
      <div className="settings-grid" style={{ marginTop: '12px' }}>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label>URL de Conexión (DATABASE_URL)</label>
          <div className="password-field">
            <input
              type={showKey ? 'text' : 'password'}
              value={dbStatus?.url || settings.dbConnectionUrl || ''}
              disabled
              placeholder="postgresql://user:****@host:5432/dbname"
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
              <label>Tablas detectadas</label>
              <input
                type="text"
                value={dbStatus.connected ? `${dbStatus.tableCount} tablas accesibles` : 'No disponible'}
                disabled
              />
            </div>
            <div className="form-group">
              <label>Almacenamiento de imágenes</label>
              <input type="text" value="Sistema de archivos (uploads/)" disabled />
            </div>
          </div>

          {/* Hint about how to change credentials */}
          <p className="field-hint" style={{ marginTop: '16px' }}>
            ⚠️ La conexión PostgreSQL se configura desde el archivo <code>.env</code> del backend
            (variable <strong>DATABASE_URL</strong>). Reinicia el servidor tras modificar.
          </p>
        </>
      )}

      {/* Backup/Restore manager */}
      <DatabaseManager />

      {/* Disconnect / Migration section */}
      <div style={{
        marginTop: '24px',
        padding: '16px',
        borderRadius: '8px',
        border: '1px solid #fca5a5',
        background: '#fef2f2'
      }}>
        <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: '#991b1b' }}>
          ⚠️ Zona de Riesgo
        </h4>
        <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#7f1d1d', lineHeight: '1.5' }}>
          Desconectar la base de datos pondrá la app en <strong>modo setup</strong>.
          La tienda dejará de funcionar hasta que se configure una nueva base de datos.
          Útil para migración o cambio de servidor PostgreSQL.
        </p>

        {!showDisconnectConfirm ? (
          <button
            type="button"
            onClick={() => setShowDisconnectConfirm(true)}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #ef4444',
              background: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              color: '#ef4444',
              cursor: 'pointer'
            }}
          >
            🔌 Desconectar Base de Datos
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: '#991b1b', fontWeight: 600 }}>
              ¿Estás seguro?
            </span>
            <button
              type="button"
              disabled={disconnecting}
              onClick={async () => {
                setDisconnecting(true);
                try {
                  const res = await apiFetch(apiUrl('/settings/db-disconnect'), { method: 'POST' });
                  if (res.ok) {
                    // Reload the page — App.jsx will detect setup mode
                    window.location.reload();
                  } else {
                    const data = await res.json();
                    setTestError(data.message || 'Error al desconectar');
                    setShowDisconnectConfirm(false);
                  }
                } catch (err) {
                  setTestError(err.message);
                  setShowDisconnectConfirm(false);
                } finally {
                  setDisconnecting(false);
                }
              }}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                background: '#ef4444',
                fontSize: '13px',
                fontWeight: 600,
                color: '#ffffff',
                cursor: disconnecting ? 'wait' : 'pointer'
              }}
            >
              {disconnecting ? 'Desconectando...' : '✅ Sí, Desconectar'}
            </button>
            <button
              type="button"
              onClick={() => setShowDisconnectConfirm(false)}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                background: '#ffffff',
                fontSize: '13px',
                fontWeight: 500,
                color: '#374151',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export default DatabaseSection;
