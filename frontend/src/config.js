// config.js - Configuración centralizada de la aplicación
// PLATFORM_DOMAIN is derived from hostname: "app.eonsclover.com" → "eonsclover.com"
// Backend .env's PLATFORM_DOMAIN is the single source of truth for tenant resolution.

const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// --- SaaS context detection ---
const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
const hostParts = hostname.split('.');
const SYSTEM_SLUGS = ['app', 'admin', 'www', 'staging', 'database'];

const isAdminPath = !isLocalhost && pathname.startsWith('/admin');
const isAppPath = !isLocalhost && pathname.startsWith('/app');

// Platform domain derived from hostname (e.g. "eonsclover.local" from "app.eonsclover.local")
// Used to build subdomain URLs dynamically — no hardcoded domain strings needed
export const PLATFORM_DOMAIN = hostParts.length >= 3
  ? hostParts.slice(1).join('.')
  : hostParts.join('.');

// Tenant subdomain: {slug}.domain.com (3+ parts, not a system slug, not localhost)
export const IS_TENANT = hostParts.length >= 3 && !SYSTEM_SLUGS.includes(hostParts[0]) && !isLocalhost;
export const TENANT_SLUG = IS_TENANT ? hostParts[0] : null;

// System contexts (SaaS platform pages)
export const IS_LANDING = !isLocalhost && (hostParts.length <= 2 || hostParts[0] === 'www') && !isAdminPath && !isAppPath;
export const IS_ONBOARDING = !isLocalhost && (hostParts[0] === 'app' || isAppPath);
// Tenant subdomains own their own /admin route — never treat them as super admin
export const IS_SUPER_ADMIN = !isLocalhost && !IS_TENANT && (hostParts[0] === 'admin' || isAdminPath);

// Protocol derived from current page (http on local, https on production)
export const PLATFORM_PROTOCOL = typeof window !== 'undefined' ? window.location.protocol : 'https:';

// API URL: relative /api in production (Nginx proxy), explicit localhost in dev
const DEFAULT_API_URL = isLocalhost 
    ? 'http://localhost:5001/api' 
    : '/api';

const DEFAULT_BASE_URL = isLocalhost 
    ? 'http://localhost:5173' 
    : (typeof window !== 'undefined' ? window.location.origin : '');

export const API_URL = import.meta.env.VITE_API_URL || DEFAULT_API_URL;
export const BASE_URL = import.meta.env.VITE_BASE_URL || DEFAULT_BASE_URL;

export const DEFAULT_CATEGORY_FILTERS_CONFIG = {
    useDefault: true,
    categories: [
        { id: 'todos', name: 'Todos', icon: '🏪', slug: 'todos', image: '' },
        { id: 'smartphones', name: 'Smartphones', icon: '📱', slug: 'Smartphones', image: '' },
        { id: 'luces-led', name: 'Luces LED', icon: '🔅', slug: 'Luces LED', image: '' },
        { id: 'casa-inteligente', name: 'Casa Inteligente', icon: '🏠', slug: 'Casa Inteligente', image: '' },
        { id: 'auriculares', name: 'Auriculares', icon: '🎧', slug: 'Auriculares', image: '' },
        { id: 'accesorios', name: 'Accesorios', icon: '🔌', slug: 'Accesorios', image: '' },
        { id: 'estilo-vida', name: 'Estilo de Vida', icon: '✨', slug: 'Estilo de Vida', image: '' }
    ],
    styles: {
        cardWidth: '',
        cardHeight: '',
        cardPadding: '',
        cardRadius: '',
        cardBackground: '',
        cardBorderColor: '',
        cardShadow: '',
        hoverBackground: '',
        hoverBorderColor: '',
        hoverShadow: '',
        hoverTitleColor: '',
        activeBackground: '',
        activeBorderColor: '',
        activeShadow: '',
        titleColor: '',
        activeTitleColor: '',
        titleSize: '',
        titleWeight: '',
        titleTransform: '',
        titleLetterSpacing: '',
        iconSize: ''
    }
};

export const DEFAULT_PRODUCT_CARD_CONFIG = {
    useDefault: true,
    layout: {
        orientation: 'vertical',
        columnsMobile: 2,
        columnsTablet: 3,
        columnsDesktop: 4,
        columnsWide: 5
    },
    styles: {
        cardWidth: '',
        cardHeight: '',
        cardPadding: '',
        cardRadius: '',
        borderWidth: '',
        borderStyle: '',
        borderColor: '',
        background: '',
        shadow: '',
        titleColor: '',
        titleSize: '',
        titleWeight: '',
        priceColor: '',
        priceSize: '',
        priceWeight: '',
        descriptionColor: '',
        descriptionSize: '',
        categoryColor: '',
        categorySize: '',
        buttonBg: '',
        buttonText: '',
        buttonRadius: '',
        buttonBorder: '',
        buttonShadow: ''
    },
    currency: 'DOP'
};
