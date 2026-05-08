// SaaSLanding.jsx - Public marketing landing page (platform root domain)
// Hero, features, pricing, social proof, login, and pricing page routes

import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { API_URL, PLATFORM_DOMAIN, PLATFORM_PROTOCOL } from '../../config';

// Dynamic URL helpers — no hardcoded domains
const registerUrl = `${PLATFORM_PROTOCOL}//app.${PLATFORM_DOMAIN}/register`;

// ── Shared Styles ─────────────────────────────────────────────────────────────
const colors = { primary: '#4f46e5', primaryDark: '#4338ca', accent: '#10b981', bg: '#f8fafc', dark: '#1a1a2e', text: '#334155', light: '#f1f5f9' };
const s = {
    page: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: colors.text },
    container: { maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem' },
    btn: { display: 'inline-block', padding: '0.85rem 2rem', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '1rem', border: 'none', cursor: 'pointer', transition: 'all 0.2s' },
    btnPrimary: { background: colors.primary, color: '#fff' },
    btnOutline: { background: 'transparent', color: colors.primary, border: `2px solid ${colors.primary}` },
    section: { padding: '5rem 0' },
    sectionTitle: { fontSize: '2.2rem', fontWeight: 700, color: colors.dark, textAlign: 'center', marginBottom: '1rem' },
    sectionSub: { fontSize: '1.1rem', color: '#64748b', textAlign: 'center', maxWidth: '600px', margin: '0 auto 3rem' },
    card: { background: '#fff', borderRadius: '16px', padding: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' },
    grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' },
    input: { width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.95rem', boxSizing: 'border-box' },
    badge: { display: 'inline-block', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 },
    nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0' },
};

// ── Navbar ────────────────────────────────────────────────────────────────────
function Navbar() {
    return (
        <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 100 }}>
            <div style={{ ...s.container, ...s.nav }}>
                <Link to="/" style={{ fontSize: '1.4rem', fontWeight: 800, color: colors.primary, textDecoration: 'none' }}>
                    🏪 EonsClover
                </Link>
                <nav style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    <Link to="/pricing" style={{ color: colors.text, textDecoration: 'none', fontWeight: 500 }}>Planes</Link>
                    <Link to="/login" style={{ color: colors.text, textDecoration: 'none', fontWeight: 500 }}>Iniciar sesión</Link>
                    <a href={registerUrl} style={{ ...s.btn, ...s.btnPrimary, padding: '0.6rem 1.5rem', fontSize: '0.9rem' }}>
                        Comenzar gratis
                    </a>
                </nav>
            </div>
        </header>
    );
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
    return (
        <footer style={{ background: colors.dark, color: '#94a3b8', padding: '3rem 0', marginTop: '4rem' }}>
            <div style={{ ...s.container, textAlign: 'center' }}>
                <p style={{ fontWeight: 600, color: '#fff', fontSize: '1.1rem', marginBottom: '0.5rem' }}>EonsClover</p>
                <p style={{ fontSize: '0.85rem' }}>Tu tienda online profesional en minutos.</p>
                <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: '1.5rem', fontSize: '0.85rem' }}>
                    <Link to="/pricing" style={{ color: '#94a3b8', textDecoration: 'none' }}>Planes</Link>
                    <Link to="/login" style={{ color: '#94a3b8', textDecoration: 'none' }}>Iniciar sesión</Link>
                    <a href={registerUrl} style={{ color: '#94a3b8', textDecoration: 'none' }}>Registro</a>
                </div>
                <p style={{ fontSize: '0.75rem', marginTop: '2rem', color: '#64748b' }}>© {new Date().getFullYear()} EonsClover. Todos los derechos reservados.</p>
            </div>
        </footer>
    );
}

// ── Plan Card (Reusable for pricing sections) ─────────────────────────────────
const FEATURE_LABELS = {
    products: 'Catálogo de productos',
    orders: 'Gestión de pedidos',
    chatbot: 'Chatbot IA',
    email_invoices: 'Facturas por email',
    tracking: 'Seguimiento de envíos',
    variants: 'Variantes de producto',
    custom_domain: 'Dominio personalizado',
    all: 'Todas las funcionalidades'
};

function PlanCard({ plan, highlighted }) {
    const borderStyle = highlighted ? `2px solid ${colors.primary}` : '1px solid #e2e8f0';
    return (
        <div style={{ ...s.card, border: borderStyle, position: 'relative', display: 'flex', flexDirection: 'column' }}>
            {/* Popular badge */}
            {highlighted && (
                <div style={{ ...s.badge, background: colors.primary, color: '#fff', position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)' }}>
                    Más popular
                </div>
            )}
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: colors.dark, marginBottom: '0.5rem' }}>{plan.name}</h3>
            <div style={{ marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 800, color: colors.dark }}>${plan.price_monthly}</span>
                <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>/mes</span>
            </div>
            {/* Limits */}
            <div style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: '#64748b' }}>
                <div>📦 {plan.max_products === -1 ? 'Productos ilimitados' : `${plan.max_products} productos`}</div>
                <div>🛒 {plan.max_orders_month === -1 ? 'Órdenes ilimitadas' : `${plan.max_orders_month} órdenes/mes`}</div>
                <div>💾 {plan.max_storage_mb === -1 ? 'Almacenamiento ilimitado' : `${plan.max_storage_mb} MB almacenamiento`}</div>
            </div>
            {/* Features */}
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem', flex: 1 }}>
                {(plan.features || []).map(f => (
                    <li key={f} style={{ padding: '0.3rem 0', fontSize: '0.9rem' }}>
                        ✅ {FEATURE_LABELS[f] || f}
                    </li>
                ))}
            </ul>
            <a href={registerUrl} style={{
                ...s.btn,
                ...(highlighted ? s.btnPrimary : s.btnOutline),
                textAlign: 'center', width: '100%', boxSizing: 'border-box'
            }}>
                {plan.price_monthly === 0 ? 'Empezar gratis' : 'Elegir plan'}
            </a>
        </div>
    );
}

// ── usePlans hook ─────────────────────────────────────────────────────────────
function usePlans() {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        fetch(`${API_URL}/saas/plans`)
            .then(r => r.ok ? r.json() : [])
            .then(data => setPlans(Array.isArray(data) ? data : []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);
    return { plans, loading };
}

// ── Home Page ─────────────────────────────────────────────────────────────────
function SaaSHome() {
    const { plans, loading: plansLoading } = usePlans();
    const [tenantCount, setTenantCount] = useState(null);

    // Fetch active tenant count for social proof
    useEffect(() => {
        fetch(`${API_URL}/superadmin/metrics`, { headers: { 'x-super-admin-secret': '__public__' } })
            .catch(() => {}); // Silently fail — count is optional
        // Use a simpler approach: just show a generic message if we can't get the count
        setTenantCount(null);
    }, []);

    return (
        <div style={s.page}>
            {/* Hero */}
            <section style={{ background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`, color: '#fff', padding: '6rem 0 5rem', textAlign: 'center' }}>
                <div style={s.container}>
                    <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', fontWeight: 800, marginBottom: '1.5rem', lineHeight: 1.2 }}>
                        Tu tienda online profesional<br />en minutos
                    </h1>
                    <p style={{ fontSize: '1.2rem', opacity: 0.9, maxWidth: '600px', margin: '0 auto 2.5rem', lineHeight: 1.6 }}>
                        Plataforma e-commerce completa con ERP integrado. Sin código, sin complicaciones. Empieza a vender hoy.
                    </p>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <a href={registerUrl} style={{ ...s.btn, background: '#fff', color: colors.primary, fontWeight: 700 }}>
                            Comenzar gratis →
                        </a>
                        <Link to="/pricing" style={{ ...s.btn, background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}>
                            Ver planes
                        </Link>
                    </div>
                    {/* Social proof */}
                    {tenantCount !== null && (
                        <p style={{ marginTop: '2rem', fontSize: '0.9rem', opacity: 0.8 }}>
                            🚀 {tenantCount}+ tiendas activas en la plataforma
                        </p>
                    )}
                </div>
            </section>

            {/* Features — 5 key capabilities */}
            <section style={{ ...s.section, background: '#fff' }}>
                <div style={s.container}>
                    <h2 style={s.sectionTitle}>Todo lo que necesitas para vender online</h2>
                    <p style={s.sectionSub}>Funcionalidades profesionales incluidas desde el primer día.</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2rem' }}>
                        {[
                            { icon: '🛍️', title: 'Catálogo completo', desc: 'Productos con variantes, imágenes múltiples, categorías y búsqueda.' },
                            { icon: '📊', title: 'Panel de administración', desc: 'Dashboard con KPIs, ventas, inventario y gestión de usuarios.' },
                            { icon: '💳', title: 'Pagos integrados', desc: 'Stripe, PayPal, transferencia bancaria y contra entrega.' },
                            { icon: '🤖', title: 'Chatbot IA', desc: 'Asistente inteligente para tus clientes con 5 proveedores IA.' },
                            { icon: '📧', title: 'Facturas y seguimiento', desc: 'Facturas PDF, emails automáticos y tracking de envíos.' },
                        ].map(f => (
                            <div key={f.title} style={{ textAlign: 'center', padding: '1.5rem' }}>
                                <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{f.icon}</div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: colors.dark, marginBottom: '0.5rem' }}>{f.title}</h3>
                                <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.5 }}>{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing preview */}
            <section style={{ ...s.section, background: colors.light }} id="pricing">
                <div style={s.container}>
                    <h2 style={s.sectionTitle}>Planes simples y transparentes</h2>
                    <p style={s.sectionSub}>Empieza gratis. Escala cuando crezcas.</p>
                    {plansLoading ? (
                        <p style={{ textAlign: 'center' }}>Cargando planes…</p>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
                            {plans.map(p => (
                                <PlanCard key={p.id} plan={p} highlighted={p.id === 'pro'} />
                            ))}
                        </div>
                    )}
                    <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                        <Link to="/pricing" style={{ color: colors.primary, fontWeight: 600, textDecoration: 'none' }}>
                            Ver comparación detallada →
                        </Link>
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section style={{ ...s.section, background: '#fff' }}>
                <div style={s.container}>
                    <h2 style={s.sectionTitle}>Listo en 3 pasos</h2>
                    <div style={{ ...s.grid3, maxWidth: '900px', margin: '2rem auto 0' }}>
                        {[
                            { step: '1', title: 'Regístrate', desc: 'Elige el nombre de tu tienda y crea tu cuenta en segundos.' },
                            { step: '2', title: 'Configura', desc: 'Agrega tus productos, personaliza tu marca y configura pagos.' },
                            { step: '3', title: 'Vende', desc: 'Comparte tu link y empieza a recibir pedidos inmediatamente.' },
                        ].map(item => (
                            <div key={item.step} style={{ ...s.card, textAlign: 'center' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: colors.primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', fontWeight: 700, margin: '0 auto 1rem' }}>
                                    {item.step}
                                </div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: colors.dark, marginBottom: '0.5rem' }}>{item.title}</h3>
                                <p style={{ fontSize: '0.9rem', color: '#64748b' }}>{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section style={{ background: colors.dark, color: '#fff', padding: '5rem 0', textAlign: 'center' }}>
                <div style={s.container}>
                    <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>¿Listo para empezar?</h2>
                    <p style={{ fontSize: '1.1rem', opacity: 0.8, marginBottom: '2rem' }}>
                        Prueba gratis por 14 días. Sin tarjeta de crédito.
                    </p>
                    <a href={registerUrl} style={{ ...s.btn, background: colors.primary, color: '#fff', fontSize: '1.1rem', padding: '1rem 2.5rem' }}>
                        Crear mi tienda gratis →
                    </a>
                </div>
            </section>
        </div>
    );
}

// ── Pricing Page (detailed comparison) ────────────────────────────────────────
function PricingPage() {
    const { plans, loading } = usePlans();

    return (
        <div style={s.page}>
            <section style={{ ...s.section, background: colors.light }}>
                <div style={s.container}>
                    <h1 style={{ ...s.sectionTitle, fontSize: '2.5rem' }}>Planes y Precios</h1>
                    <p style={s.sectionSub}>Elige el plan perfecto para tu negocio. Actualiza o cancela en cualquier momento.</p>

                    {loading ? (
                        <p style={{ textAlign: 'center' }}>Cargando…</p>
                    ) : (
                        <>
                            {/* Plan cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', maxWidth: '1100px', margin: '0 auto 3rem' }}>
                                {plans.map(p => (
                                    <PlanCard key={p.id} plan={p} highlighted={p.id === 'pro'} />
                                ))}
                            </div>

                            {/* Feature comparison table */}
                            <div style={{ ...s.card, maxWidth: '900px', margin: '0 auto', overflowX: 'auto' }}>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1.5rem', color: colors.dark }}>Comparación detallada</h3>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                            <th style={{ textAlign: 'left', padding: '0.75rem', color: '#64748b' }}>Característica</th>
                                            {plans.map(p => (
                                                <th key={p.id} style={{ textAlign: 'center', padding: '0.75rem', color: colors.dark, fontWeight: 600 }}>{p.name}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            { label: 'Productos', key: 'max_products' },
                                            { label: 'Órdenes/mes', key: 'max_orders_month' },
                                            { label: 'Almacenamiento', key: 'max_storage_mb', suffix: ' MB' },
                                            ...Object.entries(FEATURE_LABELS).map(([k, v]) => ({ label: v, feature: k }))
                                        ].map(row => (
                                            <tr key={row.label} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '0.75rem', fontWeight: 500 }}>{row.label}</td>
                                                {plans.map(p => (
                                                    <td key={p.id} style={{ textAlign: 'center', padding: '0.75rem' }}>
                                                        {row.key
                                                            ? (p[row.key] === -1 ? '∞' : `${p[row.key]}${row.suffix || ''}`)
                                                            : row.feature
                                                                ? ((p.features || []).includes(row.feature) || (p.features || []).includes('all') ? '✅' : '—')
                                                                : '—'
                                                        }
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    {/* FAQ */}
                    <div style={{ maxWidth: '700px', margin: '3rem auto 0' }}>
                        <h3 style={{ ...s.sectionTitle, fontSize: '1.5rem' }}>Preguntas frecuentes</h3>
                        {[
                            { q: '¿Puedo cambiar de plan después?', a: 'Sí, puedes actualizar o reducir tu plan en cualquier momento desde tu panel de administración.' },
                            { q: '¿Qué pasa cuando termina el trial?', a: 'Tu tienda se pausa hasta que elijas un plan de pago. No pierdes ningún dato.' },
                            { q: '¿Necesito tarjeta de crédito para empezar?', a: 'No, el trial de 14 días es completamente gratis sin compromiso.' },
                            { q: '¿Puedo usar mi propio dominio?', a: 'Sí, los planes Pro y Premium incluyen dominio personalizado.' },
                        ].map(faq => (
                            <div key={faq.q} style={{ ...s.card, marginBottom: '1rem' }}>
                                <h4 style={{ fontSize: '1rem', fontWeight: 600, color: colors.dark, marginBottom: '0.5rem' }}>{faq.q}</h4>
                                <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>{faq.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}

// ── Login Page (centralized, redirects to tenant subdomain) ───────────────────
function LoginPage() {
    const [slug, setSlug] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = (e) => {
        e.preventDefault();
        const cleanSlug = slug.trim().toLowerCase();
        if (!cleanSlug) {
            setError('Ingresa el nombre de tu tienda');
            return;
        }
        // Redirect to tenant subdomain login
        window.location.href = `${PLATFORM_PROTOCOL}//${cleanSlug}.${PLATFORM_DOMAIN}/login`;
    };

    return (
        <div style={s.page}>
            <section style={{ ...s.section, minHeight: '60vh', display: 'flex', alignItems: 'center' }}>
                <div style={{ ...s.container, maxWidth: '440px' }}>
                    <div style={s.card}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: colors.dark, textAlign: 'center', marginBottom: '0.5rem' }}>
                            Iniciar sesión
                        </h2>
                        <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '2rem', fontSize: '0.9rem' }}>
                            Ingresa el nombre de tu tienda para acceder.
                        </p>
                        <form onSubmit={handleSubmit}>
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                                <input
                                    type="text"
                                    value={slug}
                                    onChange={e => { setSlug(e.target.value); setError(''); }}
                                    placeholder="mi-tienda"
                                    style={{ ...s.input, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                                    autoFocus
                                />
                                <span style={{ padding: '0.75rem 1rem', background: colors.light, border: '1px solid #d1d5db', borderLeft: 'none', borderTopRightRadius: '8px', borderBottomRightRadius: '8px', fontSize: '0.85rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                                    .{PLATFORM_DOMAIN}
                                </span>
                            </div>
                            {error && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{error}</p>}
                            <button type="submit" style={{ ...s.btn, ...s.btnPrimary, width: '100%', textAlign: 'center' }}>
                                Ir a mi tienda →
                            </button>
                        </form>
                        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                                ¿No tienes tienda?{' '}
                                <a href={registerUrl} style={{ color: colors.primary, textDecoration: 'none', fontWeight: 500 }}>
                                    Crear una gratis
                                </a>
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

// ── Route wrapper with layout ──────────────────────────────────────────────────
function LandingLayout({ children }) {
    return (
        <>
            <Navbar />
            {children}
            <Footer />
        </>
    );
}

/** Routes shown on the root domain (SaaS landing) */
export default function SaaSLandingRoutes() {
    return (
        <Routes>
            <Route path="/" element={<LandingLayout><SaaSHome /></LandingLayout>} />
            <Route path="/pricing" element={<LandingLayout><PricingPage /></LandingLayout>} />
            <Route path="/login" element={<LandingLayout><LoginPage /></LandingLayout>} />
            {/* /register redirects to onboarding subdomain */}
            <Route path="/register" element={<Navigate to={registerUrl} replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
