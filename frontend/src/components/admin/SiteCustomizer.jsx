import React, { useState, useEffect, useRef } from 'react';
import { apiFetch, apiUrl } from '../../services/apiClient';
import { resolveImageUrl } from '../../utils/resolveImageUrl';
import { formatCurrency } from '../../utils/formatCurrency';
import { COLOR_PALETTES, FONT_OPTIONS } from '../../utils/colorPalettes';
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
  const [logoPreview, setLogoPreview] = useState(null);
  const [nameImgPreview, setNameImgPreview] = useState(null);

  // Fetch up to 6 real products for preview
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await apiFetch(apiUrl('/products?limit=6&page=1'));
        if (res.ok) {
          const data = await res.json();
          setProducts(Array.isArray(data.data) ? data.data.slice(0, 6) : []);
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
  };

  // Update a single fine-tune parameter
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
      heroHeight: 340,
      heroBannerPositionX: 80,
      heroBannerPositionY: 50,
      heroBannerSize: 150,
      heroTextPaddingX: 0,
      heroTextPaddingY: 0,
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
    { id: 'home', icon: '🏠', label: 'Home' }
  ];

  return (
    <div className="sc-app">
      {/* ── SIDEBAR ── */}
      <div className="sc-sidebar">
        {/* Panel navigation — icon-only compact row */}
        <nav className="sc-panel-nav" aria-label="Personalización">
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

                <div className="sc-ft-section">Hero</div>
                <Stepper label="Altura" value={ft.heroHeight} min={80} max={1200} step={30} unit="px"
                  onChange={v => setFt('heroHeight', v)} />
                <Stepper label="Margen lateral" value={ft.gridPadding} min={0} max={80} step={4} unit="px"
                  onChange={v => setFt('gridPadding', v)} />
                <Stepper label="Sep. cards" value={ft.cardGap} min={0} max={24} step={2} unit="px"
                  onChange={v => setFt('cardGap', v)} />

                <div className="sc-ft-section">Texto del hero</div>
                <Stepper label="Pos. X" value={ft.heroTextX} min={0} max={1600} step={10} unit="px"
                  onChange={v => setFt('heroTextPaddingX', v)} />
                <Stepper label="Pos. Y" value={ft.heroTextY} min={0} max={600} step={10} unit="px"
                  onChange={v => setFt('heroTextPaddingY', v)} />

                <div className="sc-ft-section">Imagen del hero</div>
                <Stepper label="Pos. X" value={ft.heroBannerX} min={0} max={100} step={5} unit="%"
                  onChange={v => setFt('heroBannerPositionX', v)} />
                <Stepper label="Pos. Y" value={ft.heroBannerY} min={0} max={100} step={5} unit="%"
                  onChange={v => setFt('heroBannerPositionY', v)} />
                <Stepper label="Tamaño" value={ft.heroBannerSize} min={30} max={600} step={10} unit="px"
                  onChange={v => setFt('heroBannerSize', v)} />

                <button type="button" className="sc-ft-reset" onClick={resetFtDefaults}>
                  ↺ Restaurar por defecto
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── HOME PANEL ── */}
        {activePanel === 'home' && (
          <div className="sc-panel">
            <p className="sc-panel-label">Contenido del Hero</p>
            <div className="sc-identity-row">
              <div className="sc-identity-field">
                <label className="sc-field-label">Título</label>
                <input type="text" className="sc-text-input"
                  value={settings.heroTitle || ''}
                  onChange={e => markAndChange('heroTitle', e.target.value)}
                  placeholder="La Mejor Tecnología..." />
              </div>
            </div>
            <div className="sc-identity-row">
              <div className="sc-identity-field">
                <label className="sc-field-label">Descripción</label>
                <input type="text" className="sc-text-input"
                  value={settings.heroDescription || ''}
                  onChange={e => markAndChange('heroDescription', e.target.value)}
                  placeholder="Descubre nuestra selección..." />
              </div>
            </div>

            <div className="sc-divider" />
            <p className="sc-panel-label">Apariencia</p>
            <div className="sc-home-row">
              <div className="sc-home-field">
                <label className="sc-field-label">Texto del hero</label>
                <div className="sc-color-row" style={{ marginTop: 4 }}>
                  <label className="sc-color-swatch-label">
                    <input type="color"
                      value={settings.heroTextColor || '#ffffff'}
                      onChange={e => markAndChange('heroTextColor', e.target.value)}
                      className="sc-color-input" />
                    <span className="sc-color-swatch" style={{ background: settings.heroTextColor || '#ffffff' }} />
                  </label>
                  <span className="sc-color-hex">{settings.heroTextColor || '#ffffff'}</span>
                </div>
              </div>
              <div className="sc-home-field">
                <label className="sc-field-label">Oscurecer</label>
                <div className="sc-inline-num">
                  <input type="number" className="sc-size-input" style={{ width: 54 }}
                    min="0" max="80" step="5"
                    value={Math.round((settings.heroOverlayOpacity ?? 0.5) * 100)}
                    onChange={e => markAndChange('heroOverlayOpacity', parseFloat(e.target.value) / 100)} />
                  <span className="sc-size-unit">%</span>
                </div>
              </div>
              <div className="sc-home-field">
                <label className="sc-field-label">Pos. texto</label>
                <select className="sc-text-input sc-select"
                  value={settings.heroPositionX || 'left'}
                  onChange={e => markAndChange('heroPositionX', e.target.value)}>
                  <option value="left">Izq.</option>
                  <option value="center">Centro</option>
                  <option value="right">Der.</option>
                </select>
              </div>
            </div>

            <div className="sc-divider" />
            <p className="sc-panel-label">Imagen del Hero</p>
            {onImageUpload && (
              <input type="file" accept="image/*" className="sc-file-input"
                onChange={e => onImageUpload(e, 'heroImage')} />
            )}
            {settings.heroImage && (
              <div className="sc-identity-preview">
                <img src={settings.heroImage} alt="Hero" style={{ height: '36px', objectFit: 'cover', borderRadius: 4, flex: 1, maxWidth: 120 }} />
                <button type="button" className="sc-identity-del"
                  onClick={() => markAndChange('heroImage', '')}>eliminar</button>
              </div>
            )}

            <div className="sc-divider" />
            <p className="sc-panel-label">Imagen Superpuesta</p>
            {onImageUpload && (
              <input type="file" accept="image/*" className="sc-file-input"
                onChange={e => onImageUpload(e, 'heroBannerImage')} />
            )}
            {settings.heroBannerImage && (
              <div className="sc-identity-preview">
                <img src={settings.heroBannerImage} alt="Banner" style={{ height: '36px', objectFit: 'contain', flex: 1, maxWidth: 80 }} />
                <button type="button" className="sc-identity-del"
                  onClick={() => markAndChange('heroBannerImage', '')}>eliminar</button>
              </div>
            )}

            <div className="sc-divider" />
            <p className="sc-panel-label">Landing Page</p>
            <label className="sc-checkbox-label">
              <input type="checkbox"
                checked={settings.landingPageConfig?.enabled === true}
                onChange={e => markAndBulk({
                  landingPageConfig: { ...(settings.landingPageConfig || {}), enabled: e.target.checked }
                })} />
              <span>Activar como página principal (<code>/</code>)</span>
            </label>
            <p className="sc-panel-hint">Si está activa, <code>/</code> muestra la landing y la tienda se mueve a <code>/tienda</code>.</p>
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
                        backgroundSize: 'cover',
                        backgroundPosition: '50% 50%',
                        backgroundRepeat: 'no-repeat'
                      }
                    : { background: `linear-gradient(135deg, ${primary}ee 0%, ${secondary}77 100%)` }
                  ),
                  minHeight: Math.round(activeLayoutDef.heroHeight * 0.22) + 'px',
                  alignItems: heroAlign,
                  textAlign: heroTextAlign,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
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
                      opacity: (parseInt(settings.heroBannerOpacity) || 100) / 100
                    }}
                  />
                )}
                <div style={{ transform: `translate(${Math.round(ft.heroTextX * 0.22)}px, ${Math.round(ft.heroTextY * 0.22)}px)` }}>
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
              <div className="sc-prev-cats" style={{ background: bg, borderBottom: `1px solid ${primary}22` }}>
                {['Todos', 'Electrónica', 'Ropa', 'Hogar', 'Deportes'].map((cat, i) => (
                  <div
                    key={cat}
                    className="sc-prev-cat-chip"
                    style={{
                      background: i === 0 ? primary : 'transparent',
                      color: i === 0 ? '#fff' : text,
                      border: `1px solid ${i === 0 ? primary : primary + '44'}`
                    }}
                  >
                    {cat}
                  </div>
                ))}
              </div>

              {/* ── Search bar ── */}
              <div className="sc-prev-search" style={{ background: bg }}>
                <div className="sc-prev-search-bar" style={{ borderColor: primary + '55' }}>
                  <span style={{ color: primary + '88' }}>🔍</span>
                  <span className="sc-prev-search-placeholder" style={{ color: text + '66' }}>
                    Buscar productos...
                  </span>
                </div>
              </div>

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

              {/* ── Footer strip ── */}
              <div className="sc-prev-footer" style={{ background: primary }}>
                <span style={{ color: '#ffffff99' }}>{siteName}</span>
                <span style={{ color: '#ffffff66' }}>Todos los derechos reservados</span>
              </div>

            </div>
          </div>
        </div>
      </div>
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
