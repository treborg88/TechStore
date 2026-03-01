import React, { useState, useEffect, useRef } from 'react';
import { apiFetch, apiUrl } from '../../services/apiClient';

/**
 * DatabaseManager — Backup/Restore panel inside DatabaseSection.
 * Creates unified .tar.gz archives (database.sql + product images).
 * Same-name backup replaces previous to avoid accumulation.
 * Editable name + optional version suffix for keeping multiple versions.
 */
function DatabaseManager() {
  // ── State ─────────────────────────────────────────────────
  const [backups, setBackups] = useState([]);
  const [storeName, setStoreName] = useState('');
  const [stats, setStats] = useState(null);
  const [imageCount, setImageCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [collapsed, setCollapsed] = useState(true);

  // Backup creation fields
  const [backupName, setBackupName] = useState('');
  const [backupVersion, setBackupVersion] = useState('');

  const fileInputRef = useRef(null);

  // Auto-clear alerts after 5s
  useEffect(() => {
    if (success || error) {
      const t = setTimeout(() => { setSuccess(null); setError(null); }, 5000);
      return () => clearTimeout(t);
    }
  }, [success, error]);

  // Fetch data when panel opens
  useEffect(() => {
    if (!collapsed) { fetchBackups(); fetchStats(); }
  }, [collapsed]);

  // ── API calls ─────────────────────────────────────────────

  /** Fetch backup list + store name (for default backup name). */
  const fetchBackups = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(apiUrl('/database/backups'));
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups || []);
        // Set store name as default backup name (only if user hasn't edited it)
        if (data.storeName && !backupName) setBackupName(data.storeName);
        if (data.storeName) setStoreName(data.storeName);
      }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  /** Fetch live table row counts + image count. */
  const fetchStats = async () => {
    try {
      const res = await apiFetch(apiUrl('/database/stats'));
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setImageCount(data.imageCount || 0);
      }
    } catch { /* silent */ }
  };

  /** Create a unified .tar.gz backup. Same name overwrites previous. */
  const createBackup = async () => {
    try {
      setCreating(true);
      setError(null);
      const res = await apiFetch(apiUrl('/database/backup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: backupName || undefined, version: backupVersion || undefined })
      });
      const data = await res.json();
      if (res.ok) {
        const msg = data.replaced ? ' (reemplazó anterior)' : '';
        setSuccess(`Backup: ${data.filename} — ${data.imageCount} imgs${msg}`);
        fetchBackups();
        if (data.tableStats) setStats(data.tableStats);
      } else { setError(data.message || 'Error al crear backup'); }
    } catch (err) { setError(err.message); }
    finally { setCreating(false); }
  };

  /** Restore from a .tar.gz or legacy .sql file. */
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
        const imgMsg = data.imagesRestored ? ` + ${data.imageCount} imágenes` : '';
        setSuccess(`Restaurado: ${filename}${imgMsg}`);
        setRestoring(null);
        setConfirmText('');
        fetchBackups();
        fetchStats();
      } else { setError(data.message || 'Error al restaurar'); }
    } catch (err) { setError(err.message); }
  };

  /** Delete a single backup file. */
  const deleteBackup = async (filename) => {
    if (!window.confirm(`¿Eliminar "${filename}"?`)) return;
    try {
      const res = await apiFetch(apiUrl(`/database/backups/${encodeURIComponent(filename)}`), { method: 'DELETE' });
      if (res.ok) {
        setSuccess('Backup eliminado');
        setBackups(prev => prev.filter(b => b.filename !== filename));
      } else {
        const data = await res.json();
        setError(data.message || 'Error al eliminar');
      }
    } catch (err) { setError(err.message); }
  };

  /** Download backup with type filter: data (full), sql, or images. */
  const downloadBackup = (filename, type = 'data') => {
    const url = apiUrl(`/database/backups/${encodeURIComponent(filename)}/download?type=${type}`);
    window.open(url, '_blank');
  };

  /** Upload a .tar.gz or .sql file. Same-name overwrites. */
  const uploadBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.sql') && !file.name.endsWith('.tar.gz')) {
      setError('Solo se permiten archivos .tar.gz o .sql');
      return;
    }
    try {
      setUploading(true);
      setError(null);
      const formData = new FormData();
      formData.append('backupFile', file);
      const res = await apiFetch(apiUrl('/database/backups/upload'), { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Subido: ${data.filename}`);
        fetchBackups();
      } else { setError(data.message || 'Error al subir'); }
    } catch (err) { setError(err.message); }
    finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Helpers ───────────────────────────────────────────────

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const diff = Date.now() - d;
    if (diff < 60000) return 'hace un momento';
    if (diff < 3600000) return `hace ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `hace ${Math.floor(diff / 3600000)}h`;
    return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  /** Check if creating this backup will overwrite an existing file. */
  const willReplace = () => {
    const name = (backupName || storeName || 'techstore').replace(/[^a-zA-Z0-9_-]/g, '');
    const ver = backupVersion ? `-${backupVersion.replace(/[^a-zA-Z0-9._-]/g, '')}` : '';
    const fn = `${name}${ver}.tar.gz`;
    return backups.some(b => b.filename === fn) ? fn : null;
  };

  // ── Stat labels ───────────────────────────────────────────
  const statLabels = {
    users: '👥 Usuarios', products: '📦 Productos', product_images: '🖼️ Imgs DB',
    orders: '📋 Órdenes', order_items: '📝 Items', cart: '🛒 Carrito',
    app_settings: '⚙️ Ajustes', verification_codes: '🔑 Códigos'
  };

  // ── Styles ────────────────────────────────────────────────
  const s = {
    wrapper: { marginTop: '24px', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f9fafb', cursor: 'pointer', userSelect: 'none' },
    headerTitle: { fontSize: '14px', fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' },
    chevron: (open) => ({ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', fontSize: '12px', color: '#6b7280' }),
    body: { padding: '16px', borderTop: '1px solid #e5e7eb' },
    statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px', marginBottom: '16px' },
    statCard: { padding: '8px 12px', borderRadius: '6px', background: '#f3f4f6', textAlign: 'center', fontSize: '12px' },
    statLabel: { color: '#6b7280', marginBottom: '2px' },
    statValue: { fontWeight: 700, fontSize: '16px', color: '#111827' },
    // Backup creation form
    createForm: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '16px', padding: '12px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0' },
    fieldGroup: { display: 'flex', flexDirection: 'column', gap: '3px' },
    fieldLabel: { fontSize: '11px', fontWeight: 600, color: '#374151' },
    input: { padding: '7px 10px', borderRadius: '5px', border: '1px solid #d1d5db', fontSize: '13px', width: '160px' },
    inputSmall: { padding: '7px 10px', borderRadius: '5px', border: '1px solid #d1d5db', fontSize: '13px', width: '100px' },
    replaceHint: { fontSize: '11px', color: '#b45309', fontWeight: 500, marginLeft: '4px' },
    // Buttons
    actions: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' },
    btn: (bg = '#111827', fg = '#fff', border = 'none') => ({
      padding: '8px 14px', borderRadius: '6px', border, background: bg, color: fg,
      fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px'
    }),
    smBtn: (bg, fg, border = 'none') => ({
      padding: '5px 10px', borderRadius: '4px', border, background: bg, color: fg,
      fontSize: '12px', fontWeight: 500, cursor: 'pointer'
    }),
    // List
    list: { display: 'flex', flexDirection: 'column', gap: '8px' },
    item: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff', flexWrap: 'wrap', gap: '8px' },
    itemInfo: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '200px' },
    itemName: { fontSize: '13px', fontWeight: 600, color: '#111827', wordBreak: 'break-all' },
    itemMeta: { fontSize: '12px', color: '#6b7280' },
    badge: (bg, fg) => ({ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 8px', borderRadius: '10px', background: bg, color: fg, fontSize: '11px', fontWeight: 600, marginLeft: '6px' }),
    itemActions: { display: 'flex', gap: '4px', flexWrap: 'wrap' },
    // Restore modal
    restoreModal: { marginTop: '8px', padding: '12px', borderRadius: '6px', border: '1px solid #fbbf24', background: '#fffbeb' },
    inputRow: { display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' },
    // Alerts
    alert: (type) => ({
      padding: '10px 14px', borderRadius: '6px', marginBottom: '12px', fontSize: '13px', fontWeight: 500,
      background: type === 'error' ? '#fee2e2' : '#d1fae5',
      color: type === 'error' ? '#991b1b' : '#065f46',
      border: `1px solid ${type === 'error' ? '#fca5a5' : '#6ee7b7'}`
    })
  };

  const replacingFile = willReplace();

  return (
    <div style={s.wrapper}>
      {/* Collapsible header */}
      <div style={s.header} onClick={() => setCollapsed(p => !p)}>
        <span style={s.headerTitle}>💾 Gestor de Backups</span>
        <span style={s.chevron(!collapsed)}>▼</span>
      </div>

      {!collapsed && (
        <div style={s.body}>
          {/* Alerts */}
          {error && <div style={s.alert('error')}>❌ {error}</div>}
          {success && <div style={s.alert('success')}>✅ {success}</div>}

          {/* Live stats */}
          {stats && (
            <>
              <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#374151' }}>
                📊 Estado Actual {imageCount > 0 && <span style={{ fontWeight: 400, color: '#6b7280' }}>· 🖼️ {imageCount} imágenes en disco</span>}
              </h4>
              <div style={s.statsGrid}>
                {Object.entries(stats).map(([t, c]) => (
                  <div key={t} style={s.statCard}>
                    <div style={s.statLabel}>{statLabels[t] || t}</div>
                    <div style={s.statValue}>{c >= 0 ? c : '—'}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Backup creation form ──────────────────────────── */}
          <div style={s.createForm}>
            <div style={s.fieldGroup}>
              <span style={s.fieldLabel}>Nombre</span>
              <input
                type="text"
                style={s.input}
                value={backupName}
                onChange={(e) => setBackupName(e.target.value)}
                placeholder={storeName || 'techstore'}
              />
            </div>
            <div style={s.fieldGroup}>
              <span style={s.fieldLabel}>Versión (opcional)</span>
              <input
                type="text"
                style={s.inputSmall}
                value={backupVersion}
                onChange={(e) => setBackupVersion(e.target.value)}
                placeholder="v1.0"
              />
            </div>
            <button
              type="button"
              onClick={createBackup}
              disabled={creating}
              style={s.btn(creating ? '#9ca3af' : '#059669', '#fff')}
            >
              {creating ? '⏳ Creando...' : '📥 Crear Backup'}
            </button>
            {replacingFile && (
              <span style={s.replaceHint}>⚠ Reemplazará: {replacingFile}</span>
            )}
          </div>

          {/* Action buttons row */}
          <div style={s.actions}>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} style={s.btn('#2563eb', '#fff')}>
              {uploading ? '⏳ Subiendo...' : '📤 Subir Backup'}
            </button>
            <button type="button" onClick={() => { fetchBackups(); fetchStats(); }} disabled={loading} style={s.btn('#fff', '#374151', '1px solid #d1d5db')}>
              🔄 Refrescar
            </button>
            {/* Hidden file input — single file, .tar.gz or .sql */}
            <input ref={fileInputRef} type="file" accept=".sql,.tar.gz,.gz" style={{ display: 'none' }} onChange={uploadBackup} />
          </div>

          {/* ── Backup list ───────────────────────────────────── */}
          <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#374151' }}>
            📁 Backups ({backups.length})
          </h4>

          {loading && <p style={{ fontSize: '13px', color: '#6b7280' }}>Cargando...</p>}
          {!loading && backups.length === 0 && (
            <p style={{ fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>No hay backups. Crea uno para comenzar.</p>
          )}

          <div style={s.list}>
            {backups.map(b => (
              <div key={b.filename}>
                <div style={s.item}>
                  <div style={s.itemInfo}>
                    <span style={s.itemName}>
                      {b.isArchive ? '📦' : '📄'} {b.filename}
                      {/* Content badges */}
                      {b.hasSql && <span style={s.badge('#d1fae5', '#065f46')}>SQL ✓</span>}
                      {b.imageCount > 0
                        ? <span style={s.badge('#dbeafe', '#1e40af')}>🖼️ {b.imageCount}</span>
                        : b.isArchive && <span style={s.badge('#f3f4f6', '#9ca3af')}>sin imgs</span>
                      }
                    </span>
                    <span style={s.itemMeta}>{formatSize(b.size)} · {formatDate(b.date)}</span>
                  </div>

                  <div style={s.itemActions}>
                    {/* Restore */}
                    <button type="button" onClick={() => { setRestoring(restoring === b.filename ? null : b.filename); setConfirmText(''); }} style={s.smBtn('#fbbf24', '#78350f')}>
                      ♻️ Restaurar
                    </button>
                    {/* Download — Completo (default) */}
                    <button type="button" onClick={() => downloadBackup(b.filename, 'data')} style={s.smBtn('#e0e7ff', '#3730a3')} title="Descargar completo (SQL + imágenes)">
                      ⬇️ Completo
                    </button>
                    {/* Download — SQL only */}
                    {b.hasSql && b.isArchive && (
                      <button type="button" onClick={() => downloadBackup(b.filename, 'sql')} style={s.smBtn('#f0fdf4', '#166534')} title="Descargar solo SQL">
                        ⬇️ SQL
                      </button>
                    )}
                    {/* Download — Images only */}
                    {b.imageCount > 0 && b.isArchive && (
                      <button type="button" onClick={() => downloadBackup(b.filename, 'images')} style={s.smBtn('#fef3c7', '#92400e')} title="Descargar solo imágenes">
                        ⬇️ 🖼️
                      </button>
                    )}
                    {/* Delete */}
                    <button type="button" onClick={() => deleteBackup(b.filename)} style={s.smBtn('#fee2e2', '#991b1b')}>🗑️</button>
                  </div>
                </div>

                {/* Restore confirmation */}
                {restoring === b.filename && (
                  <div style={s.restoreModal}>
                    <p style={{ margin: 0, fontSize: '13px', color: '#92400e', lineHeight: '1.4' }}>
                      ⚠️ <strong>Esto reemplazará TODOS los datos actuales</strong>. Se creará un backup de seguridad automático.
                    </p>
                    {b.imageCount > 0 && (
                      <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#1e40af', fontWeight: 500 }}>
                        🖼️ Se restaurarán {b.imageCount} imágenes de productos.
                      </p>
                    )}
                    <div style={s.inputRow}>
                      <input
                        type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
                        placeholder='Escribe "RESTAURAR"'
                        style={{ flex: 1, padding: '6px 10px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px' }}
                      />
                      <button type="button" onClick={() => restoreBackup(b.filename)} disabled={confirmText !== 'RESTAURAR'}
                        style={s.smBtn(confirmText === 'RESTAURAR' ? '#dc2626' : '#d1d5db', confirmText === 'RESTAURAR' ? '#fff' : '#9ca3af')}>
                        Confirmar
                      </button>
                      <button type="button" onClick={() => { setRestoring(null); setConfirmText(''); }}
                        style={s.smBtn('#fff', '#374151', '1px solid #d1d5db')}>
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
