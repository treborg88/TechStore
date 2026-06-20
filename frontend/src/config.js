// config.js - Configuración centralizada de la aplicación
// All SaaS detection is runtime-only: derives platform domain from the actual hostname.
// Works identically on production (eonsclover.com), staging (stage1.eonsclover.com), or local.

const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// --- SaaS context detection (runtime-only, no hardcoded domains) ---
const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
const hostParts = hostname.split('.');
const SYSTEM_SLUGS = ['app', 'admin', 'www', 'staging', 'database'];
const DETECTION_SLUGS = ['app', 'admin', 'staging', 'database']; // additional slugs that trigger detection

const isAdminPath = !isLocalhost && pathname.startsWith('/admin');
const isAppPath = !isLocalhost && pathname.startsWith('/app');

// --- Platform domain detection (MUST come before IS_TENANT/IS_LANDING) ---
// For "app.eonsclover.com" → "eonsclover.com"
// For "app.stage1.eonsclover.com" → "stage1.eonsclover.com"
// For "eonsclover.com" → "eonsclover.com"
// For "stage1.eonsclover.com" → "stage1.eonsclover.com" (staging platform)
// The key insight: if the first part is a known system slug, strip it.
// Otherwise, keep the full hostname as the platform domain.
export const PLATFORM_DOMAIN = hostname
    ? (hostParts.length >= 3 && DETECTION_SLUGS.includes(hostParts[0]))
        ? hostParts.slice(1).join('.')
        : hostname
    : '';

// Tenant subdomain: {slug}.domain.com (3+ parts, not a system slug, not localhost)
// Also exclude the platform domain itself from being treated as a tenant
export const IS_TENANT = hostname
    && hostParts.length >= 3
    && !SYSTEM_SLUGS.includes(hostParts[0])
    && !isLocalhost
    && hostname !== PLATFORM_DOMAIN;

export const TENANT_SLUG = IS_TENANT ? hostParts[0] : null;

// System contexts (SaaS platform pages)
// IS_LANDING: bare domain (≤2 parts), www prefix, or the platform domain itself
export const IS_LANDING = hostname
    && !isLocalhost
    && (hostParts.length <= 2 || hostParts[0] === 'www' || hostname === PLATFORM_DOMAIN)
    && !isAdminPath && !isAppPath;

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
