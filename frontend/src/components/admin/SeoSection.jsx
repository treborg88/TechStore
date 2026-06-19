// SeoSection.jsx - Panel de configuración SEO en admin
// Permite configurar meta tags globales, títulos por página, verificaciones y sitemap
import React, { useState } from 'react';
import { SEO_DEFAULTS, SEO_PAGE_LABELS } from '../../utils/seoDefaults';

// Sub-tabs del panel SEO
const SEO_TABS = [
  { id: 'global', label: '🌐 Global' },
  { id: 'pages', label: '📄 Páginas' },
  { id: 'verification', label: '✅ Verificación' },
  { id: 'advanced', label: '⚙️ Avanzado' }
];

const SeoSection = ({ settings, setSettings }) => {
  const [activeTab, setActiveTab] = useState('global');

  // Merge defaults con config guardada
  const cfg = { ...SEO_DEFAULTS, ...settings.seoConfig, pages: { ...SEO_DEFAULTS.pages, ...(settings.seoConfig?.pages || {}) } };

  // Actualiza un campo del seoConfig
  const updateField = (key, value) => {
    setSettings(prev => ({
      ...prev,
      seoConfig: { ...prev.seoConfig, [key]: value }
    }));
  };

  // Actualiza un campo de una página específica
  const updatePageField = (pageKey, field, value) => {
    setSettings(prev => {
      const currentPages = { ...SEO_DEFAULTS.pages, ...(prev.seoConfig?.pages || {}) };
      return {
        ...prev,
        seoConfig: {
          ...prev.seoConfig,
          pages: {
            ...currentPages,
            [pageKey]: { ...currentPages[pageKey], [field]: value }
          }
        }
      };
    });
  };

  // Reset a defaults
  const handleReset = () => {
    if (window.confirm('¿Restablecer toda la configuración SEO a los valores por defecto?')) {
      setSettings(prev => ({ ...prev, seoConfig: {} }));
    }
  };

  return (
    <div className="settings-section-scroll">
      {/* Sub-tabs */}
      <div className="seo-tabs">
        {SEO_TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={`settings-sub-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
        <button type="button" onClick={handleReset} className="settings-sub-tab secondary">
          🔄 Restablecer
        </button>
      </div>

      {/* ===== TAB: Global ===== */}
      {activeTab === 'global' && (
        <section className="settings-section">
          <h3>Meta Tags Globales</h3>
          <p className="section-description">
            Estos valores se aplican a todas las páginas como base. Las páginas individuales pueden sobreescribirlos.
          </p>

          {/* Meta Description */}
          <div className="settings-field">
            <label>Meta Descripción</label>
            <textarea
              value={cfg.metaDescription}
              onChange={(e) => updateField('metaDescription', e.target.value)}
              placeholder="Describe tu tienda en 1-2 oraciones (máx. 160 caracteres para Google)"
              maxLength={200}
              rows={3}
            />
            <small>{(cfg.metaDescription || '').length}/160 caracteres recomendados</small>
          </div>

          {/* Meta Keywords */}
          <div className="settings-field">
            <label>Palabras Clave (Keywords)</label>
            <input
              type="text"
              value={cfg.metaKeywords}
              onChange={(e) => updateField('metaKeywords', e.target.value)}
              placeholder="tienda, online, tecnología, celulares (separadas por coma)"
            />
          </div>

          {/* OG Image */}
          <div className="settings-field">
            <label>Imagen para Redes Sociales (OG Image)</label>
            <input
              type="text"
              value={cfg.ogImage}
              onChange={(e) => updateField('ogImage', e.target.value)}
              placeholder="URL de la imagen (recomendado: 1200x630px)"
            />
            <small>Se muestra al compartir cualquier página en WhatsApp, Facebook, Twitter, etc.</small>
            {cfg.ogImage && (
              <div className="seo-og-preview">
                <img src={cfg.ogImage} alt="OG Preview" onError={(e) => { e.target.style.display = 'none'; }} />
              </div>
            )}
          </div>

          {/* OG Type */}
          <div className="settings-field">
            <label>Tipo de Sitio (og:type)</label>
            <select value={cfg.ogType} onChange={(e) => updateField('ogType', e.target.value)}>
              <option value="website">website (sitio web)</option>
              <option value="article">article (artículo/blog)</option>
            </select>
          </div>

          {/* Locale */}
          <div className="settings-field">
            <label>Idioma / Locale</label>
            <select value={cfg.locale} onChange={(e) => updateField('locale', e.target.value)}>
              <option value="es_DO">Español (República Dominicana)</option>
              <option value="es_ES">Español (España)</option>
              <option value="es_MX">Español (México)</option>
              <option value="es_CO">Español (Colombia)</option>
              <option value="es_AR">Español (Argentina)</option>
              <option value="en_US">English (US)</option>
              <option value="pt_BR">Português (Brasil)</option>
            </select>
          </div>

          {/* Robots */}
          <div className="settings-field">
            <label>Directiva Robots</label>
            <select value={cfg.robots} onChange={(e) => updateField('robots', e.target.value)}>
              <option value="index, follow">index, follow (indexar todo)</option>
              <option value="noindex, follow">noindex, follow (no indexar, seguir links)</option>
              <option value="index, nofollow">index, nofollow (indexar, no seguir links)</option>
              <option value="noindex, nofollow">noindex, nofollow (bloquear todo)</option>
            </select>
            <small>Controla si los buscadores indexan tu sitio. Usa &quot;noindex&quot; para tiendas en desarrollo.</small>
          </div>
        </section>
      )}

      {/* ===== TAB: Páginas ===== */}
      {activeTab === 'pages' && (
        <section className="settings-section">
          <h3>Títulos por Página</h3>
          <p className="section-description">
            Personaliza el título de la pestaña del navegador para cada página.
            Usa <code>{'{siteName}'}</code> para el nombre de tu tienda y <code>{'{productName}'}</code> para el nombre del producto.
          </p>

          {Object.entries(SEO_PAGE_LABELS).map(([pageKey, label]) => {
            const pageConfig = cfg.pages[pageKey] || SEO_DEFAULTS.pages[pageKey] || {};
            return (
              <div key={pageKey} className="seo-page-card">
                <span className="seo-page-label">{label}</span>

                <div className="settings-field">
                  <label>Título de pestaña</label>
                  <input
                    type="text"
                    value={pageConfig.titleTemplate || ''}
                    onChange={(e) => updatePageField(pageKey, 'titleTemplate', e.target.value)}
                    placeholder={SEO_DEFAULTS.pages[pageKey]?.titleTemplate || `${label} | {siteName}`}
                  />
                </div>

                <div className="settings-field">
                  <label>Descripción (deja vacío para usar la global)</label>
                  <input
                    type="text"
                    value={pageConfig.description || ''}
                    onChange={(e) => updatePageField(pageKey, 'description', e.target.value)}
                    placeholder="Descripción específica para esta página..."
                    maxLength={200}
                  />
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* ===== TAB: Verificación ===== */}
      {activeTab === 'verification' && (
        <section className="settings-section">
          <h3>Verificación de Buscadores</h3>
          <p className="section-description">
            Pega el código de verificación que te proporcionan Google y Bing para conectar sus herramientas.
          </p>

          {/* Google */}
          <div className="settings-field">
            <label>Google Search Console</label>
            <input
              type="text"
              value={cfg.googleVerification}
              onChange={(e) => updateField('googleVerification', e.target.value)}
              placeholder="Contenido del meta tag google-site-verification"
            />
            <small>
              Obtén tu código en{' '}
              <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer">
                Google Search Console
              </a>
            </small>
          </div>

          {/* Bing */}
          <div className="settings-field">
            <label>Bing Webmaster Tools</label>
            <input
              type="text"
              value={cfg.bingVerification}
              onChange={(e) => updateField('bingVerification', e.target.value)}
              placeholder="Contenido del meta tag msvalidate.01"
            />
            <small>
              Obtén tu código en{' '}
              <a href="https://www.bing.com/webmasters" target="_blank" rel="noopener noreferrer">
                Bing Webmaster Tools
              </a>
            </small>
          </div>
        </section>
      )}

      {/* ===== TAB: Avanzado ===== */}
      {activeTab === 'advanced' && (
        <section className="settings-section">
          <h3>Configuración Avanzada</h3>

          {/* JSON-LD */}
          <div className="settings-field">
            <div className="seo-toggle-row">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={cfg.jsonLdEnabled !== false}
                  onChange={(e) => updateField('jsonLdEnabled', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
              <span className="seo-toggle-label">JSON-LD (Datos Estructurados)</span>
            </div>
            <small className="seo-note">
              Genera automáticamente datos estructurados (Organization + Product) para Google Rich Results.
            </small>
          </div>

          <div className="settings-field">
            <div className="seo-toggle-row">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={cfg.sitemapEnabled !== false}
                  onChange={(e) => updateField('sitemapEnabled', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
              <span style={{ fontWeight: 600 }}>Sitemap XML</span>
            </div>
            <small className="seo-note">
              Genera un mapa del sitio automático en <code>/api/seo/sitemap.xml</code> con todas las páginas y productos.
            </small>
          </div>

          <div className="settings-field">
            <label>Tags Personalizados en &lt;head&gt;</label>
            <textarea
              value={cfg.customHeadTags}
              onChange={(e) => updateField('customHeadTags', e.target.value)}
              placeholder={'<!-- Google Analytics -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=GA_ID"></script>'}
              rows={6}
              className="settings-textarea"
              style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
            />
            <small className="seo-warning">
              ⚠️ Solo código HTML válido. Scripts maliciosos pueden afectar la seguridad del sitio.
            </small>
          </div>
        </section>
      )}
    </div>
  );
};

export default SeoSection;
