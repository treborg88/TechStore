// landingPageDefaults.js - Configuración por defecto y helpers para la landing page

/**
 * Configuración completa por defecto de la landing page.
 * Cada sección tiene: id, type, enabled, data (contenido) y styles (colores).
 * El orden del array sections define el orden de renderizado.
 */
export const DEFAULT_LANDING_PAGE_CONFIG = {
  // Control maestro (desactivada por defecto)
  enabled: false,
  route: '/landing',
  pageTitle: 'Ofertas Especiales',
  templateId: 'modern-minimal',

  // Estilos globales de la landing page
  globalStyles: {
    fontFamily: 'inherit',
    darkColor: 'var(--secondary-color)',
    lightColor: 'var(--background-color)',
    accentColor: 'var(--primary-color)',
    accentHoverColor: 'var(--primary-hover)',
    textColor: 'var(--text-color)',
    textLightColor: 'var(--text-color)',
    headingColor: 'var(--text-color)',
    maxWidth: 1200,
    sectionPadding: 80,
    sectionPaddingMobile: 48
  },

  // Secciones ordenadas — el índice del array = orden de renderizado
  sections: [
    {
      id: 'hero',
      type: 'hero',
      enabled: true,
      data: {
        layout: 'text-left',
        title: 'La Mejor Tecnología a Tu Alcance',
        subtitle: 'Descubre productos premium con la mejor calidad y precios incomparables.',
        ctaText: 'Comprar Ahora',
        ctaLink: '/',
        image: '',
        badgeText: '',
        badgeColor: 'var(--primary-color)'
      },
      styles: {
        bgColor: 'var(--secondary-color)',
        bgGradient: '',
        bgImage: '',
        bgOverlayOpacity: 0.5,
        textColor: 'var(--background-color)',
        ctaBgColor: 'var(--primary-color)',
        ctaTextColor: 'var(--background-color)',
        minHeight: 500
      }
    },
    {
      id: 'valueProposition',
      type: 'valueProposition',
      enabled: true,
      data: {
        label: 'Nuestras Ventajas',
        title: '¿Por qué elegirnos?',
        description: 'Ofrecemos la mejor experiencia de compra con beneficios exclusivos para ti.',
        points: [
          { icon: '🚚', iconImage: '', title: 'Envío Gratis', description: '' },
          { icon: '🛡️', iconImage: '', title: 'Garantía Total', description: '' },
          { icon: '💰', iconImage: '', title: 'Mejor Precio', description: '' },
          { icon: '🔒', iconImage: '', title: 'Pago Seguro', description: '' }
        ]
      },
      styles: {
        bgColor: 'var(--background-color)',
        textColor: 'var(--text-color)',
        iconBgColor: 'var(--background-color)',
        cardBgColor: 'var(--background-color)',
        cardBorderColor: 'var(--secondary-color)',
        cardShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }
    },
    {
      id: 'productHighlight',
      type: 'productHighlight',
      enabled: true,
      data: {
        layout: 'image-left',
        label: 'Propuesta Única',
        title: 'Producto Destacado',
        description: 'Descripción del producto y sus beneficios clave para el cliente. Enfócate en el valor que aporta.',
        ctaText: 'Ver Más',
        ctaLink: '/',
        image: ''
      },
      styles: {
        bgColor: 'var(--background-color)',
        textColor: 'var(--text-color)',
        ctaBgColor: 'var(--primary-color)',
        ctaTextColor: 'var(--background-color)'
      }
    },
    {
      id: 'trustBanner',
      type: 'trustBanner',
      enabled: true,
      data: {
        title: 'Valorado por nuestros clientes',
        subtitle: 'Miles de clientes satisfechos confían en nosotros cada día.'
      },
      styles: {
        bgColor: 'var(--primary-color)',
        textColor: 'var(--background-color)'
      }
    },
    {
      id: 'featuredProduct',
      type: 'featuredProduct',
      enabled: true,
      data: {
        label: 'El mejor producto',
        productName: 'Audífonos Inalámbricos Pro',
        productId: null,
        image: '',
        specs: [
          { key: 'Tipo', value: 'Inalámbrico' },
          { key: 'Batería', value: '40 horas' },
          { key: 'Cancelación de ruido', value: 'Sí' },
          { key: 'Peso', value: '250g' }
        ],
        description: 'Sonido premium con cancelación de ruido activa. La mejor experiencia auditiva.',
        originalPrice: 158.00,
        salePrice: 118.99,
        badgeText: 'OFERTA',
        ctaText: 'Comprar Ahora',
        ctaLink: '/'
      },
      styles: {
        bgColor: 'var(--background-color)',
        textColor: 'var(--text-color)',
        priceSaleColor: 'var(--primary-color)',
        priceOriginalColor: 'var(--text-color)',
        ctaBgColor: 'var(--primary-color)',
        ctaTextColor: 'var(--background-color)',
        specsDotColor: 'var(--secondary-color)'
      }
    },
    {
      id: 'howItWorks',
      type: 'howItWorks',
      enabled: true,
      data: {
        title: '¿Cómo Funciona?',
        steps: [
          { number: '1', title: 'Explora', description: 'Navega nuestra colección de productos tecnológicos.' },
          { number: '2', title: 'Selecciona', description: 'Elige tu producto favorito y agrégalo al carrito.' },
          { number: '3', title: 'Recibe', description: 'Completa tu compra y recíbelo en la puerta de tu casa.' }
        ]
      },
      styles: {
        bgColor: 'var(--background-color)',
        textColor: 'var(--text-color)',
        stepNumberBg: 'var(--primary-color)',
        stepNumberColor: 'var(--background-color)',
        stepCardBg: 'var(--background-color)',
        stepCardBorder: 'var(--secondary-color)'
      }
    },
    {
      id: 'productShowcase',
      type: 'productShowcase',
      enabled: true,
      data: {
        title: 'Productos Destacados',
        subtitle: 'Descubre nuestras mejores ofertas en tecnología.',
        products: [
          {
            productId: null, name: 'Laptop Gaming', description: 'Alto rendimiento para gaming profesional.',
            category: 'Laptops', image: '',
            features: ['Procesador ultra rápido', 'Gráficos inmersivos', 'Batería duradera'],
            originalPrice: 1189.00, salePrice: 899.00,
            badgeText: '30% OFF', badgeColor: 'var(--primary-color)', ctaText: 'Ver Producto', ctaLink: '/'
          },
          {
            productId: null, name: 'Audífonos Wireless', description: 'Sonido cristalino con cancelación de ruido.',
            category: 'Audio', image: '',
            features: ['Cancelación de ruido', 'Batería extendida', 'Audio superior'],
            originalPrice: 199.00, salePrice: 59.70,
            badgeText: '70% OFF', badgeColor: 'var(--accent-color)', ctaText: 'Ver Producto', ctaLink: '/'
          },
          {
            productId: null, name: 'Teclado Mecánico', description: 'Teclas responsivas para gaming y productividad.',
            category: 'Periféricos', image: '',
            features: ['RGB backlight', 'Switches resistentes', 'Diseño ergonómico'],
            originalPrice: 129.00, salePrice: 89.00,
            badgeText: '31% OFF', badgeColor: 'var(--primary-color)', ctaText: 'Ver Producto', ctaLink: '/'
          },
          {
            productId: null, name: 'Monitor 4K', description: 'Visuales ultra HD con colores vívidos.',
            category: 'Monitores', image: '',
            features: ['Alta tasa de refresco', 'Amplia gama de colores', 'Soporte ajustable'],
            originalPrice: 499.00, salePrice: 399.20,
            badgeText: '20% OFF', badgeColor: 'var(--secondary-color)', ctaText: 'Ver Producto', ctaLink: '/'
          }
        ]
      },
      styles: {
        bgColor: 'var(--background-color)',
        textColor: 'var(--text-color)',
        cardBgColor: 'var(--background-color)',
        cardBorderColor: 'var(--secondary-color)',
        cardShadow: '0 4px 12px rgba(0,0,0,0.1)',
        ctaBgColor: 'var(--primary-color)',
        ctaTextColor: 'var(--background-color)'
      }
    },
    {
      id: 'testimonials',
      type: 'testimonials',
      enabled: true,
      data: {
        title: 'Lo que dicen nuestros clientes',
        subtitle: 'Opiniones reales de compradores verificados.',
        items: [
          { quote: 'Excelente calidad y servicio rápido. Totalmente recomendado.', author: 'María García', avatar: '', rating: 5 },
          { quote: 'Los mejores precios del mercado y atención personalizada.', author: 'Carlos Rodríguez', avatar: '', rating: 5 },
          { quote: 'Compra segura y envío rápido. Volveré a comprar sin duda.', author: 'Ana Martínez', avatar: '', rating: 4 },
          { quote: 'El mejor sonido que he escuchado. Producto increíble.', author: 'Pedro López', avatar: '', rating: 5 }
        ]
      },
      styles: {
        bgColor: 'var(--background-color)',
        textColor: 'var(--text-color)',
        cardBgColor: 'var(--background-color)',
        cardBorderColor: 'var(--secondary-color)',
        cardShadow: '0 2px 8px rgba(0,0,0,0.06)',
        quoteColor: 'var(--text-color)',
        authorColor: 'var(--text-color)',
        starColor: 'var(--accent-color)'
      }
    },
    {
      id: 'leadCapture',
      type: 'leadCapture',
      enabled: false,
      data: {
        title: '¡Obtén tu descuento exclusivo!',
        description: 'Completa el formulario y recibe códigos de descuento directamente en tu email.',
        aboutText: 'Somos un equipo apasionado que ofrece tecnología de primera calidad a precios imbatibles.',
        fields: ['name', 'email'],
        submitText: 'Enviar',
        successMessage: '¡Gracias! Revisa tu correo para tu código de descuento.'
      },
      styles: {
        bgColor: 'var(--secondary-color)',
        textColor: 'var(--background-color)',
        inputBgColor: 'var(--background-color)',
        inputBorderColor: 'var(--secondary-color)',
        submitBgColor: 'var(--primary-color)',
        submitTextColor: 'var(--background-color)'
      }
    },
    {
      id: 'finalCta',
      type: 'finalCta',
      enabled: true,
      data: {
        title: '¿Qué esperas?',
        subtitle: 'Aprovecha nuestras ofertas antes de que se agoten.',
        ctaText: 'Ir a la Tienda',
        ctaLink: '/'
      },
      styles: {
        bgColor: 'var(--secondary-color)',
        textColor: 'var(--background-color)',
        ctaBgColor: 'var(--primary-color)',
        ctaTextColor: 'var(--background-color)'
      }
    }
  ]
};

/**
 * Clona y merge una configuración parcial de landing page con los defaults.
 * Mantiene las secciones del usuario si existen, aplica defaults para campos faltantes.
 * @param {Object|null} value - Configuración parcial a merge
 * @returns {Object} Configuración completa con defaults aplicados
 */
export const cloneLandingPageConfig = (value) => {
  const base = JSON.parse(JSON.stringify(DEFAULT_LANDING_PAGE_CONFIG));
  if (!value || typeof value !== 'object') return base;

  // Merge global styles
  const merged = {
    ...base,
    ...value,
    globalStyles: {
      ...base.globalStyles,
      ...(value.globalStyles || {})
    }
  };

  // Merge secciones: si el usuario tiene secciones, usarlas; si no, usar defaults
  if (Array.isArray(value.sections) && value.sections.length > 0) {
    merged.sections = value.sections.map(section => {
      // Buscar el default correspondiente para merge de campos faltantes
      const defaultSection = base.sections.find(s => s.type === section.type);
      if (!defaultSection) return section;
      return {
        ...defaultSection,
        ...section,
        data: { ...defaultSection.data, ...(section.data || {}) },
        styles: { ...defaultSection.styles, ...(section.styles || {}) }
      };
    });
  }

  return merged;
};
