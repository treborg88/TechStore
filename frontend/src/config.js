// config.js - ConfiguraciÃ³n centralizada de la aplicaciÃ³n
// URLs loaded from env vars (see .env.example)
// Production: Nginx proxies /api â†’ backend:5001, so relative paths work on any domain
// Dev: explicit localhost URLs (no Nginx)

const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// --- SaaS context detection ---
const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
const hostParts = hostname.split('.');
const SYSTEM_SLUGS = ['app', 'admin', 'www', 'staging'];

// Tenant subdomain: {slug}.domain.com (3+ parts, not a system slug, not localhost)
export const IS_TENANT = hostParts.length >= 3 && !SYSTEM_SLUGS.includes(hostParts[0]) && !isLocalhost;
export const TENANT_SLUG = IS_TENANT ? hostParts[0] : null;

// System contexts (SaaS platform pages)
export const IS_LANDING = !isLocalhost && (hostParts.length <= 2 || hostParts[0] === 'www');
export const IS_ONBOARDING = hostParts[0] === 'app' && !isLocalhost;
export const IS_SUPER_ADMIN = hostParts[0] === 'admin' && !isLocalhost;

// Platform domain derived from hostname (e.g. "eonsclover.local" from "app.eonsclover.local")
// Used to build subdomain URLs dynamically â€” no hardcoded domain strings needed
export const PLATFORM_DOMAIN = hostParts.length >= 3
  ? hostParts.slice(1).join('.')
  : hostParts.join('.');

// Protocol derived from current page (http on local, https on production)
export const PLATFORM_PROTOCOL = typeof window !== 'undefined' ? window.location.protocol : 'https:';

// Production defaults: relative /api (Nginx proxy) + auto-detect origin
// No hardcoded domains â€” works on any domain behind Nginx
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
        { id: 'todos', name: 'Todos', icon: 'ðŸª', slug: 'todos', image: '' },
        { id: 'smartphones', name: 'Smartphones', icon: 'ðŸ“±', slug: 'Smartphones', image: '' },
        { id: 'luces-led', name: 'Luces LED', icon: 'ðŸ”…', slug: 'Luces LED', image: '' },
        { id: 'casa-inteligente', name: 'Casa Inteligente', icon: 'ðŸ ', slug: 'Casa Inteligente', image: '' },
        { id: 'auriculares', name: 'Auriculares', icon: 'ðŸŽ§', slug: 'Auriculares', image: '' },
        { id: 'accesorios', name: 'Accesorios', icon: 'ðŸ”Œ', slug: 'Accesorios', image: '' },
        { id: 'estilo-vida', name: 'Estilo de Vida', icon: 'âœ¨', slug: 'Estilo de Vida', image: '' }
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
