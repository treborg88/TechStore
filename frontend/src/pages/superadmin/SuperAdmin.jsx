// SuperAdmin.jsx - Platform super admin panel (admin subdomain)
// Full dashboard: sidebar, KPIs, tenant table, detail modal, actions
// Design matches: Saas/superAdminpanel1.html

import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { API_URL, PLATFORM_DOMAIN } from '../../config';
import SuperAdminLoginPage from './SuperAdminLoginPage';
import DatabaseSection from './DatabaseSection';
import BackupManager from './BackupManager';

// ── Status / plan badge config ────────────────────────────────────────────────
const STATUS_BADGE = {
    active:    { bg: 'rgba(34,197,94,0.12)',  color: '#4ade80', border: 'rgba(34,197,94,0.2)',   label: 'Activa' },
    trial:     { bg: 'rgba(34,211,238,0.10)', color: '#22d3ee', border: 'rgba(34,211,238,0.2)',  label: 'Trial' },
    suspended: { bg: 'rgba(239,68,68,0.12)',  color: '#f87171', border: 'rgba(239,68,68,0.2)',   label: 'Suspendida' },
    cancelled: { bg: 'rgba(255,255,255,0.07)',color: 'rgba(255,255,255,0.5)', border: 'rgba(255,255,255,0.1)', label: 'Cancelada' },
};

const PLAN_BADGE = {
    pro:      { bg: 'rgba(139,92,246,0.12)',  color: '#c4b5fd', border: 'rgba(139,92,246,0.2)' },
    premium:  { bg: 'rgba(139,92,246,0.12)',  color: '#c4b5fd', border: 'rgba(139,92,246,0.2)' },
    business: { bg: 'rgba(34,211,238,0.08)',  color: '#67e8f9', border: 'rgba(34,211,238,0.15)' },
    basic:    { bg: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)', border: 'rgba(255,255,255,0.10)' },
    starter:  { bg: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)', border: 'rgba(255,255,255,0.10)' },
    trial:    { bg: 'rgba(34,211,238,0.10)',  color: '#22d3ee', border: 'rgba(34,211,238,0.2)' },
};

const AVATAR_COLORS = [
    { bg: 'rgba(34,211,238,0.15)',  color: '#22d3ee' },
    { bg: 'rgba(139,92,246,0.15)', color: '#c4b5fd' },
    { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24' },
    { bg: 'rgba(34,197,94,0.12)',  color: '#4ade80' },
    { bg: 'rgba(239,68,68,0.12)',  color: '#f87171' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const avatarColor = (name = '') => AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
const initials    = (name = '') => name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

// ── API helper with super admin secret header ─────────────────────────────────
const superAdminFetch = async (path, options = {}) => {
    // Check both storages to support the "remember me" option
    const secret = sessionStorage.getItem('superAdminSecret') || localStorage.getItem('superAdminSecret');
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

// ── Logo SVG ──────────────────────────────────────────────────────────────────
const LogoSvg = () => (
    <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="19" stroke="#22d3ee" strokeWidth="1.5" fill="none" opacity="0.6"/>
        <path d="M20 20 Q10 18 10 10 Q10 2 18 4 Q22 5 20 12Z" fill="url(#sal1)" opacity="0.9"/>
        <path d="M20 20 Q22 10 30 10 Q38 10 36 18 Q35 22 28 20Z" fill="url(#sal2)" opacity="0.9"/>
        <path d="M20 20 Q10 22 10 30 Q10 38 18 36 Q22 35 20 28Z" fill="url(#sal1)" opacity="0.9"/>
        <path d="M20 20 Q22 30 30 30 Q38 30 36 22 Q35 18 28 20Z" fill="url(#sal2)" opacity="0.9"/>
        <defs>
            <linearGradient id="sal1" x1="10" y1="10" x2="20" y2="20" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#22d3ee"/><stop offset="100%" stopColor="#8b5cf6"/>
            </linearGradient>
            <linearGradient id="sal2" x1="30" y1="10" x2="20" y2="20" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#8b5cf6"/><stop offset="100%" stopColor="#22d3ee"/>
            </linearGradient>
        </defs>
    </svg>
);

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ cfg, label }) {
    if (!cfg) return <span>{label}</span>;
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: '99px', fontSize: '0.7rem', fontWeight: 600, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
            {label}
        </span>
    );
}

// ── Tenant Detail Modal ───────────────────────────────────────────────────────
function TenantDetailModal({ tenantId, onClose, onRefresh }) {
    const [tenant, setTenant]           = useState(null);
    const [loading, setLoading]         = useState(true);
    const [actionLoading, setActionLoading] = useState('');
    const [selectedPlan, setSelectedPlan]   = useState('');

    useEffect(() => {
        if (!tenantId) return;
        setLoading(true);
        superAdminFetch(`/tenants/${tenantId}`)
            .then(t => { setTenant(t); setSelectedPlan(t.plan_id || ''); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [tenantId]);

    const handlePlanChange = async () => {
        if (!selectedPlan || selectedPlan === tenant.plan_id) return;
        if (!window.confirm(`¿Cambiar plan a "${selectedPlan}"?`)) return;
        setActionLoading('plan');
        try {
            await superAdminFetch(`/tenants/${tenantId}/plan`, { method: 'PUT', body: { plan_id: selectedPlan } });
            onRefresh();
            const updated = await superAdminFetch(`/tenants/${tenantId}`);
            setTenant(updated); setSelectedPlan(updated.plan_id || '');
        } catch { /* error */ } finally { setActionLoading(''); }
    };

    const handleStatusChange = async (newStatus) => {
        if (!window.confirm(`¿Cambiar estado a "${newStatus}"?`)) return;
        setActionLoading('status');
        try {
            await superAdminFetch(`/tenants/${tenantId}/status`, { method: 'PUT', body: { status: newStatus } });
            onRefresh();
            const updated = await superAdminFetch(`/tenants/${tenantId}`);
            setTenant(updated);
        } catch { /* error */ } finally { setActionLoading(''); }
    };

    const handleImpersonate = async () => {
        setActionLoading('impersonate');
        try {
            const result = await superAdminFetch(`/tenants/${tenantId}/impersonate`, { method: 'POST' });
            window.open(result.redirectUrl, '_blank');
        } catch (err) {
            alert(err.message || 'Error al impersonar este tenant');
        } finally { setActionLoading(''); }
    };

    const handleDelete = async () => {
        if (!window.confirm(`¿ELIMINAR PERMANENTEMENTE "${tenant?.slug}"? Esta acción no se puede deshacer.`)) return;
        setActionLoading('delete');
        try {
            await superAdminFetch(`/tenants/${tenantId}`, { method: 'DELETE', body: { confirm: true } });
            onRefresh(); onClose();
        } catch { /* error */ } finally { setActionLoading(''); }
    };

    if (!tenantId) return null;

    const inputDark = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '8px', padding: '8px 12px', color: 'white', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', outline: 'none' };
    const btnOutline = (color) => ({ padding: '7px 14px', borderRadius: '8px', border: `1px solid ${color}20`, background: `${color}12`, color, cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500, fontFamily: 'Inter, sans-serif' });

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
            <div style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '28px', maxWidth: '640px', width: '90%', maxHeight: '80vh', overflowY: 'auto', color: 'white', fontFamily: 'Inter, sans-serif' }} onClick={e => e.stopPropagation()}>
                {loading ? (
                    <p style={{ color: 'rgba(255,255,255,0.5)' }}>Cargando…</p>
                ) : tenant ? (<>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div style={{ width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 700, flexShrink: 0, ...avatarColor(tenant.name) }}>
                                {initials(tenant.name)}
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{tenant.name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>{tenant.slug}.{PLATFORM_DOMAIN}</div>
                            </div>
                        </div>
                        <Badge cfg={STATUS_BADGE[tenant.status]} label={STATUS_BADGE[tenant.status]?.label || tenant.status} />
                    </div>

                    {/* Info grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.65)' }}>
                        <div><span style={{ color: 'rgba(255,255,255,0.4)', marginRight: '4px' }}>Email:</span>{tenant.owner_email}</div>
                        <div><span style={{ color: 'rgba(255,255,255,0.4)', marginRight: '4px' }}>Plan:</span>{tenant.plan_name} (${tenant.price_monthly}/mes)</div>
                        <div><span style={{ color: 'rgba(255,255,255,0.4)', marginRight: '4px' }}>Creado:</span>{new Date(tenant.created_at).toLocaleDateString()}</div>
                        <div><span style={{ color: 'rgba(255,255,255,0.4)', marginRight: '4px' }}>Trial expira:</span>{tenant.trial_ends_at ? new Date(tenant.trial_ends_at).toLocaleDateString() : '—'}</div>
                    </div>

                    {/* Plan change */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '20px' }}>
                        <span style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.6)', fontWeight: 500, whiteSpace: 'nowrap' }}>Cambiar plan:</span>
                        <select value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)} disabled={!!actionLoading} style={inputDark}>
                            <option value="trial">Trial</option>
                            <option value="basic">Básico</option>
                            <option value="pro">Profesional</option>
                            <option value="premium">Premium</option>
                        </select>
                        <button onClick={handlePlanChange} disabled={!!actionLoading || selectedPlan === tenant.plan_id} style={{ padding: '8px 14px', borderRadius: '8px', background: '#22d3ee', color: '#050816', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.8125rem', fontFamily: 'Inter, sans-serif' }}>
                            {actionLoading === 'plan' ? '…' : 'Aplicar'}
                        </button>
                    </div>

                    {/* Usage */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '16px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '12px', color: 'rgba(255,255,255,0.7)' }}>Uso actual</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                            <div>
                                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Productos</div>
                                <div style={{ fontWeight: 700 }}>{tenant.usage?.products ?? 0}<span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem' }}>/{tenant.max_products === -1 ? '∞' : tenant.max_products}</span></div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Órdenes/mes</div>
                                <div style={{ fontWeight: 700 }}>{tenant.usage?.orders_month ?? 0}<span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem' }}>/{tenant.max_orders_month === -1 ? '∞' : tenant.max_orders_month}</span></div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Usuarios</div>
                                <div style={{ fontWeight: 700 }}>{tenant.usage?.users ?? 0}</div>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                        {tenant.status !== 'suspended' && (
                            <button onClick={() => handleStatusChange('suspended')} disabled={!!actionLoading} style={btnOutline('#f87171')}>
                                {actionLoading === 'status' ? '…' : '⏸ Suspender'}
                            </button>
                        )}
                        {tenant.status === 'suspended' && (
                            <button onClick={() => handleStatusChange('active')} disabled={!!actionLoading} style={btnOutline('#4ade80')}>
                                {actionLoading === 'status' ? '…' : '▶ Reactivar'}
                            </button>
                        )}
                        <button onClick={handleImpersonate} disabled={!!actionLoading} style={{ padding: '7px 14px', borderRadius: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500, fontFamily: 'Inter, sans-serif' }}>
                            {actionLoading === 'impersonate' ? '…' : '👤 Impersonar'}
                        </button>
                        <button onClick={handleDelete} disabled={!!actionLoading} style={btnOutline('#f87171')}>
                            {actionLoading === 'delete' ? '…' : '🗑 Eliminar'}
                        </button>
                    </div>

                    {/* Audit log */}
                    {tenant.audit_log?.length > 0 && (
                        <div>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>Historial de acciones</div>
                            {tenant.audit_log.map(log => (
                                <div key={log.id} style={{ display: 'flex', gap: '12px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem' }}>
                                    <span style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>{new Date(log.created_at).toLocaleString()}</span>
                                    <span style={{ color: 'rgba(255,255,255,0.7)' }}>{log.action}</span>
                                    <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 'auto' }}>{log.actor}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <button onClick={onClose} style={{ marginTop: '20px', padding: '8px 20px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'Inter, sans-serif' }}>
                        Cerrar
                    </button>
                </>) : (
                    <p style={{ color: 'rgba(255,255,255,0.5)' }}>Error al cargar tenant</p>
                )}
            </div>
        </div>
    );
}

// ── Tenant Table ──────────────────────────────────────────────────────────────
function TenantTable({ refreshKey, onSelectTenant, onStatusChange }) {
    const [tenants, setTenants]           = useState([]);
    const [total, setTotal]               = useState(0);
    const [page, setPage]                 = useState(1);
    const [filters, setFilters]           = useState({ status: '', plan: '' });
    const [loading, setLoading]           = useState(true);
    const [actionLoading, setActionLoading] = useState('');

    const fetchTenants = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page, limit: 20 });
            if (filters.status) params.set('status', filters.status);
            if (filters.plan)   params.set('plan', filters.plan);
            const data = await superAdminFetch(`/tenants?${params}`);
            setTenants(data.data);
            setTotal(data.total);
        } catch { /* error */ } finally { setLoading(false); }
    }, [page, filters]);

    useEffect(() => { fetchTenants(); }, [fetchTenants, refreshKey]);

    const handleInlineStatus = async (e, tenant, newStatus) => {
        e.stopPropagation();
        const label = newStatus === 'suspended' ? 'Suspender' : 'Reactivar';
        if (!window.confirm(`¿${label} "${tenant.name}"?`)) return;
        setActionLoading(String(tenant.id));
        try {
            await superAdminFetch(`/tenants/${tenant.id}/status`, { method: 'PUT', body: { status: newStatus } });
            onStatusChange();
            await fetchTenants();
        } catch { /* error */ } finally { setActionLoading(''); }
    };

    const totalPages = Math.max(1, Math.ceil(total / 20));

    // Shared button styles
    const btnGhost   = { padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.10)', background: 'transparent', color: 'rgba(255,255,255,0.60)', fontSize: '0.7rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif' };
    const btnDanger  = { padding: '5px 11px', borderRadius: '8px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: '0.72rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif' };
    const btnActivate = { ...btnGhost, borderColor: 'rgba(34,197,94,0.3)', color: '#4ade80' };
    const selStyle   = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: 'white', padding: '6px 12px', borderRadius: '10px', fontSize: '0.8125rem', fontFamily: 'Inter, sans-serif', outline: 'none' };

    return (
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', overflow: 'hidden' }}>
            {/* Header + filters */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexWrap: 'wrap', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600 }}>Tiendas recientes</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <select value={filters.plan} onChange={e => { setFilters(f => ({ ...f, plan: e.target.value })); setPage(1); }} style={selStyle}>
                        <option value="">Todos los planes</option>
                        <option value="trial">Trial</option>
                        <option value="basic">Básico</option>
                        <option value="pro">Pro</option>
                        <option value="premium">Premium</option>
                    </select>
                    <select value={filters.status} onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1); }} style={selStyle}>
                        <option value="">Todos los estados</option>
                        <option value="trial">Trial</option>
                        <option value="active">Activo</option>
                        <option value="suspended">Suspendido</option>
                        <option value="cancelled">Cancelado</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                    <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                            {['Tienda', 'Plan', 'Estado', 'MRR', 'Usuarios', 'Registro', ''].map(h => (
                                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.35)', borderBottom: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} style={{ padding: '24px', color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>Cargando…</td></tr>
                        ) : tenants.length === 0 ? (
                            <tr><td colSpan={7} style={{ padding: '24px', color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>No hay tiendas</td></tr>
                        ) : tenants.map(t => {
                            const av          = avatarColor(t.name);
                            const isSuspended = t.status === 'suspended';
                            const isActioning = actionLoading === String(t.id);
                            return (
                                <tr key={t.id} onClick={() => onSelectTenant(t.id)} style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '13px 16px', verticalAlign: 'middle' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0, background: av.bg, color: av.color }}>
                                                {initials(t.name)}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, color: isSuspended ? 'rgba(255,255,255,0.5)' : 'white' }}>{t.name}</div>
                                                <div style={{ fontSize: '0.675rem', color: isSuspended ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.35)' }}>{t.slug}.{PLATFORM_DOMAIN}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '13px 16px', verticalAlign: 'middle' }}>
                                        <Badge cfg={PLAN_BADGE[t.plan_id] || PLAN_BADGE.basic} label={t.plan_name || t.plan_id} />
                                    </td>
                                    <td style={{ padding: '13px 16px', verticalAlign: 'middle' }}>
                                        <Badge cfg={STATUS_BADGE[t.status]} label={STATUS_BADGE[t.status]?.label || t.status} />
                                    </td>
                                    <td style={{ padding: '13px 16px', verticalAlign: 'middle', fontWeight: 600, color: t.price_monthly ? 'white' : 'rgba(255,255,255,0.35)' }}>
                                        {t.price_monthly ? `$${t.price_monthly}` : '—'}
                                    </td>
                                    <td style={{ padding: '13px 16px', verticalAlign: 'middle', color: 'rgba(255,255,255,0.55)' }}>
                                        {t.usage?.users ?? '—'}
                                    </td>
                                    <td style={{ padding: '13px 16px', verticalAlign: 'middle', color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                        {new Date(t.created_at).toLocaleDateString('es-DO', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </td>
                                    <td style={{ padding: '13px 16px', verticalAlign: 'middle' }} onClick={e => e.stopPropagation()}>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button onClick={e => { e.stopPropagation(); onSelectTenant(t.id); }} style={btnGhost}>Ver</button>
                                            {isSuspended ? (
                                                <button onClick={e => handleInlineStatus(e, t, 'active')} disabled={isActioning} style={btnActivate}>
                                                    {isActioning ? '…' : 'Reactivar'}
                                                </button>
                                            ) : (
                                                <button onClick={e => handleInlineStatus(e, t, 'suspended')} disabled={isActioning} style={btnDanger}>
                                                    {isActioning ? '…' : 'Suspender'}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>
                    Mostrando {tenants.length} de {total} tiendas
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={{ ...btnGhost, padding: '5px 10px' }}>‹</button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                        <button key={p} onClick={() => setPage(p)} style={{ ...btnGhost, padding: '5px 10px', ...(page === p ? { background: 'rgba(34,211,238,0.1)', borderColor: 'rgba(34,211,238,0.3)', color: '#22d3ee' } : {}) }}>{p}</button>
                    ))}
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ ...btnGhost, padding: '5px 10px' }}>›</button>
                </div>
            </div>
        </div>
    );
}

// ── KPI metric card ───────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, trend, trendColor, sparkColor }) {
    const bars  = [40, 55, 45, 65, 58, 72, 85, 100];
    const solid = sparkColor || '#22d3ee';
    // Build a faded version for non-last bars
    const faded = solid.startsWith('#')
        ? `${solid}55`
        : solid.replace('rgb(', 'rgba(').replace(')', ',0.35)');

    return (
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                {trend && <span style={{ fontSize: '0.625rem', fontWeight: 700, color: trendColor || '#4ade80', background: `${trendColor || '#4ade80'}18`, padding: '2px 8px', borderRadius: '99px' }}>{trend}</span>}
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '4px' }}>{value ?? '—'}</div>
            {sub && <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>{sub}</div>}
            {/* Sparkline */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '28px', marginTop: '12px' }}>
                {bars.map((h, i) => (
                    <div key={i} style={{ flex: 1, borderRadius: '3px', background: i === bars.length - 1 ? solid : faded, height: `${h}%` }} />
                ))}
            </div>
        </div>
    );
}

// ── Plan distribution sidebar ─────────────────────────────────────────────────
function PlanDistribution({ plans = [] }) {
    const total = plans.reduce((s, p) => s + parseInt(p.count || 0), 0) || 1;
    const COLORS = { pro: '#8b5cf6', premium: '#8b5cf6', business: '#22d3ee', trial: '#22d3ee', basic: 'rgba(255,255,255,0.30)', starter: 'rgba(255,255,255,0.30)' };

    return (
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '0.875rem', fontWeight: 600 }}>Distribución de planes</h3>
            {plans.length === 0 ? (
                <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', margin: 0 }}>Sin datos</p>
            ) : plans.map(p => {
                const pct = Math.round((parseInt(p.count || 0) / total) * 100);
                return (
                    <div key={p.plan_id} style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                            <span style={{ color: 'rgba(255,255,255,0.6)' }}>{p.name || p.plan_id}</span>
                            <span style={{ fontWeight: 600 }}>{p.count} tiendas</span>
                        </div>
                        <div style={{ height: '5px', borderRadius: '99px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: '99px', width: `${pct}%`, background: COLORS[p.plan_id] || '#22d3ee' }} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── Quick actions sidebar ─────────────────────────────────────────────────────
// Only "Actualizar datos" is wired; others are placeholders for future features
function QuickActions({ onRefresh, setActiveNav }) {
    const actions = [
        { icon: '🔄', label: 'Actualizar datos',         fn: onRefresh },
        { icon: '🏪', label: 'Crear nueva tienda',        fn: null },
        { icon: '📨', label: 'Enviar anuncio global',     fn: null },
        { icon: '📤', label: 'Exportar reporte MRR',      fn: null },
        { icon: '🗄️', label: 'Respaldo de base de datos', fn: () => setActiveNav('backup') },
    ];
    return (
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '0.875rem', fontWeight: 600 }}>Acciones rápidas</h3>
            {actions.map(a => (
                <button key={a.label} onClick={a.fn || undefined} disabled={!a.fn} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '12px', border: 'none', background: 'transparent', color: a.fn ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.3)', fontSize: '0.75rem', fontWeight: 500, cursor: a.fn ? 'pointer' : 'not-allowed', textAlign: 'left', fontFamily: 'Inter, sans-serif', marginBottom: '2px' }}>
                    <span style={{ fontSize: '1rem' }}>{a.icon}</span>
                    {a.label}
                </button>
            ))}
        </div>
    );
}

// ── Alerts sidebar ────────────────────────────────────────────────────────────
function AlertsPanel({ trialAlerts = [] }) {
    return (
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600 }}>Alertas</h3>
                <span style={{ fontSize: '0.625rem', color: '#22d3ee', fontWeight: 500, cursor: 'pointer' }}>Ver todas</span>
            </div>
            {trialAlerts.length === 0 ? (
                <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', margin: 0 }}>Sin alertas activas</p>
            ) : trialAlerts.slice(0, 5).map(a => {
                const days = a.trial_ends_at ? Math.ceil((new Date(a.trial_ends_at) - Date.now()) / 86400000) : null;
                return (
                    <div key={a.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#facc15', flexShrink: 0, marginTop: '4px' }} />
                        <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'rgba(255,255,255,0.8)' }}>
                                {a.name} — trial expira{days != null ? ` en ${days}d` : ''}
                            </div>
                            <div style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>
                                {a.trial_ends_at ? new Date(a.trial_ends_at).toLocaleDateString() : ''}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ onLogout, totalTenants, activeNav, setActiveNav }) {

    const NAV_PLATFORM = [
        { id: 'dashboard', icon: '◈', label: 'Dashboard' },
        { id: 'stores',    icon: '🏪', label: 'Tiendas',    badge: totalTenants },
        { id: 'users',     icon: '👥', label: 'Usuarios' },
        { id: 'billing',   icon: '💳', label: 'Facturación' },
        { id: 'analytics', icon: '📊', label: 'Analíticas' },
    ];
    const NAV_SYSTEM = [
        { id: 'security', icon: '🛡️', label: 'Seguridad' },
        { id: 'settings', icon: '⚙️', label: 'Configuración' },
        { id: 'database', icon: '🗄️', label: 'Base de datos' },
        { id: 'backup',   icon: '💾', label: 'Respaldos' },
        { id: 'logs',     icon: '📋', label: 'Logs' },
    ];

    const navItem = (item) => (
        <button key={item.id} onClick={() => setActiveNav(item.id)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px', borderRadius: '10px', fontSize: '0.8125rem', fontWeight: 500, color: activeNav === item.id ? '#22d3ee' : 'rgba(255,255,255,0.45)', background: activeNav === item.id ? 'rgba(34,211,238,0.10)' : 'transparent', cursor: 'pointer', border: 'none', width: '100%', textAlign: 'left', fontFamily: 'Inter, sans-serif', marginBottom: '2px' }}>
            <span style={{ fontSize: '1rem', width: '20px', textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
            {item.label}
            {item.badge != null && (
                <span style={{ marginLeft: 'auto', background: 'rgba(34,211,238,0.2)', color: '#22d3ee', fontSize: '0.65rem', fontWeight: 700, padding: '1px 7px', borderRadius: '99px' }}>
                    {item.badge}
                </span>
            )}
        </button>
    );

    return (
        <aside style={{ width: '240px', flexShrink: 0, background: 'rgba(255,255,255,0.03)', borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0, overflowY: 'auto' }}>
            {/* Logo */}
            <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <LogoSvg />
                    <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>EonsClover</div>
                        <div style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.35)', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Super Admin</div>
                    </div>
                </div>
            </div>

            {/* Nav */}
            <nav style={{ flex: 1, padding: '12px', paddingTop: '16px' }}>
                <div style={{ fontSize: '0.625rem', fontWeight: 600, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 8px', marginBottom: '8px' }}>Plataforma</div>
                {NAV_PLATFORM.map(navItem)}
                <div style={{ fontSize: '0.625rem', fontWeight: 600, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 8px', margin: '20px 0 8px' }}>Sistema</div>
                {NAV_SYSTEM.map(navItem)}
            </nav>

            {/* Profile + logout */}
            <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', borderRadius: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0, background: 'linear-gradient(135deg,#22d3ee,#8b5cf6)' }}>SA</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>Super Admin</div>
                        <div style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>admin@eonsclover.com</div>
                    </div>
                    <button onClick={onLogout} title="Cerrar sesión" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', fontSize: '1rem', padding: '2px', lineHeight: 1 }}>⏻</button>
                </div>
            </div>
        </aside>
    );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
function SuperAdminDashboard() {
    const [authenticated, setAuthenticated] = useState(
        !!(sessionStorage.getItem('superAdminSecret') || localStorage.getItem('superAdminSecret'))
    );
    const [metrics, setMetrics]           = useState(null);
    const [selectedTenant, setSelectedTenant] = useState(null);
    const [refreshKey, setRefreshKey]     = useState(0);
    const [search, setSearch]             = useState('');
    const [activeNav, setActiveNav]       = useState('dashboard');

    // Inject Inter font
    useEffect(() => {
        const id = 'inter-font-sa';
        if (!document.getElementById(id)) {
            const link = document.createElement('link');
            link.id   = id; link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
            document.head.appendChild(link);
        }
    }, []);

    const loadMetrics = useCallback(async () => {
        try {
            const data = await superAdminFetch('/metrics');
            setMetrics(data);
        } catch {
            sessionStorage.removeItem('superAdminSecret');
            localStorage.removeItem('superAdminSecret');
            setAuthenticated(false);
        }
    }, []);

    useEffect(() => {
        if (authenticated) loadMetrics();
    }, [authenticated, loadMetrics, refreshKey]);

    const handleRefresh = () => setRefreshKey(k => k + 1);
    const handleLogout  = () => {
        sessionStorage.removeItem('superAdminSecret');
        localStorage.removeItem('superAdminSecret');
        setAuthenticated(false);
    };

    if (!authenticated) {
        return <SuperAdminLoginPage onLogin={() => setAuthenticated(true)} />;
    }

    const dateStr = new Date().toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' });
    const btnGhostSm = { padding: '7px 10px', borderRadius: '9px', border: '1px solid rgba(255,255,255,0.10)', background: 'transparent', color: 'rgba(255,255,255,0.60)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

    return (
        <div style={{ fontFamily: 'Inter, sans-serif', background: '#050816', color: 'white', minHeight: '100vh', display: 'flex' }}>
            {/* Glow blobs */}
            <div style={{ position: 'fixed', width: '500px', height: '500px', borderRadius: '999px', filter: 'blur(120px)', background: 'rgba(34,211,238,0.07)', top: '-80px', left: '200px', pointerEvents: 'none', zIndex: 0 }} />
            <div style={{ position: 'fixed', width: '420px', height: '420px', borderRadius: '999px', filter: 'blur(120px)', background: 'rgba(139,92,246,0.08)', bottom: 0, right: 0, pointerEvents: 'none', zIndex: 0 }} />

            <Sidebar onLogout={handleLogout} totalTenants={metrics?.tenants?.total} activeNav={activeNav} setActiveNav={setActiveNav} />

            {/* Main content area */}
            <div style={{ flex: 1, overflowY: 'auto', position: 'relative', zIndex: 10 }}>

                {/* Top bar */}
                <header style={{ position: 'sticky', top: 0, zIndex: 20, padding: '16px 32px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(5,8,22,0.85)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Buenos días, Admin 👋</h1>
                        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>{dateStr} · Visión general de la plataforma</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Search (UI only for now) */}
                        <div style={{ position: 'relative' }}>
                            <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                            </svg>
                            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar tienda o usuario…" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: 'white', padding: '8px 14px 8px 36px', borderRadius: '10px', fontSize: '0.8125rem', fontFamily: 'Inter, sans-serif', width: '220px', outline: 'none' }} />
                        </div>
                        {/* Refresh */}
                        <button onClick={handleRefresh} style={btnGhostSm} title="Actualizar">
                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                            </svg>
                        </button>
                        {/* New store — placeholder for future */}
                        <button disabled title="Próximamente" style={{ padding: '8px 18px', borderRadius: '10px', background: 'rgba(34,211,238,0.4)', color: '#050816', fontSize: '0.8125rem', fontWeight: 700, cursor: 'not-allowed', border: 'none', fontFamily: 'Inter, sans-serif' }}>
                            + Nueva tienda
                        </button>
                    </div>
                </header>

                {/* Content */}
                <main style={{ padding: '28px 32px' }}>

                    {/* Database browser section */}
                    {activeNav === 'database' && (
                        <DatabaseSection superAdminFetch={superAdminFetch} />
                    )}

                    {/* Backup manager section */}
                    {activeNav === 'backup' && (
                        <BackupManager superAdminFetch={superAdminFetch} />
                    )}

                    {/* Dashboard content (KPIs + tables) */}
                    {activeNav === 'dashboard' && (<>

                    {/* KPI cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
                        <MetricCard
                            label="MRR"
                            value={metrics ? `$${(metrics.mrr || 0).toFixed(0)}` : null}
                            sub="Ingresos mensuales recurrentes"
                            trend="↑ MRR"
                            sparkColor="#22d3ee"
                        />
                        <MetricCard
                            label="Tiendas activas"
                            value={metrics?.tenants?.active}
                            sub={`${metrics?.tenants?.trial || 0} en trial`}
                            trend={`↑ activas`}
                            sparkColor="#22d3ee"
                        />
                        <MetricCard
                            label="Suspendidas"
                            value={metrics?.tenants?.suspended}
                            sub="Requieren atención"
                            trend={metrics?.tenants?.suspended > 0 ? `${metrics.tenants.suspended} actualmente` : undefined}
                            trendColor="#f87171"
                            sparkColor="#f87171"
                        />
                        <MetricCard
                            label="Total tenants"
                            value={metrics?.tenants?.total}
                            sub={`Trials por vencer: ${metrics?.trial_alerts?.length || 0}`}
                            sparkColor="#8b5cf6"
                        />
                    </div>

                    {/* Main grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '20px', alignItems: 'start' }}>

                        <TenantTable
                            key={refreshKey}
                            refreshKey={refreshKey}
                            onSelectTenant={setSelectedTenant}
                            onStatusChange={handleRefresh}
                        />

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <PlanDistribution plans={metrics?.plans || []} />
                            <QuickActions onRefresh={handleRefresh} setActiveNav={setActiveNav} />
                            <AlertsPanel trialAlerts={metrics?.trial_alerts || []} />
                        </div>
                    </div>

                    </>)} {/* end activeNav === 'dashboard' */}
                </main>
            </div>

            {/* Tenant detail modal */}
            <TenantDetailModal
                tenantId={selectedTenant}
                onClose={() => setSelectedTenant(null)}
                onRefresh={handleRefresh}
            />
        </div>
    );
}

// ── Routes ────────────────────────────────────────────────────────────────────
export default function SuperAdminRoutes() {
    return (
        <Routes>
            <Route path="/" element={<SuperAdminDashboard />} />
            {/* Support path-based access: eonsclover.local/admin */}
            <Route path="/admin" element={<SuperAdminDashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
