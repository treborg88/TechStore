// config.js - Configuración centralizada de la aplicación
// URLs are loaded from environment variables (see .env.example)

export const API_URL = import.meta.env.VITE_API_URL
export const BASE_URL = import.meta.env.VITE_BASE_URL

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
    currency: 'USD'
};
