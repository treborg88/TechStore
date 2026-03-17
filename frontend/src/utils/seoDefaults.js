// seoDefaults.js - Defaults y constantes SEO compartidos entre admin y hook

export const SEO_DEFAULTS = {
  // --- Global ---
  metaDescription: '',
  metaKeywords: '',
  ogImage: '',
  ogType: 'website',
  locale: 'es_DO',
  robots: 'index, follow',
  googleVerification: '',
  bingVerification: '',
  customHeadTags: '',
  jsonLdEnabled: true,
  sitemapEnabled: true,
  // --- Per-page title templates ({siteName}, {productName}, {categoryName} son placeholders) ---
  pages: {
    home:    { titleTemplate: '{siteName} - Tienda Online', description: '' },
    store:   { titleTemplate: 'Tienda | {siteName}', description: '' },
    product: { titleTemplate: '{productName} | {siteName}', description: '' },
    cart:    { titleTemplate: 'Carrito | {siteName}', description: '' },
    checkout:{ titleTemplate: 'Checkout | {siteName}', description: '' },
    contact: { titleTemplate: 'Contacto | {siteName}', description: '' },
    orders:  { titleTemplate: 'Mis Pedidos | {siteName}', description: '' },
    login:   { titleTemplate: 'Iniciar Sesión | {siteName}', description: '' },
    profile: { titleTemplate: 'Mi Perfil | {siteName}', description: '' }
  }
};

// Páginas disponibles para configurar (label para el admin)
export const SEO_PAGE_LABELS = {
  home: 'Inicio / Landing',
  store: 'Tienda (catálogo)',
  product: 'Detalle de Producto',
  cart: 'Carrito',
  checkout: 'Checkout',
  contact: 'Contacto',
  orders: 'Mis Pedidos',
  login: 'Login / Registro',
  profile: 'Perfil de Usuario'
};
