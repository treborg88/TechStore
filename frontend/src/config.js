// config.js - Configuración centralizada de la aplicación
// URLs loaded from env vars (see .env.example)
// Production: Nginx proxies /api → backend:5001, so relative paths work on any domain
// Dev: explicit localhost URLs (no Nginx)

const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// Production defaults: relative /api (Nginx proxy) + auto-detect origin
// No hardcoded domains — works on any domain behind Nginx
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
    currency: 'RD$'
};
