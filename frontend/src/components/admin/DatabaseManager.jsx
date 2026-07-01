import React, { useState, useEffect, useRef } from 'react';
import { apiFetch, apiUrl } from '../../services/apiClient';
import ProcessingOverlay from '../common/ProcessingOverlay';

function DatabaseManager() {
  const MIN_RESTORE_ANIMATION_MS = 30000;

  const [storeName, setStoreName] = useState('store');
  const [stats, setStats] = useState(null);
  const [imageCount, setImageCount] = useState(0);
  const [loadingStats, setLoadingStats] = useState(false);

  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [restoreFile, setRestoreFile] = useState(null);

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [collapsed, setCollapsed] = useState(true);

  const [backupName, setBackupName] = useState('');
  const [backupVersion, setBackupVersion] = useState('');
  const [backupFormat, setBackupFormat] = useState('sql');
  const [restoreOverlay, setRestoreOverlay] = useState({
    visible: false,
    status: 'idle',
    title: '',
    subtitle: ''
  });

  const restoreInputRef = useRef(null);

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  useEffect(() => {
    if (success || error) {
      const t = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [success, error]);

  useEffect(() => {
    if (!collapsed) {
      fetchStats();
      fetchStoreName();
    }
  }, [collapsed]);

  const fetchStoreName = async () => {
    try {
      const res = await apiFetch(apiUrl('/database/backups'));
      if (!res.ok) return;
      const data = await res.json();
      const nextName = (data.storeName || 'store').replace(/[^a-zA-Z0-9_-]/g, '');
      setStoreName(nextName || 'store');
      if (!backupName) setBackupName(nextName || 'store');
    } catch {
      // silent fallback
    }
  };

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const res = await apiFetch(apiUrl('/database/stats'));
      if (!res.ok) return;
      const data = await res.json();
      setStats(data.stats);
      setImageCount(data.imageCount || 0);
    } catch {
      // silent
    } finally {
      setLoadingStats(false);
    }
  };

  const buildRequestedName = () => {
    const name = (backupName || storeName || 'store').replace(/[^a-zA-Z0-9_-]/g, '');
    const version = (backupVersion || '').replace(/[^a-zA-Z0-9._-]/g, '');
    return {
      name: name || 'store',
      version: version || undefined,
      includeImages: backupFormat === 'full'
    };
  };

  const parseFilename = (disposition, fallbackName) => {
    const match = disposition?.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i);
    if (match?.[1]) return decodeURIComponent(match[1].replace(/"/g, ''));
    return fallbackName;
  };

  const createBackup = async () => {
    try {
      setCreating(true);
      setError(null);

      const request = buildRequestedName();
      const res = await apiFetch(apiUrl('/database/backup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Error al crear backup');
      }

      const blob = await res.blob();
      const fallbackExt = request.includeImages ? '.tar.gz' : '.sql';
      const fallback = `${request.name}${request.version ? `-${request.version}` : ''}${fallbackExt}`;
      const filename = parseFilename(res.headers.get('content-disposition'), fallback);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setSuccess(`Backup descargado en tu dispositivo: ${filename}`);
      fetchStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const restoreBackup = async () => {
    if (!restoreFile) {
      setError('Selecciona un archivo .tar.gz, .tar o .sql para restaurar.');
      return;
    }

    try {
      const startedAt = Date.now();
      setRestoring(true);
      setError(null);
      setRestoreOverlay({
        visible: true,
        status: 'running',
        title: 'Estamos preparando tu tienda',
        subtitle: 'Aplicando datos, validando estructura y afinando todo para abrir.'
      });

      const formData = new FormData();
      formData.append('backupFile', restoreFile);
      formData.append('confirmText', confirmText);

      const res = await apiFetch(apiUrl('/database/restore'), {
        method: 'POST',
        body: formData
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Error al restaurar backup');
      }

      const elapsed = Date.now() - startedAt;
      const waitRemaining = Math.max(0, MIN_RESTORE_ANIMATION_MS - elapsed);
      if (waitRemaining > 0) {
        await sleep(waitRemaining);
      }

      setRestoreOverlay({
        visible: true,
        status: 'success',
        title: 'Restauracion completada con exito',
        subtitle: 'Tu tienda ya esta lista. Actualizaremos la pagina para mostrar los cambios.'
      });

      setSuccess(`Restauración completada desde: ${restoreFile.name}`);
      setConfirmText('');
      setRestoreFile(null);
      if (restoreInputRef.current) restoreInputRef.current.value = '';
      fetchStats();

      setTimeout(() => {
        window.location.reload();
      }, 1800);
    } catch (err) {
      setRestoreOverlay({
        visible: false,
        status: 'idle',
        title: '',
        subtitle: ''
      });
      setError(err.message);
    } finally {
      setRestoring(false);
    }
  };

  const formatDate = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const statLabels = {
    users: '👥 Usuarios',
    products: '📦 Productos',
    product_images: '🖼️ Imgs DB',
    orders: '📋 Órdenes',
    order_items: '📝 Items',
    cart: '🛒 Carrito',
    app_settings: '⚙️ Ajustes',
    verification_codes: '🔑 Códigos'
  };

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
    createForm: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '16px', padding: '12px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0' },
    fieldGroup: { display: 'flex', flexDirection: 'column', gap: '3px' },
    fieldLabel: { fontSize: '11px', fontWeight: 600, color: '#374151' },
    input: { padding: '7px 10px', borderRadius: '5px', border: '1px solid #d1d5db', fontSize: '13px', width: '170px' },
    inputSmall: { padding: '7px 10px', borderRadius: '5px', border: '1px solid #d1d5db', fontSize: '13px', width: '100px' },
    helper: { fontSize: '11px', color: '#6b7280' },
    btn: (bg = '#111827', fg = '#fff', border = 'none') => ({
      padding: '8px 14px',
      borderRadius: '6px',
      border,
      background: bg,
      color: fg,
      fontSize: '13px',
      fontWeight: 500,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px'
    }),
    restoreBox: { marginTop: '12px', padding: '12px', borderRadius: '8px', border: '1px solid #fde68a', background: '#fffbeb' },
    alert: (type) => ({
      padding: '10px 14px',
      borderRadius: '6px',
      marginBottom: '12px',
      fontSize: '13px',
      fontWeight: 500,
      background: type === 'error' ? '#fee2e2' : '#d1fae5',
      color: type === 'error' ? '#991b1b' : '#065f46',
      border: `1px solid ${type === 'error' ? '#fca5a5' : '#6ee7b7'}`
    }),
  };

  return (
    <>
      <div style={s.wrapper}>
        <div style={s.header} onClick={() => setCollapsed((p) => !p)}>
          <span style={s.headerTitle}>💾 Gestor de Backups</span>
          <span style={s.chevron(!collapsed)}>▼</span>
        </div>

        {!collapsed && (
          <div style={s.body}>
            {error && <div style={s.alert('error')}>❌ {error}</div>}
            {success && <div style={s.alert('success')}>✅ {success}</div>}

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

            {!stats && loadingStats && <p style={{ fontSize: '13px', color: '#6b7280' }}>Cargando estado actual...</p>}

            <div style={s.createForm}>
              <div style={s.fieldGroup}>
                <span style={s.fieldLabel}>Nombre</span>
                <input
                  type="text"
                  style={s.input}
                  value={backupName}
                  onChange={(e) => setBackupName(e.target.value)}
                  placeholder={storeName}
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
              <div style={s.fieldGroup}>
                <span style={s.fieldLabel}>Contenido</span>
                <select
                  style={{ ...s.inputSmall, width: '180px' }}
                  value={backupFormat}
                  onChange={(e) => setBackupFormat(e.target.value)}
                >
                  <option value="sql">SQL</option>
                  <option value="full">SQL + Imágenes</option>
                </select>
              </div>
              <button type="button" onClick={createBackup} disabled={creating} style={s.btn(creating ? '#9ca3af' : '#059669', '#fff')}>
                {creating ? '⏳ Creando...' : '📥 Crear y Descargar Backup'}
              </button>
              <span style={s.helper}>Formato: nombre + versión(opcional) + fecha ({formatDate()})</span>
            </div>

            <div style={s.restoreBox}>
              <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#92400e' }}>♻️ Restaurar desde dispositivo</h4>
              <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#92400e' }}>
                El archivo se procesa temporalmente para restaurar y luego se elimina del servidor.
              </p>

              <input
                ref={restoreInputRef}
                type="file"
                accept=".sql,.tar,.tar.gz,.gz"
                onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                style={{ marginBottom: '8px' }}
              />

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder='Escribe "RESTAURAR"'
                  style={{ ...s.input, width: '180px' }}
                />
                <button
                  type="button"
                  onClick={restoreBackup}
                  disabled={!restoreFile || confirmText !== 'RESTAURAR' || restoring}
                  style={s.btn(confirmText === 'RESTAURAR' && restoreFile && !restoring ? '#dc2626' : '#d1d5db', confirmText === 'RESTAURAR' && restoreFile && !restoring ? '#fff' : '#6b7280')}
                >
                  {restoring ? '⏳ Restaurando...' : '✅ Confirmar Restauración'}
                </button>
              </div>
            </div>
          </div>

        )}
      </div>

      {restoreOverlay.visible && (
        <ProcessingOverlay
          visible={true}
          status={restoreOverlay.status}
          title={restoreOverlay.title}
          subtitle={restoreOverlay.subtitle}
          minDurationMs={MIN_RESTORE_ANIMATION_MS}
          onComplete={() => {
            if (restoreOverlay.status === 'success') {
              setTimeout(() => window.location.reload(), 1800);
            }
          }}
        />
      )}
    </>
  );
}

export default DatabaseManager;
