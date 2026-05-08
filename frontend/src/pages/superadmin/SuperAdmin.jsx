// SuperAdmin.jsx - Platform super admin panel (admin subdomain)
// Full dashboard: KPIs, tenant list, detail, actions

import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { API_URL, PLATFORM_DOMAIN } from '../../config';

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
    page: { maxWidth: '1400px', margin: '0 auto', padding: '2rem', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' },
    title: { fontSize: '1.8rem', fontWeight: 700, color: '#1a1a2e' },
    badge: { padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 },
    kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' },
    kpiCard: { background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
    kpiLabel: { fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' },
    kpiValue: { fontSize: '2rem', fontWeight: 700, color: '#1a1a2e' },
    card: { background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '1.5rem' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '2px solid #e5e7eb', fontSize: '0.8rem', color: '#666', textTransform: 'uppercase' },
    td: { padding: '0.75rem 1rem', borderBottom: '1px solid #f3f4f6', fontSize: '0.9rem' },
    btn: { padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 },
    btnPrimary: { background: '#4f46e5', color: '#fff' },
    btnDanger: { background: '#ef4444', color: '#fff' },
    btnSuccess: { background: '#10b981', color: '#fff' },
    btnGhost: { background: 'transparent', color: '#4f46e5', border: '1px solid #4f46e5' },
    input: { padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem', width: '100%' },
    select: { padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem' },
    flex: { display: 'flex', gap: '0.75rem', alignItems: 'center' },
    modal: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modalContent: { background: '#fff', borderRadius: '16px', padding: '2rem', maxWidth: '700px', width: '90%', maxHeight: '80vh', overflowY: 'auto' },
    loginBox: { maxWidth: '400px', margin: '15vh auto', padding: '2rem', background: '#fff', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' },
    alert: { padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' },
    alertWarning: { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' },
};

// Status color mapping
const STATUS_COLORS = {
    trial: { bg: '#dbeafe', color: '#1e40af' },
    active: { bg: '#dcfce7', color: '#166534' },
    suspended: { bg: '#fee2e2', color: '#991b1b' },
    cancelled: { bg: '#f3f4f6', color: '#6b7280' }
};

// ── API helper with super admin secret header ─────────────────────────────────
const superAdminFetch = async (path, options = {}) => {
    const secret = sessionStorage.getItem('superAdminSecret');
    if (!secret) throw new Error('No autenticado');
    const res = await fetch(`${API_URL}/superadmin${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'x-super-admin-secret': secret,
            ...(options.headers || {})
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Error ${res.status}`);
    }
    return res.json();
};

// ── Login Gate ────────────────────────────────────────────────────────────────
function SuperAdminLogin({ onLogin }) {
    const [secret, setSecret] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            // Test the secret by fetching metrics
            sessionStorage.setItem('superAdminSecret', secret);
            await superAdminFetch('/metrics');
            onLogin();
        } catch {
            sessionStorage.removeItem('superAdminSecret');
            setError('Acceso denegado — secreto inválido');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.loginBox}>
            <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>🔐 Super Admin</h2>
            <form onSubmit={handleSubmit}>
                <input
                    type="password"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder="Super Admin Secret"
                    style={{ ...styles.input, marginBottom: '1rem' }}
                    autoFocus
                    required
                />
                {error && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{error}</p>}
                <button
                    type="submit"
                    disabled={loading}
                    style={{ ...styles.btn, ...styles.btnPrimary, width: '100%', padding: '10px' }}
                >
                    {loading ? 'Verificando…' : 'Acceder'}
                </button>
            </form>
        </div>
    );
}

// ── KPI Cards ─────────────────────────────────────────────────────────────────
function KPICards({ metrics }) {
    if (!metrics) return null;
    const { tenants, mrr, trial_alerts } = metrics;
    return (
        <div style={styles.kpiGrid}>
            <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>Total Tenants</div>
                <div style={styles.kpiValue}>{tenants.total}</div>
            </div>
            <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>Activos</div>
                <div style={{ ...styles.kpiValue, color: '#10b981' }}>{tenants.active}</div>
            </div>
            <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>En Trial</div>
                <div style={{ ...styles.kpiValue, color: '#f59e0b' }}>{tenants.trial}</div>
            </div>
            <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>MRR Estimado</div>
                <div style={{ ...styles.kpiValue, color: '#4f46e5' }}>${mrr?.toFixed(2)}</div>
            </div>
            <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>Suspendidos</div>
                <div style={{ ...styles.kpiValue, color: '#ef4444' }}>{tenants.suspended}</div>
            </div>
            <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>Trials por vencer</div>
                <div style={{ ...styles.kpiValue, color: '#f59e0b' }}>{trial_alerts?.length || 0}</div>
            </div>
        </div>
    );
}

// ── Tenant Detail Modal ───────────────────────────────────────────────────────
function TenantDetailModal({ tenantId, onClose, onRefresh }) {
    const [tenant, setTenant] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState('');
    const [selectedPlan, setSelectedPlan] = useState('');

    useEffect(() => {
        if (!tenantId) return;
        setLoading(true);
        superAdminFetch(`/tenants/${tenantId}`)
            .then(t => { setTenant(t); setSelectedPlan(t.plan_id || ''); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [tenantId]);

    // Plan change handler
    const handlePlanChange = async () => {
        if (!selectedPlan || selectedPlan === tenant.plan_id) return;
        if (!window.confirm(`¿Cambiar plan a "${selectedPlan}"?`)) return;
        setActionLoading('plan');
        try {
            await superAdminFetch(`/tenants/${tenantId}/plan`, {
                method: 'PUT', body: { plan_id: selectedPlan }
            });
            onRefresh();
            const updated = await superAdminFetch(`/tenants/${tenantId}`);
            setTenant(updated);
            setSelectedPlan(updated.plan_id || '');
        } catch { /* error */ }
        finally { setActionLoading(''); }
    };

    // Status change handler
    const handleStatusChange = async (newStatus) => {
        if (!window.confirm(`¿Cambiar estado a "${newStatus}"?`)) return;
        setActionLoading('status');
        try {
            await superAdminFetch(`/tenants/${tenantId}/status`, {
                method: 'PUT', body: { status: newStatus }
            });
            onRefresh();
            // Reload detail
            const updated = await superAdminFetch(`/tenants/${tenantId}`);
            setTenant(updated);
        } catch { /* toast or inline error */ }
        finally { setActionLoading(''); }
    };

    // Impersonate handler
    const handleImpersonate = async () => {
        setActionLoading('impersonate');
        try {
            const result = await superAdminFetch(`/tenants/${tenantId}/impersonate`, { method: 'POST' });
            // Open tenant admin in new tab with impersonation token
            window.open(result.redirectUrl, '_blank');
        } catch { /* error */ }
        finally { setActionLoading(''); }
    };

    // Delete handler
    const handleDelete = async () => {
        const slug = tenant?.slug;
        if (!window.confirm(`¿ELIMINAR PERMANENTEMENTE el tenant "${slug}"? Esta acción no se puede deshacer.`)) return;
        setActionLoading('delete');
        try {
            await superAdminFetch(`/tenants/${tenantId}`, {
                method: 'DELETE', body: { confirm: true }
            });
            onRefresh();
            onClose();
        } catch { /* error */ }
        finally { setActionLoading(''); }
    };

    if (!tenantId) return null;

    return (
        <div style={styles.modal} onClick={onClose}>
            <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                {loading ? <p>Cargando…</p> : tenant ? (
                    <>
                        {/* Header */}
                        <div style={{ ...styles.flex, justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <div>
                                <h2 style={{ margin: 0 }}>{tenant.name}</h2>
                                <span style={{ color: '#666' }}>{tenant.slug}.{PLATFORM_DOMAIN}</span>
                            </div>
                            <span style={{
                                ...styles.badge,
                                ...(STATUS_COLORS[tenant.status] || STATUS_COLORS.cancelled)
                            }}>{tenant.status}</span>
                        </div>

                        {/* Info grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            <div><strong>Email:</strong> {tenant.owner_email}</div>
                            <div><strong>Plan:</strong> {tenant.plan_name} (${tenant.price_monthly}/mes)</div>
                            <div><strong>Creado:</strong> {new Date(tenant.created_at).toLocaleDateString()}</div>
                            <div><strong>Trial expira:</strong> {tenant.trial_ends_at ? new Date(tenant.trial_ends_at).toLocaleDateString() : '—'}</div>
                        </div>

                        {/* Plan change */}
                        <div style={{ ...styles.flex, marginBottom: '1.5rem' }}>
                            <label htmlFor="plan-select" style={{ fontWeight: 600, fontSize: '0.9rem' }}>Cambiar plan:</label>
                            <select
                                id="plan-select"
                                value={selectedPlan}
                                onChange={e => setSelectedPlan(e.target.value)}
                                style={styles.select}
                                disabled={!!actionLoading}
                            >
                                <option value="trial">Trial</option>
                                <option value="basic">Básico</option>
                                <option value="pro">Profesional</option>
                                <option value="premium">Premium</option>
                            </select>
                            <button
                                style={{ ...styles.btn, ...styles.btnPrimary }}
                                onClick={handlePlanChange}
                                disabled={!!actionLoading || selectedPlan === tenant.plan_id}
                            >
                                {actionLoading === 'plan' ? '…' : 'Aplicar'}
                            </button>
                        </div>

                        {/* Usage */}
                        <div style={{ ...styles.card, background: '#f8fafc' }}>
                            <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Uso actual</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <div style={styles.kpiLabel}>Productos</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                                        {tenant.usage?.products ?? 0}
                                        <span style={{ fontSize: '0.85rem', color: '#999' }}>/{tenant.max_products === -1 ? '∞' : tenant.max_products}</span>
                                    </div>
                                </div>
                                <div>
                                    <div style={styles.kpiLabel}>Órdenes/mes</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                                        {tenant.usage?.orders_month ?? 0}
                                        <span style={{ fontSize: '0.85rem', color: '#999' }}>/{tenant.max_orders_month === -1 ? '∞' : tenant.max_orders_month}</span>
                                    </div>
                                </div>
                                <div>
                                    <div style={styles.kpiLabel}>Usuarios</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{tenant.usage?.users ?? 0}</div>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div style={{ ...styles.flex, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                            {tenant.status !== 'suspended' && (
                                <button
                                    style={{ ...styles.btn, ...styles.btnDanger }}
                                    onClick={() => handleStatusChange('suspended')}
                                    disabled={!!actionLoading}
                                >
                                    {actionLoading === 'status' ? '…' : '⏸ Suspender'}
                                </button>
                            )}
                            {tenant.status === 'suspended' && (
                                <button
                                    style={{ ...styles.btn, ...styles.btnSuccess }}
                                    onClick={() => handleStatusChange('active')}
                                    disabled={!!actionLoading}
                                >
                                    {actionLoading === 'status' ? '…' : '▶ Reactivar'}
                                </button>
                            )}
                            <button
                                style={{ ...styles.btn, ...styles.btnGhost }}
                                onClick={handleImpersonate}
                                disabled={!!actionLoading}
                            >
                                {actionLoading === 'impersonate' ? '…' : '👤 Impersonar'}
                            </button>
                            <button
                                style={{ ...styles.btn, ...styles.btnDanger, opacity: 0.7 }}
                                onClick={handleDelete}
                                disabled={!!actionLoading}
                            >
                                {actionLoading === 'delete' ? '…' : '🗑 Eliminar'}
                            </button>
                        </div>

                        {/* Audit log */}
                        {tenant.audit_log?.length > 0 && (
                            <div>
                                <h3 style={{ fontSize: '1rem' }}>Historial de acciones</h3>
                                <table style={styles.table}>
                                    <thead>
                                        <tr>
                                            <th style={styles.th}>Fecha</th>
                                            <th style={styles.th}>Acción</th>
                                            <th style={styles.th}>Actor</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tenant.audit_log.map(log => (
                                            <tr key={log.id}>
                                                <td style={styles.td}>{new Date(log.created_at).toLocaleString()}</td>
                                                <td style={styles.td}>{log.action}</td>
                                                <td style={styles.td}>{log.actor}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <button style={{ ...styles.btn, marginTop: '1rem' }} onClick={onClose}>Cerrar</button>
                    </>
                ) : <p>Error al cargar tenant</p>}
            </div>
        </div>
    );
}

// ── Tenant List ───────────────────────────────────────────────────────────────
function TenantList({ onSelectTenant }) {
    const [tenants, setTenants] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState({ status: '', plan: '', search: '' });
    const [loading, setLoading] = useState(true);

    const fetchTenants = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page, limit: 20 });
            if (filters.status) params.set('status', filters.status);
            if (filters.plan) params.set('plan', filters.plan);
            if (filters.search) params.set('search', filters.search);
            const data = await superAdminFetch(`/tenants?${params}`);
            setTenants(data.data);
            setTotal(data.total);
        } catch { /* error */ }
        finally { setLoading(false); }
    }, [page, filters]);

    useEffect(() => { fetchTenants(); }, [fetchTenants]);

    return (
        <div style={styles.card}>
            <div style={{ ...styles.flex, marginBottom: '1rem', flexWrap: 'wrap' }}>
                <input
                    type="text"
                    placeholder="Buscar tenant…"
                    value={filters.search}
                    onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1); }}
                    style={{ ...styles.input, maxWidth: '250px' }}
                />
                <select
                    value={filters.status}
                    onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1); }}
                    style={styles.select}
                >
                    <option value="">Todos los estados</option>
                    <option value="trial">Trial</option>
                    <option value="active">Activo</option>
                    <option value="suspended">Suspendido</option>
                    <option value="cancelled">Cancelado</option>
                </select>
                <select
                    value={filters.plan}
                    onChange={e => { setFilters(f => ({ ...f, plan: e.target.value })); setPage(1); }}
                    style={styles.select}
                >
                    <option value="">Todos los planes</option>
                    <option value="trial">Trial</option>
                    <option value="basic">Básico</option>
                    <option value="pro">Profesional</option>
                    <option value="premium">Premium</option>
                </select>
            </div>

            {loading ? <p>Cargando…</p> : (
                <>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Tenant</th>
                                <th style={styles.th}>Plan</th>
                                <th style={styles.th}>Estado</th>
                                <th style={styles.th}>Creado</th>
                                <th style={styles.th}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tenants.map(t => (
                                <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => onSelectTenant(t.id)}>
                                    <td style={styles.td}>
                                        <div style={{ fontWeight: 600 }}>{t.name}</div>
                                        <div style={{ fontSize: '0.8rem', color: '#666' }}>{t.slug}.{PLATFORM_DOMAIN}</div>
                                    </td>
                                    <td style={styles.td}>{t.plan_name || t.plan_id}</td>
                                    <td style={styles.td}>
                                        <span style={{
                                            ...styles.badge,
                                            ...(STATUS_COLORS[t.status] || STATUS_COLORS.cancelled)
                                        }}>{t.status}</span>
                                    </td>
                                    <td style={styles.td}>{new Date(t.created_at).toLocaleDateString()}</td>
                                    <td style={styles.td}>
                                        <button
                                            style={{ ...styles.btn, ...styles.btnGhost, fontSize: '0.8rem' }}
                                            onClick={(e) => { e.stopPropagation(); onSelectTenant(t.id); }}
                                        >
                                            Ver detalle
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {!tenants.length && (
                                <tr><td style={styles.td} colSpan={5}>No hay tenants</td></tr>
                            )}
                        </tbody>
                    </table>

                    {/* Pagination */}
                    {total > 20 && (
                        <div style={{ ...styles.flex, justifyContent: 'center', marginTop: '1rem' }}>
                            <button
                                style={styles.btn}
                                disabled={page <= 1}
                                onClick={() => setPage(p => p - 1)}
                            >← Anterior</button>
                            <span style={{ fontSize: '0.9rem', color: '#666' }}>
                                Página {page} de {Math.ceil(total / 20)}
                            </span>
                            <button
                                style={styles.btn}
                                disabled={page >= Math.ceil(total / 20)}
                                onClick={() => setPage(p => p + 1)}
                            >Siguiente →</button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ── Trial Alerts ──────────────────────────────────────────────────────────────
function TrialAlerts({ alerts }) {
    if (!alerts?.length) return null;
    return (
        <div style={{ ...styles.alert, ...styles.alertWarning }}>
            <strong>⚠️ Trials por vencer:</strong>{' '}
            {alerts.map(a => (
                <span key={a.id} style={{ marginRight: '0.75rem' }}>
                    {a.name} ({new Date(a.trial_ends_at).toLocaleDateString()})
                </span>
            ))}
        </div>
    );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
function SuperAdminDashboard() {
    const [authenticated, setAuthenticated] = useState(!!sessionStorage.getItem('superAdminSecret'));
    const [metrics, setMetrics] = useState(null);
    const [selectedTenant, setSelectedTenant] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);

    // Load metrics
    const loadMetrics = useCallback(async () => {
        try {
            const data = await superAdminFetch('/metrics');
            setMetrics(data);
        } catch {
            // If auth fails, reset
            sessionStorage.removeItem('superAdminSecret');
            setAuthenticated(false);
        }
    }, []);

    useEffect(() => {
        if (authenticated) loadMetrics();
    }, [authenticated, loadMetrics, refreshKey]);

    // Refresh trigger
    const handleRefresh = () => setRefreshKey(k => k + 1);

    if (!authenticated) {
        return <SuperAdminLogin onLogin={() => setAuthenticated(true)} />;
    }

    return (
        <div style={styles.page}>
            {/* Header */}
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>Super Admin</h1>
                    <span style={{ color: '#666', fontSize: '0.9rem' }}>Gestión de la plataforma SaaS</span>
                </div>
                <div style={styles.flex}>
                    <button style={{ ...styles.btn, ...styles.btnGhost }} onClick={handleRefresh}>🔄 Actualizar</button>
                    <button
                        style={{ ...styles.btn }}
                        onClick={() => { sessionStorage.removeItem('superAdminSecret'); setAuthenticated(false); }}
                    >Salir</button>
                </div>
            </div>

            {/* Trial alerts */}
            <TrialAlerts alerts={metrics?.trial_alerts} />

            {/* KPIs */}
            <KPICards metrics={metrics} />

            {/* Plan distribution */}
            {metrics?.plans?.length > 0 && (
                <div style={{ ...styles.card, marginBottom: '1.5rem' }}>
                    <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Distribución por plan</h3>
                    <div style={{ ...styles.flex, flexWrap: 'wrap' }}>
                        {metrics.plans.map(p => (
                            <div key={p.plan_id} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', borderRadius: '8px' }}>
                                <strong>{p.name}</strong>: {p.count} tenants
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tenant list */}
            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>Tenants</h2>
            <TenantList key={refreshKey} onSelectTenant={setSelectedTenant} />

            {/* Tenant detail modal */}
            <TenantDetailModal
                tenantId={selectedTenant}
                onClose={() => setSelectedTenant(null)}
                onRefresh={handleRefresh}
            />
        </div>
    );
}

/** Routes shown on admin.{PLATFORM_DOMAIN} (super admin subdomain) */
export default function SuperAdminRoutes() {
    return (
        <Routes>
            <Route path="/" element={<SuperAdminDashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
