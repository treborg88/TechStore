import React, { useState, useEffect, useRef } from 'react';
import { apiFetch, apiUrl } from '../../services/apiClient';

/**
 * DatabaseManager — Backup/Restore sub-panel inside DatabaseSection.
 * Allows admins to: create backups, list them, restore, upload, download, delete.
 */
function DatabaseManager() {
  const [backups, setBackups] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(null); // filename being restored
  const [confirmText, setConfirmText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [collapsed, setCollapsed] = useState(true);
  const fileInputRef = useRef(null);

  // Clear messages after 5s
  useEffect(() => {
    if (success || error) {
      const t = setTimeout(() => { setSuccess(null); setError(null); }, 5000);
      return () => clearTimeout(t);
    }
  }, [success, error]);

  // Fetch backups + stats when panel opens
  useEffect(() => {
    if (!collapsed) {
      fetchBackups();
      fetchStats();
    }
  }, [collapsed]);

  // ── API calls ─────────────────────────────────────────────

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(apiUrl('/database/backups'));
      if (res.ok) setBackups(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await apiFetch(apiUrl('/database/stats'));
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
    } catch { /* silent */ }
  };

  const createBackup = async () => {
    try {
      setCreating(true);
      setError(null);
      const res = await apiFetch(apiUrl('/database/backup'), { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Backup creado: ${data.filename}`);
        fetchBackups();
        if (data.tableStats) setStats(data.tableStats);
      } else {
        setError(data.message || 'Error al crear backup');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const restoreBackup = async (filename) => {
    try {
      setError(null);
      const res = await apiFetch(apiUrl('/database/restore'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, confirmText })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Restaurado: ${filename}. Backup de seguridad: ${data.safetyBackup}`);
        setRestoring(null);
        setConfirmText('');
        fetchBackups();
        if (data.tableStats) setStats(data.tableStats);
      } else {
        setError(data.message || 'Error al restaurar');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteBackup = async (filename) => {
    if (!window.confirm(`¿Eliminar backup "${filename}"?`)) return;
    try {
      const res = await apiFetch(apiUrl(`/database/backups/${encodeURIComponent(filename)}`), { method: 'DELETE' });
      if (res.ok) {
        setSuccess('Backup eliminado');
        setBackups(prev => prev.filter(b => b.filename !== filename));
      } else {
        const data = await res.json();
        setError(data.message || 'Error al eliminar');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const downloadBackup = (filename) => {
    // Trigger download via hidden link (auth cookie handles auth)
    window.open(apiUrl(`/database/backups/${encodeURIComponent(filename)}/download`), '_blank');
  };

  const uploadBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.sql')) {
      setError('Solo se permiten archivos .sql');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      const formData = new FormData();
      formData.append('backupFile', file);
      const res = await apiFetch(apiUrl('/database/backups/upload'), {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Backup subido: ${data.filename}`);
        fetchBackups();
      } else {
        setError(data.message || 'Error al subir');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Helpers ───────────────────────────────────────────────

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'hace un momento';
    if (diff < 3600000) return `hace ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `hace ${Math.floor(diff / 3600000)}h`;
    return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // ── Stat labels for display ───────────────────────────────
  const statLabels = {
    users: '👥 Usuarios',
    products: '📦 Productos',
    product_images: '🖼️ Imágenes',
    orders: '📋 Órdenes',
    order_items: '📝 Items',
    cart: '🛒 Carrito',
    app_settings: '⚙️ Ajustes',
    verification_codes: '🔑 Códigos'
  };

  // ── Styles ────────────────────────────────────────────────
  const styles = {
    wrapper: {
      marginTop: '24px',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      overflow: 'hidden'
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      background: '#f9fafb',
      cursor: 'pointer',
      userSelect: 'none'
    },
    headerTitle: {
      fontSize: '14px',
      fontWeight: 600,
      color: '#111827',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    chevron: (open) => ({
      transform: open ? 'rotate(180deg)' : 'rotate(0)',
      transition: 'transform 0.2s',
      fontSize: '12px',
      color: '#6b7280'
    }),
    body: {
      padding: '16px',
      borderTop: '1px solid #e5e7eb'
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
      gap: '8px',
      marginBottom: '16px'
    },
    statCard: {
      padding: '8px 12px',
      borderRadius: '6px',
      background: '#f3f4f6',
      textAlign: 'center',
      fontSize: '12px'
    },
    statLabel: {
      color: '#6b7280',
      marginBottom: '2px'
    },
    statValue: {
      fontWeight: 700,
      fontSize: '16px',
      color: '#111827'
    },
    actions: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap',
      marginBottom: '16px'
    },
    btn: (bg = '#111827', color = '#fff', border = 'none') => ({
      padding: '8px 14px',
      borderRadius: '6px',
      border,
      background: bg,
      color,
      fontSize: '13px',
      fontWeight: 500,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px'
    }),
    list: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    },
    backupItem: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 14px',
      borderRadius: '6px',
      border: '1px solid #e5e7eb',
      background: '#fff',
      flexWrap: 'wrap',
      gap: '8px'
    },
    backupInfo: {
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      minWidth: '200px'
    },
    backupName: {
      fontSize: '13px',
      fontWeight: 600,
      color: '#111827',
      wordBreak: 'break-all'
    },
    backupMeta: {
      fontSize: '12px',
      color: '#6b7280'
    },
    backupActions: {
      display: 'flex',
      gap: '6px',
      flexWrap: 'wrap'
    },
    smBtn: (bg, color, border = 'none') => ({
      padding: '5px 10px',
      borderRadius: '4px',
      border,
      background: bg,
      color,
      fontSize: '12px',
      fontWeight: 500,
      cursor: 'pointer'
    }),
    restoreModal: {
      marginTop: '8px',
      padding: '12px',
      borderRadius: '6px',
      border: '1px solid #fbbf24',
      background: '#fffbeb'
    },
    inputRow: {
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
      marginTop: '8px'
    },
    alert: (type) => ({
      padding: '10px 14px',
      borderRadius: '6px',
      marginBottom: '12px',
      fontSize: '13px',
      fontWeight: 500,
      background: type === 'error' ? '#fee2e2' : '#d1fae5',
      color: type === 'error' ? '#991b1b' : '#065f46',
      border: `1px solid ${type === 'error' ? '#fca5a5' : '#6ee7b7'}`
    })
  };

  return (
    <div style={styles.wrapper}>
      {/* Collapsible header */}
      <div style={styles.header} onClick={() => setCollapsed(p => !p)}>
        <span style={styles.headerTitle}>
          💾 Gestor de Backups
        </span>
        <span style={styles.chevron(!collapsed)}>▼</span>
      </div>

      {/* Body (only when expanded) */}
      {!collapsed && (
        <div style={styles.body}>
          {/* Alerts */}
          {error && <div style={styles.alert('error')}>❌ {error}</div>}
          {success && <div style={styles.alert('success')}>✅ {success}</div>}

          {/* Live stats */}
          {stats && (
            <>
              <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#374151' }}>📊 Estado Actual</h4>
              <div style={styles.statsGrid}>
                {Object.entries(stats).map(([table, count]) => (
                  <div key={table} style={styles.statCard}>
                    <div style={styles.statLabel}>{statLabels[table] || table}</div>
                    <div style={styles.statValue}>{count >= 0 ? count : '—'}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Action buttons */}
          <div style={styles.actions}>
            <button
              type="button"
              onClick={createBackup}
              disabled={creating}
              style={styles.btn(creating ? '#9ca3af' : '#059669', '#fff')}
            >
              {creating ? '⏳ Creando...' : '📥 Crear Backup'}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={styles.btn('#2563eb', '#fff')}
            >
              {uploading ? '⏳ Subiendo...' : '📤 Subir Backup'}
            </button>
            <button
              type="button"
              onClick={() => { fetchBackups(); fetchStats(); }}
              disabled={loading}
              style={styles.btn('#fff', '#374151', '1px solid #d1d5db')}
            >
              🔄 Refrescar
            </button>
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".sql"
              style={{ display: 'none' }}
              onChange={uploadBackup}
            />
          </div>

          {/* Backup list */}
          <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#374151' }}>
            📁 Backups Disponibles ({backups.length})
          </h4>

          {loading && <p style={{ fontSize: '13px', color: '#6b7280' }}>Cargando...</p>}

          {!loading && backups.length === 0 && (
            <p style={{ fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>
              No hay backups. Crea uno para comenzar.
            </p>
          )}

          <div style={styles.list}>
            {backups.map(b => (
              <div key={b.filename}>
                <div style={styles.backupItem}>
                  <div style={styles.backupInfo}>
                    <span style={styles.backupName}>📄 {b.filename}</span>
                    <span style={styles.backupMeta}>
                      {formatSize(b.size)} · {formatDate(b.date)}
                    </span>
                  </div>
                  <div style={styles.backupActions}>
                    <button
                      type="button"
                      onClick={() => { setRestoring(restoring === b.filename ? null : b.filename); setConfirmText(''); }}
                      style={styles.smBtn('#fbbf24', '#78350f')}
                    >
                      ♻️ Restaurar
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadBackup(b.filename)}
                      style={styles.smBtn('#e0e7ff', '#3730a3')}
                    >
                      ⬇️ Descargar
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteBackup(b.filename)}
                      style={styles.smBtn('#fee2e2', '#991b1b')}
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Restore confirmation panel */}
                {restoring === b.filename && (
                  <div style={styles.restoreModal}>
                    <p style={{ margin: 0, fontSize: '13px', color: '#92400e', lineHeight: '1.4' }}>
                      ⚠️ <strong>Esto reemplazará TODOS los datos actuales</strong> con el contenido de este backup.
                      Se creará un backup de seguridad automático antes de restaurar.
                    </p>
                    <div style={styles.inputRow}>
                      <input
                        type="text"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder='Escribe "RESTAURAR" para confirmar'
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: '4px',
                          border: '1px solid #d1d5db',
                          fontSize: '13px'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => restoreBackup(b.filename)}
                        disabled={confirmText !== 'RESTAURAR'}
                        style={styles.smBtn(
                          confirmText === 'RESTAURAR' ? '#dc2626' : '#d1d5db',
                          confirmText === 'RESTAURAR' ? '#fff' : '#9ca3af'
                        )}
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => { setRestoring(null); setConfirmText(''); }}
                        style={styles.smBtn('#fff', '#374151', '1px solid #d1d5db')}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DatabaseManager;
