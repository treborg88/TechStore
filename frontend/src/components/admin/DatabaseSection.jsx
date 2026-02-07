import React, { useState, useEffect } from 'react';
import { apiFetch, apiUrl } from '../../services/apiClient';

/**
 * Database status section (read-only)
 * Fetches real connection info from the backend and displays it
 */
function DatabaseSection() {
  const [dbInfo, setDbInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch DB status on mount
  useEffect(() => {
    const fetchDbStatus = async () => {
      try {
        setLoading(true);
        const res = await apiFetch(apiUrl('/settings/db-status'));
        if (!res.ok) throw new Error('No se pudo obtener el estado de la base de datos');
        const data = await res.json();
        setDbInfo(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDbStatus();
  }, []);

  return (
    <section className="settings-section">
      <h3>🗄️ Base de Datos</h3>
      <p className="section-description">
        Estado de la conexión y datos del proveedor de base de datos.
      </p>

      {loading && (
        <p style={{ color: '#6b7280', padding: '12px 0' }}>Verificando conexión...</p>
      )}

      {error && (
        <p style={{ color: '#ef4444', padding: '12px 0' }}>❌ {error}</p>
      )}

      {dbInfo && (
        <>
          {/* Connection status badge */}
          <div style={{ marginBottom: '16px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 600,
              color: dbInfo.connected ? '#065f46' : '#991b1b',
              background: dbInfo.connected ? '#d1fae5' : '#fee2e2'
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: dbInfo.connected ? '#10b981' : '#ef4444',
                display: 'inline-block'
              }} />
              {dbInfo.connected ? 'Conectada' : 'Sin conexión'}
            </span>
          </div>

          <div className="settings-grid">
            <div className="form-group">
              <label>Proveedor</label>
              <input type="text" value={dbInfo.provider || 'Supabase'} disabled />
            </div>
            <div className="form-group">
              <label>URL del Proyecto</label>
              <input type="text" value={dbInfo.url || 'No configurada'} disabled />
            </div>
            <div className="form-group">
              <label>Referencia del Proyecto</label>
              <input type="text" value={dbInfo.projectRef || 'N/A'} disabled />
            </div>
            <div className="form-group">
              <label>API Key</label>
              <input
                type="text"
                value={dbInfo.apiKeySet ? dbInfo.maskedKey : '⚠️ No configurada'}
                disabled
                style={{ color: dbInfo.apiKeySet ? undefined : '#ef4444' }}
              />
            </div>
            <div className="form-group">
              <label>Tablas detectadas</label>
              <input type="text" value={dbInfo.connected ? `${dbInfo.tableCount} tablas accesibles` : 'No disponible'} disabled />
            </div>
            {dbInfo.dashboardUrl && (
              <div className="form-group">
                <label>Panel de Supabase</label>
                <a
                  href={dbInfo.dashboardUrl}
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
            Para cambiar las credenciales, actualiza <strong>SUPABASE_URL</strong> y <strong>SUPABASE_KEY</strong> en el archivo <code>.env</code> del backend y reinicia el servidor.
          </p>
        </>
      )}
    </section>
  );
}

export default DatabaseSection;
