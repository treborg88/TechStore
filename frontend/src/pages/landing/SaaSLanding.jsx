// SaaSLanding.jsx - Public marketing landing page (platform root domain)
// Dark theme with glassmorphism, trefoil animation — matches EonsClover HTML design

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PLATFORM_DOMAIN, PLATFORM_PROTOCOL } from '../../config';

const registerUrl = `${PLATFORM_PROTOCOL}//app.${PLATFORM_DOMAIN}/register`;

// -- Global styles injector (font + CSS helpers not expressible inline) ---------
function GlobalStyles() {
    useEffect(() => {
        // Inter font
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
        link.id = 'saas-inter-font';
        if (!document.getElementById('saas-inter-font')) document.head.appendChild(link);

        // Utility classes (hover effects, gradient text) + mobile responsive
        const style = document.createElement('style');
        style.id = 'saas-landing-global';
        style.textContent = `
            .saas-root * { box-sizing: border-box; }
            .saas-root a { text-decoration: none; }
            .saas-root { overflow: hidden; font-size: 110%; }
            .gradient-text {
                background: linear-gradient(to right, #22d3ee, #8b5cf6);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            .hover-lift { transition: transform 0.3s; }
            .hover-lift:hover { transform: translateY(-8px); }

            /* -- Global body protection ---------------------------- */
            body { max-width: 100vw; overflow-x: hidden; }
            img { max-width: 100%; height: auto; }

            /* -- Mobile responsive ----------------------------------- */
            @media (max-width: 768px) {
                body { overflow-x: hidden; max-width: 100vw; }
                .saas-nav-links { display: none !important; }
                .saas-nav-cta { display: none !important; }
                .saas-menu-btn { display: flex !important; }
                .saas-hero-grid { grid-template-columns: 1fr !important; gap: 1.5rem !important; }
                .saas-hero-image { order: -1; margin-top: -1rem !important; }
                .saas-features-grid { grid-template-columns: 1fr !important; }
                .saas-pricing-grid { grid-template-columns: 1fr !important; }
                .saas-pricing-grid > div { transform: none !important; }
                .saas-comparison-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
                .saas-comparison-table { min-width: 500px; font-size: 0.75rem; }
                .saas-section-heading { font-size: 2rem !important; }
                .saas-hero-heading { font-size: clamp(1.6rem, 5vw, 3rem) !important; }
                .saas-demo-grid { grid-template-columns: 1fr !important; }
                .saas-carousel-controls button { width: 2.5rem !important; height: 2.5rem !important; }
                .saas-glob-blob { max-width: 90vw !important; max-height: 90vw !important; left: -20vw !important; }
                #hero { padding: 5rem 1rem 2.5rem !important; }
                #hero .saas-hero-heading + p { font-size: 1rem !important; }
                section[id="pricing"] { padding: 4rem 1rem !important; }
                section[id="faq"] { padding: 4rem 1rem !important; }
                section { padding-left: 1rem !important; padding-right: 1rem !important; }
                .saas-root img { max-width: 100%; height: auto; }
                .hover-lift { padding: 1.25rem !important; }
                .saas-carousel-btn { width: 2.2rem !important; height: 2.2rem !important; font-size: 1rem !important; }
                .saas-spec-grid { grid-template-columns: repeat(2, 1fr) !important; }
                .saas-feature-detail { grid-template-columns: 1fr !important; }
                /* Extra mobile fixes */
                #hero .saas-hero-grid > div:first-child { order: 1; }
                #hero .saas-hero-image { order: 0; margin-top: -3rem !important; }
                .saas-pricing-grid > div { padding: 1.5rem !important; }
                [style*="padding: 6rem 2.5rem"] { padding: 3rem 1.25rem !important; }
                [style*="font-size: 3rem"][style*="font-weight: 700"] { font-size: 2rem !important; }
                .saas-root ul li { word-break: break-word; }
                .saas-root table { min-width: unset !important; }
                .saas-mobile-menu { width: 100vw; margin-left: -1rem; padding-left: 1.5rem !important; padding-right: 1.5rem !important; }
            }

            /* -- PC wide feel (simulated 110% zoom) ---------------- */
            @media (min-width: 769px) {
                .saas-nav-links { display: flex !important; }
                .saas-nav-cta { display: flex !important; }
                #hero { padding: 10rem 2rem 7rem !important; }
                .saas-root { font-size: 106%; }
                .saas-section-heading { font-size: 3.3rem !important; }
                .saas-hero-heading { font-size: clamp(2.2rem, 4.5vw, 3.3rem) !important; }
                section[id="pricing"] .saas-section-heading { font-size: 3.3rem !important; }
                .saas-pricing-grid { gap: 2.5rem !important; }
                .saas-root p { line-height: 1.7; }
                /* Content containers slightly wider */
                [style*="max-width: 1280px"] { max-width: 1340px !important; }
            }
        `;
        if (!document.getElementById('saas-landing-global')) document.head.appendChild(style);

        return () => { document.getElementById('saas-landing-global')?.remove(); };
    }, []);
    return null;
}

// -- Design tokens --------------------------------------------------------------
const glass = {
    background: 'rgba(255,255,255,0.05)',
    backdropFilter: 'blur(14px)',
    border: '1px solid rgba(255,255,255,0.08)',
};

// -- EonsClover SVG Logo ---------------------------------------------------------
function LogoSvg() {
    return (
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="20" r="19" stroke="#22d3ee" strokeWidth="1.5" fill="none" opacity="0.6" />
            <path d="M20 20 Q10 18 10 10 Q10 2 18 4 Q22 5 20 12Z" fill="url(#lg1)" opacity="0.9" />
            <path d="M20 20 Q22 10 30 10 Q38 10 36 18 Q35 22 28 20Z" fill="url(#lg2)" opacity="0.9" />
            <path d="M20 20 Q10 22 10 30 Q10 38 18 36 Q22 35 20 28Z" fill="url(#lg1)" opacity="0.9" />
            <path d="M20 20 Q22 30 30 30 Q38 30 36 22 Q35 18 28 20Z" fill="url(#lg2)" opacity="0.9" />
            <path d="M20 30 Q19 35 17 37" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7" />
            <defs>
                <linearGradient id="lg1" x1="10" y1="10" x2="20" y2="20" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
                <linearGradient id="lg2" x1="30" y1="10" x2="20" y2="20" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#22d3ee" />
                </linearGradient>
            </defs>
        </svg>
    );
}

// -- Trefoil knot canvas animation ---------------------------------------------
function TrefoilCanvas() {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = canvas.parentElement?.offsetHeight || 600;
        }
        resize();
        window.addEventListener('resize', resize);

        function drawTrefoil(cx, cy, scale, rotation, alpha, color) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(rotation);
            ctx.beginPath();
            for (let i = 0; i <= 240; i++) {
                const t = (i / 240) * Math.PI * 2;
                const x = (Math.sin(t) + 2 * Math.sin(2 * t)) * scale;
                const y = (Math.cos(t) - 2 * Math.cos(2 * t)) * scale;
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.strokeStyle = color;
            ctx.globalAlpha = alpha;
            ctx.lineWidth = 1.8;
            ctx.stroke();
            ctx.restore();
        }

        const COLORS = ['#22d3ee', '#8b5cf6', '#a78bfa', '#67e8f9'];
        const particles = Array.from({ length: 22 }, () => ({
            x: Math.random() * (canvas.width || 1400),
            y: Math.random() * (canvas.height || 600),
            scale: Math.random() * 80 + 30,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.005,
            dx: (Math.random() - 0.5) * 0.28,
            dy: (Math.random() - 0.5) * 0.28,
            alpha: Math.random() * 0.22 + 0.12,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
        }));

        let animId;
        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (const p of particles) {
                drawTrefoil(p.x, p.y, p.scale, p.rotation, p.alpha, p.color);
                p.x += p.dx; p.y += p.dy; p.rotation += p.rotSpeed;
                const pad = p.scale * 3;
                if (p.x < -pad) p.x = canvas.width + pad;
                if (p.x > canvas.width + pad) p.x = -pad;
                if (p.y < -pad) p.y = canvas.height + pad;
                if (p.y > canvas.height + pad) p.y = -pad;
            }
            animId = requestAnimationFrame(animate);
        }
        animate();

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', resize);
        };
    }, []);

    return (
        <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }} />
    );
}

// -- Navbar ---------------------------------------------------------------------
function Navbar() {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <header style={{ position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 50, borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(5,8,22,0.8)', backdropFilter: 'blur(20px)' }}>
            <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {/* Logo */}
                <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none', zIndex: 51 }}>
                    <LogoSvg />
                    <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff' }}>EonsClover</span>
                </Link>

                {/* Desktop nav links */}
                <nav className="saas-nav-links" style={{ alignItems: 'center', gap: '1.75rem', fontSize: '0.9rem' }}>
                    <a href="#hero" style={{ color: 'rgba(255,255,255,0.7)' }}>Dashboard</a>
                    <a href="#features" style={{ color: 'rgba(255,255,255,0.7)' }}>Características</a>
                    <a href="#pricing" style={{ color: 'rgba(255,255,255,0.7)' }}>Precios</a>
                    <a href="#faq" style={{ color: 'rgba(255,255,255,0.7)' }}>FAQ</a>
                </nav>

                {/* Desktop CTA */}
                <div className="saas-nav-cta" style={{ gap: '0.6rem' }}>
                    <Link to="/login" style={{ padding: '0.45rem 1.1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', background: 'transparent', fontSize: '0.85rem' }}>
                        Iniciar Sesión
                    </Link>
                    <a href={registerUrl} style={{ padding: '0.45rem 1.1rem', borderRadius: '10px', background: '#22d3ee', color: '#000', fontWeight: 600, fontSize: '0.85rem' }}>
                        Prueba Gratuita
                    </a>
                </div>

                {/* Mobile hamburger (tipo libro) */}
                <button className="saas-menu-btn" aria-label="Abrir menú" onClick={() => setMenuOpen(!menuOpen)}
                    style={{ display: 'none', background: 'none', border: 'none', color: '#fff', fontSize: '1.6rem', cursor: 'pointer', padding: '0.25rem', lineHeight: 1, zIndex: 51, minWidth: '44px', minHeight: '44px', justifyContent: 'center', alignItems: 'center' }}>
                    {menuOpen ? '?' : (
                        <svg width="24" height="18" viewBox="0 0 24 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                            <line x1="1" y1="1" x2="23" y2="1" />
                            <line x1="1" y1="9" x2="23" y2="9" />
                            <line x1="1" y1="17" x2="23" y2="17" />
                        </svg>
                    )}
                </button>
            </div>

            {/* Mobile dropdown menu */}
            {menuOpen && (
                <div className="saas-mobile-menu" style={{ background: 'rgba(5,8,22,0.98)', backdropFilter: 'blur(24px)', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '1rem 1.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <a href="#hero" onClick={() => setMenuOpen(false)} style={{ color: 'rgba(255,255,255,0.85)', fontSize: '1.05rem', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>?? Dashboard</a>
                    <a href="#features" onClick={() => setMenuOpen(false)} style={{ color: 'rgba(255,255,255,0.85)', fontSize: '1.05rem', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>? Características</a>
                    <a href="#pricing" onClick={() => setMenuOpen(false)} style={{ color: 'rgba(255,255,255,0.85)', fontSize: '1.05rem', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>?? Precios</a>
                    <a href="#faq" onClick={() => setMenuOpen(false)} style={{ color: 'rgba(255,255,255,0.85)', fontSize: '1.05rem', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>? FAQ</a>
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <Link to="/login" onClick={() => setMenuOpen(false)} style={{ flex: 1, textAlign: 'center', padding: '0.6rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', background: 'transparent', fontSize: '0.9rem' }}>
                            Iniciar Sesión
                        </Link>
                        <a href={registerUrl} onClick={() => setMenuOpen(false)} style={{ flex: 1, textAlign: 'center', padding: '0.6rem', borderRadius: '10px', background: '#22d3ee', color: '#000', fontWeight: 600, fontSize: '0.9rem' }}>
                            Prueba Gratuita
                        </a>
                    </div>
                </div>
            )}
        </header>
    );
}

// -- Footer ---------------------------------------------------------------------
function Footer() {
    return (
        <footer style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '2.5rem 1.5rem', color: 'rgba(255,255,255,0.5)' }}>
            <div style={{ maxWidth: '1160px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '2rem' }}>
                <div>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', margin: '0 0 0.75rem' }}>EonsClover</h3>
                    <p style={{ maxWidth: '28rem', margin: 0, lineHeight: 1.6 }}>Plataforma SaaS moderna para ecommerce y gestión de negocios tecnológicos.</p>
                </div>
                <div style={{ display: 'flex', gap: '2.5rem' }}>
                    <div>
                        <h4 style={{ color: '#fff', fontWeight: 600, marginBottom: '1rem' }}>Producto</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
                            <span>Características</span>
                            <span>Precios</span>
                            <span>Integraciones</span>
                        </div>
                    </div>
                    <div>
                        <h4 style={{ color: '#fff', fontWeight: 600, marginBottom: '1rem' }}>Empresa</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
                            <span>Acerca de</span>
                            <span>Contacto</span>
                            <span>Soporte</span>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}

// -- Image Carousel -------------------------------------------------------------

// -- Demo stores button with dropdown ------------------------------------------
const DEMO_STORES = [
    { name: 'Tech Azul', slug: 'tiendaazul', desc: 'Tecnología · Electrónica', color: '#2563eb' },
    { name: 'Esmeralda', slug: 'esmeralda', desc: 'Salud · Orgánicos', color: '#059669' },
    { name: 'Rosa', slug: 'rosa', desc: 'Belleza · Flores', color: '#be185d' },
    { name: 'Ámbar', slug: 'ambar', desc: 'Café · Artesanal', color: '#b45309' },
];

function DemoStoresButton() {
    const [open, setOpen] = useState(false);
    const btnRef = useRef(null);
    const menuRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const close = (e) => {
            if (btnRef.current && btnRef.current.contains(e.target)) return;
            if (menuRef.current && menuRef.current.contains(e.target)) return;
            setOpen(false);
        };
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, [open]);

    // Position dropdown below the button
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    useEffect(() => {
        if (open && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            setCoords({ top: rect.bottom + 6, left: rect.left });
        }
    }, [open]);

    return (
        <>
            <button ref={btnRef} onClick={() => setOpen(!open)} style={{ padding: '1rem 2rem', borderRadius: '16px', ...glass, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                Ver Demo {open ? '?' : '?'}
            </button>
            {open && createPortal(
                <div ref={menuRef} style={{ position: 'fixed', top: coords.top, left: coords.left, background: 'rgba(5,8,22,0.98)', backdropFilter: 'blur(24px)', borderRadius: '16px', minWidth: '260px', zIndex: 9999, padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '2px', border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}>
                    <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tiendas Demo</div>
                    {DEMO_STORES.map(store => (
                        <a key={store.slug} href={`${PLATFORM_PROTOCOL}//${store.slug}.${PLATFORM_DOMAIN}`} target="_blank" rel="noopener"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.7rem 0.75rem', borderRadius: '10px', color: '#fff', textDecoration: 'none', fontSize: '0.875rem', transition: 'background 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: store.color, flexShrink: 0 }} />
                            <div>
                                <div style={{ fontWeight: 600 }}>{store.name}</div>
                                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)' }}>{store.desc}</div>
                            </div>
                        </a>
                    ))}
                </div>,
                document.body
            )}
        </>
    );
}

// -- Image Carousel -------------------------------------------------------------
const CAROUSEL_SLIDES = [
    { img: '/imagenes/Site home page.png', alt: 'Página principal de la tienda', icon: '??', title: 'Página Principal', desc: 'Catálogo, categorías y búsqueda — lista para vender.', border: 'rgba(34,211,238,0.2)' },
    { img: '/imagenes/Admin dashboard.png', alt: 'Panel de administración', icon: '??', title: 'Panel de Administración', desc: 'KPIs en tiempo real: ingresos, órdenes e inventario.', border: 'rgba(139,92,246,0.2)' },
    { img: '/imagenes/product page.png', alt: 'Página de producto', icon: '??', title: 'Página de Producto', desc: 'Galería, variantes y precio con botón de compra destacado.', border: 'rgba(34,211,238,0.2)' },
    { img: '/imagenes/proceso de checkout paso 2 informacion de envio.png', alt: 'Proceso de checkout', icon: '??', title: 'Checkout — Envío', desc: 'Dirección y opciones de entrega en un paso claro.', border: 'rgba(74,222,128,0.2)' },
    { img: '/imagenes/metodos de pagos.png', alt: 'Métodos de pago', icon: '??', title: 'Métodos de Pago', desc: 'Stripe, PayPal, transferencia y contra entrega.', border: 'rgba(250,204,21,0.2)' },
    { img: '/imagenes/confirmacion de pedidos.png', alt: 'Confirmación de pedido', icon: '?', title: 'Confirmación de Pedido', desc: 'Resumen del pedido y factura PDF enviada al cliente.', border: 'rgba(74,222,128,0.2)' },
    { img: '/imagenes/order tracking.png', alt: 'Seguimiento de pedido', icon: '??', title: 'Seguimiento de Envío', desc: 'Rastreo en tiempo real con notificaciones automáticas.', border: 'rgba(34,211,238,0.2)' },
    { img: '/imagenes/revision de pedido.png', alt: 'Revisión de pedido', icon: '??', title: 'Revisión del Pedido', desc: 'Productos, descuentos y total antes de confirmar.', border: 'rgba(139,92,246,0.2)' },
    { img: '/imagenes/order page.png', alt: 'Gestión de órdenes', icon: '??', title: 'Gestión de Órdenes', desc: 'Filtra, actualiza y gestiona todos tus pedidos.', border: 'rgba(250,204,21,0.2)' },
    { img: '/imagenes/site setting.png', alt: 'Configuración del sitio', icon: '??', title: 'Configuración de la Tienda', desc: 'Logo, colores, dominio y opciones desde un panel intuitivo.', border: 'rgba(236,72,153,0.2)' },
];

function Carousel() {
    const [idx, setIdx] = useState(0);
    const [visible, setVisible] = useState(1);
    const timerRef = useRef(null);
    const trackRef = useRef(null);
    const touchStart = useRef(null);
    const n = CAROUSEL_SLIDES.length;

    useEffect(() => {
        const update = () => setVisible(window.innerWidth >= 768 ? 2 : 1);
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    const maxIdx = n - visible;

    // Auto-advance timer
    useEffect(() => {
        timerRef.current = setInterval(() => setIdx(prev => prev >= maxIdx ? 0 : prev + 1), 5000);
        return () => clearInterval(timerRef.current);
    }, [maxIdx]);

    const move = (dir) => {
        if (dir > 0) setIdx(prev => prev >= maxIdx ? 0 : prev + 1);
        else setIdx(prev => prev <= 0 ? maxIdx : prev - 1);
        clearInterval(timerRef.current);
        timerRef.current = setInterval(() => setIdx(prev => prev >= maxIdx ? 0 : prev + 1), 5000);
    };

    // Touch swipe handlers
    const handleTouchStart = (e) => {
        touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const handleTouchEnd = (e) => {
        if (!touchStart.current) return;
        const dx = e.changedTouches[0].clientX - touchStart.current.x;
        const dy = e.changedTouches[0].clientY - touchStart.current.y;
        // Only swipe if horizontal drag > vertical and > 40px
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
            move(dx < 0 ? 1 : -1);
        }
        touchStart.current = null;
    };

    const translatePct = idx * (100 / visible);

    return (
        <div style={{ position: 'relative', marginTop: '5rem' }}>
            {/* Prev/Next */}
            <button onClick={() => move(-1)} aria-label="Anterior" className="saas-carousel-btn saas-carousel-prev"
                style={{ position: 'absolute', left: '-0.5rem', top: '50%', transform: 'translateY(-50%)', width: '3rem', height: '3rem', ...glass, borderRadius: '9999px', color: '#fff', fontSize: '1.25rem', cursor: 'pointer', zIndex: 10, border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
            <button onClick={() => move(1)} aria-label="Siguiente" className="saas-carousel-btn saas-carousel-next"
                style={{ position: 'absolute', right: '-0.5rem', top: '50%', transform: 'translateY(-50%)', width: '3rem', height: '3rem', ...glass, borderRadius: '9999px', color: '#fff', fontSize: '1.25rem', cursor: 'pointer', zIndex: 10, border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>

            {/* Track with touch events */}
            <div style={{ overflow: 'hidden', margin: '0 2.5rem', touchAction: 'pan-y' }}>
                <div ref={trackRef}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    style={{ display: 'flex', transform: `translateX(-${translatePct}%)`, transition: 'transform 0.5s ease-in-out' }}>
                    {CAROUSEL_SLIDES.map((slide, i) => (
                        <div key={i} style={{ minWidth: `${100 / visible}%`, padding: visible === 2 ? '0 18px' : '0 6px', flex: 'none' }}>
                            <div style={{ ...glass, borderRadius: '24px', overflow: 'hidden', border: `1px solid ${slide.border}` }}>
                                <img src={slide.img} alt={slide.alt} style={{ width: '100%', height: 'auto', maxHeight: '420px', objectFit: 'contain', objectPosition: 'top', display: 'block' }} />
                                <div style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ fontSize: 28, marginRight: 8 }}>{slide.icon}</span>
                                    <div style={{ minWidth: 0 }}>
                                        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, color: '#fff' }}>{slide.title}</h3>
                                        <p style={{ margin: '0.2rem 0 0', color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem', lineHeight: 1.3 }}>{slide.desc}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
                {CAROUSEL_SLIDES.map((_, i) => {
                    const active = visible === 2 ? (i === idx || i === idx + 1) : i === idx;
                    return (
                        <button key={i} aria-label={`Slide ${i + 1}`} onClick={() => {
                            setIdx(Math.min(i, maxIdx));
                            clearInterval(timerRef.current);
                            timerRef.current = setInterval(() => setIdx(prev => prev >= maxIdx ? 0 : prev + 1), 5000);
                        }}
                        style={{ width: active ? '20px' : '8px', height: '8px', borderRadius: '9999px', background: active ? '#22d3ee' : 'rgba(255,255,255,0.3)', border: 'none', cursor: 'pointer', transition: 'all 0.3s', padding: 0 }} />
                    );
                })}
            </div>
        </div>
    );
}

// -- Static pricing plans -------------------------------------------------------
const PLANS = [
    { name: 'Trial', subtitle: 'Prueba gratuita', price: '$0', items: ['?? 20 Productos', '?? 50 Órdenes/mes', '?? 200 MB Almacenamiento', '? Funcionalidades Básicas'], btnText: 'Comenzar Prueba', featured: false, dark: false },
    { name: 'Básico', subtitle: 'Para comenzar', price: '$19', items: ['?? 100 Productos', '?? 500 Órdenes/mes', '?? 1000 MB Almacenamiento', '? Funcionalidades Estándar'], btnText: 'Elegir Plan', featured: false, dark: true },
    { name: 'Profesional', subtitle: 'Para negocios en crecimiento', price: '$49', items: ['?? 500 Productos', '?? 2000 Órdenes/mes', '?? 5000 MB Almacenamiento', '? Funcionalidades Avanzadas'], btnText: 'Elegir Plan', featured: true, dark: true },
    { name: 'Premium', subtitle: 'Todo incluido', price: '$99', items: ['?? Productos Ilimitados', '?? Órdenes Ilimitadas', '?? 20000 MB Almacenamiento', '? Todas las Funcionalidades'], btnText: 'Elegir Plan', featured: false, dark: true },
];

const COMPARISON_ROWS = [
    ['Productos', '20', '100', '500', '8'],
    ['Órdenes/mes', '50', '500', '2000', '8'],
    ['Almacenamiento', '200 MB', '1000 MB', '5000 MB', '20000 MB'],
    ['Catálogo de productos', '?', '?', '?', '?'],
    ['Gestión de pedidos', '?', '?', '?', '?'],
    ['Chatbot IA', '?', '?', '?', '?'],
    ['Facturas por email', '—', '?', '?', '?'],
    ['Seguimiento de envíos', '—', '—', '?', '?'],
    ['Variantes de producto', '—', '—', '?', '?'],
    ['Dominio personalizado', '—', '—', '?', '?'],
    ['Todas las funcionalidades', '—', '—', '—', '?'],
];

const FAQ_ITEMS = [
    { q: '¿Cómo funciona el respaldo de base de datos?', a: 'Desde el panel de administración puedes generar un respaldo completo de tu base de datos con un solo clic y descargarlo al instante. También puedes programar copias automáticas diarias o semanales, y restaurar cualquier respaldo anterior en caso de necesitarlo.' },
    { q: '¿Mis clientes pueden rastrear su pedido sin tener una cuenta?', a: 'Sí. El módulo de trackeo permite consultar el estado de una orden ingresando únicamente el número de orden o los datos del comprador (nombre, email o teléfono). No es necesario estar registrado, lo que reduce la fricción y mejora la experiencia de compra.' },
    { q: '¿Cómo funciona el mapa de rutas de envío?', a: 'Cada envío activo puede visualizarse en un mapa interactivo con la ruta desde tu bodega hasta la dirección del cliente. La plataforma integra Google Maps y Leaflet, permitiéndote ver la ubicación estimada del paquete y compartir el enlace de seguimiento con tu cliente en tiempo real.' },
    { q: '¿Qué métodos de pago puedo aceptar?', a: 'Eonsclover soporta Stripe, PayPal, transferencia bancaria y pago contra entrega. Puedes activar o desactivar cada método desde la configuración de tu tienda sin necesidad de código, y todos los pagos en línea están cifrados y cumplen con el estándar PCI DSS.' },
    { q: '¿El chatbot de IA requiere configuración técnica?', a: 'No. Solo debes elegir uno de los 5 proveedores de IA compatibles (como OpenAI, Gemini u otros), ingresar tu clave de API desde el panel y activarlo. El chatbot comienza a responder preguntas de tus clientes automáticamente las 24 horas del día, sin necesidad de programación.' },
    { q: '¿Las facturas se generan solas con cada venta?', a: 'Sí. Al confirmarse un pago, el sistema genera automáticamente una factura en PDF y la envía por email al cliente junto con el resumen del pedido. Tú también puedes descargar o reenviar cualquier factura desde el historial de órdenes en el panel de administración.' },
    { q: '¿Cómo manejo el stock cuando un producto tiene variantes?', a: 'Cada variante (talla, color, modelo, etc.) lleva su propio contador de inventario. El sistema descuenta el stock automáticamente con cada venta y te notifica cuando una variante alcanza el umbral mínimo que tú defines, evitando sobrevender productos agotados.' },
];

// -- Home page (all sections) ---------------------------------------------------
function SaaSHome() {
    // Show toast for store-not-found redirects
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const toastType = params.get('toast');
        const slug = params.get('slug') || '';
        if (toastType === 'store-not-found' && slug) {
            toast.error(`La tienda "${decodeURIComponent(slug)}" no existe o aún no está configurada.`);
            // Clean URL
            const url = new URL(window.location);
            url.searchParams.delete('toast');
            url.searchParams.delete('slug');
            window.history.replaceState({}, '', url.toString());
        }
    }, []);

    return (
        <div className="saas-root" style={{ overflowX: 'hidden' }}>
            {/* -- Hero -------------------------------------------------------- */}
            <section id="hero" style={{ position: 'relative', overflow: 'hidden', padding: '9rem 1.5rem 6rem' }}>
                <TrefoilCanvas />
                {/* Glow blob */}
                <div className="saas-glob-blob" style={{ position: 'absolute', width: '500px', height: '500px', background: 'rgba(34,211,238,0.18)', filter: 'blur(120px)', borderRadius: '999px', zIndex: 0, top: '2.5rem', left: '5rem', maxWidth: '100vw' }} />

                <div className="saas-hero-grid" style={{ maxWidth: '1400px', margin: '0 auto', position: 'relative', zIndex: 10, display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '3rem', alignItems: 'center' }}>
                    <div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '9999px', ...glass, fontSize: '0.875rem', color: '#22d3ee', marginBottom: '1.5rem' }}>
                            Plataforma Todo-en-Uno de Ecommerce para Tecnología
                        </div>
                        <h2 className="saas-hero-heading" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, lineHeight: 1.2, margin: '0 0 2rem', color: '#fff' }}>
                            Crea Tu{' '}
                            <span className="gradient-text">Tienda Online</span>
                            {' '}y Administra Tu Negocio Desde Cualquier Dispositivo
                        </h2>
                        <p style={{ fontSize: '1.25rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, margin: '0 0 2.5rem' }}>
                            Crea tu tienda online, automatiza tu tienda, recibe pedidos en línea y controla tu negocio desde cualquier lugar.
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                            <a href={registerUrl} style={{ padding: '1rem 2rem', borderRadius: '16px', background: '#22d3ee', color: '#000', fontWeight: 700, fontSize: '1.125rem' }}>
                                Iniciar Prueba Gratuita
                            </a>
                            <DemoStoresButton />
                        </div>
                    </div>

                    {/* Hero image */}
                    <div className="saas-hero-image" style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', top: '-2.5rem', right: '-2.5rem', width: '18rem', height: '18rem', background: 'rgba(168,85,247,0.2)', filter: 'blur(120px)', borderRadius: '9999px' }} />
                        <div style={{ position: 'absolute', bottom: '-2.5rem', left: '-2.5rem', width: '15rem', height: '15rem', background: 'rgba(34,211,238,0.15)', filter: 'blur(100px)', borderRadius: '9999px' }} />
                        <div style={{ ...glass, borderRadius: '32px', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
                            <img src="/imagenes/landing image.png" alt="Vista de la tienda online Eonsclover" style={{ width: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                        </div>
                    </div>
                </div>
            </section>

            {/* -- Features ---------------------------------------------------- */}
            <section id="features" style={{ padding: '6rem 1.5rem' }}>
                <div style={{ maxWidth: '1160px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', maxWidth: '48rem', margin: '0 auto 3rem' }}>
                        <h2 className="saas-section-heading" style={{ fontSize: '3rem', fontWeight: 700, margin: '0 0 1.5rem', color: '#fff' }}>Todo lo que necesitas para vender online</h2>
                        <p style={{ fontSize: '1.125rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
                            Potentes herramientas de ecommerce diseñadas para simplificar tus operaciones y aumentar la productividad.
                        </p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }} className="saas-features-grid">
                        {/* Catálogo */}
                        <div className="hover-lift" style={{ ...glass, borderRadius: '24px', padding: '2rem' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>???</div>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 1rem', color: '#fff' }}>Catálogo Completo</h3>
                            <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, margin: 0 }}>Productos con variantes, imágenes múltiples, categorías y búsqueda avanzada para tus clientes.</p>
                        </div>
                        {/* Checkout */}
                        <div className="hover-lift" style={{ ...glass, borderRadius: '24px', padding: '2rem', border: '1px solid rgba(74,222,128,0.2)' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>??</div>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 1rem', color: '#fff' }}>Checkout Completo y Moderno</h3>
                            <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, margin: '0 0 1.5rem' }}>Flujo de compra optimizado: carrito, dirección de envío, métodos de pago y confirmación — todo en pasos claros que aumentan la conversión.</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', flexWrap: 'wrap' }}>
                                <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', background: 'rgba(74,222,128,0.2)', color: '#86efac' }}>Carrito</span>
                                <span style={{ color: 'rgba(255,255,255,0.3)' }}>?</span>
                                <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', background: 'rgba(34,211,238,0.2)', color: '#67e8f9' }}>Dirección</span>
                                <span style={{ color: 'rgba(255,255,255,0.3)' }}>?</span>
                                <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', background: 'rgba(139,92,246,0.2)', color: '#c4b5fd' }}>Pago</span>
                                <span style={{ color: 'rgba(255,255,255,0.3)' }}>?</span>
                                <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', background: 'rgba(250,204,21,0.2)', color: '#fde047' }}>Confirmado</span>
                            </div>
                        </div>
                        {/* Pagos */}
                        <div className="hover-lift" style={{ ...glass, borderRadius: '24px', padding: '2rem' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>??</div>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 1rem', color: '#fff' }}>Pagos Integrados</h3>
                            <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, margin: 0 }}>Stripe, PayPal, transferencia bancaria y contra entrega. Acepta pagos de forma segura desde el primer día.</p>
                        </div>
                        {/* Inventario */}
                        <div className="hover-lift" style={{ ...glass, borderRadius: '24px', padding: '2rem' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>??</div>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 1rem', color: '#fff' }}>Gestión de Inventario</h3>
                            <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, margin: 0 }}>Rastrea stock automáticamente con alertas de inventario bajo y herramientas completas de gestión de productos.</p>
                        </div>
                        {/* Chatbot */}
                        <div className="hover-lift" style={{ ...glass, borderRadius: '24px', padding: '2rem' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>??</div>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 1rem', color: '#fff' }}>Chatbot IA</h3>
                            <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, margin: 0 }}>Asistente inteligente para tus clientes disponible 24/7, con soporte para 5 proveedores de inteligencia artificial.</p>
                        </div>
                        {/* Facturas */}
                        <div className="hover-lift" style={{ ...glass, borderRadius: '24px', padding: '2rem' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>??</div>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 1rem', color: '#fff' }}>Facturas y Seguimiento</h3>
                            <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, margin: 0 }}>Facturas PDF automáticas, emails de confirmación y tracking de envíos en tiempo real para tus clientes.</p>
                        </div>
                        {/* DB backup */}
                        <div className="hover-lift" style={{ ...glass, borderRadius: '24px', padding: '2rem', border: '1px solid rgba(96,165,250,0.2)' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>???</div>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 1rem', color: '#fff' }}>Respaldo de Base de Datos</h3>
                            <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, margin: '0 0 1.5rem' }}>Realiza copias de seguridad de tu base de datos con un solo clic. Descarga, restaura o programa respaldos automáticos para proteger tu negocio en todo momento.</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                                <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', background: 'rgba(96,165,250,0.2)', color: '#93c5fd' }}>Un clic</span>
                                <span style={{ color: 'rgba(255,255,255,0.3)' }}>•</span>
                                <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}>Automático</span>
                                <span style={{ color: 'rgba(255,255,255,0.3)' }}>•</span>
                                <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', background: 'rgba(34,211,238,0.2)', color: '#67e8f9' }}>Restauración</span>
                            </div>
                        </div>
                        {/* Map */}
                        <div className="hover-lift" style={{ ...glass, borderRadius: '24px', padding: '2rem', border: '1px solid rgba(52,211,153,0.2)' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>???</div>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 1rem', color: '#fff' }}>Rutas de Envío con Mapa</h3>
                            <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, margin: '0 0 1.5rem' }}>Visualiza la ubicación de los envíos en tiempo real con rutas interactivas usando Google Maps y Leaflet. Optimiza las entregas y mantén a tus clientes informados.</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem' }}>
                                <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', background: 'rgba(52,211,153,0.2)', color: '#6ee7b7' }}>?? Google Maps</span>
                                <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', background: 'rgba(74,222,128,0.2)', color: '#86efac' }}>?? Leaflet</span>
                            </div>
                        </div>
                        {/* Order tracking */}
                        <div className="hover-lift" style={{ ...glass, borderRadius: '24px', padding: '2rem', border: '1px solid rgba(251,146,60,0.2)' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>??</div>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 1rem', color: '#fff' }}>Trackeo de Órdenes</h3>
                            <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, margin: '0 0 1.5rem' }}>Consulta el estado de cualquier pedido por número de orden o datos del usuario. Seguimiento claro y transparente para ti y tus clientes en cada etapa del proceso.</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                                <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', background: 'rgba(251,146,60,0.2)', color: '#fdba74' }}># Nº de Orden</span>
                                <span style={{ color: 'rgba(255,255,255,0.3)' }}>•</span>
                                <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', background: 'rgba(250,204,21,0.2)', color: '#fde047' }}>?? Datos Usuario</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* -- Workflow ----------------------------------------------------- */}
            <section style={{ padding: '6rem 1.5rem' }}>
                <div style={{ maxWidth: '1160px', margin: '0 auto' }}>
                        <h2 className="saas-section-heading" style={{ fontSize: '3rem', fontWeight: 700, textAlign: 'center', marginBottom: '4rem', color: '#fff' }}>Lanza Tu Negocio en Minutos</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2rem' }}>
                        {[
                            { n: '1', title: 'Crear Tienda', desc: 'Configura tu perfil de negocio, productos y categorías.' },
                            { n: '2', title: 'Subir Productos', desc: 'Agrega inventario, imágenes, descripciones y precios.' },
                            { n: '3', title: 'Recibir Pedidos', desc: 'Gestiona compras, pagos y solicitudes de clientes.' },
                            { n: '4', title: 'Analizar Crecimiento', desc: 'Monitorea reportes de ventas y optimiza el rendimiento de tu negocio.' },
                        ].map(item => (
                            <div key={item.n} className="hover-lift" style={{ ...glass, borderRadius: '24px', padding: '2rem', textAlign: 'center' }}>
                                <div style={{ width: '4rem', height: '4rem', borderRadius: '9999px', background: '#22d3ee', color: '#000', fontWeight: 700, fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                                    {item.n}
                                </div>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 1rem', color: '#fff' }}>{item.title}</h3>
                                <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* -- Demo Images ------------------------------------------------- */}
            <section style={{ padding: '6rem 1.5rem' }}>
                <div style={{ maxWidth: '1160px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                        <h2 className="saas-section-heading" style={{ fontSize: '3rem', fontWeight: 700, marginBottom: '1.5rem', color: '#fff' }}>Así se vería tu tienda online</h2>
                        <p style={{ fontSize: '1.125rem', color: 'rgba(255,255,255,0.65)' }}>Una interfaz moderna y profesional que impresiona a tus clientes</p>
                        <div style={{ marginTop: '2.5rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1rem' }}>
                            {[
                                { icon: '??', text: 'Colores personalizables' },
                                { icon: '???', text: 'Tu propio logo' },
                                { icon: '??', text: 'Tipografías a tu estilo' },
                                { icon: '??', text: 'Dominio propio' },
                                { icon: '??', text: 'Textos y banners editables' },
                            ].map(b => (
                                <div key={b.text} style={{ ...glass, padding: '0.75rem 1.25rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'rgba(255,255,255,0.8)' }}>
                                    <span style={{ fontSize: '1.25rem' }}>{b.icon}</span> {b.text}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Store screenshot */}
                    <div style={{ marginBottom: '4rem' }}>
                        <div style={{ ...glass, borderRadius: '32px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)' }}>
                                <div style={{ width: '0.75rem', height: '0.75rem', borderRadius: '9999px', background: '#f87171' }} />
                                <div style={{ width: '0.75rem', height: '0.75rem', borderRadius: '9999px', background: '#facc15' }} />
                                <div style={{ width: '0.75rem', height: '0.75rem', borderRadius: '9999px', background: '#4ade80' }} />
                                <span style={{ marginLeft: '1rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem' }}>Tu Tienda Online — eonsclover.com</span>
                            </div>
                            <img src="/imagenes/Site home page.png" alt="Vista de la tienda online con versión desktop y móvil" style={{ width: '100%', objectFit: 'cover' }} />
                            <div className="saas-demo-grid" style={{ padding: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                                <div>
                                    <h4 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#67e8f9', margin: '0 0 0.5rem' }}>??? Tienda Profesional</h4>
                                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>Homepage moderna con catálogo de productos, categorías, búsqueda y carrito de compras.</p>
                                </div>
                                <div>
                                    <h4 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#67e8f9', margin: '0 0 0.5rem' }}>?? 100% Responsive</h4>
                                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>Diseño adaptativo perfecto para desktop, tablet y móvil. Tus clientes compran desde cualquier dispositivo.</p>
                                </div>
                                <div>
                                    <h4 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#67e8f9', margin: '0 0 0.5rem' }}>? Lista al Instante</h4>
                                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>Configura tu tienda en minutos con tu logo, colores, productos y comienza a vender de inmediato.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Admin screenshot */}
                    <div>
                        <div style={{ ...glass, borderRadius: '32px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)' }}>
                                <div style={{ width: '0.75rem', height: '0.75rem', borderRadius: '9999px', background: '#f87171' }} />
                                <div style={{ width: '0.75rem', height: '0.75rem', borderRadius: '9999px', background: '#facc15' }} />
                                <div style={{ width: '0.75rem', height: '0.75rem', borderRadius: '9999px', background: '#4ade80' }} />
                                <span style={{ marginLeft: '1rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem' }}>Panel de Administración — admin.eonsclover.com</span>
                            </div>
                            <img src="/imagenes/Admin dashboard.png" alt="Panel de administración con vista desktop y móvil" style={{ width: '100%', objectFit: 'cover' }} />
                            <div className="saas-demo-grid" style={{ padding: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                                <div>
                                    <h4 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#c4b5fd', margin: '0 0 0.5rem' }}>?? Dashboard Completo</h4>
                                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>Visualiza ingresos totales, órdenes pendientes, productos en stock y usuarios registrados en tiempo real.</p>
                                </div>
                                <div>
                                    <h4 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#c4b5fd', margin: '0 0 0.5rem' }}>?? Ventas por Período</h4>
                                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>Gráficos de ventas por día, semana, mes y año. Identifica tendencias y optimiza tu estrategia comercial.</p>
                                </div>
                                <div>
                                    <h4 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#c4b5fd', margin: '0 0 0.5rem' }}>?? Productos Más Vendidos</h4>
                                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>Ranking en tiempo real de tus mejores productos para enfocar tus esfuerzos donde más genera.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* -- Carousel ---------------------------------------------------- */}
            <section style={{ padding: '4rem 1.5rem' }}>
                <div style={{ maxWidth: '1160px', margin: '0 auto' }}>
                    <Carousel />
                </div>
            </section>

            {/* -- Pricing ----------------------------------------------------- */}
            <section id="pricing" style={{ padding: '6rem 1.5rem' }}>
                <div style={{ maxWidth: '1160px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '5rem' }}>
                        <p style={{ color: '#22d3ee', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 1rem', fontSize: '0.875rem', fontWeight: 600 }}>Precios</p>
                        <h2 className="saas-section-heading" style={{ fontSize: '3rem', fontWeight: 700, margin: 0, color: '#fff' }}>Precios Asequibles Siempre</h2>
                    </div>

                    <div className="saas-pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2rem', alignItems: 'center' }}>
                        {PLANS.map((plan, i) => (
                            <div key={i} style={plan.featured ? {
                                borderRadius: '32px', padding: '2rem',
                                background: 'linear-gradient(to bottom, #22d3ee, #8b5cf6)',
                                color: '#000', transform: 'scale(1.05)', boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
                                display: 'flex', flexDirection: 'column',
                            } : {
                                ...glass, borderRadius: '32px', padding: '2rem', display: 'flex', flexDirection: 'column',
                            }}>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem', color: plan.featured ? '#000' : '#fff' }}>{plan.name}</h3>
                                <p style={{ fontSize: '0.875rem', margin: '0 0 1.5rem', color: plan.featured ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.6)' }}>{plan.subtitle}</p>
                                <div style={{ fontSize: '3rem', fontWeight: 900, margin: '0 0 2rem', color: plan.featured ? '#000' : '#fff' }}>
                                    {plan.price}<span style={{ fontSize: '1.125rem', fontWeight: 400, color: plan.featured ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.5)' }}>/mes</span>
                                </div>
                                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem', flex: 1 }}>
                                    {plan.items.map((item, j) => (
                                        <li key={j} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: plan.featured ? '#000' : 'rgba(255,255,255,0.7)' }}>{item}</li>
                                    ))}
                                </ul>
                                <button onClick={() => { window.location.href = registerUrl; }} style={{
                                    width: '100%', marginTop: '2rem', padding: '0.75rem', borderRadius: '16px',
                                    background: plan.dark ? '#000' : 'rgba(255,255,255,0.1)',
                                    color: '#fff',
                                    border: plan.dark ? 'none' : '1px solid rgba(255,255,255,0.08)',
                                    fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem',
                                }}>
                                    {plan.btnText}
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Comparison table */}
                    <div className="saas-comparison-wrap" style={{ marginTop: '6rem', overflowX: 'auto' }}>
                        <h3 className="saas-section-heading" style={{ fontSize: '2.5rem', fontWeight: 700, textAlign: 'center', marginBottom: '3rem', color: '#fff' }}>Comparación Detallada</h3>
                        <div style={{ ...glass, borderRadius: '32px', overflow: 'hidden' }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table className="saas-comparison-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                            {['Característica', 'Trial', 'Básico', 'Profesional', 'Premium'].map((h, i) => (
                                                <th key={i} style={{ padding: '1.5rem', textAlign: i === 0 ? 'left' : 'center', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {COMPARISON_ROWS.map((row, ri) => (
                                            <tr key={ri} style={{ borderBottom: ri < COMPARISON_ROWS.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                                                {row.map((cell, ci) => (
                                                    <td key={ci} style={{
                                                        padding: '1.5rem',
                                                        textAlign: ci === 0 ? 'left' : 'center',
                                                        color: cell === '?' ? '#4ade80' : cell === '—' ? '#f87171' : ci === 0 ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.7)',
                                                        whiteSpace: 'nowrap',
                                                    }}>{cell}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* -- CTA --------------------------------------------------------- */}
            <section style={{ padding: '0 1.5rem 6rem' }}>
                <div style={{ maxWidth: '1160px', margin: '0 auto', borderRadius: '40px', overflow: 'hidden', position: 'relative', background: 'linear-gradient(to right, rgba(6,182,212,0.2), rgba(139,92,246,0.2))', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} />
                    <div style={{ position: 'relative', zIndex: 10, padding: '6rem 2.5rem', textAlign: 'center' }}>
                        <h2 style={{ fontSize: '3rem', fontWeight: 700, maxWidth: '64rem', margin: '0 auto 2rem', lineHeight: 1.2, color: '#fff' }}>
                            Comienza a Gestionar Tu Negocio de Tecnología Más Inteligente Hoy
                        </h2>
                        <p style={{ fontSize: '1.25rem', color: 'rgba(255,255,255,0.7)', maxWidth: '48rem', margin: '0 auto 2.5rem', lineHeight: 1.6 }}>
                            Únete a miles de negocios modernos usando EonsClover para automatizar operaciones y crecer más rápido.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                            <a href={registerUrl} style={{ padding: '1rem 2rem', borderRadius: '16px', background: '#22d3ee', color: '#000', fontWeight: 700 }}>
                                Iniciar Prueba Gratuita
                            </a>
                            <DemoStoresButton />
                        </div>
                    </div>
                </div>
            </section>

            {/* -- FAQ --------------------------------------------------------- */}
            <section id="faq" style={{ padding: '6rem 1.5rem' }}>
                <div style={{ maxWidth: '1160px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                        <p style={{ color: '#22d3ee', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 1rem', fontSize: '0.875rem', fontWeight: 600 }}>Preguntas Frecuentes</p>
                        <h2 className="saas-section-heading" style={{ fontSize: '3rem', fontWeight: 700, margin: 0, color: '#fff' }}>Todo Lo Que Necesitas Saber</h2>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {FAQ_ITEMS.map((faq, i) => (
                            <div key={i} style={{ ...glass, borderRadius: '16px', padding: '2rem' }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 1rem', color: '#fff' }}>{faq.q}</h3>
                                <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, margin: 0 }}>{faq.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}

// -- Login page (redirect to tenant subdomain) ----------------------------------
function LoginPage() {
    const [slug, setSlug] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        const cleanSlug = slug.trim().toLowerCase();
        if (!cleanSlug) { setError('Ingresa el nombre de tu tienda'); return; }
        window.location.href = `${PLATFORM_PROTOCOL}//${cleanSlug}.${PLATFORM_DOMAIN}/login`;
    };

    return (
        <section style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem' }}>
            <div style={{ width: '100%', maxWidth: '440px' }}>
                <div style={{ ...glass, borderRadius: '24px', padding: '2.5rem' }}>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 700, textAlign: 'center', margin: '0 0 0.5rem', color: '#fff' }}>Iniciar sesión</h2>
                    <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', marginBottom: '2rem', fontSize: '0.9rem' }}>
                        Ingresa el nombre de tu tienda para acceder.
                    </p>
                    <form onSubmit={handleSubmit}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                            <input
                                type="text"
                                value={slug}
                                onChange={e => { setSlug(e.target.value); setError(''); }}
                                placeholder="mi-tienda"
                                style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '8px 0 0 8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '0.95rem', outline: 'none' }}
                                autoFocus
                            />
                            <span style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderLeft: 'none', borderRadius: '0 8px 8px 0', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
                                .{PLATFORM_DOMAIN}
                            </span>
                        </div>
                        {error && <p style={{ color: '#f87171', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>{error}</p>}
                        <button type="submit" style={{ width: '100%', padding: '0.85rem', borderRadius: '12px', background: '#22d3ee', color: '#000', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: '1rem' }}>
                            Ir a mi tienda ?
                        </button>
                    </form>
                    <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                            ¿No tienes tienda?{' '}
                            <a href={registerUrl} style={{ color: '#22d3ee', fontWeight: 500 }}>Crear una gratis</a>
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}

// -- Login page wrapper for SaaS dark theme --------------------------------------
function SaaSLoginPage() {
    return (
        <div>
            {/* Styled back link for dark theme */}
            <div style={{ maxWidth: '512px', margin: '1.5rem auto 0', padding: '0 1.5rem' }}>
                <a
                    href="/"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.45)', fontSize: '0.8125rem', textDecoration: 'none', transition: 'color 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.85)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.45)'}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                    Volver al inicio
                </a>
            </div>
            {/* embedded hides the store-themed header/logo inside LoginPage */}
            <LoginPage embedded={true} onBackToHome={() => window.location.href = '/'} />
        </div>
    );
}

// -- Layout with nav + footer ---------------------------------------------------
function LandingLayout({ children }) {
    return (
        <>
            <Navbar />
            <main style={{ paddingTop: '72px' }}>{children}</main>
            <Footer />
        </>
    );
}

/** Routes shown on the root domain (SaaS landing) */
export default function SaaSLandingRoutes() {
    // Show toast when redirected from invalid subdomain
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const toastType = params.get('toast');
        const slug = params.get('slug');
        if (toastType === 'store-not-found') {
            toast.error(slug
                ? `La tienda "${slug}.${PLATFORM_DOMAIN}" no existe`
                : 'Esa tienda no existe', { duration: 6000 });
            // Clean URL without reload
            const url = new URL(window.location);
            url.searchParams.delete('toast');
            url.searchParams.delete('slug');
            window.history.replaceState({}, '', url);
        }
    }, []);
    return (
        <div className="saas-root" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", background: '#050816', color: '#fff', minHeight: '100vh' }}>
            <GlobalStyles />
            <Routes>
                <Route path="/" element={<LandingLayout><SaaSHome /></LandingLayout>} />
                <Route path="/login" element={<LandingLayout><SaaSLoginPage /></LandingLayout>} />
                <Route path="/pricing" element={<Navigate to="/" replace />} />
                <Route path="/register" element={<Navigate to={registerUrl} replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </div>
    );
}
