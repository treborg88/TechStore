// DatabaseSection.jsx — Read-only DB browser for the super admin panel
// Two tabs: public schema (SaaS platform tables) and per-tenant schema browser
// Opens Adminer in new tab with pre-selected schema via URL params

import { useState, useEffect } from 'react';

// Adminer runs as a Docker sidecar on port 8080
const ADMINER_BASE = 'http://localhost:8080';

// Ordered list for the public (platform) schema
const PUBLIC_TABLES = ['tenants', 'subscriptions', 'plans', 'audit_log', 'schema_migrations', '_schema_version'];

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
    container:   { display: 'flex', flexDirection: 'column', gap: '16px', height: 'calc(100vh - 130px)' },
    header:      { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' },
    tabBar:      { display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '4px', alignSelf: 'flex-start' },
    tab:  (on) => ({ padding: '7px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500, fontFamily: 'Inter, sans-serif', background: on ? 'rgba(34,211,238,0.15)' : 'transparent', color: on ? '#22d3ee' : 'rgba(255,255,255,0.45)' }),
    body:        { flex: 1, display: 'flex', gap: '16px', overflow: 'hidden' },
    sidebar:     { width: '190px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' },
    sideLabel:   { fontSize: '0.6rem', fontWeight: 600, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 4px', marginBottom: '4px' },
    tableBtn: (on) => ({ width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'Inter, sans-serif', fontWeight: on ? 600 : 400, background: on ? 'rgba(34,211,238,0.10)' : 'rgba(255,255,255,0.025)', color: on ? '#22d3ee' : 'rgba(255,255,255,0.55)', borderLeft: on ? '2px solid #22d3ee' : '2px solid transparent', marginBottom: '2px' }),
    main:        { flex: 1, background: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
    tableWrap:   { flex: 1, overflowX: 'auto', overflowY: 'auto' },
    th:          { padding: '10px 14px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'nowrap', background: 'rgba(255,255,255,0.03)', position: 'sticky', top: 0 },
    td:          { padding: '8px 14px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(255,255,255,0.04)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    footer:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', flexShrink: 0 },
    pageBtn: (off) => ({ padding: '5px 14px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.10)', background: 'transparent', color: off ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.55)', cursor: off ? 'default' : 'pointer', fontSize: '0.75rem', fontFamily: 'Inter, sans-serif' }),
    adminerBtn:  { padding: '8px 18px', borderRadius: '10px', background: 'rgba(34,211,238,0.10)', border: '1px solid rgba(34,211,238,0.25)', color: '#22d3ee', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: '6px' },
    select:      { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: 'white', padding: '8px 12px', borderRadius: '9px', fontSize: '0.8rem', fontFamily: 'Inter, sans-serif', outline: 'none', width: '100%' },
    card:        { background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.07)', padding: '14px 16px' },
    empty:       { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.875rem', flexDirection: 'column', gap: '8px' },
};

// Format a single cell value for display
function Cell({ value }) {
    if (value === null || value === undefined) {
        return <span style={{ color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>null</span>;
    }
    if (typeof value === 'boolean') {
        return <span style={{ color: value ? '#4ade80' : '#f87171' }}>{String(value)}</span>;
    }
    if (typeof value === 'object') {
        const json = JSON.stringify(value);
        return <span style={{ color: '#22d3ee', fontFamily: 'monospace', fontSize: '0.68rem' }} title={json}>{json.slice(0, 80)}{json.length > 80 ? '…' : ''}</span>;
    }
    const str = String(value);
    // ISO datetime
    if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
        return <span style={{ color: 'rgba(255,255,255,0.5)' }}>{new Date(str).toLocaleString('es-DO')}</span>;
    }
    // UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(str)) {
        return <span style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'rgba(255,255,255,0.55)' }} title={str}>{str.slice(0, 8)}…</span>;
    }
    return str;
}

// ── Main Component ────────────────────────────────────────────────────────────
function DatabaseSection({ superAdminFetch }) {
    const [tab, setTab]                 = useState('platform'); // 'platform' | 'tenant'
    const [schemas, setSchemas]         = useState({});
    const [tenants, setTenants]         = useState([]);
    const [selectedTenant, setSelectedTenant] = useState(null);
    const [selectedTable, setSelectedTable]   = useState(null);
    const [tableData, setTableData]     = useState(null);
    const [loadingData, setLoadingData] = useState(false);
    const [loadingInit, setLoadingInit] = useState(true);
    const [page, setPage]               = useState(1);
    const [error, setError]             = useState(null);

    // Load schemas + tenant list on mount
    useEffect(() => {
        setLoadingInit(true);
        Promise.all([
            superAdminFetch('/database/schemas'),
            superAdminFetch('/tenants?limit=200&page=1'),
        ])
            .then(([schemasData, tenantsData]) => {
                setSchemas(schemasData);
                setTenants(tenantsData.data || []);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoadingInit(false));
    }, [superAdminFetch]);

    // Load table data whenever selection or page changes
    useEffect(() => {
        if (!selectedTable) { setTableData(null); return; }
        const schema = tab === 'platform' ? 'public' : selectedTenant?.schema_name;
        if (!schema) return;

        setLoadingData(true);
        setError(null);
        superAdminFetch(`/database/${schema}/table/${selectedTable}?page=${page}&limit=50`)
            .then(data => setTableData(data))
            .catch(err => { setError(err.message); setTableData(null); })
            .finally(() => setLoadingData(false));
    }, [selectedTable, selectedTenant, page, tab, superAdminFetch]);

    const handleTabChange = (t) => {
        setTab(t);
        setSelectedTable(null);
        setTableData(null);
        setPage(1);
        setError(null);
        if (t === 'platform') setSelectedTenant(null);
    };

    const handleTableSelect = (t) => {
        setSelectedTable(t);
        setPage(1);
        setTableData(null);
    };

    // Open Adminer with pre-selected schema (and table if available)
    const openAdminer = () => {
        const ns = tab === 'platform' ? 'public' : (selectedTenant?.schema_name || 'public');
        const params = new URLSearchParams({ pgsql: 'database', username: 'eonsclover', db: 'eonsclover', ns });
        if (selectedTable) params.set('select', selectedTable);
        window.open(`${ADMINER_BASE}/?${params}`, '_blank');
    };

    // Which tables appear in the sidebar
    const sidebarTables = tab === 'platform'
        ? PUBLIC_TABLES
        : (selectedTenant ? (schemas[selectedTenant.schema_name] || []) : []);

    const schemaLabel = tab === 'platform' ? 'public' : (selectedTenant?.schema_name || '—');

    return (
        <div style={S.container}>

            {/* Header row */}
            <div style={S.header}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>🗄️ Base de Datos</h2>
                    <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                        Explorador de tablas — solo lectura
                    </p>
                </div>
                <button onClick={openAdminer} style={S.adminerBtn}>
                    <span>⚡</span> Abrir en Adminer
                </button>
            </div>

            {/* Tab switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={S.tabBar}>
                    <button style={S.tab(tab === 'platform')} onClick={() => handleTabChange('platform')}>🌐 Plataforma</button>
                    <button style={S.tab(tab === 'tenant')}   onClick={() => handleTabChange('tenant')}>🏪 Por Tenant</button>
                </div>
            </div>

            {/* Tenant selector — only visible on "Por Tenant" tab */}
            {tab === 'tenant' && (
                <div style={S.card}>
                    <label style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginBottom: '6px', display: 'block', fontWeight: 500 }}>
                        Seleccionar tienda
                    </label>
                    <select
                        style={S.select}
                        value={selectedTenant?.slug || ''}
                        onChange={e => {
                            const t = tenants.find(x => x.slug === e.target.value) || null;
                            setSelectedTenant(t);
                            setSelectedTable(null);
                            setTableData(null);
                            setPage(1);
                        }}
                    >
                        <option value="">— Elige una tienda —</option>
                        {tenants.map(t => (
                            <option key={t.id} value={t.slug}>
                                {t.name} · {t.slug} ({t.status})
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* Body: sidebar + main data area */}
            <div style={S.body}>

                {/* Table list sidebar */}
                <div style={S.sidebar}>
                    <div style={S.sideLabel}>{schemaLabel}</div>

                    {loadingInit ? (
                        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', padding: '8px 4px' }}>Cargando…</div>
                    ) : sidebarTables.length === 0 ? (
                        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', padding: '8px 4px', lineHeight: 1.5 }}>
                            {tab === 'tenant' && !selectedTenant ? 'Selecciona una tienda' : 'Sin tablas'}
                        </div>
                    ) : (
                        sidebarTables.map(t => (
                            <button key={t} style={S.tableBtn(selectedTable === t)} onClick={() => handleTableSelect(t)}>
                                {t}
                            </button>
                        ))
                    )}
                </div>

                {/* Data panel */}
                <div style={S.main}>
                    {error ? (
                        <div style={S.empty}><span style={{ color: '#f87171', fontSize: '1.5rem' }}>⚠</span>{error}</div>
                    ) : !selectedTable ? (
                        <div style={S.empty}><span style={{ fontSize: '2rem', opacity: 0.3 }}>🗃</span>Selecciona una tabla</div>
                    ) : loadingData ? (
                        <div style={S.empty}>Cargando datos…</div>
                    ) : tableData ? (
                        <>
                            <div style={S.tableWrap}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '500px' }}>
                                    <thead>
                                        <tr>
                                            {tableData.columns.map(col => (
                                                <th key={col} style={S.th}>{col}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tableData.rows.length === 0 ? (
                                            <tr>
                                                <td colSpan={tableData.columns.length} style={{ ...S.td, textAlign: 'center', color: 'rgba(255,255,255,0.2)', padding: '32px' }}>
                                                    Sin registros
                                                </td>
                                            </tr>
                                        ) : tableData.rows.map((row, i) => (
                                            <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                                                {tableData.columns.map(col => (
                                                    <td key={col} style={S.td} title={String(row[col] ?? '')}>
                                                        <Cell value={row[col]} />
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination footer */}
                            <div style={S.footer}>
                                <span>
                                    {tableData.total} registros · página {page} de {tableData.totalPages || 1}
                                </span>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                        style={S.pageBtn(page <= 1)}
                                        disabled={page <= 1}
                                        onClick={() => setPage(p => p - 1)}
                                    >
                                        ← Anterior
                                    </button>
                                    <button
                                        style={S.pageBtn(page >= (tableData.totalPages || 1))}
                                        disabled={page >= (tableData.totalPages || 1)}
                                        onClick={() => setPage(p => p + 1)}
                                    >
                                        Siguiente →
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

export default DatabaseSection;
