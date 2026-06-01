import React, { useState, useEffect, useRef } from 'react';
import { apiFetch, apiUrl } from '../../services/apiClient';
import { resolveImageUrl } from '../../utils/resolveImageUrl';
import { formatCurrency } from '../../utils/formatCurrency';
import { COLOR_PALETTES, FONT_OPTIONS } from '../../utils/colorPalettes';
import { DEFAULT_CATEGORY_FILTERS_CONFIG } from '../../config';
import RichTextEditor from '../common/RichTextEditor';
import './SiteCustomizer.css';

// Layout presets inspired by major e-commerce platform patterns.
// Each preset sets the FULL productCardConfig (useDefault:false REQUIRED for
// column/style overrides to take effect in Home.jsx).
const LAYOUT_OPTIONS = [
  {
    id: 'bazar',
    name: 'Bazar',
    desc: 'Cuadrícula ultra-densa · máximos productos',
    badge: 'Supermercado · Ferretería · Mayoreo · Descuentos',
    productCardOverrides: {
      useDefault: false,
      layout: { orientation: 'vertical', columnsMobile: 3, columnsTablet: 4, columnsDesktop: 6, columnsWide: 7 },
      styles: {
        cardRadius: '4px',
        cardPadding: '6px',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: '#e5e7eb',
        shadow: 'none'
      }
    },
    heroHeight: 160,
    heroPositionX: 'left',
    previewCols: 3
  },
  {
    id: 'mercado',
    name: 'Mercado',
    desc: 'Cuadrícula estándar · equilibrado',
    badge: 'Electrónica · Ropa · Tienda general',
    productCardOverrides: {
      useDefault: false,
      layout: { orientation: 'vertical', columnsMobile: 2, columnsTablet: 3, columnsDesktop: 4, columnsWide: 5 },
      styles: {
        cardRadius: '8px',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: '#dde3ea',
        background: '#ffffff',
        shadow: '0 2px 8px rgba(0,0,0,0.07)'
      }
    },
    heroHeight: 340,
    heroPositionX: 'left',
    previewCols: 3
  },
  {
    id: 'boutique',
    name: 'Boutique',
    desc: 'Tarjetas grandes · presentación premium',
    badge: 'Joyería · Moda lujo · Arte · Regalos',
    productCardOverrides: {
      useDefault: false,
      layout: { orientation: 'vertical', columnsMobile: 1, columnsTablet: 2, columnsDesktop: 3, columnsWide: 3 },
      styles: {
        cardRadius: '16px',
        cardPadding: '16px',
        borderWidth: '0px',
        shadow: '0 4px 24px rgba(0,0,0,0.10)',
        background: '#ffffff'
      }
    },
    heroHeight: 500,
    heroPositionX: 'center',
    previewCols: 2
  },
  {
    id: 'moda',
    name: 'Moda',
    desc: 'Editorial · imagen al frente · sin bordes',
    badge: 'Ropa · Calzado · Belleza · Accesorios',
    productCardOverrides: {
      useDefault: false,
      layout: { orientation: 'vertical', columnsMobile: 2, columnsTablet: 3, columnsDesktop: 4, columnsWide: 4 },
      styles: {
        cardRadius: '2px',
        cardPadding: '8px',
        borderWidth: '0px',
        shadow: 'none'
      }
    },
    heroHeight: 460,
    heroPositionX: 'left',
    previewCols: 3
  },
  {
    id: 'catalogo',
    name: 'Catálogo',
    desc: 'Vista lista · ficha detallada',
    badge: 'Tecnología · Herramientas · Repuestos · Comparación',
    productCardOverrides: {
      useDefault: false,
      layout: { orientation: 'horizontal', columnsMobile: 1, columnsTablet: 2, columnsDesktop: 2, columnsWide: 2 },
      styles: {
        cardRadius: '8px',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: '#e5e7eb',
        shadow: '0 1px 4px rgba(0,0,0,0.06)'
      }
    },
    heroHeight: 240,
    heroPositionX: 'left',
    previewCols: 1
  }
];

// Filter style options for the category filter strip.
const FILTER_STYLES = [
  { id: 'cards',   label: 'Tarjetas',   desc: 'Icono + nombre en tile' },
  { id: 'pills',   label: 'Pastillas',  desc: 'Chip compacto' },
  { id: 'tabs',    label: 'Pestaña',    desc: 'Texto con subrayado activo' },
  { id: 'bubbles', label: 'Burbujas',   desc: 'Icono + texto' },
  { id: 'images',  label: 'Imágenes',   desc: 'Tarjeta con imagen de fondo' },
  { id: 'none',    label: 'Sin filtro', desc: 'Ocultar categorías' },
];

// Card size steps for 'images' filter style (px). Step 5 is the default.
const IMG_SIZE_STEPS = [40, 54, 68, 80, 90, 110, 134, 162, 196, 234];

const PRODUCT_CURRENCY_OPTIONS = [
  { code: 'DOP', label: 'DOP (RD$)' },
  { code: 'USD', label: 'USD (USD$)' },
  { code: 'EUR', label: 'EUR (€)' }
];

const DEFAULT_WHY_CHOOSE_US_ITEMS = [
  { icon: '🚚', title: 'Envío Gratis', text: 'En todos tus pedidos superiores a $50' },
  { icon: '⚡', title: 'Garantía Extendida', text: '12 meses adicionales en todos nuestros productos' },
  { icon: '🔒', title: 'Pago Seguro', text: 'Todas las transacciones son 100% seguras' }
];

const DEFAULT_NEWSLETTER_CONFIG = {
  enabled: false,
  title: 'Únete a Nuestra Newsletter',
  text: 'Recibe las últimas noticias sobre tecnología y ofertas exclusivas directamente en tu correo.',
  placeholder: 'Tu correo electrónico',
  buttonText: 'Suscribirse'
};

const DEFAULT_FOOTER_CONFIG = {
  brandMessage: 'Tu tienda de confianza para todos los dispositivos electrónicos y accesorios.',
  quickLinksTitle: 'Enlaces Rápidos',
  quickLinks: [
    { label: 'Inicio', href: '/', enabled: true },
    { label: 'Productos', href: '/tienda', enabled: true },
    { label: 'Ofertas', href: '/tienda?promo=1', enabled: true },
    { label: 'Sobre Nosotros', href: '/contacto', enabled: true }
  ],
  supportTitle: 'Atención al Cliente',
  supportLinks: [
    { label: 'Contáctanos', href: '/contacto', enabled: true },
    { label: 'Devoluciones', href: '/contacto', enabled: true },
    { label: 'Preguntas Frecuentes', href: '/contacto', enabled: true },
    { label: 'Estado del Pedido', href: '/orders', enabled: true }
  ],
  socialTitle: 'Síguenos',
  socialLinks: [
    { icon: '📘', href: '', enabled: true },
    { icon: '📱', href: '', enabled: true },
    { icon: '📷', href: '', enabled: true },
    { icon: '🐦', href: '', enabled: true }
  ],
  copyrightText: '© 2026 Eonsclover. Todos los derechos reservados.'
};

// Derive active layout from current productCardConfig. Match by columnsDesktop + orientation.
function getActiveLayout(settings) {
  const cardCfg = settings.productCardConfig || {};
  if (cardCfg.fineLayoutActive === true) return 'ajuste_fino';
  if (cardCfg.useDefault !== false) return 'mercado'; // default unmapped state
  const cols = cardCfg.layout?.columnsDesktop;
  const orient = cardCfg.layout?.orientation;
  if (cols >= 6) return 'bazar';
  if (cols === 3 && orient !== 'horizontal') return 'boutique';
  if (orient === 'horizontal') return 'catalogo';
  if (cols >= 4) return cardCfg.styles?.shadow === 'none' ? 'moda' : 'mercado';
  return 'mercado';
}

// Detect which palette is currently active (null = custom)
function getActivePalette(settings) {
  return COLOR_PALETTES.find(
    p => p.colors.primaryColor === settings.primaryColor &&
         p.colors.backgroundColor === settings.backgroundColor
  ) || null;
}

// Detect which font is currently active
function getActiveFont(settings) {
  return FONT_OPTIONS.find(f => f.stack === settings.fontFamily) || FONT_OPTIONS[0];
}

export default function SiteCustomizer({ settings, onChange, onBulkChange, onImageUpload }) {
  const [activePanel, setActivePanel] = useState('palette');
  const [previewMode, setPreviewMode] = useState('desktop');
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const hasUnsaved = useRef(false);
  const [unsaved, setUnsaved] = useState(false);
  const [ftOpen, setFtOpen] = useState(false);
  const [stylesOpen, setStylesOpen] = useState(false);
  const [catMoreOpen, setCatMoreOpen] = useState(false);
  const [emojiEditIdx, setEmojiEditIdx] = useState(null);
  const emojiPopRef = useRef(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [nameImgPreview, setNameImgPreview] = useState(null);

  // Fetch up to 6 real products for preview
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await apiFetch(apiUrl('/products?limit=100&page=1'));
        if (res.ok) {
          const data = await res.json();
          setProducts(Array.isArray(data.data) ? data.data : []);
        }
      } catch {
        // silently fail — preview works with placeholder cards
      } finally {
        setLoadingProducts(false);
      }
    };
    fetchProducts();
  }, []);

  // Mark unsaved on any change propagated from this component
  const markAndChange = (name, value) => {
    hasUnsaved.current = true;
    setUnsaved(true);
    onChange({ target: { name, value } });
  };

  const markAndBulk = (values) => {
    hasUnsaved.current = true;
    setUnsaved(true);
    onBulkChange(values);
  };

  const activePalette = getActivePalette(settings);
  const activeFont = getActiveFont(settings);
  const activeLayout = getActiveLayout(settings);
  const activeLayoutDef = activeLayout === 'ajuste_fino'
    ? {
        id: 'ajuste_fino',
        heroHeight: parseInt(settings.heroHeight) || 340,
        heroPositionX: settings.heroPositionX || 'left',
        previewCols: Math.min(settings.productCardConfig?.layout?.columnsDesktop || 4, 4)
      }
    : (LAYOUT_OPTIONS.find(l => l.id === activeLayout) || LAYOUT_OPTIONS[1]);

  const primary = settings.primaryColor || '#2563eb';
  const accent = settings.accentColor || '#f59e0b';
  const secondary = settings.secondaryColor || '#8b5cf6';
  const bg = settings.backgroundColor || '#f8fafc';
  const text = settings.textColor || '#1e293b';
  const headerBg = settings.headerBgColor || primary;
  const headerText = settings.headerTextColor || '#ffffff';
  const fontFamily = settings.fontFamily || 'system-ui, sans-serif';
  const siteName = settings.siteName || 'Mi Tienda';
  const currency = settings.productCardConfig?.currency || 'DOP';

  // Header with transparency (matches Header.jsx getHeaderBgColor logic)
  const headerBgFull = (() => {
    try {
      const hex = headerBg.replace('#', '');
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const alpha = (settings.headerTransparency ?? 100) / 100;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    } catch { return headerBg; }
  })();
  const headerBtnBg = settings.headerButtonColor || '#ffffff';
  const headerBtnText = settings.headerButtonTextColor || primary;

  // Hero computed (matches Home.jsx heroStyleVars logic)
  const heroImage = settings.heroImage ? resolveImageUrl(settings.heroImage) : null;
  const heroTextColor = settings.heroTextColor || '#ffffff';
  const heroTitle = settings.heroTitle || 'La Mejor Tecnología a Tu Alcance';
  const heroDesc = settings.heroDescription || 'Descubre nuestra selección de productos.';
  const heroPosX = settings.heroPositionX || activeLayoutDef.heroPositionX || 'left';
  const heroAlign = heroPosX === 'center' ? 'center' : heroPosX === 'right' ? 'flex-end' : 'flex-start';
  const heroTextAlign = heroPosX === 'center' ? 'center' : heroPosX === 'right' ? 'right' : 'left';
  const heroOverlay = settings.heroOverlayOpacity ?? settings.overlayOpacity ?? 0.45;

  // Card styles from active productCardConfig (matches Home.jsx productCardStyleVars logic)
  const cardCfg = settings.productCardConfig || {};
  const isCustomCards = cardCfg.useDefault === false;
  const cardStylesSrc = isCustomCards ? (cardCfg.styles || {}) : {};
  const isHorizontal = isCustomCards && cardCfg.layout?.orientation === 'horizontal';
  const previewCardStyle = {
    borderRadius: cardStylesSrc.cardRadius || '8px',
    border: cardStylesSrc.borderWidth === '0px'
      ? 'none'
      : `${cardStylesSrc.borderWidth || '1px'} ${cardStylesSrc.borderStyle || 'solid'} ${cardStylesSrc.borderColor || '#e5e7eb'}`,
    boxShadow: cardStylesSrc.shadow === 'none' ? 'none' : (cardStylesSrc.shadow || '0 1px 4px rgba(0,0,0,0.07)'),
    background: cardStylesSrc.background || '#ffffff',
    overflow: 'hidden'
  };

  // How many product cards to show in preview grid
  const previewCount = activeLayoutDef.previewCols * 2;
  const displayProducts = products.length > 0
    ? products.slice(0, previewCount)
    : Array.from({ length: previewCount }, (_, i) => ({
        id: i + 1, name: `Producto ${i + 1}`, price: 1200 * (i + 1), category: 'General'
      }));

  const selectedPromoProduct = (() => {
    const selectedId = String(settings.promoProductId || '').trim();
    if (!selectedId) return null;
    return products.find((p) => String(p.id) === selectedId) || null;
  })();

  const promoPreviewImage = selectedPromoProduct?.images?.[0]?.image_url
    || selectedPromoProduct?.image
    || '';

  const whyChooseUsConfig = settings.whyChooseUsConfig || {
    enabled: true,
    sectionTitle: '¿Por Qué Elegirnos?',
    items: DEFAULT_WHY_CHOOSE_US_ITEMS
  };
  const whyChooseUsItems = Array.isArray(whyChooseUsConfig.items) && whyChooseUsConfig.items.length > 0
    ? whyChooseUsConfig.items
    : DEFAULT_WHY_CHOOSE_US_ITEMS;

  const setWhyChooseUsConfig = (nextConfig) => {
    markAndBulk({
      whyChooseUsConfig: {
        enabled: true,
        sectionTitle: '¿Por Qué Elegirnos?',
        items: DEFAULT_WHY_CHOOSE_US_ITEMS,
        ...whyChooseUsConfig,
        ...nextConfig
      }
    });
  };

  const setWhyChooseUsItem = (index, field, value) => {
    const nextItems = whyChooseUsItems.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    ));
    setWhyChooseUsConfig({ items: nextItems });
  };

  const addWhyChooseUsItem = () => {
    setWhyChooseUsConfig({
      items: [...whyChooseUsItems, { icon: '⭐', title: 'Nuevo beneficio', text: 'Describe tu propuesta de valor.' }]
    });
  };

  const removeWhyChooseUsItem = (index) => {
    const nextItems = whyChooseUsItems.filter((_, itemIndex) => itemIndex !== index);
    setWhyChooseUsConfig({ items: nextItems.length > 0 ? nextItems : DEFAULT_WHY_CHOOSE_US_ITEMS });
  };

  const newsletterConfig = {
    ...DEFAULT_NEWSLETTER_CONFIG,
    ...(settings.newsletterConfig || {})
  };

  const setNewsletterConfig = (nextConfig) => {
    markAndBulk({
      newsletterConfig: {
        ...DEFAULT_NEWSLETTER_CONFIG,
        ...newsletterConfig,
        ...nextConfig
      }
    });
  };

  const footerConfig = {
    ...DEFAULT_FOOTER_CONFIG,
    ...(settings.footerConfig || {}),
    quickLinks: Array.isArray(settings.footerConfig?.quickLinks) && settings.footerConfig.quickLinks.length > 0
      ? settings.footerConfig.quickLinks
      : DEFAULT_FOOTER_CONFIG.quickLinks,
    supportLinks: Array.isArray(settings.footerConfig?.supportLinks) && settings.footerConfig.supportLinks.length > 0
      ? settings.footerConfig.supportLinks
      : DEFAULT_FOOTER_CONFIG.supportLinks,
    socialLinks: Array.isArray(settings.footerConfig?.socialLinks) && settings.footerConfig.socialLinks.length > 0
      ? settings.footerConfig.socialLinks
      : DEFAULT_FOOTER_CONFIG.socialLinks
  };

  const setFooterConfig = (nextConfig) => {
    markAndBulk({
      footerConfig: {
        ...footerConfig,
        ...nextConfig
      }
    });
  };

  const setFooterLinkItem = (group, index, field, value) => {
    const list = group === 'quickLinks' ? footerConfig.quickLinks : footerConfig.supportLinks;
    const nextList = list.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    ));
    setFooterConfig({ [group]: nextList });
  };

  const setFooterSocialItem = (index, field, value) => {
    const nextList = footerConfig.socialLinks.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    ));
    setFooterConfig({ socialLinks: nextList });
  };

  // Fine-tune values — extracted from settings for the ajuste_fino panel and preview
  const ft = {
    columns:       cardCfg.layout?.columnsDesktop ?? 4,
    cardPadding:   parseInt(cardStylesSrc.cardPadding)   || 8,
    cardImgHeight: parseInt(cardStylesSrc.cardImgHeight) || 80,
    cardGap:       parseInt(cardStylesSrc.cardGap)       || 8,
    heroHeight:    parseInt(settings.heroHeight)         || 340,
    gridPadding:   parseInt(cardStylesSrc.gridPadding)   || 14,
    heroTextX:     parseInt(settings.heroTextPaddingX)   || 20,
    heroTextY:     parseInt(settings.heroTextPaddingY)   || 20,
    heroBannerX:    parseInt(settings.heroBannerPositionX) || 80,
    heroBannerY:    parseInt(settings.heroBannerPositionY) || 50,
    heroBannerSize: parseInt(settings.heroBannerSize)      || 150,
    heroImageZoom:  parseInt(settings.heroImageBgZoom)     || 100,
  };

  // Update a single fine-tune parameter
  // Category filter config helpers
  const catCfg = settings.categoryFiltersConfig || {};
  const catStyles = catCfg.styles || {};
  const catList = catCfg.categories || [];

  const setCatStyle = (field, val) => markAndBulk({
    categoryFiltersConfig: { ...catCfg, useDefault: false, styles: { ...catStyles, [field]: val } }
  });

  const setCatItem = (idx, field, val) => {
    const updated = catList.map((c, i) => i === idx ? { ...c, [field]: val } : c);
    markAndBulk({ categoryFiltersConfig: { ...catCfg, useDefault: false, categories: updated } });
  };

  const addCatItem = () => {
    const id = `cat-${Date.now()}`;
    markAndBulk({ categoryFiltersConfig: { ...catCfg, useDefault: false, categories: [...catList, { id, name: 'Nueva', icon: '📌', slug: id, image: '' }] } });
  };

  const removeCatItem = (idx) => {
    markAndBulk({ categoryFiltersConfig: { ...catCfg, useDefault: false, categories: catList.filter((_, i) => i !== idx) } });
  };

  const filterStyle = catCfg.filterStyle || 'cards';
  const setCatFilterStyle = (val) => markAndBulk({
    categoryFiltersConfig: { ...catCfg, useDefault: false, filterStyle: val }
  });

  const filterImageSize = catCfg.filterImageSize ?? 5;
  const setFilterImageSize = (val) => markAndBulk({
    categoryFiltersConfig: { ...catCfg, useDefault: false, filterImageSize: Math.min(10, Math.max(1, val)) }
  });

  // Reset to fully defaults: style, size, and restore original default categories
  const resetFilterDefaults = () => markAndBulk({
    categoryFiltersConfig: {
      ...catCfg,
      filterStyle: 'cards',
      filterImageSize: 5,
      styles: {},
      useDefault: false,
      categories: DEFAULT_CATEGORY_FILTERS_CONFIG.categories
    }
  });

  // Upload an image for a specific category and store the URL in category.image
  const uploadCatImage = async (idx, file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await apiFetch(apiUrl('/settings/upload'), { method: 'POST', body: formData });
      if (res.ok) {
        const { url } = await res.json();
        setCatItem(idx, 'image', url);
      }
    } catch (err) {
      console.error('Cat image upload error', err);
    }
  };

  // Close emoji popover on outside click
  useEffect(() => {
    if (emojiEditIdx === null) return;
    const handler = (e) => {
      if (emojiPopRef.current && !emojiPopRef.current.contains(e.target)) {
        setEmojiEditIdx(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [emojiEditIdx]);

  const setFt = (key, val) => {
    const cardStyleKeys = ['cardPadding', 'cardImgHeight', 'cardGap', 'gridPadding'];
    if (key === 'columns') {
      markAndBulk({
        productCardConfig: {
          ...settings.productCardConfig,
          useDefault: false,
          fineLayoutActive: true,
          layout: { ...(cardCfg.layout || {}), columnsDesktop: val, columnsWide: val }
        }
      });
    } else if (cardStyleKeys.includes(key)) {
      markAndBulk({
        productCardConfig: {
          ...settings.productCardConfig,
          useDefault: false,
          fineLayoutActive: true,
          styles: { ...(cardStylesSrc), [key]: val + 'px' }
        }
      });
    } else {
      markAndBulk({
        [key]: val,
        productCardConfig: settings.productCardConfig?.fineLayoutActive
          ? settings.productCardConfig
          : { ...settings.productCardConfig, useDefault: false, fineLayoutActive: true }
      });
    }
  };

  // Reset all fine-tune params to baseline values (stays in ajuste_fino mode)
  const resetFtDefaults = () => {
    markAndBulk({
      productCardConfig: {
        ...settings.productCardConfig,
        useDefault: false,
        fineLayoutActive: true,
        layout: { columnsDesktop: 4, columnsMobile: 2, columnsTablet: 3, columnsWide: 5 },
        styles: {
          cardPadding: '8px', cardImgHeight: '80px', cardGap: '8px', gridPadding: '0px',
          cardRadius: '8px', borderWidth: '1px', borderStyle: 'solid',
          borderColor: '#e5e7eb', shadow: '0 1px 4px rgba(0,0,0,0.07)', background: '#ffffff'
        }
      }
    });
  };

  const PANELS = [
    { id: 'palette', icon: '🎨', label: 'Paleta' },
    { id: 'fonts', icon: '✏️', label: 'Fuentes' },
    { id: 'layout', icon: '⊞', label: 'Layout' },
    { id: 'identity', icon: '🏷️', label: 'Identidad' },
    { id: 'hero', icon: '🖼️', label: 'Hero' },
    { id: 'filtros', icon: '🧩', label: 'Filtros' },
    { id: 'busqueda', icon: '🔍', label: 'Búsqueda' },
    { id: 'promociones', icon: '🏷️', label: 'Promos' },
    { id: 'detalle-producto', icon: '📦', label: 'Pro.detalles' },
    { id: 'por-que-elegirnos', icon: '✨', label: '¿Por Qué Elegirnos?' },
    { id: 'newsletter', icon: '✉️', label: 'Newsletter' },
    { id: 'footer', icon: '🦶', label: 'Footer' }
  ];

  return (
    <div className="sc-app">
      {/* ── SECTION NAV — full-width horizontal bar ── */}
      <nav className="sc-section-nav" aria-label="Secciones de personalización">
        {PANELS.map(p => (
          <button
            key={p.id}
            type="button"
            title={p.label}
            className={`sc-nav-btn${activePanel === p.id ? ' active' : ''}`}
            onClick={() => setActivePanel(p.id)}
          >
            <span className="sc-nav-icon" aria-hidden="true">{p.icon}</span>
            <span>{p.label}</span>
          </button>
        ))}
      </nav>

      {/* ── BODY: sidebar panel + live preview ── */}
      <div className="sc-body">
      {/* ── SIDEBAR ── */}
      <div className="sc-sidebar">

        {/* ── PALETTE PANEL ── */}
        {activePanel === 'palette' && (
          <div className="sc-panel">
            <p className="sc-panel-label">Presets de paleta</p>
            <p className="sc-panel-hint">Selecciona un preset para aplicar todos los colores de una vez</p>
            <div className="sc-palette-list">
              {COLOR_PALETTES.map(pal => (
                <button
                  key={pal.id}
                  type="button"
                  className={`sc-palette-row${activePalette?.id === pal.id ? ' selected' : ''}`}
                  onClick={() => markAndBulk(pal.colors)}
                >
                  <div className="sc-palette-chips">
                    {[pal.colors.primaryColor, pal.colors.accentColor, pal.colors.backgroundColor, pal.colors.textColor].map((c, i) => (
                      <div key={i} className="sc-palette-chip" style={{ background: c }} />
                    ))}
                  </div>
                  <span className="sc-palette-name">{pal.name}</span>
                </button>
              ))}
            </div>

            {/* Fine-tune individual colors */}
            <div className="sc-divider" />
            <p className="sc-panel-label">Ajuste fino</p>
            <div className="sc-color-slots">
              {[
                { key: 'primaryColor',          keys: ['primaryColor', 'headerBgColor'],   label: 'Principal' },
                { key: 'secondaryColor',                                                     label: 'Secundario' },
                { key: 'accentColor',                                                        label: 'Acento' },
                { key: 'backgroundColor',                                                    label: 'Fondo' },
                { key: 'textColor',              keys: ['textColor', 'headerTextColor'],    label: 'Texto' },
                { key: 'headerButtonColor',                                                  label: 'Botón cabecera' },
                { key: 'headerButtonTextColor',                                              label: 'Texto botón' },
              ].map(({ key, keys, label }) => (
                <div key={key} className="sc-color-row">
                  <label className="sc-color-swatch-label">
                    <input
                      type="color"
                      value={settings[key] || '#000000'}
                      onChange={e => keys
                        ? markAndBulk(Object.fromEntries(keys.map(k => [k, e.target.value])))
                        : markAndChange(key, e.target.value)
                      }
                      className="sc-color-input"
                      aria-label={label}
                    />
                    <span className="sc-color-swatch" style={{ background: settings[key] || '#000000' }} />
                  </label>
                  <span className="sc-color-name">{label}</span>
                  <span className="sc-color-hex">{settings[key] || ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── IDENTITY PANEL ── */}
        {activePanel === 'identity' && (
          <div className="sc-panel">
            <p className="sc-panel-label">Nombre e Icono</p>
            <div className="sc-identity-row">
              <div className="sc-identity-field sc-identity-field--short">
                <label className="sc-field-label">Icono</label>
                <input type="text" className="sc-text-input"
                  value={settings.siteIcon || ''}
                  onChange={e => markAndChange('siteIcon', e.target.value)}
                  placeholder="🛍️" />
              </div>
              <div className="sc-identity-field">
                <label className="sc-field-label">Nombre del Sitio</label>
                <input type="text" className="sc-text-input"
                  value={settings.siteName || ''}
                  onChange={e => markAndChange('siteName', e.target.value)}
                  placeholder="Mi Tienda" />
              </div>
            </div>

            <div className="sc-divider" />
            <p className="sc-panel-label">Logo</p>
            <div className="sc-identity-upload-row">
              <div className="sc-field-label">Tamaño</div>
              <input type="number" className="sc-size-input" min="20" max="80" step="2"
                value={settings.siteLogoSize || 40}
                onChange={e => markAndChange('siteLogoSize', e.target.value)} />
              <span className="sc-size-unit">px</span>
            </div>
            {onImageUpload && (
              <input type="file" accept="image/*" className="sc-file-input"
                onChange={e => {
                  const f = e.target.files[0];
                  if (f) setLogoPreview(URL.createObjectURL(f));
                  onImageUpload(e, 'siteLogo');
                }} />
            )}
            {(settings.siteLogo || logoPreview) && (
              <div className="sc-identity-preview">
                <img src={settings.siteLogo || logoPreview} alt="Logo" style={{ height: '32px' }} />
                <button type="button" className="sc-identity-del"
                  onClick={() => { markAndChange('siteLogo', ''); setLogoPreview(null); }}>eliminar</button>
              </div>
            )}

            <div className="sc-divider" />
            <p className="sc-panel-label">Nombre (imagen)</p>
            <div className="sc-identity-upload-row">
              <div className="sc-field-label">Tamaño</div>
              <input type="number" className="sc-size-input" min="16" max="60" step="2"
                value={settings.siteNameImageSize || 32}
                onChange={e => markAndChange('siteNameImageSize', e.target.value)} />
              <span className="sc-size-unit">px</span>
            </div>
            {onImageUpload && (
              <input type="file" accept="image/*" className="sc-file-input"
                onChange={e => {
                  const f = e.target.files[0];
                  if (f) setNameImgPreview(URL.createObjectURL(f));
                  onImageUpload(e, 'siteNameImage');
                }} />
            )}
            {(settings.siteNameImage || nameImgPreview) && (
              <div className="sc-identity-preview">
                <img src={settings.siteNameImage || nameImgPreview} alt="Nombre" style={{ height: '24px' }} />
                <button type="button" className="sc-identity-del"
                  onClick={() => { markAndChange('siteNameImage', ''); setNameImgPreview(null); }}>eliminar</button>
              </div>
            )}
          </div>
        )}

        {/* ── FONTS PANEL ── */}
        {activePanel === 'fonts' && (
          <div className="sc-panel">
            <p className="sc-panel-label">Tipografía</p>
            <p className="sc-panel-hint">Define la personalidad visual de tu tienda</p>
            <div className="sc-font-list">
              {FONT_OPTIONS.map(font => (
                <button
                  key={font.id}
                  type="button"
                  className={`sc-font-opt${activeFont.id === font.id ? ' selected' : ''}`}
                  onClick={() => markAndChange('fontFamily', font.stack)}
                >
                  <span className="sc-font-sample" style={{ fontFamily: font.stack }}>
                    {font.sample}
                  </span>
                  <span className="sc-font-label">{font.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── LAYOUT PANEL ── */}
        {activePanel === 'layout' && (
          <div className="sc-panel">
            <p className="sc-panel-label">Diseño de página</p>
            <p className="sc-panel-hint">Define cómo se organizan los productos en la tienda</p>

            {/* ── Estilos section ── */}
            <button type="button" className="sc-layout-section-toggle" onClick={() => setStylesOpen(o => !o)}>
              <span>Estilos</span>
              <span className={`sc-ft-chevron${stylesOpen ? ' open' : ''}`}>▾</span>
            </button>
            {stylesOpen && (
              <div className="sc-layout-list">
                {LAYOUT_OPTIONS.map(lo => (
                  <button
                    key={lo.id}
                    type="button"
                    className={`sc-layout-opt-row${activeLayout === lo.id ? ' selected' : ''}`}
                    onClick={() => {
                      markAndBulk({
                        heroHeight: lo.heroHeight,
                        heroPositionX: lo.heroPositionX,
                        productCardConfig: {
                          ...settings.productCardConfig,
                          ...lo.productCardOverrides,
                          currency: settings.productCardConfig?.currency || 'DOP'
                        }
                      });
                    }}
                  >
                    <div className="sc-layout-thumb-row">
                      <LayoutThumb id={lo.id} />
                    </div>
                    <div className="sc-layout-meta">
                      <span className="sc-layout-name">{lo.name}</span>
                      <span className="sc-layout-desc">{lo.desc}</span>
                      <span className="sc-layout-badge">{lo.badge}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* ── Parámetros section (= Ajuste fino) ── */}
            <button
              type="button"
              className={`sc-layout-section-toggle${activeLayout === 'ajuste_fino' ? ' active' : ''}`}
              onClick={() => {
                const isActivating = activeLayout !== 'ajuste_fino';
                markAndBulk({
                  productCardConfig: { ...settings.productCardConfig, useDefault: false, fineLayoutActive: true }
                });
                if (isActivating) setFtOpen(true);
                else setFtOpen(o => !o);
              }}
            >
              <span>Parámetros</span>
              <span className={`sc-ft-chevron${activeLayout === 'ajuste_fino' && ftOpen ? ' open' : ''}`}>▾</span>
            </button>

            {activeLayout === 'ajuste_fino' && ftOpen && (
              <div className="sc-ft-panel">
                <div className="sc-ft-section">Cuadrícula</div>
                <Stepper label="Columnas" value={ft.columns} min={1} max={8} unit="col"
                  onChange={v => setFt('columns', v)} />

                <div className="sc-ft-section">Tarjeta</div>
                <Stepper label="Padding" value={ft.cardPadding} min={0} max={32} step={2} unit="px"
                  onChange={v => setFt('cardPadding', v)} />
                <Stepper label="Img. alto" value={ft.cardImgHeight} min={40} max={200} step={8} unit="px"
                  onChange={v => setFt('cardImgHeight', v)} />
                <Stepper label="Margen lateral" value={ft.gridPadding} min={0} max={80} step={4} unit="px"
                  onChange={v => setFt('gridPadding', v)} />
                <Stepper label="Sep. cards" value={ft.cardGap} min={0} max={24} step={2} unit="px"
                  onChange={v => setFt('cardGap', v)} />

                <button type="button" className="sc-ft-reset" onClick={resetFtDefaults}>
                  ↺ Restaurar por defecto
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── HERO PANEL ── */}
        {activePanel === 'hero' && (
          <div className="sc-panel sc-panel--home">

            {/* ── Contenido del Hero ── */}
            <div className="sc-home-section">
              <p className="sc-home-section-title">Contenido del Hero</p>
              <div className="sc-home-field-full">
                <label className="sc-home-label">Título</label>
                <input type="text" className="sc-home-input"
                  value={settings.heroTitle || ''}
                  onChange={e => markAndChange('heroTitle', e.target.value)}
                  placeholder="La Mejor Tecnología a Tu Alcance" />
              </div>
              <div className="sc-home-field-full">
                <label className="sc-home-label">Descripción</label>
                <textarea className="sc-home-input sc-home-textarea"
                  value={settings.heroDescription || ''}
                  onChange={e => markAndChange('heroDescription', e.target.value)}
                  placeholder="Descubre nuestra selección..."
                  rows={2}
                  onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }} />
              </div>
            </div>

            {/* ── Apariencia ── */}
            <div className="sc-home-section">
              <p className="sc-home-section-title">Apariencia</p>
              <div className="sc-home-appearance-grid">

                {/* Color texto */}
                <div className="sc-home-appear-item">
                  <span className="sc-home-label">Color texto</span>
                  <label className="sc-home-color-btn">
                    <input type="color"
                      value={settings.heroTextColor || '#ffffff'}
                      onChange={e => markAndChange('heroTextColor', e.target.value)}
                      className="sc-color-input" />
                    <span className="sc-home-color-swatch" style={{ background: settings.heroTextColor || '#ffffff' }} />
                    <span className="sc-home-color-hex">{settings.heroTextColor || '#fff'}</span>
                  </label>
                </div>

                {/* Oscurecer */}
                <div className="sc-home-appear-item">
                  <span className="sc-home-label">Oscurecer</span>
                  <div className="sc-home-range-wrap">
                    <input type="range" className="sc-home-range"
                      min="0" max="80" step="5"
                      value={Math.round((settings.heroOverlayOpacity ?? 0.5) * 100)}
                      onChange={e => markAndChange('heroOverlayOpacity', parseFloat(e.target.value) / 100)} />
                    <span className="sc-home-range-val">{Math.round((settings.heroOverlayOpacity ?? 0.5) * 100)}%</span>
                  </div>
                </div>

                {/* Posición texto */}
                <div className="sc-home-appear-item">
                  <span className="sc-home-label">Posición texto</span>
                  <div className="sc-home-pos-btns">
                    {[['left','◀ Izq.'],['center','● Centro'],['right','Der. ▶']].map(([v, lbl]) => (
                      <button key={v} type="button"
                        className={`sc-home-pos-btn${(settings.heroPositionX || 'left') === v ? ' active' : ''}`}
                        onClick={() => markAndChange('heroPositionX', v)}>{lbl}</button>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* ── Dimensiones ── */}
            <div className="sc-home-section">
              <p className="sc-home-section-title">Dimensiones</p>
              <div className="sc-hero-steppers">
                <Stepper label="Altura hero" value={ft.heroHeight} min={80} max={1200} step={30} unit="px"
                  onChange={v => markAndChange('heroHeight', v)} />
                <Stepper label="Texto Pos. X" value={ft.heroTextX} min={0} max={1600} step={10} unit="px"
                  onChange={v => markAndChange('heroTextPaddingX', v)} />
                <Stepper label="Texto Pos. Y" value={ft.heroTextY} min={0} max={600} step={10} unit="px"
                  onChange={v => markAndChange('heroTextPaddingY', v)} />
              </div>
            </div>

            {/* ── Imágenes ── */}
            <div className="sc-home-section">
              <p className="sc-home-section-title">Imágenes</p>

              <div className="sc-hero-img-block">
                <span className="sc-home-label">Fondo del Hero</span>
                {onImageUpload && (
                  <label className="sc-home-upload-btn">
                    📁 Subir imagen
                    <input type="file" accept="image/*" className="sc-hidden-file"
                      onChange={e => onImageUpload(e, 'heroImage')} />
                  </label>
                )}
                {settings.heroImage && (
                  <div className="sc-home-img-preview">
                    <img src={settings.heroImage} alt="Hero" />
                    <button type="button" className="sc-home-img-del"
                      onClick={() => markAndChange('heroImage', '')}>✕</button>
                  </div>
                )}
                <div className="sc-hero-steppers">
                  <Stepper label="Zoom" value={ft.heroImageZoom} min={50} max={300} step={10} unit="%"
                    onChange={v => markAndChange('heroImageBgZoom', v)} />
                </div>
              </div>

              <div className="sc-hero-img-block" style={{ marginTop: 8 }}>
                <span className="sc-home-label">Imagen superpuesta</span>
                {onImageUpload && (
                  <label className="sc-home-upload-btn">
                    📁 Subir imagen
                    <input type="file" accept="image/*" className="sc-hidden-file"
                      onChange={e => onImageUpload(e, 'heroBannerImage')} />
                  </label>
                )}
                {settings.heroBannerImage && (
                  <div className="sc-home-img-preview">
                    <img src={settings.heroBannerImage} alt="Banner" />
                    <button type="button" className="sc-home-img-del"
                      onClick={() => markAndChange('heroBannerImage', '')}>✕</button>
                  </div>
                )}
                <div className="sc-hero-steppers">
                  <Stepper label="Pos. X" value={ft.heroBannerX} min={0} max={100} step={5} unit="%"
                    onChange={v => markAndChange('heroBannerPositionX', v)} />
                  <Stepper label="Pos. Y" value={ft.heroBannerY} min={0} max={100} step={5} unit="%"
                    onChange={v => markAndChange('heroBannerPositionY', v)} />
                  <Stepper label="Tamaño" value={ft.heroBannerSize} min={30} max={600} step={10} unit="px"
                    onChange={v => markAndChange('heroBannerSize', v)} />
                </div>
              </div>
            </div>

            {/* ── Landing Page ── */}
            <div className="sc-home-section">
              <p className="sc-home-section-title">Landing Page</p>
              <label className="sc-home-toggle-row">
                <div className="sc-home-toggle-info">
                  <span className="sc-home-toggle-title">Activar como página principal</span>
                  <span className="sc-home-toggle-desc">La ruta <code>/</code> mostrará la landing; la tienda se mueve a <code>/tienda</code>.</span>
                </div>
                <div className={`sc-home-toggle${settings.landingPageConfig?.enabled ? ' on' : ''}`}
                  role="switch"
                  aria-checked={!!settings.landingPageConfig?.enabled}
                  onClick={() => markAndBulk({
                    landingPageConfig: { ...(settings.landingPageConfig || {}), enabled: !settings.landingPageConfig?.enabled }
                  })}>
                  <div className="sc-home-toggle-thumb" />
                </div>
              </label>
            </div>

          </div>
        )}

        {/* ── BÚSQUEDA panel ── */}
        {activePanel === 'busqueda' && (
          <div className="sc-panel sc-panel--home">
            <div className="sc-home-section">
              <p className="sc-home-section-title">Barra de Búsqueda</p>
              <label className="sc-home-toggle-row">
                <div className="sc-home-toggle-info">
                  <span className="sc-home-toggle-title">Mostrar barra de búsqueda</span>
                  <span className="sc-home-toggle-desc">Permite a los usuarios buscar productos por nombre o descripción en el Home.</span>
                </div>
                <div className={`sc-home-toggle${settings.searchBarConfig?.enabled !== false ? ' on' : ''}`}
                  role="switch"
                  aria-checked={settings.searchBarConfig?.enabled !== false}
                  onClick={() => markAndBulk({
                    searchBarConfig: { ...(settings.searchBarConfig || {}), enabled: !(settings.searchBarConfig?.enabled !== false) }
                  })}>
                  <div className="sc-home-toggle-thumb" />
                </div>
              </label>
            </div>
          </div>
        )}

        {/* ── PROMOCIONES panel ── */}
        {activePanel === 'promociones' && (
          <div className="sc-panel sc-panel--home">
            <div className="sc-home-section">
              <p className="sc-home-section-title">Promociones</p>

              <label className="sc-home-toggle-row">
                <div className="sc-home-toggle-info">
                  <span className="sc-home-toggle-title">Mostrar banner de promoción</span>
                  <span className="sc-home-toggle-desc">Activa o desactiva el bloque promocional que aparece en la página principal.</span>
                </div>
                <div className={`sc-home-toggle${settings.showPromotionBanner ? ' on' : ''}`}
                  role="switch"
                  aria-checked={!!settings.showPromotionBanner}
                  onClick={() => markAndChange('showPromotionBanner', !settings.showPromotionBanner)}>
                  <div className="sc-home-toggle-thumb" />
                </div>
              </label>

              <div className="sc-home-field-full">
                <label className="sc-home-label">Título de la promoción</label>
                <input type="text" className="sc-home-input"
                  value={settings.promoTitle || ''}
                  onChange={e => markAndChange('promoTitle', e.target.value)}
                  placeholder="¡Oferta Especial del Mes!" />
              </div>

              <div className="sc-home-field-full">
                <label className="sc-home-label">Texto de la promoción</label>
                <RichTextEditor
                  value={settings.promoText || ''}
                  onChange={(html) => markAndChange('promoText', html)}
                  placeholder="Escribe un mensaje de marketing con formato..."
                  minHeight={120}
                  helpText="Puedes usar negrita, listas y subtítulos para destacar beneficios y urgencia."
                />
              </div>

              <div className="sc-home-field-full">
                <label className="sc-home-label">Texto del botón</label>
                <input type="text" className="sc-home-input"
                  value={settings.promoButtonText || ''}
                  onChange={e => markAndChange('promoButtonText', e.target.value)}
                  placeholder="Ver Oferta" />
              </div>

              <div className="sc-home-field-full">
                <label className="sc-home-label">Producto promocionado</label>
                <select
                  className="sc-home-input"
                  value={settings.promoProductId || ''}
                  onChange={(e) => markAndChange('promoProductId', e.target.value)}
                >
                  <option value="">Selecciona un producto...</option>
                  {products.map((product) => (
                    <option key={product.id} value={String(product.id)}>
                      {product.name}
                    </option>
                  ))}
                </select>
                {selectedPromoProduct && (
                  <div className="sc-promo-picked">
                    <span className="sc-promo-picked-label">Seleccionado:</span>
                    <span className="sc-promo-picked-name">{selectedPromoProduct.name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── DETALLE DE PRODUCTO panel ── */}
        {activePanel === 'detalle-producto' && (
          <div className="sc-panel sc-panel--home">
            <div className="sc-home-section">
              <p className="sc-home-section-title">Detalle de Producto</p>

              <div className="sc-home-field-full">
                <label className="sc-home-label">Moneda de productos</label>
                <select
                  className="sc-home-input"
                  value={settings.productCardConfig?.currency || 'DOP'}
                  onChange={(e) => markAndBulk({
                    productCardConfig: {
                      ...(settings.productCardConfig || {}),
                      currency: e.target.value
                    }
                  })}
                >
                  {PRODUCT_CURRENCY_OPTIONS.map((currencyOption) => (
                    <option key={currencyOption.code} value={currencyOption.code}>{currencyOption.label}</option>
                  ))}
                </select>
              </div>

              <label className="sc-home-toggle-row">
                <div className="sc-home-toggle-info">
                  <span className="sc-home-toggle-title">Usar mismo Hero del Home</span>
                  <span className="sc-home-toggle-desc">El detalle del producto reutiliza el Hero principal cuando esta opción está activa.</span>
                </div>
                <div className={`sc-home-toggle${(settings.productDetailUseHomeHero ?? true) ? ' on' : ''}`}
                  role="switch"
                  aria-checked={settings.productDetailUseHomeHero ?? true}
                  onClick={() => markAndChange('productDetailUseHomeHero', !(settings.productDetailUseHomeHero ?? true))}>
                  <div className="sc-home-toggle-thumb" />
                </div>
              </label>

              {!(settings.productDetailUseHomeHero ?? true) && (
                <>
                  <div className="sc-home-field-full">
                    <span className="sc-home-label">Imagen del Hero</span>
                    {onImageUpload && (
                      <label className="sc-home-upload-btn">
                        📁 Subir imagen
                        <input type="file" accept="image/*" className="sc-hidden-file"
                          onChange={e => onImageUpload(e, 'productDetailHeroImage')} />
                      </label>
                    )}
                    {settings.productDetailHeroImage && (
                      <div className="sc-home-img-preview">
                        <img src={settings.productDetailHeroImage} alt="Hero detalle" />
                        <button type="button" className="sc-home-img-del"
                          onClick={() => markAndChange('productDetailHeroImage', '')}>✕</button>
                      </div>
                    )}
                  </div>

                  <div className="sc-hero-steppers">
                    <Stepper label="Altura" value={parseInt(settings.productDetailHeroHeight) || 200} min={100} max={400} step={20} unit="px"
                      onChange={v => markAndChange('productDetailHeroHeight', v)} />
                    <Stepper label="Oscurecer" value={Math.round((settings.productDetailHeroOverlayOpacity ?? 0.5) * 100)} min={0} max={80} step={5} unit="%"
                      onChange={v => markAndChange('productDetailHeroOverlayOpacity', v / 100)} />
                  </div>

                  <div className="sc-home-field-full">
                    <span className="sc-home-label">Imagen superpuesta</span>
                    {onImageUpload && (
                      <label className="sc-home-upload-btn">
                        📁 Subir imagen
                        <input type="file" accept="image/*" className="sc-hidden-file"
                          onChange={e => onImageUpload(e, 'productDetailHeroBannerImage')} />
                      </label>
                    )}
                    {settings.productDetailHeroBannerImage && (
                      <div className="sc-home-img-preview">
                        <img src={settings.productDetailHeroBannerImage} alt="Banner detalle" />
                        <button type="button" className="sc-home-img-del"
                          onClick={() => markAndChange('productDetailHeroBannerImage', '')}>✕</button>
                      </div>
                    )}
                  </div>

                  {settings.productDetailHeroBannerImage && (
                    <>
                      <div className="sc-hero-steppers">
                        <Stepper label="Tamaño" value={parseInt(settings.productDetailHeroBannerSize) || 120} min={50} max={300} step={10} unit="px"
                          onChange={v => markAndChange('productDetailHeroBannerSize', v)} />
                        <Stepper label="Opacidad" value={parseInt(settings.productDetailHeroBannerOpacity) || 100} min={10} max={100} step={5} unit="%"
                          onChange={v => markAndChange('productDetailHeroBannerOpacity', v)} />
                      </div>

                      <div className="sc-home-field-full">
                        <label className="sc-home-label">Posición horizontal</label>
                        <select className="sc-home-input"
                          value={settings.productDetailHeroBannerPositionX || 'right'}
                          onChange={e => markAndChange('productDetailHeroBannerPositionX', e.target.value)}>
                          <option value="left">Izquierda</option>
                          <option value="center">Centro</option>
                          <option value="right">Derecha</option>
                        </select>
                      </div>

                      <div className="sc-home-field-full">
                        <label className="sc-home-label">Posición vertical</label>
                        <select className="sc-home-input"
                          value={settings.productDetailHeroBannerPositionY || 'center'}
                          onChange={e => markAndChange('productDetailHeroBannerPositionY', e.target.value)}>
                          <option value="top">Arriba</option>
                          <option value="center">Centro</option>
                          <option value="bottom">Abajo</option>
                        </select>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── POR QUÉ ELEGIRNOS panel ── */}
        {activePanel === 'por-que-elegirnos' && (
          <div className="sc-panel sc-panel--home">
            <div className="sc-home-section">
              <p className="sc-home-section-title">¿Por Qué Elegirnos?</p>

              <label className="sc-home-toggle-row">
                <div className="sc-home-toggle-info">
                  <span className="sc-home-toggle-title">Mostrar sección</span>
                  <span className="sc-home-toggle-desc">Activa o desactiva esta sección informativa en el Home.</span>
                </div>
                <div className={`sc-home-toggle${whyChooseUsConfig.enabled !== false ? ' on' : ''}`}
                  role="switch"
                  aria-checked={whyChooseUsConfig.enabled !== false}
                  onClick={() => setWhyChooseUsConfig({ enabled: !(whyChooseUsConfig.enabled !== false) })}>
                  <div className="sc-home-toggle-thumb" />
                </div>
              </label>

              <div className="sc-home-field-full">
                <label className="sc-home-label">Título de la sección</label>
                <input type="text" className="sc-home-input"
                  value={whyChooseUsConfig.sectionTitle || '¿Por Qué Elegirnos?'}
                  onChange={(e) => setWhyChooseUsConfig({ sectionTitle: e.target.value })}
                  placeholder="¿Por Qué Elegirnos?" />
              </div>

              <div className="sc-home-field-full">
                <label className="sc-home-label">Puntos de valor</label>
                <div className="sc-why-list">
                  {whyChooseUsItems.map((item, index) => (
                    <div className="sc-why-item" key={`why-${index}`}>
                      <div className="sc-why-item-head">
                        <span className="sc-why-item-index">Punto {index + 1}</span>
                        <button type="button" className="sc-why-del"
                          onClick={() => removeWhyChooseUsItem(index)}>✕</button>
                      </div>
                      <div className="sc-why-fields">
                        <input
                          type="text"
                          className="sc-home-input sc-why-icon"
                          value={item.icon || ''}
                          onChange={(e) => setWhyChooseUsItem(index, 'icon', e.target.value)}
                          placeholder="⭐"
                        />
                        <input
                          type="text"
                          className="sc-home-input"
                          value={item.title || ''}
                          onChange={(e) => setWhyChooseUsItem(index, 'title', e.target.value)}
                          placeholder="Título"
                        />
                      </div>
                      <textarea
                        className="sc-home-input sc-home-textarea"
                        value={item.text || ''}
                        onChange={(e) => setWhyChooseUsItem(index, 'text', e.target.value)}
                        placeholder="Descripción del beneficio"
                        rows={2}
                      />
                    </div>
                  ))}
                </div>
                <button type="button" className="sc-ft-reset" style={{ marginTop: 8 }} onClick={addWhyChooseUsItem}>
                  + Agregar punto
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── NEWSLETTER panel ── */}
        {activePanel === 'newsletter' && (
          <div className="sc-panel sc-panel--home">
            <div className="sc-home-section">
              <p className="sc-home-section-title">Newsletter</p>

              <label className="sc-home-toggle-row">
                <div className="sc-home-toggle-info">
                  <span className="sc-home-toggle-title">Mostrar sección</span>
                  <span className="sc-home-toggle-desc">Activa o desactiva el bloque de suscripción en el Home.</span>
                </div>
                <div className={`sc-home-toggle${newsletterConfig.enabled !== false ? ' on' : ''}`}
                  role="switch"
                  aria-checked={newsletterConfig.enabled !== false}
                  onClick={() => setNewsletterConfig({ enabled: !(newsletterConfig.enabled !== false) })}>
                  <div className="sc-home-toggle-thumb" />
                </div>
              </label>

              <div className="sc-home-field-full">
                <label className="sc-home-label">Título</label>
                <input type="text" className="sc-home-input"
                  value={newsletterConfig.title || DEFAULT_NEWSLETTER_CONFIG.title}
                  onChange={(e) => setNewsletterConfig({ title: e.target.value })}
                  placeholder={DEFAULT_NEWSLETTER_CONFIG.title} />
              </div>

              <div className="sc-home-field-full">
                <label className="sc-home-label">Texto</label>
                <textarea className="sc-home-input sc-home-textarea"
                  value={newsletterConfig.text || ''}
                  onChange={(e) => setNewsletterConfig({ text: e.target.value })}
                  placeholder={DEFAULT_NEWSLETTER_CONFIG.text}
                  rows={3}
                />
              </div>

              <div className="sc-home-field-full">
                <label className="sc-home-label">Placeholder del campo</label>
                <input type="text" className="sc-home-input"
                  value={newsletterConfig.placeholder || ''}
                  onChange={(e) => setNewsletterConfig({ placeholder: e.target.value })}
                  placeholder={DEFAULT_NEWSLETTER_CONFIG.placeholder} />
              </div>

              <div className="sc-home-field-full">
                <label className="sc-home-label">Texto del botón</label>
                <input type="text" className="sc-home-input"
                  value={newsletterConfig.buttonText || ''}
                  onChange={(e) => setNewsletterConfig({ buttonText: e.target.value })}
                  placeholder={DEFAULT_NEWSLETTER_CONFIG.buttonText} />
              </div>
            </div>
          </div>
        )}

        {/* ── FOOTER panel ── */}
        {activePanel === 'footer' && (
          <div className="sc-panel sc-panel--home">
            <div className="sc-home-section">
              <p className="sc-home-section-title">Footer</p>

              <div className="sc-home-field-full">
                <label className="sc-home-label">Mensaje principal</label>
                <textarea
                  className="sc-home-input sc-home-textarea"
                  value={footerConfig.brandMessage || ''}
                  onChange={(e) => setFooterConfig({ brandMessage: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="sc-home-field-full">
                <label className="sc-home-label">Título Enlaces Rápidos</label>
                <input
                  type="text"
                  className="sc-home-input"
                  value={footerConfig.quickLinksTitle || ''}
                  onChange={(e) => setFooterConfig({ quickLinksTitle: e.target.value })}
                />
              </div>

              <div className="sc-footer-link-list">
                {footerConfig.quickLinks.map((link, index) => (
                  <div className="sc-footer-link-item" key={`quick-link-${index}`}>
                    <label className="sc-footer-link-toggle">
                      <input
                        type="checkbox"
                        checked={link.enabled !== false}
                        onChange={(e) => setFooterLinkItem('quickLinks', index, 'enabled', e.target.checked)}
                      />
                      <span>Mostrar</span>
                    </label>
                    <input
                      type="text"
                      className="sc-home-input"
                      value={link.label || ''}
                      onChange={(e) => setFooterLinkItem('quickLinks', index, 'label', e.target.value)}
                      placeholder="Texto"
                    />
                    <input
                      type="text"
                      className="sc-home-input"
                      value={link.href || ''}
                      onChange={(e) => setFooterLinkItem('quickLinks', index, 'href', e.target.value)}
                      placeholder="Ruta o URL"
                    />
                  </div>
                ))}
              </div>

              <div className="sc-home-field-full">
                <label className="sc-home-label">Título Atención al Cliente</label>
                <input
                  type="text"
                  className="sc-home-input"
                  value={footerConfig.supportTitle || ''}
                  onChange={(e) => setFooterConfig({ supportTitle: e.target.value })}
                />
              </div>

              <div className="sc-footer-link-list">
                {footerConfig.supportLinks.map((link, index) => (
                  <div className="sc-footer-link-item" key={`support-link-${index}`}>
                    <label className="sc-footer-link-toggle">
                      <input
                        type="checkbox"
                        checked={link.enabled !== false}
                        onChange={(e) => setFooterLinkItem('supportLinks', index, 'enabled', e.target.checked)}
                      />
                      <span>Mostrar</span>
                    </label>
                    <input
                      type="text"
                      className="sc-home-input"
                      value={link.label || ''}
                      onChange={(e) => setFooterLinkItem('supportLinks', index, 'label', e.target.value)}
                      placeholder="Texto"
                    />
                    <input
                      type="text"
                      className="sc-home-input"
                      value={link.href || ''}
                      onChange={(e) => setFooterLinkItem('supportLinks', index, 'href', e.target.value)}
                      placeholder="Ruta o URL"
                    />
                  </div>
                ))}
              </div>

              <div className="sc-home-field-full">
                <label className="sc-home-label">Título redes sociales</label>
                <input
                  type="text"
                  className="sc-home-input"
                  value={footerConfig.socialTitle || ''}
                  onChange={(e) => setFooterConfig({ socialTitle: e.target.value })}
                />
              </div>

              <div className="sc-footer-link-list">
                {footerConfig.socialLinks.map((social, index) => (
                  <div className="sc-footer-social-item" key={`social-link-${index}`}>
                    <label className="sc-footer-link-toggle">
                      <input
                        type="checkbox"
                        checked={social.enabled !== false}
                        onChange={(e) => setFooterSocialItem(index, 'enabled', e.target.checked)}
                      />
                      <span>Mostrar</span>
                    </label>
                    <input
                      type="text"
                      className="sc-home-input sc-why-icon"
                      value={social.icon || ''}
                      onChange={(e) => setFooterSocialItem(index, 'icon', e.target.value)}
                      placeholder="📘"
                    />
                    <input
                      type="text"
                      className="sc-home-input"
                      value={social.href || ''}
                      onChange={(e) => setFooterSocialItem(index, 'href', e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                ))}
              </div>

              <div className="sc-home-field-full">
                <label className="sc-home-label">Texto final</label>
                <input
                  type="text"
                  className="sc-home-input"
                  value={footerConfig.copyrightText || ''}
                  onChange={(e) => setFooterConfig({ copyrightText: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── FILTROS panel ── */}
        {activePanel === 'filtros' && (
          <div className="sc-panel sc-panel--home">

            {/* ── Categorías ── */}
            <div className="sc-home-section">
              <div className="sc-section-hdr">
                <p className="sc-home-section-title" style={{ margin: 0 }}>Categorías</p>
                <button type="button" className="sc-defaults-btn" title="Restaurar valores por defecto" onClick={resetFilterDefaults}>
                  ↺ Defecto
                </button>
              </div>
              <div className="sc-cat-list">
                {catList.map((cat, idx) => (
                  <div key={cat.id || idx} className="sc-cat-row">
                    {/* Image upload (images style) or emoji picker (all other styles) */}
                    {filterStyle === 'images' ? (
                      <div className="sc-cat-img-wrap">
                        {cat.image ? (
                          <>
                            <img src={cat.image} alt="" className="sc-cat-img-mini" />
                            {/* Hover overlay: replace (↑) or delete (✕) */}
                            <div className="sc-cat-img-actions">
                              <label className="sc-cat-img-act-btn" title="Cambiar imagen">
                                ↑
                                <input type="file" accept="image/*" className="sc-hidden-file-input"
                                  onChange={e => {
                                    const f = e.target.files[0];
                                    if (f) uploadCatImage(idx, f);
                                    e.target.value = '';
                                  }} />
                              </label>
                              <button type="button" className="sc-cat-img-act-btn sc-cat-img-del-btn"
                                title="Eliminar imagen"
                                onClick={() => setCatItem(idx, 'image', '')}>✕</button>
                            </div>
                          </>
                        ) : (
                          <label className="sc-cat-img-empty" title="Subir imagen">
                            🖼️
                            <input type="file" accept="image/*" className="sc-hidden-file-input"
                              onChange={e => {
                                const f = e.target.files[0];
                                if (f) uploadCatImage(idx, f);
                                e.target.value = '';
                              }} />
                          </label>
                        )}
                      </div>
                    ) : (
                      <div className="sc-cat-emoji-wrap" ref={emojiEditIdx === idx ? emojiPopRef : null}>
                        <button
                          type="button"
                          className="sc-cat-emoji-btn"
                          title="Editar emoji"
                          onClick={() => setEmojiEditIdx(emojiEditIdx === idx ? null : idx)}
                        >
                          {cat.icon || '+'}
                        </button>
                        {emojiEditIdx === idx && (
                          <div className="sc-emoji-picker">
                            <input
                              className="sc-emoji-text-inp"
                              type="text"
                              value={cat.icon || ''}
                              onChange={e => setCatItem(idx, 'icon', e.target.value)}
                              placeholder="Emoji..."
                              autoFocus
                              onKeyDown={e => e.key === 'Enter' && setEmojiEditIdx(null)}
                            />
                            <p className="sc-emoji-hint">
                              {navigator.platform?.includes('Mac') ? '⌘ Ctrl Space' : 'Win + .'}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    <input className="sc-cat-input sc-cat-name-inp" type="text"
                      value={cat.name || ''} onChange={e => setCatItem(idx, 'name', e.target.value)}
                      placeholder="Nombre" />
                    <button type="button" className="sc-cat-del"
                      onClick={() => removeCatItem(idx)}
                      disabled={cat.slug === 'todos'}>✕</button>
                  </div>
                ))}
              </div>
              <button type="button" className="sc-ft-reset" style={{ marginTop: 6 }}
                onClick={addCatItem}>+ Agregar categoría</button>
            </div>

            {/* ── Estilo de filtro ── */}
            <div className="sc-home-section">
              <p className="sc-home-section-title">Estilo de filtro</p>
              <div className="sc-filter-style-grid">
                {FILTER_STYLES.map(fs => (
                  <button
                    key={fs.id}
                    type="button"
                    className={`sc-filter-style-opt${filterStyle === fs.id ? ' selected' : ''}`}
                    onClick={() => setCatFilterStyle(fs.id)}
                  >
                    <div className="sc-filter-style-thumb">
                      <FilterStyleThumb id={fs.id} primary={primary} />
                    </div>
                    <div className="sc-filter-style-meta">
                      <span className="sc-filter-style-label">{fs.label}</span>
                      <span className="sc-filter-style-desc">{fs.desc}</span>
                    </div>
                  </button>
                ))}
              </div>
              {/* Size stepper — only for images style */}
              {filterStyle === 'images' && (
                <div className="sc-img-size-row">
                  <span className="sc-img-size-label">Tamaño de tarjeta</span>
                  <div className="sc-img-size-stepper">
                    <button type="button" className="sc-stepper-btn"
                      onClick={() => setFilterImageSize(filterImageSize - 1)}
                      disabled={filterImageSize <= 1}>−</button>
                    <span className="sc-stepper-val">{filterImageSize}</span>
                    <button type="button" className="sc-stepper-btn"
                      onClick={() => setFilterImageSize(filterImageSize + 1)}
                      disabled={filterImageSize >= 10}>+</button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Más Ajustes (collapsible) ── */}
            <div className="sc-home-section sc-cat-more-wrap">
              <button
                type="button"
                className="sc-cat-more-toggle"
                onClick={() => setCatMoreOpen(o => !o)}
              >
                <span>Más ajustes</span>
                <span className={`sc-cat-more-arrow${catMoreOpen ? ' open' : ''}`}>›</span>
              </button>

              {catMoreOpen && (
                <div className="sc-cat-more-body">

                  {/* Estado normal */}
                  <p className="sc-home-section-title" style={{ marginTop: 0 }}>Estado normal</p>
                  <div className="sc-home-appearance-grid">
                    <div className="sc-home-appear-item">
                      <span className="sc-home-label">Fondo</span>
                      <label className="sc-home-color-btn">
                        <input type="color" value={catStyles.cardBackground || '#f8fafc'} onChange={e => setCatStyle('cardBackground', e.target.value)} className="sc-color-input" />
                        <span className="sc-home-color-swatch" style={{ background: catStyles.cardBackground || '#f8fafc' }} />
                        <span className="sc-home-color-hex">{catStyles.cardBackground || '#f8fafc'}</span>
                      </label>
                    </div>
                    <div className="sc-home-appear-item">
                      <span className="sc-home-label">Borde</span>
                      <label className="sc-home-color-btn">
                        <input type="color" value={catStyles.cardBorderColor || '#e2e8f0'} onChange={e => setCatStyle('cardBorderColor', e.target.value)} className="sc-color-input" />
                        <span className="sc-home-color-swatch" style={{ background: catStyles.cardBorderColor || '#e2e8f0' }} />
                        <span className="sc-home-color-hex">{catStyles.cardBorderColor || '#e2e8f0'}</span>
                      </label>
                    </div>
                    <div className="sc-home-appear-item">
                      <span className="sc-home-label">Texto</span>
                      <label className="sc-home-color-btn">
                        <input type="color" value={catStyles.titleColor || '#1f2937'} onChange={e => setCatStyle('titleColor', e.target.value)} className="sc-color-input" />
                        <span className="sc-home-color-swatch" style={{ background: catStyles.titleColor || '#1f2937' }} />
                        <span className="sc-home-color-hex">{catStyles.titleColor || '#1f2937'}</span>
                      </label>
                    </div>
                  </div>
                  <div className="sc-hero-steppers" style={{ marginTop: 8 }}>
                    <Stepper label="Padding" value={parseInt(catStyles.cardPadding) || 8} min={2} max={40} step={2} unit="px"
                      onChange={v => setCatStyle('cardPadding', String(v))} />
                    <Stepper label="Radio" value={parseInt(catStyles.cardRadius) || 20} min={0} max={50} step={2} unit="px"
                      onChange={v => setCatStyle('cardRadius', String(v))} />
                    <Stepper label="Tam. texto" value={parseInt(catStyles.titleSize) || 13} min={8} max={24} step={1} unit="px"
                      onChange={v => setCatStyle('titleSize', String(v))} />
                    <Stepper label="Tam. icono" value={parseInt(catStyles.iconSize) || 20} min={10} max={48} step={2} unit="px"
                      onChange={v => setCatStyle('iconSize', String(v))} />
                  </div>

                  {/* Estado activo */}
                  <p className="sc-home-section-title" style={{ marginTop: 12 }}>Estado activo</p>
                  <div className="sc-home-field-full" style={{ marginBottom: 6 }}>
                    <label className="sc-home-label">Fondo (acepta gradiente)</label>
                    <input type="text" className="sc-home-input"
                      value={catStyles.activeBackground || ''}
                      onChange={e => setCatStyle('activeBackground', e.target.value)}
                      placeholder={primary} />
                  </div>
                  <div className="sc-home-appearance-grid">
                    <div className="sc-home-appear-item">
                      <span className="sc-home-label">Texto activo</span>
                      <label className="sc-home-color-btn">
                        <input type="color" value={catStyles.activeTitleColor || '#ffffff'} onChange={e => setCatStyle('activeTitleColor', e.target.value)} className="sc-color-input" />
                        <span className="sc-home-color-swatch" style={{ background: catStyles.activeTitleColor || '#ffffff' }} />
                        <span className="sc-home-color-hex">{catStyles.activeTitleColor || '#fff'}</span>
                      </label>
                    </div>
                    <div className="sc-home-appear-item">
                      <span className="sc-home-label">Borde activo</span>
                      <label className="sc-home-color-btn">
                        <input type="color" value={catStyles.activeBorderColor || primary} onChange={e => setCatStyle('activeBorderColor', e.target.value)} className="sc-color-input" />
                        <span className="sc-home-color-swatch" style={{ background: catStyles.activeBorderColor || primary }} />
                        <span className="sc-home-color-hex">{catStyles.activeBorderColor || primary}</span>
                      </label>
                    </div>
                  </div>

                  {/* Estado hover */}
                  <p className="sc-home-section-title" style={{ marginTop: 12 }}>Estado hover</p>
                  <div className="sc-home-appearance-grid">
                    <div className="sc-home-appear-item">
                      <span className="sc-home-label">Fondo</span>
                      <label className="sc-home-color-btn">
                        <input type="color" value={catStyles.hoverBackground || '#eff6ff'} onChange={e => setCatStyle('hoverBackground', e.target.value)} className="sc-color-input" />
                        <span className="sc-home-color-swatch" style={{ background: catStyles.hoverBackground || '#eff6ff' }} />
                        <span className="sc-home-color-hex">{catStyles.hoverBackground || '#eff6ff'}</span>
                      </label>
                    </div>
                    <div className="sc-home-appear-item">
                      <span className="sc-home-label">Texto</span>
                      <label className="sc-home-color-btn">
                        <input type="color" value={catStyles.hoverTitleColor || '#2563eb'} onChange={e => setCatStyle('hoverTitleColor', e.target.value)} className="sc-color-input" />
                        <span className="sc-home-color-swatch" style={{ background: catStyles.hoverTitleColor || '#2563eb' }} />
                        <span className="sc-home-color-hex">{catStyles.hoverTitleColor || '#2563eb'}</span>
                      </label>
                    </div>
                  </div>

                </div>
              )}
            </div>

          </div>
        )}

        {/* Unsaved badge */}
        {unsaved && (
          <div className="sc-unsaved-badge">Cambios sin guardar</div>
        )}
      </div>

      {/* ── LIVE PREVIEW ── */}
      <div className="sc-preview-area">

        <div className="sc-preview-topbar">
          <span className="sc-preview-title">Vista previa en vivo</span>
          <div className="sc-preview-tabs">
            <button
              type="button"
              className={`sc-preview-tab${previewMode === 'desktop' ? ' active' : ''}`}
              onClick={() => setPreviewMode('desktop')}
              title="Escritorio"
            >🖥</button>
            <button
              type="button"
              className={`sc-preview-tab${previewMode === 'mobile' ? ' active' : ''}`}
              onClick={() => setPreviewMode('mobile')}
              title="Móvil"
            >📱</button>
          </div>
        </div>

        <div className="sc-preview-scroll">
          <div
            className="sc-preview-wrap"
            style={{ maxWidth: previewMode === 'mobile' ? '320px' : '100%' }}
          >
            <div className="sc-site-preview" style={{ background: bg, fontFamily }}>

              {/* ── Header ── */}
              <div className="sc-prev-nav" style={{ background: headerBgFull }}>
                <span className="sc-prev-logo" style={{ color: headerText, fontFamily }}>
                  {(settings.siteLogo || logoPreview)
                    ? <img src={settings.siteLogo || logoPreview} alt="logo"
                        style={{ height: Math.min(parseInt(settings.siteLogoSize) || 40, 32), verticalAlign: 'middle' }} />
                    : (settings.siteIcon || '🛍️')}
                  {(settings.siteNameImage || nameImgPreview)
                    ? <img src={settings.siteNameImage || nameImgPreview} alt="nombre"
                        style={{ height: Math.min(parseInt(settings.siteNameImageSize) || 32, 24), verticalAlign: 'middle', marginLeft: 4 }} />
                    : <span style={{ marginLeft: 4 }}>{siteName}</span>}
                </span>
                <div className="sc-prev-nav-links">
                  <span style={{ color: headerText + 'cc' }}>Tienda</span>
                  <span style={{ color: headerText + 'cc' }}>Contacto</span>
                </div>
                <div
                  className="sc-prev-nav-btn"
                  style={{ background: headerBtnBg, color: headerBtnText }}
                >
                  🛒 0
                </div>
              </div>

              {/* ── Hero section ── */}
              <div
                className="sc-prev-hero"
                style={{
                  ...(heroImage
                    ? {
                        backgroundImage: `url(${heroImage})`,
                        backgroundSize: ft.heroImageZoom !== 100 ? `${ft.heroImageZoom}%` : 'cover',
                        backgroundPosition: '50% 50%',
                        backgroundRepeat: 'no-repeat'
                      }
                    : { background: `linear-gradient(135deg, ${primary}ee 0%, ${secondary}77 100%)` }
                  ),
                  minHeight: Math.round((parseInt(settings.heroHeight) || activeLayoutDef.heroHeight) * 0.22) + 'px',
                  alignItems: heroAlign,
                  textAlign: heroTextAlign,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Dark overlay */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: `rgba(0,0,0,${heroOverlay})`,
                  pointerEvents: 'none', zIndex: 0
                }} />
                {settings.heroBannerImage && (
                  <img
                    src={resolveImageUrl(settings.heroBannerImage)}
                    alt=""
                    style={{
                      position: 'absolute',
                      left: `${ft.heroBannerX}%`,
                      top: `${ft.heroBannerY}%`,
                      width: `${Math.round(ft.heroBannerSize * 0.22)}px`,
                      height: 'auto',
                      pointerEvents: 'none',
                      opacity: (parseInt(settings.heroBannerOpacity) || 100) / 100,
                      zIndex: 1
                    }}
                  />
                )}
                <div style={{ transform: `translate(${Math.round(ft.heroTextX * 0.22)}px, ${Math.round(ft.heroTextY * 0.22)}px)`, position: 'relative', zIndex: 2 }}>
                <h2 className="sc-prev-headline" style={{ color: heroTextColor, fontFamily }}>
                  {heroTitle}
                </h2>
                <p className="sc-prev-subline" style={{ color: heroTextColor + 'cc' }}>
                  {heroDesc}
                </p>
                <div className="sc-prev-cta" style={{ background: primary, color: '#fff', fontFamily }}>
                  Ver productos
                </div>
                </div>
              </div>

              {/* ── Category filter strip ── */}
              {filterStyle !== 'none' && (
                <div
                  className={`sc-prev-cats sc-prev-cats--${filterStyle}`}
                  style={{
                    background: bg,
                    borderBottom: `1px solid ${primary}22`,
                    ...(filterStyle === 'images' && {
                      '--filter-img-size': Math.round(IMG_SIZE_STEPS[filterImageSize - 1] * 0.44) + 'px'
                    })
                  }}>
                  {(catList.length > 0 ? catList.slice(0, 5) : ['Todos','Electrónica','Ropa','Hogar','Deportes'].map(n => ({ name: n, icon: '' }))).map((cat, i) => {
                    const isActive = i === 0;
                    const activeBg = catStyles.activeBackground || primary;
                    const normalBg = catStyles.cardBackground || 'transparent';
                    const activeBorder = catStyles.activeBorderColor || primary;
                    const normalBorder = catStyles.cardBorderColor || primary + '44';
                    const radius = catStyles.cardRadius ? catStyles.cardRadius + 'px' : undefined;
                    let chipStyle;
                    if (filterStyle === 'tabs') {
                      chipStyle = {
                        background: 'transparent', border: 'none',
                        borderBottom: `2px solid ${isActive ? activeBorder : 'transparent'}`,
                        borderRadius: 0, padding: '4px 8px',
                        color: isActive ? activeBorder : (catStyles.titleColor || text),
                      };
                    } else if (filterStyle === 'images') {
                      chipStyle = {
                        background: `linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,0,0,0.55)), ${isActive ? activeBg : (normalBg !== 'transparent' ? normalBg : '#94a3b8')}`,
                        border: `1.5px solid ${isActive ? activeBorder : normalBorder}`,
                        ...(radius && { borderRadius: radius }),
                        color: '#fff',
                      };
                    } else {
                      chipStyle = {
                        background: isActive ? activeBg : normalBg,
                        color: isActive ? (catStyles.activeTitleColor || '#fff') : (catStyles.titleColor || text),
                        border: `1px solid ${isActive ? activeBorder : normalBorder}`,
                        ...(radius && { borderRadius: radius }),
                        ...(catStyles.titleSize && { fontSize: catStyles.titleSize + 'px' }),
                      };
                    }
                    return (
                      <div key={i} className={`sc-prev-cat-chip sc-prev-cat-chip--${filterStyle}`} style={chipStyle}>
                        {filterStyle !== 'tabs' && cat.icon && <span style={{ lineHeight: 1 }}>{cat.icon}</span>}
                        <span>{cat.name || cat}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Search bar ── */}
              {settings.searchBarConfig?.enabled !== false && (
                <div className="sc-prev-search" style={{ background: bg }}>
                  <div className="sc-prev-search-bar" style={{ borderColor: primary + '55' }}>
                    <span style={{ color: primary + '88' }}>🔍</span>
                    <span className="sc-prev-search-placeholder" style={{ color: text + '66' }}>
                      Buscar productos...
                    </span>
                  </div>
                </div>
              )}

              {/* ── Products section ── */}
              <div className="sc-prev-products" style={{ background: bg, padding: `10px ${ft.gridPadding}px 16px` }}>
                <h3 className="sc-prev-section-title" style={{ color: text, fontFamily }}>
                  Productos Destacados
                </h3>

                {loadingProducts ? (
                  <div className="sc-prev-loading">Cargando…</div>
                ) : (
                  <div
                    className="sc-prev-grid"
                    style={{ gridTemplateColumns: `repeat(${activeLayoutDef.previewCols}, 1fr)`, gap: ft.cardGap + 'px' }}
                  >
                    {displayProducts.map(p => (
                      <div
                        key={p.id}
                        className={`sc-prev-card${isHorizontal ? ' horizontal' : ''}`}
                        style={previewCardStyle}
                      >
                        {/* Image */}
                        <div className="sc-prev-card-img" style={{ background: primary + '18', height: ft.cardImgHeight + 'px' }}>
                          {p.images?.[0]?.image_url || p.image ? (
                            <img
                              src={resolveImageUrl(p.images?.[0]?.image_url || p.image)}
                              alt={p.name}
                              onError={e => { e.target.style.display = 'none'; }}
                            />
                          ) : (
                            <span className="sc-prev-card-placeholder">📦</span>
                          )}
                        </div>

                        {/* Body */}
                        <div className="sc-prev-card-body">
                          {p.category && (
                            <span className="sc-prev-card-cat" style={{ color: accent }}>
                              {p.category}
                            </span>
                          )}
                          <span className="sc-prev-card-name" style={{ color: text, fontFamily }}>
                            {p.name}
                          </span>
                          <div className="sc-prev-card-footer">
                            <span className="sc-prev-card-price" style={{ color: primary }}>
                              {formatCurrency(p.price, currency)}
                            </span>
                            <div
                              className="sc-prev-card-btn"
                              style={{ background: primary, color: '#fff' }}
                            >
                              +
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Promo section ── */}
              {settings.showPromotionBanner && (
                <div className="sc-prev-promo" style={{ background: `linear-gradient(135deg, ${primary}18 0%, ${accent}14 100%)` }}>
                  <div className="sc-prev-promo-content">
                    <h3 className="sc-prev-promo-title" style={{ color: text, fontFamily }}>
                      {settings.promoTitle || '¡Oferta Especial del Mes!'}
                    </h3>
                    <div
                      className="sc-prev-promo-text"
                      style={{ color: text + 'cc' }}
                      dangerouslySetInnerHTML={{
                        __html: settings.promoText || 'Destaca tu oferta con un mensaje claro, beneficios y llamada a la acción.'
                      }}
                    />
                    <div className="sc-prev-promo-btn" style={{ background: primary, color: '#fff' }}>
                      {settings.promoButtonText || 'Ver Oferta'}
                    </div>
                  </div>
                  {promoPreviewImage && (
                    <div className="sc-prev-promo-image">
                      <img src={resolveImageUrl(promoPreviewImage)} alt="Producto promocionado" />
                    </div>
                  )}
                </div>
              )}

              {/* ── Footer strip ── */}
              {newsletterConfig.enabled !== false && (
                <div
                  className="sc-prev-newsletter"
                  style={{
                    background: '#f8fafc',
                    borderTop: `1px solid ${primary}22`,
                    borderBottom: `1px solid ${primary}22`,
                    padding: '10px'
                  }}
                >
                  <div style={{ textAlign: 'center', marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, color: text, marginBottom: 4, fontSize: 12 }}>
                      {newsletterConfig.title || DEFAULT_NEWSLETTER_CONFIG.title}
                    </div>
                    <div style={{ color: text + 'bb', fontSize: 10.5 }}>
                      {newsletterConfig.text || DEFAULT_NEWSLETTER_CONFIG.text}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <div
                      style={{
                        flex: 1,
                        border: '1px solid #cbd5e1',
                        borderRadius: 8,
                        padding: '6px 8px',
                        color: '#94a3b8',
                        fontSize: 10
                      }}
                    >
                      {newsletterConfig.placeholder || DEFAULT_NEWSLETTER_CONFIG.placeholder}
                    </div>
                    <div
                      style={{
                        background: primary,
                        color: '#fff',
                        borderRadius: 8,
                        padding: '6px 10px',
                        fontSize: 10,
                        fontWeight: 700
                      }}
                    >
                      {newsletterConfig.buttonText || DEFAULT_NEWSLETTER_CONFIG.buttonText}
                    </div>
                  </div>
                </div>
              )}

              <div className="sc-prev-footer" style={{ background: primary }}>
                <span style={{ color: '#ffffff99' }}>{footerConfig.brandMessage || siteName}</span>
                <span style={{ color: '#ffffff66' }}>{footerConfig.copyrightText || 'Todos los derechos reservados'}</span>
              </div>

            </div>
          </div>
        </div>
      </div>
      </div>{/* ── /sc-body ── */}
    </div>
  );
}

// Increment/decrement control — renders as two grid cells (label col1, ctrl col2)
function Stepper({ label, value, min, max, step = 1, unit = '', onChange }) {
  return (
    <>
      <span className="sc-stepper-label">{label}</span>
      <div className="sc-stepper-ctrl">
        <button type="button" className="sc-stepper-btn" onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min}>−</button>
        <span className="sc-stepper-val">{value}<small className="sc-stepper-unit">{unit}</small></span>
        <button type="button" className="sc-stepper-btn" onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max}>+</button>
      </div>
    </>
  );
}

// Mini layout thumbnail illustrations
function LayoutThumb({ id }) {
  // bazar: ultra-dense tiny grid, short hero strip
  if (id === 'bazar') return (
    <div className="lt-wrap">
      <div className="lt-bar lt-bar-sm" style={{ width: '45%' }} />
      <div className="lt-row lt-dense">
        {[0,1,2,3,4,5].map(i => <div key={i} className="lt-block lt-block-xs" />)}
      </div>
      <div className="lt-row lt-dense" style={{ marginTop: 1 }}>
        {[0,1,2,3,4,5].map(i => <div key={i} className="lt-block lt-block-xs" />)}
      </div>
      <div className="lt-row lt-dense" style={{ marginTop: 1 }}>
        {[0,1,2,3,4,5].map(i => <div key={i} className="lt-block lt-block-xs" />)}
      </div>
    </div>
  );
  // mercado: standard 4-col grid, medium hero
  if (id === 'mercado') return (
    <div className="lt-wrap">
      <div className="lt-hero-band" />
      <div className="lt-row" style={{ marginTop: 3 }}>
        {[0,1,2,3].map(i => <div key={i} className="lt-block lt-block-sm" />)}
      </div>
      <div className="lt-row" style={{ marginTop: 2 }}>
        {[0,1,2,3].map(i => <div key={i} className="lt-block lt-block-sm" />)}
      </div>
    </div>
  );
  // boutique: 2-3 large cards, tall hero, centered
  if (id === 'boutique') return (
    <div className="lt-wrap">
      <div className="lt-hero-band lt-hero-xl" />
      <div className="lt-row lt-centered" style={{ marginTop: 3, gap: 3 }}>
        <div className="lt-block lt-block-lg" />
        <div className="lt-block lt-block-lg" />
      </div>
    </div>
  );
  // moda: 4 borderless blocks, prominent hero
  if (id === 'moda') return (
    <div className="lt-wrap">
      <div className="lt-hero-band lt-hero-tall" />
      <div className="lt-row" style={{ marginTop: 3, gap: 2 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <div className="lt-block lt-block-img" />
            <div className="lt-bar lt-bar-xs" style={{ width: '70%' }} />
          </div>
        ))}
      </div>
    </div>
  );
  // catalogo: list rows with image+text (horizontal cards)
  if (id === 'catalogo') return (
    <div className="lt-wrap">
      <div className="lt-bar" style={{ width: '50%' }} />
      {[0,1,2].map(i => (
        <div key={i} className="lt-list-row" style={{ marginTop: 3 }}>
          <div className="lt-list-img lt-list-img-lg" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div className="lt-bar" style={{ width: '85%' }} />
            <div className="lt-bar lt-bar-sm" style={{ width: '55%' }} />
          </div>
        </div>
      ))}
    </div>
  );
  // ajuste_fino: slider-like rows hinting at manual control
  return (
    <div className="lt-wrap" style={{ gap: 4, justifyContent: 'center' }}>
      {[0.9, 0.5, 0.75, 0.4].map((w, i) => (
        <div key={i} className="lt-row" style={{ gap: 3, alignItems: 'center' }}>
          <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'currentColor', opacity: 0.2 }} />
          <div style={{ width: Math.round(w * 20), height: 7, borderRadius: 2, background: 'currentColor', opacity: 0.7, flexShrink: 0 }} />
          <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'currentColor', opacity: 0.2 }} />
        </div>
      ))}
    </div>
  );
}

// Mini visual thumbnail for each category filter style option.
function FilterStyleThumb({ id, primary }) {
  const active = primary || '#6366f1';
  if (id === 'cards') return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', justifyContent: 'center', height: '100%', paddingBottom: 2 }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          width: 16, borderRadius: 4, flexShrink: 0,
          background: i === 0 ? active : '#f1f5f9',
          border: `1px solid ${i === 0 ? active : '#e2e8f0'}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3px 2px 2px', gap: 2,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: i === 0 ? 'rgba(255,255,255,0.5)' : '#cbd5e1' }} />
          <div style={{ width: 10, height: 2, borderRadius: 1, background: i === 0 ? 'rgba(255,255,255,0.6)' : '#e2e8f0' }} />
        </div>
      ))}
    </div>
  );
  if (id === 'pills') return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      {['Todos','A','B'].map((lbl, i) => (
        <div key={i} style={{
          padding: '2px 7px', borderRadius: 999,
          background: i === 0 ? active : '#f1f5f9',
          border: `1px solid ${i === 0 ? active : '#e2e8f0'}`,
          fontSize: 7, fontWeight: 600,
          color: i === 0 ? '#fff' : '#64748b', whiteSpace: 'nowrap',
        }}>{lbl}</div>
      ))}
    </div>
  );
  if (id === 'tabs') return (
    <div style={{ display: 'flex', gap: 0, alignItems: 'flex-end', justifyContent: 'center', height: '100%', borderBottom: '1px solid #e2e8f0' }}>
      {['Todos','Uno','Dos'].map((lbl, i) => (
        <div key={i} style={{
          padding: '4px 6px 3px',
          borderBottom: i === 0 ? `2px solid ${active}` : '2px solid transparent',
          marginBottom: -1, fontSize: 7, fontWeight: i === 0 ? 700 : 500,
          color: i === 0 ? active : '#94a3b8', whiteSpace: 'nowrap',
        }}>{lbl}</div>
      ))}
    </div>
  );
  if (id === 'bubbles') return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      {[0,1].map(i => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 999,
          background: i === 0 ? active : '#f1f5f9',
          border: `1px solid ${i === 0 ? active : '#e2e8f0'}`,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: i === 0 ? 'rgba(255,255,255,0.7)' : '#cbd5e1' }} />
          <div style={{ width: 12, height: 2, borderRadius: 1, background: i === 0 ? 'rgba(255,255,255,0.6)' : '#e2e8f0' }} />
        </div>
      ))}
    </div>
  );
  if (id === 'images') return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'stretch', justifyContent: 'center', height: '100%', padding: '2px 0' }}>
      {[active + 'cc', '#64748b', '#94a3b8'].map((col, i) => (
        <div key={i} style={{
          flex: 1, borderRadius: 4,
          background: `linear-gradient(to bottom, transparent 25%, rgba(0,0,0,0.5) 100%), ${col}`,
          display: 'flex', alignItems: 'flex-end', padding: '2px 3px',
          border: i === 0 ? `1.5px solid ${active}` : '1px solid #e2e8f0',
        }}>
          <div style={{ width: '100%', height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.7)' }} />
        </div>
      ))}
    </div>
  );
  if (id === 'none') return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <span style={{ fontSize: 20, lineHeight: 1, color: '#cbd5e1' }}>—</span>
    </div>
  );
  return null;
}
