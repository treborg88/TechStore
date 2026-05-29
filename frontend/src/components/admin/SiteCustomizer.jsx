import React, { useState, useEffect, useRef } from 'react';
import { apiFetch, apiUrl } from '../../services/apiClient';
import { resolveImageUrl } from '../../utils/resolveImageUrl';
import { formatCurrency } from '../../utils/formatCurrency';
import { COLOR_PALETTES, FONT_OPTIONS } from '../../utils/colorPalettes';
import './SiteCustomizer.css';

// Layout options that map to productCardConfig.layout.orientation + hero position
const LAYOUT_OPTIONS = [
  {
    id: 'grid',
    name: 'Cuadrícula',
    heroPositionX: 'left',
    orientation: 'vertical',
    thumb: 'grid'
  },
  {
    id: 'hero',
    name: 'Hero grande',
    heroPositionX: 'center',
    orientation: 'vertical',
    thumb: 'hero'
  },
  {
    id: 'split',
    name: 'Dividido',
    heroPositionX: 'right',
    orientation: 'horizontal',
    thumb: 'split'
  },
  {
    id: 'minimal',
    name: 'Minimal',
    heroPositionX: 'left',
    orientation: 'horizontal',
    thumb: 'minimal'
  }
];

// Derive active layout ID from current settings
function getActiveLayout(settings) {
  const orientation = settings.productCardConfig?.layout?.orientation || 'vertical';
  const posX = settings.heroPositionX || 'left';
  if (posX === 'center') return 'hero';
  if (posX === 'right' || orientation === 'horizontal') return 'split';
  if (orientation === 'horizontal') return 'minimal';
  return 'grid';
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

export default function SiteCustomizer({ settings, onChange, onBulkChange }) {
  const [activePanel, setActivePanel] = useState('palette');
  const [previewMode, setPreviewMode] = useState('desktop');
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const hasUnsaved = useRef(false);
  const [unsaved, setUnsaved] = useState(false);

  // Fetch first 3 real products for preview
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await apiFetch(apiUrl('/products?limit=3&page=1'));
        if (res.ok) {
          const data = await res.json();
          setProducts(Array.isArray(data.data) ? data.data.slice(0, 3) : []);
        }
      } catch {
        // silently fail — preview works with empty products
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

  const primary = settings.primaryColor || '#2563eb';
  const accent = settings.accentColor || '#f59e0b';
  const bg = settings.backgroundColor || '#f8fafc';
  const text = settings.textColor || '#1e293b';
  const headerBg = settings.headerBgColor || primary;
  const headerText = settings.headerTextColor || '#ffffff';
  const fontFamily = settings.fontFamily || 'system-ui, sans-serif';
  const siteName = settings.siteName || 'Mi Tienda';
  const currency = settings.productCardConfig?.currency || 'USD';

  const PANELS = [
    { id: 'palette', icon: '🎨', label: 'Paleta' },
    { id: 'fonts', icon: '✏️', label: 'Fuentes' },
    { id: 'layout', icon: '⊞', label: 'Layout' }
  ];

  return (
    <div className="sc-app">
      {/* ── SIDEBAR ── */}
      <div className="sc-sidebar">
        {/* Panel navigation */}
        <nav className="sc-panel-nav" aria-label="Personalización">
          {PANELS.map(p => (
            <button
              key={p.id}
              type="button"
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
                { key: 'primaryColor', label: 'Principal' },
                { key: 'accentColor', label: 'Acento' },
                { key: 'backgroundColor', label: 'Fondo' },
                { key: 'textColor', label: 'Texto' },
                { key: 'headerBgColor', label: 'Cabecera' },
                { key: 'headerTextColor', label: 'Texto cabecera' }
              ].map(({ key, label }) => (
                <div key={key} className="sc-color-row">
                  <label className="sc-color-swatch-label">
                    <input
                      type="color"
                      value={settings[key] || '#000000'}
                      onChange={e => markAndChange(key, e.target.value)}
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
            <p className="sc-panel-hint">Elige cómo se estructura tu página de inicio</p>
            <div className="sc-layout-grid">
              {LAYOUT_OPTIONS.map(lo => (
                <button
                  key={lo.id}
                  type="button"
                  className={`sc-layout-opt${activeLayout === lo.id ? ' selected' : ''}`}
                  onClick={() => {
                    markAndBulk({
                      heroPositionX: lo.heroPositionX,
                      productCardConfig: {
                        ...settings.productCardConfig,
                        layout: {
                          ...(settings.productCardConfig?.layout || {}),
                          orientation: lo.orientation
                        }
                      }
                    });
                  }}
                >
                  <div className="sc-layout-thumb">
                    <LayoutThumb id={lo.id} />
                  </div>
                  <span className="sc-layout-name">{lo.name}</span>
                </button>
              ))}
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
              {/* Nav */}
              <div className="sc-prev-nav" style={{ background: headerBg }}>
                <span className="sc-prev-logo" style={{ color: headerText, fontFamily }}>
                  {settings.siteIcon || '🛍️'} {siteName}
                </span>
                <div className="sc-prev-nav-links">
                  <span style={{ color: headerText + 'cc' }}>Tienda</span>
                  <span style={{ color: headerText + 'cc' }}>Contacto</span>
                </div>
                <div
                  className="sc-prev-nav-btn"
                  style={{ background: settings.headerButtonColor || '#ffffff', color: settings.headerButtonTextColor || primary }}
                >
                  Carrito
                </div>
              </div>

              {/* Hero strip */}
              <div
                className="sc-prev-hero"
                style={{
                  background: `linear-gradient(135deg, ${primary}22, ${accent}33)`,
                  borderLeft: `4px solid ${primary}`
                }}
              >
                <h2 className="sc-prev-headline" style={{ color: text, fontFamily }}>
                  {settings.heroTitle || 'La Mejor Tecnología a Tu Alcance'}
                </h2>
                <p className="sc-prev-subline" style={{ color: text + 'bb' }}>
                  {settings.heroDescription || 'Descubre nuestra selección de productos.'}
                </p>
                <div className="sc-prev-cta" style={{ background: primary, color: '#fff', fontFamily }}>
                  Ver productos
                </div>
              </div>

              {/* Products */}
              <div className="sc-prev-products" style={{ background: bg }}>
                <h3 className="sc-prev-cat" style={{ color: primary, fontFamily }}>
                  Productos destacados
                </h3>
                <div className={`sc-prev-grid${activeLayout === 'split' || activeLayout === 'minimal' ? ' horizontal' : ''}`}>
                  {loadingProducts ? (
                    <div className="sc-prev-loading">Cargando…</div>
                  ) : products.length > 0 ? (
                    products.map(p => (
                      <div key={p.id} className="sc-prev-card" style={{ borderColor: primary + '33' }}>
                        <div className="sc-prev-card-img" style={{ background: primary + '15' }}>
                          <img
                            src={resolveImageUrl(
                              p.images?.[0]?.image_url || p.image
                            )}
                            alt={p.name}
                            onError={e => { e.target.style.display = 'none'; }}
                          />
                        </div>
                        <div className="sc-prev-card-info">
                          <span className="sc-prev-card-name" style={{ color: text, fontFamily }}>
                            {p.name}
                          </span>
                          <span className="sc-prev-card-price" style={{ color: primary }}>
                            {formatCurrency(p.price, currency)}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    /* Placeholder cards when no products loaded */
                    [1, 2, 3].map(i => (
                      <div key={i} className="sc-prev-card" style={{ borderColor: primary + '33' }}>
                        <div className="sc-prev-card-img" style={{ background: primary + '15' }}>
                          <span style={{ fontSize: '1.5rem', opacity: 0.4 }}>📦</span>
                        </div>
                        <div className="sc-prev-card-info">
                          <span className="sc-prev-card-name" style={{ color: text, fontFamily }}>
                            Producto {i}
                          </span>
                          <span className="sc-prev-card-price" style={{ color: primary }}>
                            {formatCurrency(1000 * i, currency)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Mini SVG-style layout thumbnail using divs
function LayoutThumb({ id }) {
  if (id === 'grid') return (
    <div className="lt-wrap">
      <div className="lt-bar" style={{ width: '70%' }} />
      <div className="lt-row">
        <div className="lt-block" />
        <div className="lt-block" />
        <div className="lt-block" />
      </div>
    </div>
  );
  if (id === 'hero') return (
    <div className="lt-wrap">
      <div className="lt-hero-band" />
      <div className="lt-row" style={{ marginTop: 3 }}>
        <div className="lt-block" />
        <div className="lt-block" />
      </div>
    </div>
  );
  if (id === 'split') return (
    <div className="lt-wrap lt-split">
      <div className="lt-split-img" />
      <div className="lt-split-text">
        <div className="lt-bar" />
        <div className="lt-bar" style={{ width: '60%' }} />
      </div>
    </div>
  );
  // minimal
  return (
    <div className="lt-wrap">
      {[1, 1, 1].map((_, i) => (
        <div key={i} className="lt-list-row">
          <div className="lt-list-img" />
          <div className="lt-bar" style={{ flex: 1 }} />
        </div>
      ))}
    </div>
  );
}
