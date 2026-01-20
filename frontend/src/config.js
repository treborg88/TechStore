// config.js - Configuración centralizada de la aplicación

//export const API_URL = 'http://localhost:5001/api';
//export const BASE_URL = 'http://localhost:5173';



// export const API_URL = 'http://192.168.100.41:5173/api';    // Servidor

     export const BASE_URL = 'http://192.168.100.41:5173';     // Red local

     export const API_URL = "https://6sfq7hfx-5001.use2.devtunnels.ms/api";  // Servidor local 5001

    // export const API_URL = 'http://149.47.118.165:5001/api';  // Servidor remoto


/*************************************************************************/
// Producción
// export const API_URL = 'http://143.47.118.165:5001/api';
// export const BASE_URL = 'http://143.47.118.165:5001'

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
