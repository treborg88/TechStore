// BackupManager.jsx — Full database backup management for super admin
// Sections: Create Backup, Backup List (download/delete), Restore Backup

import { useState, useEffect } from 'react';

const S = {
    container: { display: 'flex', flexDirection: 'column', gap: '20px' },
    section: {
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '14px',
        border: '1px solid rgba(255,255,255,0.07)',
        padding: '20px 24px'
    },
    sectionTitle: {
        fontSize: '0.875rem', fontWeight: 600,
        marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px'
    },
    input: {
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: '9px', padding: '8px 12px', color: 'white',
        fontSize: '0.8125rem', fontFamily: 'Inter, sans-serif', outline: 'none'
    },
    btnPrimary: {
        padding: '10px 20px', borderRadius: '10px',
        background: '#22d3ee', color: '#050816', border: 'none',
        cursor: 'pointer', fontWeight: 700, fontSize: '0.8125rem',
        fontFamily: 'Inter, sans-serif'
    },
    btnGhost: {
        padding: '8px 14px', borderRadius: '9px',
        border: '1px solid rgba(255,255,255,0.10)', background: 'transparent',
        color: 'rgba(255,255,255,0.55)', cursor: 'pointer',
        fontSize: '0.75rem', fontFamily: 'Inter, sans-serif'
    },
    btnDanger: {
        padding: '8px 14px', borderRadius: '9px',
        background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)',
        color: '#f87171', cursor: 'pointer', fontSize: '0.75rem',
        fontFamily: 'Inter, sans-serif'
    },
    table: {
        width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem'
    },
    th: {
        padding: '10px 14px', textAlign: 'left', fontSize: '0.68rem',
        fontWeight: 600, color: 'rgba(255,255,255,0.35)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        borderBottom: '1px solid rgba(255,255,255,0.07)'
    },
    td: {
        padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)',
        color: 'rgba(255,255,255,0.65)'
    },
    badge: {
        display: 'inline-flex', padding: '3px 10px', borderRadius: '99px',
        fontSize: '0.7rem', fontWeight: 600
    },
    label: { fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }
};

function BackupManager({ superAdminFetch }) {
    const [backups, setBackups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const [backupName, setBackupName] = useState('');
    const [backupVersion, setBackupVersion] = useState('');
    const [includePublicSchema, setIncludePublicSchema] = useState(true);

    const [restoreFile, setRestoreFile] = useState(null);
    const [restoreConfirm, setRestoreConfirm] = useState('');
    const [restoring, setRestoring] = useState(false);

    useEffect(() => {
        if (success || error) {
            const t = setTimeout(() => { setSuccess(null); setError(null); }, 5000);
            return () => clearTimeout(t);
        }
    }, [success, error]);

    const fetchBackups = async () => {
        try {
            setLoading(true);
            const data = await superAdminFetch('/database/backups');
            setBackups(data.backups || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchBackups(); }, []);

    const handleCreate = async () => {
        try {
            setCreating(true);
            setError(null);
            const result = await superAdminFetch('/database/backup/all-tenants', {
                method: 'POST',
                body: {
                    name: backupName || undefined,
                    version: backupVersion || undefined,
                    includePublicSchema
                }
            });
            setSuccess(`Backup creado: ${result.filename} (${formatSize(result.size)})`);
            await fetchBackups();
            setBackupName('');
            setBackupVersion('');
        } catch (err) {
            setError(err.message);
        } finally {
            setCreating(false);
        }
    };

    const handleDownload = async (filename) => {
        try {
            const secret = sessionStorage.getItem('superAdminSecret') || localStorage.getItem('superAdminSecret');
            const res = await fetch(`/api/superadmin/database/backups/${encodeURIComponent(filename)}/download`, {
                headers: { 'x-super-admin-secret': secret }
            });
            if (!res.ok) throw new Error('Error al descargar');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDelete = async (filename) => {
        if (!window.confirm(`¿Eliminar "${filename}" permanentemente?`)) return;
        try {
            await superAdminFetch(`/database/backups/${encodeURIComponent(filename)}`, { method: 'DELETE' });
            setSuccess(`Backup eliminado: ${filename}`);
            await fetchBackups();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleRestore = async () => {
        if (!restoreFile || restoreConfirm !== 'RESTAURAR') return;
        try {
            setRestoring(true);
            setError(null);
            const formData = new FormData();
            formData.append('backupFile', restoreFile);
            formData.append('confirmText', 'RESTAURAR');
            formData.append('includePublicSchema', 'true');

            const secret = sessionStorage.getItem('superAdminSecret') || localStorage.getItem('superAdminSecret');
            const res = await fetch('/api/superadmin/database/restore/all-tenants', {
                method: 'POST',
                headers: { 'x-super-admin-secret': secret },
                body: formData
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || 'Error al restaurar');
            }
            const data = await res.json();
            setSuccess(`Restauración completa: ${data.message || 'OK'}`);
            setRestoreFile(null);
            setRestoreConfirm('');
        } catch (err) {
            setError(err.message);
        } finally {
            setRestoring(false);
        }
    };

    const formatSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    };

    const formatDate = (d) => new Date(d).toLocaleString('es-DO', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    return (
        <div style={S.container}>
            <div>
                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>🗄️ Respaldos de Base de Datos</h2>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                    Gestión de respaldos completos de la plataforma — protección de datos y migración
                </p>
            </div>

            {error && (
                <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: '0.8125rem' }}>
                    {error}
                </div>
            )}
            {success && (
                <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80', fontSize: '0.8125rem' }}>
                    {success}
                </div>
            )}

            {/* ── Section 1: Create Backup ── */}
            <div style={S.section}>
                <div style={S.sectionTitle}>📦 Crear Nuevo Backup Completo</div>
                <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>
                    Esto crea un archivo .tar.gz que incluye: schema public (tenants, planes, suscripciones),
                    todos los schemas de tiendas, y las imágenes de productos.
                </p>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={S.label}>Nombre (opcional)</label>
                        <input
                            style={S.input}
                            value={backupName}
                            onChange={e => setBackupName(e.target.value)}
                            placeholder="ej: pre-migration"
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={S.label}>Versión (opcional)</label>
                        <input
                            style={{ ...S.input, width: '120px' }}
                            value={backupVersion}
                            onChange={e => setBackupVersion(e.target.value)}
                            placeholder="v2.1.0"
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={includePublicSchema}
                                onChange={e => setIncludePublicSchema(e.target.checked)}
                            />
                            Incluir schema public
                        </label>
                    </div>
                    <button
                        style={S.btnPrimary}
                        onClick={handleCreate}
                        disabled={creating}
                    >
                        {creating ? 'Creando...' : 'Crear Backup Completo'}
                    </button>
                </div>
            </div>

            {/* ── Section 2: Existing Backups ── */}
            <div style={S.section}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={S.sectionTitle}>📋 Backups Existentes</div>
                    <button style={{ ...S.btnGhost, padding: '6px 12px' }} onClick={fetchBackups}>
                        🔄 Actualizar
                    </button>
                </div>

                {loading ? (
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', padding: '24px', textAlign: 'center' }}>
                        Cargando backups...
                    </div>
                ) : backups.length === 0 ? (
                    <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.875rem', padding: '32px', textAlign: 'center' }}>
                        <span style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }}>📭</span>
                        No hay backups completos. Crea el primero arriba.
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={S.table}>
                            <thead>
                                <tr>
                                    <th style={S.th}>Archivo</th>
                                    <th style={S.th}>Tamaño</th>
                                    <th style={S.th}>Fecha</th>
                                    <th style={S.th}>Tenants</th>
                                    <th style={S.th}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {backups.map(b => (
                                    <tr key={b.filename}>
                                        <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '0.7rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.filename}>
                                            {b.filename}
                                        </td>
                                        <td style={S.td}>{formatSize(b.size)}</td>
                                        <td style={{ ...S.td, whiteSpace: 'nowrap' }}>{formatDate(b.date)}</td>
                                        <td style={S.td}>
                                            <span style={{ ...S.badge, background: 'rgba(34,211,238,0.10)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.15)' }}>
                                                {b.tenantCount != null ? `${b.tenantCount} tiendas` : '—'}
                                            </span>
                                        </td>
                                        <td style={S.td}>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <button style={S.btnGhost} onClick={() => handleDownload(b.filename)}>
                                                    ⬇ Descargar
                                                </button>
                                                <button style={S.btnDanger} onClick={() => handleDelete(b.filename)}>
                                                    🗑
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Section 3: Restore Backup ── */}
            <div style={S.section}>
                <div style={S.sectionTitle}>⚠ Restaurar Backup</div>
                <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>
                    Restaura TODOS los schemas de la base de datos desde un archivo .tar.gz.
                    Esta acción es irreversible y reemplazará todos los datos actuales.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                        <input
                            type="file"
                            accept=".tar.gz,.tar"
                            onChange={e => setRestoreFile(e.target.files[0] || null)}
                            style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8125rem' }}
                        />
                        {restoreFile && (
                            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginLeft: '12px' }}>
                                {restoreFile.name} ({formatSize(restoreFile.size)})
                            </span>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 600 }}>
                            Escribe &quot;RESTAURAR&quot; para confirmar:
                        </span>
                        <input
                            style={{ ...S.input, width: '200px' }}
                            value={restoreConfirm}
                            onChange={e => setRestoreConfirm(e.target.value)}
                            placeholder="RESTAURAR"
                        />
                        <button
                            style={{
                                ...S.btnDanger,
                                padding: '10px 20px',
                                fontWeight: 700,
                                opacity: restoreFile && restoreConfirm === 'RESTAURAR' ? 1 : 0.4,
                                cursor: restoreFile && restoreConfirm === 'RESTAURAR' ? 'pointer' : 'not-allowed'
                            }}
                            disabled={!restoreFile || restoreConfirm !== 'RESTAURAR' || restoring}
                            onClick={handleRestore}
                        >
                            {restoring ? 'Restaurando...' : '⚠ Restaurar Todo'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default BackupManager;
