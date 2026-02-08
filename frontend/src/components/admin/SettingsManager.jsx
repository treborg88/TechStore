import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { apiFetch, apiUrl } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import './SettingsManager.css';
import EmailSettingsSection from './EmailSettingsSection';
import DatabaseSection from './DatabaseSection';
import { DEFAULT_CATEGORY_FILTERS_CONFIG, DEFAULT_PRODUCT_CARD_CONFIG } from '../../config';

function SettingsManager() {
  const location = useLocation();
  const [activeSection, setActiveSection] = useState('site');
  const [siteTab, setSiteTab] = useState('general');
  const [openSections, setOpenSections] = useState({
    theme: true,
    home: true,
    product: true,
    identity: false,
    heroText: false,
    ecommerce: true,
    promos: true,
    filters: true,
    productCards: true,
    filterCategories: true,
    filterStyles: false,
    paymentCash: false,
    paymentTransfer: false,
    paymentStripe: false,
    paymentPaypal: false,
    cardLayout: true,
    cardDimensions: false,
    cardColors: false,
    cardButton: false
  });
  const [expandedCategories, setExpandedCategories] = useState({});
  const cloneCategoryConfig = (config = DEFAULT_CATEGORY_FILTERS_CONFIG) => (
    JSON.parse(JSON.stringify(config))
  );
  const cloneProductCardConfig = (config = DEFAULT_PRODUCT_CARD_CONFIG) => (
    JSON.parse(JSON.stringify(config))
  );
  const normalizeBoolean = (value) => value === true || value === 'true';
  const normalizeNumber = (value) => {
    if (value === '' || value === null || value === undefined) return value;
    const num = Number(value);
    return Number.isNaN(num) ? value : num;
  };

  // Default payment methods configuration
  const DEFAULT_PAYMENT_METHODS_CONFIG = {
    cash: {
      enabled: true,
      name: 'Pago Contra Entrega',
      description: 'Paga en efectivo cuando recibas tu pedido',
      icon: '💵',
      order: 1
    },
    transfer: {
      enabled: true,
      name: 'Transferencia Bancaria',
      description: 'Transferencia o depósito bancario',
      icon: '🏦',
      order: 2,
      bankName: '',
      bankHolder: '',
      bankAccount: '',
      transferNote: ''
    },
    stripe: {
      enabled: true,
      name: 'Tarjeta de Crédito/Débito',
      description: 'Visa, MasterCard, American Express',
      icon: '💳',
      order: 3,
      testMode: true // true = test keys, false = live keys
    },
    paypal: {
      enabled: false,
      name: 'PayPal',
      description: 'Paga con tu cuenta PayPal',
      icon: '🅿️',
      order: 4
    }
  };

  const clonePaymentMethodsConfig = (config = DEFAULT_PAYMENT_METHODS_CONFIG) => (
    JSON.parse(JSON.stringify(config))
  );

  const [settings, setSettings] = useState({
    siteName: 'TechStore',
    siteIcon: '🛍️',
    siteLogo: '',
    siteLogoSize: 40,
    siteNameImage: '',
    siteNameImageSize: 32,
    maintenanceMode: false,
    freeShippingThreshold: 50000,
    contactEmail: 'soporte@techstore.com',
    showPromotionBanner: true,
    promoText: '¡Gran venta de año nuevo! 20% de descuento en todo.',
    mailFromName: 'TechStore',
    mailFrom: '',
    mailUser: '',
    mailPassword: '',
    mailHost: '',
    mailPort: 587,
    mailUseTls: true,
    mailTemplateHtml: '<div style="font-family: Arial, sans-serif; color:#111827; line-height:1.6;">\n  <div style="background:#111827;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0;">\n    <h2 style="margin:0;">{{siteIcon}} {{siteName}}</h2>\n    <p style="margin:4px 0 0;">Tu pedido fue recibido</p>\n  </div>\n  <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 10px 10px;">\n    <p>Hola <strong>{{customerName}}</strong>,</p>\n    <p>Tu orden <strong>{{orderNumber}}</strong> fue tomada y está en proceso de preparación para envío.</p>\n    <h3 style="margin-top:20px;">Resumen</h3>\n    {{itemsTable}}\n    <p style="margin-top:16px;"><strong>Total:</strong> {{total}}</p>\n    <p><strong>Dirección:</strong> {{shippingAddress}}</p>\n    <p><strong>Pago:</strong> {{paymentMethod}}</p>\n    <p style="margin-top:20px;">Gracias por comprar con nosotros.</p>\n  </div>\n</div>',
    // Hero text configuration
    heroTitle: 'La Mejor Tecnología a Tu Alcance',
    heroDescription: 'Descubre nuestra selección de smartphones y accesorios con las mejores ofertas del mercado.',
    heroTitleSize: 2.1,
    heroDescriptionSize: 1.05,
    heroPositionY: 'center',
    heroPositionX: 'left',
    heroImageWidth: 100,
    heroOverlayOpacity: 0.5,
    heroHeight: 360,
    heroTextColor: '#ffffff',
    headerTextColor: '#ffffff',
    headerButtonColor: '#ffffff',
    headerButtonTextColor: '#2563eb',
    // Banner image overlay settings
    heroBannerImage: '',
    heroBannerSize: 150,
    heroBannerPositionX: 'right',
    heroBannerPositionY: 'center',
    heroBannerOpacity: 100,
    // Product Detail Hero settings
    productDetailHeroImage: '',
    productDetailUseHomeHero: true,
    productDetailHeroHeight: 200,
    productDetailHeroOverlayOpacity: 0.5,
    productDetailHeroBannerImage: '',
    productDetailHeroBannerSize: 120,
    productDetailHeroBannerPositionX: 'right',
    productDetailHeroBannerPositionY: 'center',
    productDetailHeroBannerOpacity: 100,
    categoryFiltersConfig: cloneCategoryConfig(),
    productCardConfig: cloneProductCardConfig(),
    paymentMethodsConfig: clonePaymentMethodsConfig(),
    // Stripe API Keys (stored separately for encryption)
    stripePublishableKey: '',
    stripeSecretKey: '',
    // PayPal API Keys (stored separately for encryption)
    paypalClientId: '',
    paypalClientSecret: '',
    // Database credentials (reference copy)
    dbSupabaseUrl: '',
    dbSupabaseKey: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const hash = location.hash?.replace('#', '').trim();
    if (hash === 'email') {
      // Email ahora es un tab dentro de site
      setActiveSection('site');
      setSiteTab('email');
    } else if (hash === 'site') {
      setActiveSection('site');
    }
  }, [location.hash]);

  useEffect(() => {
    // Solo resetear a 'general' si no viene de un hash específico
    const hash = location.hash?.replace('#', '').trim();
    if (activeSection === 'site' && hash !== 'email') {
      setSiteTab('general');
    }
  }, [activeSection, location.hash]);

  useEffect(() => {
    const buildTypedData = (data) => {
      const typedData = {};
      Object.entries(data || {}).forEach(([key, value]) => {
        if (value === 'true') typedData[key] = true;
        else if (value === 'false') typedData[key] = false;
        else if (!isNaN(value) && (key === 'freeShippingThreshold' || key === 'mailPort')) typedData[key] = Number(value);
        else if (key === 'categoryFiltersConfig') {
          try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            typedData[key] = {
              ...cloneCategoryConfig(),
              ...parsed,
              categories: Array.isArray(parsed?.categories) && parsed.categories.length > 0
                ? parsed.categories
                : cloneCategoryConfig().categories,
              styles: {
                ...cloneCategoryConfig().styles,
                ...(parsed?.styles || {})
              }
            };
          } catch {
            typedData[key] = cloneCategoryConfig();
          }
        } else if (key === 'productCardConfig') {
          try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            const merged = {
              ...cloneProductCardConfig(),
              ...parsed,
              layout: {
                ...cloneProductCardConfig().layout,
                ...(parsed?.layout || {})
              },
              styles: {
                ...cloneProductCardConfig().styles,
                ...(parsed?.styles || {})
              }
            };
            merged.useDefault = normalizeBoolean(parsed?.useDefault ?? merged.useDefault);
            if (merged.layout) {
              merged.layout = {
                ...merged.layout,
                columnsMobile: normalizeNumber(merged.layout.columnsMobile),
                columnsTablet: normalizeNumber(merged.layout.columnsTablet),
                columnsDesktop: normalizeNumber(merged.layout.columnsDesktop),
                columnsWide: normalizeNumber(merged.layout.columnsWide)
              };
            }
            typedData[key] = merged;
          } catch {
            typedData[key] = cloneProductCardConfig();
          }
        } else if (key === 'paymentMethodsConfig') {
          try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            // Merge with defaults to ensure all payment methods exist
            typedData[key] = {
              ...clonePaymentMethodsConfig(),
              ...parsed,
              cash: { ...clonePaymentMethodsConfig().cash, ...(parsed?.cash || {}) },
              transfer: { ...clonePaymentMethodsConfig().transfer, ...(parsed?.transfer || {}) },
              stripe: { ...clonePaymentMethodsConfig().stripe, ...(parsed?.stripe || {}) },
              paypal: { ...clonePaymentMethodsConfig().paypal, ...(parsed?.paypal || {}) }
            };
          } catch {
            typedData[key] = clonePaymentMethodsConfig();
          }
        } else typedData[key] = value;
      });
      return typedData;
    };

    const applySettingsData = (data) => {
      const typedData = buildTypedData(data);
      setSettings(prev => ({
        ...prev,
        ...typedData
      }));
    };

    const fetchSettings = async () => {
      try {
        const cached = localStorage.getItem('settings_cache_v1');
        if (cached) {
          const parsedCache = JSON.parse(cached);
          if (parsedCache?.data) {
            applySettingsData(parsedCache.data);
            setLoading(false);
          }
        }

        const response = await apiFetch(apiUrl('/settings'));
        if (response.ok) {
          const data = await response.json();
          applySettingsData(data);
          localStorage.setItem('settings_cache_v1', JSON.stringify({
            timestamp: new Date().getTime(),
            data
          }));
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleImageUpload = async (e, targetKey) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    const uploadToast = toast.loading('Subiendo imagen...');
    try {
      const response = await apiFetch(apiUrl('/settings/upload'), {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const { url } = await response.json();
        setSettings(prev => ({ ...prev, [targetKey]: url }));
        toast.success('Imagen subida correctamente', { id: uploadToast });
      } else {
        throw new Error('Error al subir');
      }
    } catch (err) {
      console.error(err);
      toast.error('Ocurrió un error al subir la imagen', { id: uploadToast });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...settings,
        categoryFiltersConfig: JSON.stringify(settings.categoryFiltersConfig || cloneCategoryConfig()),
        productCardConfig: JSON.stringify(settings.productCardConfig || cloneProductCardConfig()),
        paymentMethodsConfig: JSON.stringify(settings.paymentMethodsConfig || clonePaymentMethodsConfig())
      };
      const response = await apiFetch(apiUrl('/settings'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        toast.success('Ajustes guardados correctamente');
        localStorage.setItem('settings_cache_v1', JSON.stringify({
          timestamp: new Date().getTime(),
          data: payload
        }));
      } else {
        const data = await response.json();
        toast.error(data.message || 'Error al guardar');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="settings-manager">Cargando ajustes...</div>;

  const categoryConfig = settings.categoryFiltersConfig || cloneCategoryConfig();
  const productCardConfig = settings.productCardConfig || cloneProductCardConfig();

  const updateCategoryConfig = (updater) => {
    setSettings(prev => ({
      ...prev,
      categoryFiltersConfig: updater(prev.categoryFiltersConfig || cloneCategoryConfig())
    }));
  };

  const handleCategoryStyleChange = (field, value) => {
    updateCategoryConfig((prevConfig) => ({
      ...prevConfig,
      styles: {
        ...prevConfig.styles,
        [field]: value
      }
    }));
  };

  const handleCategoryItemChange = (index, field, value) => {
    updateCategoryConfig((prevConfig) => {
      const nextCategories = [...(prevConfig.categories || [])];
      const current = nextCategories[index] || {};
      nextCategories[index] = { ...current, [field]: value };
      return { ...prevConfig, categories: nextCategories };
    });
  };

  const handleAddCategory = () => {
    updateCategoryConfig((prevConfig) => ({
      ...prevConfig,
      categories: [
        ...(prevConfig.categories || []),
        { id: `cat-${Date.now()}`, name: 'Nueva Categoría', icon: '🏷️', slug: 'nueva-categoria', image: '' }
      ]
    }));
  };

  const handleRemoveCategory = (index) => {
    updateCategoryConfig((prevConfig) => {
      const nextCategories = [...(prevConfig.categories || [])];
      nextCategories.splice(index, 1);
      return { ...prevConfig, categories: nextCategories };
    });
  };

  const handleResetCategoryFilters = () => {
    setSettings(prev => ({
      ...prev,
      categoryFiltersConfig: cloneCategoryConfig()
    }));
  };

  const updateProductCardConfig = (updater) => {
    setSettings(prev => {
      const nextConfig = updater(prev.productCardConfig || cloneProductCardConfig());
      const cachePayload = {
        ...prev,
        productCardConfig: nextConfig,
        categoryFiltersConfig: prev.categoryFiltersConfig
      };
      localStorage.setItem('settings_cache_v1', JSON.stringify({
        timestamp: new Date().getTime(),
        data: cachePayload
      }));
      return {
        ...prev,
        productCardConfig: nextConfig
      };
    });
  };

  const handleProductCardLayoutChange = (field, value) => {
    updateProductCardConfig((prevConfig) => ({
      ...prevConfig,
      layout: {
        ...prevConfig.layout,
        [field]: value
      }
    }));
  };

  const handleProductCardStyleChange = (field, value) => {
    updateProductCardConfig((prevConfig) => ({
      ...prevConfig,
      styles: {
        ...prevConfig.styles,
        [field]: value
      }
    }));
  };

  const handleResetProductCard = () => {
    setSettings(prev => ({
      ...prev,
      productCardConfig: cloneProductCardConfig()
    }));
  };

  const toggleSection = (sectionId) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  return (
    <div className="settings-manager">
      {activeSection === 'site' && (
        <div className="settings-header">
          <h2>⚙️ Ajustes del Sitio</h2>
          <p>Configura parámetros globales de la tienda.</p>
        </div>
      )}

      <form onSubmit={handleSave} className="settings-form">
        {activeSection === 'site' && (
          <div className="settings-layout">
            <nav className="settings-sidebar">
              <button
                type="button"
                className={`settings-nav-item ${siteTab === 'general' ? 'active' : ''}`}
                onClick={() => setSiteTab('general')}
              >
                🎨 General
              </button>
              <button
                type="button"
                className={`settings-nav-item ${siteTab === 'identity' ? 'active' : ''}`}
                onClick={() => setSiteTab('identity')}
              >
                🏷️ Identidad
              </button>
              <button
                type="button"
                className={`settings-nav-item ${siteTab === 'home' ? 'active' : ''}`}
                onClick={() => setSiteTab('home')}
              >
                🏠 Home
              </button>
              <button
                type="button"
                className={`settings-nav-item ${siteTab === 'cards' ? 'active' : ''}`}
                onClick={() => setSiteTab('cards')}
              >
                🃏 Tarjetas
              </button>
              <button
                type="button"
                className={`settings-nav-item ${siteTab === 'product' ? 'active' : ''}`}
                onClick={() => setSiteTab('product')}
              >
                📦 Producto
              </button>
              <button
                type="button"
                className={`settings-nav-item ${siteTab === 'filters' ? 'active' : ''}`}
                onClick={() => setSiteTab('filters')}
              >
                🔍 Filtros
              </button>
              <button
                type="button"
                className={`settings-nav-item ${siteTab === 'ecommerce' ? 'active' : ''}`}
                onClick={() => setSiteTab('ecommerce')}
              >
                🛒 E-commerce
              </button>
              <button
                type="button"
                className={`settings-nav-item ${siteTab === 'payments' ? 'active' : ''}`}
                onClick={() => setSiteTab('payments')}
              >
                💳 Pagos
              </button>
              <button
                type="button"
                className={`settings-nav-item ${siteTab === 'promos' ? 'active' : ''}`}
                onClick={() => setSiteTab('promos')}
              >
                🏷️ Promociones
              </button>
              <button
                type="button"
                className={`settings-nav-item ${siteTab === 'email' ? 'active' : ''}`}
                onClick={() => setSiteTab('email')}
              >
                ✉️ Correo
              </button>
              <button
                type="button"
                className={`settings-nav-item ${siteTab === 'database' ? 'active' : ''}`}
                onClick={() => setSiteTab('database')}
              >
                🗄️ Base de datos
              </button>
            </nav>

            <div className="settings-content">
              {siteTab === 'general' && (
                <section className="settings-section collapsible">
                  <button type="button" className="section-toggle" onClick={() => toggleSection('theme')}>
                    <span>🎨 Tema Global (Colores)</span>
                    <span className="toggle-indicator">{openSections.theme ? '−' : '+'}</span>
                  </button>
                  {openSections.theme && (
                    <>
                      <p className="section-description">Define la paleta de colores de toda la aplicación.</p>
                      <div className="settings-grid">
                        <div className="form-group">
                          <label>Color Principal (Botones, Header)</label>
                          <div className="color-input-wrapper">
                            <input type="color" name="primaryColor" value={settings.primaryColor || '#2563eb'} onChange={handleChange} />
                            <span>{settings.primaryColor}</span>
                          </div>
                        </div>

                        <div className="form-group">
                          <label>Color Secundario</label>
                          <div className="color-input-wrapper">
                            <input type="color" name="secondaryColor" value={settings.secondaryColor || '#7c3aed'} onChange={handleChange} />
                            <span>{settings.secondaryColor}</span>
                          </div>
                        </div>

                        <div className="form-group">
                          <label>Color de Acento</label>
                          <div className="color-input-wrapper">
                            <input type="color" name="accentColor" value={settings.accentColor || '#f59e0b'} onChange={handleChange} />
                            <span>{settings.accentColor}</span>
                          </div>
                        </div>

                        <div className="form-group">
                          <label>Color de Fondo</label>
                          <div className="color-input-wrapper">
                            <input type="color" name="backgroundColor" value={settings.backgroundColor || '#f8fafc'} onChange={handleChange} />
                            <span>{settings.backgroundColor}</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </section>
              )}
              {siteTab === 'home' && (
                <section className="settings-section collapsible">
                  <button type="button" className="section-toggle" onClick={() => toggleSection('home')}>
                    <span>🖥️ Página de Inicio (Home)</span>
                    <span className="toggle-indicator">{openSections.home ? '−' : '+'}</span>
                  </button>
                  {openSections.home && (
                    <>
                      <div className="form-group">
                        <label>Título Principal</label>
                        <input type="text" name="heroTitle" value={settings.heroTitle} onChange={handleChange} />
                      </div>
                      <div className="form-group">
                        <label>Descripción</label>
                        <textarea name="heroDescription" value={settings.heroDescription} onChange={handleChange} rows="2" />
                      </div>
                      <div className="form-group">
                        <label>Banner del Home</label>
                        <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'heroImage')} />
                        {settings.heroImage && (
                          <div className="settings-preview">
                            <img src={settings.heroImage} alt="Home Hero" />
                            <button type="button" onClick={() => setSettings(prev => ({ ...prev, heroImage: '' }))} className="delete-image-btn">Eliminar</button>
                          </div>
                        )}
                      </div>
                      <div className="settings-grid">
                        <div className="form-group">
                          <label>Botón Primario</label>
                          <input type="text" name="heroPrimaryBtn" value={settings.heroPrimaryBtn} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                          <label>Botón Secundario</label>
                          <input type="text" name="heroSecondaryBtn" value={settings.heroSecondaryBtn} onChange={handleChange} />
                        </div>
                      </div>
                    </>
                  )}
                </section>
              )}

              {siteTab === 'cards' && (
                <div className="cards-main-section">
                  <p className="section-description" style={{ marginBottom: '1rem' }}>
                    Configura las tarjetas de producto y la moneda.
                  </p>

                  <div className="form-group checkbox-group" style={{ marginBottom: '1rem' }}>
                    <label>
                      <input
                        type="checkbox"
                        checked={!!productCardConfig.useDefault}
                        onChange={(e) => updateProductCardConfig(prev => ({ ...prev, useDefault: e.target.checked }))}
                      />
                      Usar configuración predeterminada
                    </label>
                    <button type="button" className="settings-secondary-btn" onClick={handleResetProductCard} style={{ marginLeft: '1rem' }}>
                      Restablecer
                    </button>
                  </div>

                  {/* Sección 1: Distribución */}
                  <section className="settings-section collapsible">
                    <button type="button" className="section-toggle" onClick={() => toggleSection('cardLayout')}>
                      <span>📐 Distribución</span>
                      <span className="toggle-indicator">{openSections.cardLayout ? '−' : '+'}</span>
                    </button>
                    {openSections.cardLayout && (
                      <div className="section-content styles-compact-content">
                        <div className="style-group-content">
                          <div className="inline-field">
                            <label>Móvil</label>
                            <input type="number" value={productCardConfig.layout?.columnsMobile ?? ''} onChange={(e) => handleProductCardLayoutChange('columnsMobile', e.target.value)} disabled={productCardConfig.useDefault} min="1" max="6" />
                            <span>col</span>
                          </div>
                          <div className="inline-field">
                            <label>Tablet</label>
                            <input type="number" value={productCardConfig.layout?.columnsTablet ?? ''} onChange={(e) => handleProductCardLayoutChange('columnsTablet', e.target.value)} disabled={productCardConfig.useDefault} min="1" max="8" />
                            <span>col</span>
                          </div>
                          <div className="inline-field">
                            <label>Desktop</label>
                            <input type="number" value={productCardConfig.layout?.columnsDesktop ?? ''} onChange={(e) => handleProductCardLayoutChange('columnsDesktop', e.target.value)} disabled={productCardConfig.useDefault} min="1" max="8" />
                            <span>col</span>
                          </div>
                          <div className="inline-field">
                            <label>Wide</label>
                            <input type="number" value={productCardConfig.layout?.columnsWide ?? ''} onChange={(e) => handleProductCardLayoutChange('columnsWide', e.target.value)} disabled={productCardConfig.useDefault} min="1" max="10" />
                            <span>col</span>
                          </div>
                          <div className="inline-field">
                            <label>Orientación</label>
                            <select value={productCardConfig.layout?.orientation || 'vertical'} onChange={(e) => handleProductCardLayoutChange('orientation', e.target.value)} disabled={productCardConfig.useDefault}>
                              <option value="vertical">Vertical</option>
                              <option value="horizontal">Horizontal</option>
                            </select>
                          </div>
                          <div className="inline-field">
                            <label>Moneda</label>
                            <select value={productCardConfig.currency || 'USD'} onChange={(e) => updateProductCardConfig(prev => ({ ...prev, currency: e.target.value }))}>
                              <option value="DOP">RD (DOP)</option>
                              <option value="USD">USD</option>
                              <option value="EUR">EUR</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </section>

                  {/* Sección 2: Dimensiones y Bordes */}
                  <section className="settings-section collapsible" style={{ marginTop: '0.5rem' }}>
                    <button type="button" className="section-toggle" onClick={() => toggleSection('cardDimensions')}>
                      <span>📏 Dimensiones y Bordes</span>
                      <span className="toggle-indicator">{openSections.cardDimensions ? '−' : '+'}</span>
                    </button>
                    {openSections.cardDimensions && (
                      <div className="section-content styles-compact-content">
                        <div className="style-group-content">
                          <div className="inline-field">
                            <label>Ancho</label>
                            <input type="number" value={productCardConfig.styles?.cardWidth || ''} onChange={(e) => handleProductCardStyleChange('cardWidth', e.target.value)} disabled={productCardConfig.useDefault} />
                            <span>px</span>
                          </div>
                          <div className="inline-field">
                            <label>Alto</label>
                            <input type="number" value={productCardConfig.styles?.cardHeight || ''} onChange={(e) => handleProductCardStyleChange('cardHeight', e.target.value)} disabled={productCardConfig.useDefault} />
                            <span>px</span>
                          </div>
                          <div className="inline-field">
                            <label>Padding</label>
                            <input type="number" value={productCardConfig.styles?.cardPadding || ''} onChange={(e) => handleProductCardStyleChange('cardPadding', e.target.value)} disabled={productCardConfig.useDefault} />
                            <span>px</span>
                          </div>
                          <div className="inline-field">
                            <label>Radio</label>
                            <input type="number" value={productCardConfig.styles?.cardRadius || ''} onChange={(e) => handleProductCardStyleChange('cardRadius', e.target.value)} disabled={productCardConfig.useDefault} />
                            <span>px</span>
                          </div>
                          <div className="inline-field">
                            <label>Borde</label>
                            <input type="number" value={productCardConfig.styles?.borderWidth || ''} onChange={(e) => handleProductCardStyleChange('borderWidth', e.target.value)} disabled={productCardConfig.useDefault} />
                            <span>px</span>
                          </div>
                          <div className="inline-field">
                            <label>Estilo</label>
                            <input type="text" value={productCardConfig.styles?.borderStyle || ''} onChange={(e) => handleProductCardStyleChange('borderStyle', e.target.value)} disabled={productCardConfig.useDefault} placeholder="solid" />
                          </div>
                          <div className="color-field">
                            <input type="color" value={productCardConfig.styles?.borderColor || '#e5e7eb'} onChange={(e) => handleProductCardStyleChange('borderColor', e.target.value)} disabled={productCardConfig.useDefault} />
                            <span>Borde</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </section>

                  {/* Sección 3: Colores y Texto */}
                  <section className="settings-section collapsible" style={{ marginTop: '0.5rem' }}>
                    <button type="button" className="section-toggle" onClick={() => toggleSection('cardColors')}>
                      <span>🎨 Colores y Texto</span>
                      <span className="toggle-indicator">{openSections.cardColors ? '−' : '+'}</span>
                    </button>
                    {openSections.cardColors && (
                      <div className="section-content styles-compact-content">
                        {/* Fondo y Sombra */}
                        <details className="style-group" open>
                          <summary>🖼️ Fondo</summary>
                          <div className="style-group-content colors-row">
                            <div className="color-field">
                              <input type="color" value={productCardConfig.styles?.background || '#ffffff'} onChange={(e) => handleProductCardStyleChange('background', e.target.value)} disabled={productCardConfig.useDefault} />
                              <span>Fondo</span>
                            </div>
                            <div className="inline-field wide">
                              <label>Sombra</label>
                              <input type="text" value={productCardConfig.styles?.shadow || ''} onChange={(e) => handleProductCardStyleChange('shadow', e.target.value)} disabled={productCardConfig.useDefault} placeholder="0 1px 3px rgba(0,0,0,0.1)" />
                            </div>
                          </div>
                        </details>

                        {/* Título */}
                        <details className="style-group">
                          <summary>📝 Título</summary>
                          <div className="style-group-content colors-row">
                            <div className="color-field">
                              <input type="color" value={productCardConfig.styles?.titleColor || '#111827'} onChange={(e) => handleProductCardStyleChange('titleColor', e.target.value)} disabled={productCardConfig.useDefault} />
                              <span>Color</span>
                            </div>
                            <div className="inline-field">
                              <label>Tamaño</label>
                              <input type="number" value={productCardConfig.styles?.titleSize || ''} onChange={(e) => handleProductCardStyleChange('titleSize', e.target.value)} disabled={productCardConfig.useDefault} />
                              <span>px</span>
                            </div>
                            <div className="inline-field">
                              <label>Grosor</label>
                              <input type="number" value={productCardConfig.styles?.titleWeight || ''} onChange={(e) => handleProductCardStyleChange('titleWeight', e.target.value)} disabled={productCardConfig.useDefault} placeholder="600" />
                            </div>
                          </div>
                        </details>

                        {/* Precio */}
                        <details className="style-group">
                          <summary>💰 Precio</summary>
                          <div className="style-group-content colors-row">
                            <div className="color-field">
                              <input type="color" value={productCardConfig.styles?.priceColor || '#111827'} onChange={(e) => handleProductCardStyleChange('priceColor', e.target.value)} disabled={productCardConfig.useDefault} />
                              <span>Color</span>
                            </div>
                            <div className="inline-field">
                              <label>Tamaño</label>
                              <input type="number" value={productCardConfig.styles?.priceSize || ''} onChange={(e) => handleProductCardStyleChange('priceSize', e.target.value)} disabled={productCardConfig.useDefault} />
                              <span>px</span>
                            </div>
                            <div className="inline-field">
                              <label>Grosor</label>
                              <input type="number" value={productCardConfig.styles?.priceWeight || ''} onChange={(e) => handleProductCardStyleChange('priceWeight', e.target.value)} disabled={productCardConfig.useDefault} placeholder="700" />
                            </div>
                          </div>
                        </details>

                        {/* Descripción */}
                        <details className="style-group">
                          <summary>📄 Descripción</summary>
                          <div className="style-group-content colors-row">
                            <div className="color-field">
                              <input type="color" value={productCardConfig.styles?.descriptionColor || '#6b7280'} onChange={(e) => handleProductCardStyleChange('descriptionColor', e.target.value)} disabled={productCardConfig.useDefault} />
                              <span>Color</span>
                            </div>
                            <div className="inline-field">
                              <label>Tamaño</label>
                              <input type="number" value={productCardConfig.styles?.descriptionSize || ''} onChange={(e) => handleProductCardStyleChange('descriptionSize', e.target.value)} disabled={productCardConfig.useDefault} />
                              <span>px</span>
                            </div>
                          </div>
                        </details>

                        {/* Categoría */}
                        <details className="style-group">
                          <summary>🏷️ Categoría</summary>
                          <div className="style-group-content colors-row">
                            <div className="color-field">
                              <input type="color" value={productCardConfig.styles?.categoryColor || '#2563eb'} onChange={(e) => handleProductCardStyleChange('categoryColor', e.target.value)} disabled={productCardConfig.useDefault} />
                              <span>Color</span>
                            </div>
                            <div className="inline-field">
                              <label>Tamaño</label>
                              <input type="number" value={productCardConfig.styles?.categorySize || ''} onChange={(e) => handleProductCardStyleChange('categorySize', e.target.value)} disabled={productCardConfig.useDefault} />
                              <span>px</span>
                            </div>
                          </div>
                        </details>
                      </div>
                    )}
                  </section>

                  {/* Sección 4: Botón */}
                  <section className="settings-section collapsible" style={{ marginTop: '0.5rem' }}>
                    <button type="button" className="section-toggle" onClick={() => toggleSection('cardButton')}>
                      <span>🔘 Botón</span>
                      <span className="toggle-indicator">{openSections.cardButton ? '−' : '+'}</span>
                    </button>
                    {openSections.cardButton && (
                      <div className="section-content styles-compact-content">
                        <div className="style-group-content colors-row">
                          <div className="color-field">
                            <input type="color" value={productCardConfig.styles?.buttonBg || '#2563eb'} onChange={(e) => handleProductCardStyleChange('buttonBg', e.target.value)} disabled={productCardConfig.useDefault} />
                            <span>Fondo</span>
                          </div>
                          <div className="color-field">
                            <input type="color" value={productCardConfig.styles?.buttonText || '#ffffff'} onChange={(e) => handleProductCardStyleChange('buttonText', e.target.value)} disabled={productCardConfig.useDefault} />
                            <span>Texto</span>
                          </div>
                          <div className="inline-field">
                            <label>Radio</label>
                            <input type="number" value={productCardConfig.styles?.buttonRadius || ''} onChange={(e) => handleProductCardStyleChange('buttonRadius', e.target.value)} disabled={productCardConfig.useDefault} />
                            <span>px</span>
                          </div>
                          <div className="inline-field wide">
                            <label>Borde</label>
                            <input type="text" value={productCardConfig.styles?.buttonBorder || ''} onChange={(e) => handleProductCardStyleChange('buttonBorder', e.target.value)} disabled={productCardConfig.useDefault} placeholder="1px solid #000" />
                          </div>
                          <div className="inline-field wide">
                            <label>Sombra</label>
                            <input type="text" value={productCardConfig.styles?.buttonShadow || ''} onChange={(e) => handleProductCardStyleChange('buttonShadow', e.target.value)} disabled={productCardConfig.useDefault} placeholder="0 2px 4px rgba(0,0,0,0.1)" />
                          </div>
                        </div>
                      </div>
                    )}
                  </section>
                </div>
              )}

              {siteTab === 'product' && (
                <section className="settings-section collapsible">
                  <button type="button" className="section-toggle" onClick={() => toggleSection('product')}>
                    <span>📦 Detalle de Producto</span>
                    <span className="toggle-indicator">{openSections.product ? '−' : '+'}</span>
                  </button>
                  {openSections.product && (
                    <>
                      {/* Checkbox para usar configuración del Home */}
                      <div className="form-group checkbox-group" style={{ marginBottom: '1rem' }}>
                        <label>
                          <input
                            type="checkbox"
                            checked={settings.productDetailUseHomeHero ?? true}
                            onChange={(e) => setSettings(prev => ({ ...prev, productDetailUseHomeHero: e.target.checked }))}
                          />
                          Usar misma configuración del Hero del Home
                        </label>
                      </div>

                      {/* Si NO usa la configuración del home, mostrar opciones */}
                      {!settings.productDetailUseHomeHero && (
                        <div className="hero-settings-compact">
                          {/* Imagen del Hero */}
                          <div className="hero-image-row">
                            <div className="form-group-compact" style={{ flex: 1 }}>
                              <label>Imagen del Hero</label>
                              <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'productDetailHeroImage')} />
                            </div>
                            {settings.productDetailHeroImage && (
                              <div className="settings-preview-compact">
                                <img src={settings.productDetailHeroImage} alt="Product Hero" />
                                <button type="button" onClick={() => setSettings(prev => ({ ...prev, productDetailHeroImage: '' }))} className="delete-text-btn">eliminar</button>
                              </div>
                            )}
                          </div>

                          {/* Altura y oscurecimiento */}
                          <div className="settings-grid-3" style={{ marginTop: '0.5rem' }}>
                            <div className="form-group-compact inline-label">
                              <label>Altura <input type="number" name="productDetailHeroHeight" min="100" max="400" step="20" value={settings.productDetailHeroHeight || 200} onChange={handleChange} className="size-input-mini" />px</label>
                            </div>
                            <div className="form-group-compact inline-label">
                              <label>Oscurecer <input type="number" name="productDetailHeroOverlayOpacity" min="0" max="80" step="5" value={Math.round((settings.productDetailHeroOverlayOpacity ?? 0.5) * 100)} onChange={(e) => handleChange({ target: { name: 'productDetailHeroOverlayOpacity', value: parseFloat(e.target.value) / 100 } })} className="size-input-mini" />%</label>
                            </div>
                          </div>

                          {/* Imagen superpuesta del Banner */}
                          <div className="banner-image-section">
                            <label className="section-label">Imagen Superpuesta del Banner</label>
                            <div className="hero-image-row">
                              <div className="form-group-compact" style={{ flex: 1 }}>
                                <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'productDetailHeroBannerImage')} />
                              </div>
                              {settings.productDetailHeroBannerImage && (
                                <div className="settings-preview-compact">
                                  <img src={settings.productDetailHeroBannerImage} alt="Banner overlay" />
                                  <button type="button" onClick={() => setSettings(prev => ({ ...prev, productDetailHeroBannerImage: '' }))} className="delete-text-btn">eliminar</button>
                                </div>
                              )}
                            </div>
                            {settings.productDetailHeroBannerImage && (
                              <div className="settings-grid-4" style={{ marginTop: '0.5rem' }}>
                                <div className="form-group-compact inline-label">
                                  <label>Tamaño <input type="number" name="productDetailHeroBannerSize" min="50" max="300" step="10" value={settings.productDetailHeroBannerSize || 120} onChange={handleChange} className="size-input-mini" />px</label>
                                </div>
                                <div className="form-group-compact">
                                  <label>Pos. Horizontal</label>
                                  <select name="productDetailHeroBannerPositionX" value={settings.productDetailHeroBannerPositionX || 'right'} onChange={handleChange}>
                                    <option value="left">Izquierda</option>
                                    <option value="center">Centro</option>
                                    <option value="right">Derecha</option>
                                  </select>
                                </div>
                                <div className="form-group-compact">
                                  <label>Pos. Vertical</label>
                                  <select name="productDetailHeroBannerPositionY" value={settings.productDetailHeroBannerPositionY || 'center'} onChange={handleChange}>
                                    <option value="top">Arriba</option>
                                    <option value="center">Centro</option>
                                    <option value="bottom">Abajo</option>
                                  </select>
                                </div>
                                <div className="form-group-compact inline-label">
                                  <label>Opacidad <input type="number" name="productDetailHeroBannerOpacity" min="10" max="100" step="5" value={settings.productDetailHeroBannerOpacity || 100} onChange={handleChange} className="size-input-mini" />%</label>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {settings.productDetailUseHomeHero && (
                        <p className="field-hint" style={{ marginTop: '0.5rem' }}>Se usará la imagen y configuración del Hero del Home.</p>
                      )}
                    </>
                  )}
                </section>
              )}

              {siteTab === 'identity' && (
                <>
                  {/* Identidad y Navegación */}
                  <section className={`settings-section collapsible ${openSections.identity ? 'open' : ''}`}>
                    <button type="button" className={`section-toggle ${openSections.identity ? 'open' : ''}`} onClick={() => toggleSection('identity')}>
                      <span>🏠 Identidad y Navegación</span>
                      <span className="toggle-indicator">{openSections.identity ? '−' : '+'}</span>
                    </button>
                    {openSections.identity && (
                      <div className="identity-settings-compact">
                        {/* Nombre e Icono */}
                        <div className="settings-grid-compact">
                          <div className="form-group-compact">
                            <label>Nombre del Sitio</label>
                            <input type="text" name="siteName" value={settings.siteName} onChange={handleChange} />
                          </div>
                          <div className="form-group-compact">
                            <label>Icono (Emoji)</label>
                            <input type="text" name="siteIcon" value={settings.siteIcon} onChange={handleChange} />
                          </div>
                        </div>

                        {/* Logo y Nombre Imagen en fila */}
                        <div className="identity-images-row">
                          <div className="identity-image-block">
                            <div className="form-group-compact">
                              <label>Logo <input type="number" name="siteLogoSize" min="20" max="80" step="2" value={settings.siteLogoSize || 40} onChange={handleChange} className="size-input-mini" />px</label>
                              <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'siteLogo')} />
                            </div>
                            {settings.siteLogo && (
                              <div className="settings-preview-compact">
                                <img src={settings.siteLogo} alt="Logo" style={{ height: '30px' }} />
                                <button type="button" onClick={() => setSettings(prev => ({ ...prev, siteLogo: '' }))} className="delete-text-btn">eliminar</button>
                              </div>
                            )}
                          </div>
                          <div className="identity-image-block">
                            <div className="form-group-compact">
                              <label>Nombre <input type="number" name="siteNameImageSize" min="16" max="60" step="2" value={settings.siteNameImageSize || 32} onChange={handleChange} className="size-input-mini" />px</label>
                              <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'siteNameImage')} />
                            </div>
                            {settings.siteNameImage && (
                              <div className="settings-preview-compact">
                                <img src={settings.siteNameImage} alt="Nombre" style={{ height: '24px' }} />
                                <button type="button" onClick={() => setSettings(prev => ({ ...prev, siteNameImage: '' }))} className="delete-text-btn">eliminar</button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Transparencia */}
                        <div className="form-group-compact inline-label">
                          <label>Transparencia <input type="number" name="headerTransparency" min="0" max="100" value={settings.headerTransparency || 100} onChange={handleChange} className="size-input-mini" />%</label>
                        </div>
                      </div>
                    )}
                  </section>

                  {/* Texto del Hero */}
                  <section className={`settings-section collapsible hero-section-compact ${openSections.heroText ? 'open' : ''}`} style={{ marginTop: '0.5rem' }}>
                    <button type="button" className={`section-toggle ${openSections.heroText ? 'open' : ''}`} onClick={() => toggleSection('heroText')}>
                      <span>📝 Texto del Hero (Banner Principal)</span>
                      <span className="toggle-indicator">{openSections.heroText ? '−' : '+'}</span>
                    </button>
                    {openSections.heroText && (
                      <div className="hero-settings-compact">
                        {/* Color pickers compactos al inicio */}
                        <div className="color-pickers-row">
                          <div className="color-picker-compact" title="Color Principal (Header)">
                            <input type="color" name="headerBgColor" value={settings.headerBgColor || '#2563eb'} onChange={handleChange} />
                            <span>Principal</span>
                          </div>
                          <div className="color-picker-compact" title="Color Secundario">
                            <input type="color" name="secondaryColor" value={settings.secondaryColor || '#419579'} onChange={handleChange} />
                            <span>Secundario</span>
                          </div>
                          <div className="color-picker-compact" title="Color de Acento">
                            <input type="color" name="accentColor" value={settings.accentColor || '#901ab7'} onChange={handleChange} />
                            <span>Acento</span>
                          </div>
                          <div className="color-picker-compact" title="Color de Fondo">
                            <input type="color" name="backgroundColor" value={settings.backgroundColor || '#f8fafc'} onChange={handleChange} />
                            <span>Fondo</span>
                          </div>
                          <div className="color-picker-compact" title="Texto Hero">
                            <input type="color" name="heroTextColor" value={settings.heroTextColor || '#ffffff'} onChange={handleChange} />
                            <span>Hero</span>
                          </div>
                          <div className="color-picker-compact" title="Texto/Links Header">
                            <input type="color" name="headerTextColor" value={settings.headerTextColor || '#ffffff'} onChange={handleChange} />
                            <span>Links</span>
                          </div>
                          <div className="color-picker-compact" title="Fondo Botón">
                            <input type="color" name="headerButtonColor" value={settings.headerButtonColor || '#ffffff'} onChange={handleChange} />
                            <span>Btn Fondo</span>
                          </div>
                          <div className="color-picker-compact" title="Texto Botón">
                            <input type="color" name="headerButtonTextColor" value={settings.headerButtonTextColor || '#2563eb'} onChange={handleChange} />
                            <span>Btn Texto</span>
                          </div>
                        </div>

                        {/* Título y Descripción en grid */}
                        <div className="settings-grid-compact">
                          <div className="form-group-compact">
                            <label>Título</label>
                            <input type="text" name="heroTitle" value={settings.heroTitle || ''} onChange={handleChange} placeholder="La Mejor Tecnología..." />
                          </div>
                          <div className="form-group-compact">
                            <label>Descripción</label>
                            <input type="text" name="heroDescription" value={settings.heroDescription || ''} onChange={handleChange} placeholder="Descubre nuestra selección..." />
                          </div>
                        </div>

                        {/* Tamaños y posiciones */}
                        <div className="settings-grid-4">
                          <div className="form-group-compact inline-label">
                            <label>Título <input type="number" name="heroTitleSize" min="1" max="5" step="0.1" value={settings.heroTitleSize || 2.1} onChange={handleChange} className="size-input-mini" />rem</label>
                          </div>
                          <div className="form-group-compact inline-label">
                            <label>Desc. <input type="number" name="heroDescriptionSize" min="0.8" max="2.5" step="0.05" value={settings.heroDescriptionSize || 1.05} onChange={handleChange} className="size-input-mini" />rem</label>
                          </div>
                          <div className="form-group-compact">
                            <label>Pos. Vertical</label>
                            <select name="heroPositionY" value={settings.heroPositionY || 'center'} onChange={handleChange}>
                              <option value="flex-start">Arriba</option>
                              <option value="center">Centro</option>
                              <option value="flex-end">Abajo</option>
                            </select>
                          </div>
                          <div className="form-group-compact">
                            <label>Pos. Horizontal</label>
                            <select name="heroPositionX" value={settings.heroPositionX || 'left'} onChange={handleChange}>
                              <option value="left">Izquierda</option>
                              <option value="center">Centro</option>
                              <option value="right">Derecha</option>
                            </select>
                          </div>
                        </div>

                        {/* Imagen y ajustes */}
                        <div className="hero-image-row">
                          <div className="form-group-compact" style={{ flex: 1 }}>
                            <label>Imagen del Hero</label>
                            <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'heroImage')} />
                          </div>
                          {settings.heroImage && (
                            <div className="settings-preview-compact">
                              <img src={settings.heroImage} alt="Hero" />
                              <button type="button" onClick={() => setSettings(prev => ({ ...prev, heroImage: '' }))} className="delete-text-btn">eliminar</button>
                            </div>
                          )}
                        </div>

                        {/* Altura, ancho y oscurecimiento */}
                        <div className="settings-grid-3">
                          <div className="form-group-compact inline-label">
                            <label>Altura <input type="number" name="heroHeight" min="200" max="600" step="20" value={settings.heroHeight || 360} onChange={handleChange} className="size-input-mini" />px</label>
                          </div>
                          <div className="form-group-compact inline-label">
                            <label>Ancho <input type="number" name="heroImageWidth" min="50" max="100" step="5" value={settings.heroImageWidth || 100} onChange={handleChange} className="size-input-mini" />%</label>
                          </div>
                          <div className="form-group-compact inline-label">
                            <label>Oscurecer <input type="number" name="heroOverlayOpacity" min="0" max="80" step="5" value={Math.round((settings.heroOverlayOpacity ?? 0.5) * 100)} onChange={(e) => handleChange({ target: { name: 'heroOverlayOpacity', value: parseFloat(e.target.value) / 100 } })} className="size-input-mini" />%</label>
                          </div>
                        </div>

                        {/* Imagen superpuesta del Banner */}
                        <div className="banner-image-section">
                          <label className="section-label">Imagen Superpuesta del Banner</label>
                          <div className="hero-image-row">
                            <div className="form-group-compact" style={{ flex: 1 }}>
                              <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'heroBannerImage')} />
                            </div>
                            {settings.heroBannerImage && (
                              <div className="settings-preview-compact">
                                <img src={settings.heroBannerImage} alt="Banner overlay" />
                                <button type="button" onClick={() => setSettings(prev => ({ ...prev, heroBannerImage: '' }))} className="delete-text-btn">eliminar</button>
                              </div>
                            )}
                          </div>
                          {settings.heroBannerImage && (
                            <div className="settings-grid-4" style={{ marginTop: '0.5rem' }}>
                              <div className="form-group-compact inline-label">
                                <label>Tamaño <input type="number" name="heroBannerSize" min="50" max="500" step="10" value={settings.heroBannerSize || 150} onChange={handleChange} className="size-input-mini" />px</label>
                              </div>
                              <div className="form-group-compact">
                                <label>Pos. Horizontal</label>
                                <select name="heroBannerPositionX" value={settings.heroBannerPositionX || 'right'} onChange={handleChange}>
                                  <option value="left">Izquierda</option>
                                  <option value="center">Centro</option>
                                  <option value="right">Derecha</option>
                                </select>
                              </div>
                              <div className="form-group-compact">
                                <label>Pos. Vertical</label>
                                <select name="heroBannerPositionY" value={settings.heroBannerPositionY || 'center'} onChange={handleChange}>
                                  <option value="top">Arriba</option>
                                  <option value="center">Centro</option>
                                  <option value="bottom">Abajo</option>
                                </select>
                              </div>
                              <div className="form-group-compact inline-label">
                                <label>Opacidad <input type="number" name="heroBannerOpacity" min="10" max="100" step="5" value={settings.heroBannerOpacity || 100} onChange={handleChange} className="size-input-mini" />%</label>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </section>
                </>
              )}

              {siteTab === 'payments' && (
                <div className="payments-main-section">
                  <p className="section-description" style={{ marginBottom: '1rem' }}>
                    Configura qué métodos de pago estarán disponibles en el checkout.
                    Solo los métodos habilitados se mostrarán a los clientes.
                  </p>

                  {/* Sección 1: Pago Contra Entrega */}
                  <section className="settings-section collapsible">
                    <button type="button" className="section-toggle" onClick={() => toggleSection('paymentCash')}>
                      <span className="payment-toggle-header">
                        <span>💵 Pago Contra Entrega</span>
                        <span className={`status-badge-inline ${settings.paymentMethodsConfig?.cash?.enabled ? 'active' : ''}`}>
                          {settings.paymentMethodsConfig?.cash?.enabled ? 'Activo' : 'Inactivo'}
                        </span>
                      </span>
                      <span className="toggle-indicator">{openSections.paymentCash ? '−' : '+'}</span>
                    </button>
                    {openSections.paymentCash && (
                      <div className="section-content">
                        <div className="form-group checkbox-group">
                          <label>
                            <input
                              type="checkbox"
                              checked={settings.paymentMethodsConfig?.cash?.enabled ?? true}
                              onChange={(e) => setSettings(prev => ({
                                ...prev,
                                paymentMethodsConfig: {
                                  ...prev.paymentMethodsConfig,
                                  cash: { ...prev.paymentMethodsConfig?.cash, enabled: e.target.checked }
                                }
                              }))}
                            />
                            Habilitar este método de pago
                          </label>
                        </div>
                        <div className="form-group">
                          <label>Descripción</label>
                          <input
                            type="text"
                            value={settings.paymentMethodsConfig?.cash?.description || ''}
                            onChange={(e) => setSettings(prev => ({
                              ...prev,
                              paymentMethodsConfig: {
                                ...prev.paymentMethodsConfig,
                                cash: { ...prev.paymentMethodsConfig?.cash, description: e.target.value }
                              }
                            }))}
                            placeholder="Paga en efectivo cuando recibas tu pedido"
                          />
                        </div>
                      </div>
                    )}
                  </section>

                  {/* Sección 2: Transferencia Bancaria */}
                  <section className="settings-section collapsible" style={{ marginTop: '0.5rem' }}>
                    <button type="button" className="section-toggle" onClick={() => toggleSection('paymentTransfer')}>
                      <span className="payment-toggle-header">
                        <span>🏦 Transferencia Bancaria</span>
                        <span className={`status-badge-inline ${settings.paymentMethodsConfig?.transfer?.enabled ? 'active' : ''}`}>
                          {settings.paymentMethodsConfig?.transfer?.enabled ? 'Activo' : 'Inactivo'}
                        </span>
                      </span>
                      <span className="toggle-indicator">{openSections.paymentTransfer ? '−' : '+'}</span>
                    </button>
                    {openSections.paymentTransfer && (
                      <div className="section-content">
                        <div className="form-group checkbox-group">
                          <label>
                            <input
                              type="checkbox"
                              checked={settings.paymentMethodsConfig?.transfer?.enabled ?? true}
                              onChange={(e) => setSettings(prev => ({
                                ...prev,
                                paymentMethodsConfig: {
                                  ...prev.paymentMethodsConfig,
                                  transfer: { ...prev.paymentMethodsConfig?.transfer, enabled: e.target.checked }
                                }
                              }))}
                            />
                            Habilitar este método de pago
                          </label>
                        </div>
                        <div className="form-group">
                          <label>Descripción</label>
                          <input
                            type="text"
                            value={settings.paymentMethodsConfig?.transfer?.description || ''}
                            onChange={(e) => setSettings(prev => ({
                              ...prev,
                              paymentMethodsConfig: {
                                ...prev.paymentMethodsConfig,
                                transfer: { ...prev.paymentMethodsConfig?.transfer, description: e.target.value }
                              }
                            }))}
                            placeholder="Transferencia o depósito bancario"
                          />
                        </div>
                        <div className="settings-grid">
                          <div className="form-group">
                            <label>Nombre del Banco</label>
                            <input
                              type="text"
                              value={settings.paymentMethodsConfig?.transfer?.bankName || ''}
                              onChange={(e) => setSettings(prev => ({
                                ...prev,
                                paymentMethodsConfig: {
                                  ...prev.paymentMethodsConfig,
                                  transfer: { ...prev.paymentMethodsConfig?.transfer, bankName: e.target.value }
                                }
                              }))}
                              placeholder="Ej: Banco Popular"
                            />
                          </div>
                          <div className="form-group">
                            <label>Titular de la Cuenta</label>
                            <input
                              type="text"
                              value={settings.paymentMethodsConfig?.transfer?.bankHolder || ''}
                              onChange={(e) => setSettings(prev => ({
                                ...prev,
                                paymentMethodsConfig: {
                                  ...prev.paymentMethodsConfig,
                                  transfer: { ...prev.paymentMethodsConfig?.transfer, bankHolder: e.target.value }
                                }
                              }))}
                              placeholder="Ej: Mi Tienda Online SRL"
                            />
                          </div>
                          <div className="form-group">
                            <label>Cuenta / CLABE / Link de Pago</label>
                            <input
                              type="text"
                              value={settings.paymentMethodsConfig?.transfer?.bankAccount || ''}
                              onChange={(e) => setSettings(prev => ({
                                ...prev,
                                paymentMethodsConfig: {
                                  ...prev.paymentMethodsConfig,
                                  transfer: { ...prev.paymentMethodsConfig?.transfer, bankAccount: e.target.value }
                                }
                              }))}
                              placeholder="Ej: 1234-5678-9012-3456"
                            />
                          </div>
                        </div>
                        <div className="form-group">
                          <label>Nota Importante (instrucciones de pago)</label>
                          <textarea
                            value={settings.paymentMethodsConfig?.transfer?.transferNote || ''}
                            onChange={(e) => setSettings(prev => ({
                              ...prev,
                              paymentMethodsConfig: {
                                ...prev.paymentMethodsConfig,
                                transfer: { ...prev.paymentMethodsConfig?.transfer, transferNote: e.target.value }
                              }
                            }))}
                            placeholder="Ej: Envía tu comprobante de pago por WhatsApp al 829-000-0000 indicando tu número de orden."
                            rows="2"
                          />
                        </div>
                      </div>
                    )}
                  </section>

                  {/* Sección 3: Stripe */}
                  <section className="settings-section collapsible" style={{ marginTop: '0.5rem' }}>
                    <button type="button" className="section-toggle" onClick={() => toggleSection('paymentStripe')}>
                      <span className="payment-toggle-header">
                        <span>💳 Stripe</span>
                        <span className={`status-badge-inline ${settings.paymentMethodsConfig?.stripe?.enabled ? 'active' : ''}`}>
                          {settings.paymentMethodsConfig?.stripe?.enabled ? 'Activo' : 'Inactivo'}
                        </span>
                      </span>
                      <span className="toggle-indicator">{openSections.paymentStripe ? '−' : '+'}</span>
                    </button>
                    {openSections.paymentStripe && (
                      <div className="section-content">
                        <div className="form-group checkbox-group">
                          <label>
                            <input
                              type="checkbox"
                              checked={settings.paymentMethodsConfig?.stripe?.enabled ?? true}
                              onChange={(e) => setSettings(prev => ({
                                ...prev,
                                paymentMethodsConfig: {
                                  ...prev.paymentMethodsConfig,
                                  stripe: { ...prev.paymentMethodsConfig?.stripe, enabled: e.target.checked }
                                }
                              }))}
                            />
                            Habilitar este método de pago
                          </label>
                        </div>
                        <div className="form-group">
                          <label>Descripción</label>
                          <input
                            type="text"
                            value={settings.paymentMethodsConfig?.stripe?.description || ''}
                            onChange={(e) => setSettings(prev => ({
                              ...prev,
                              paymentMethodsConfig: {
                                ...prev.paymentMethodsConfig,
                                stripe: { ...prev.paymentMethodsConfig?.stripe, description: e.target.value }
                              }
                            }))}
                            placeholder="Visa, MasterCard, American Express"
                          />
                        </div>
                        
                        {/* Stripe API Keys Configuration */}
                        <div className="stripe-config-section">
                          <h4 className="stripe-config-title">🔑 Credenciales de Stripe</h4>
                          
                          <div className="form-group">
                            <label className="flex-label">
                              Modo de Pruebas
                              <span className={`mode-badge ${settings.paymentMethodsConfig?.stripe?.testMode !== false ? 'test' : 'live'}`}>
                                {settings.paymentMethodsConfig?.stripe?.testMode !== false ? '🧪 Test' : '🔴 Producción'}
                              </span>
                            </label>
                            <div className="toggle-switch-container">
                              <label className="toggle-switch">
                                <input
                                  type="checkbox"
                                  checked={settings.paymentMethodsConfig?.stripe?.testMode !== false}
                                  onChange={(e) => setSettings(prev => ({
                                    ...prev,
                                    paymentMethodsConfig: {
                                      ...prev.paymentMethodsConfig,
                                      stripe: { ...prev.paymentMethodsConfig?.stripe, testMode: e.target.checked }
                                    }
                                  }))}
                                />
                                <span className="toggle-slider"></span>
                              </label>
                              <span className="toggle-label-text">
                                {settings.paymentMethodsConfig?.stripe?.testMode !== false 
                                  ? 'Usa claves de prueba (pk_test_, sk_test_)' 
                                  : 'Usa claves de producción (pk_live_, sk_live_)'}
                              </span>
                            </div>
                          </div>
                          
                          <div className="form-group">
                            <label>
                              Clave Pública (Publishable Key)
                              <span className="key-hint">{settings.paymentMethodsConfig?.stripe?.testMode !== false ? 'pk_test_...' : 'pk_live_...'}</span>
                            </label>
                            <input
                              type="text"
                              value={settings.stripePublishableKey || ''}
                              onChange={(e) => setSettings(prev => ({
                                ...prev,
                                stripePublishableKey: e.target.value
                              }))}
                              placeholder={settings.paymentMethodsConfig?.stripe?.testMode !== false ? 'pk_test_xxxxxxxxxxxx' : 'pk_live_xxxxxxxxxxxx'}
                              className="stripe-key-input"
                            />
                          </div>
                          
                          <div className="form-group">
                            <label>
                              Clave Secreta (Secret Key)
                              <span className="key-hint">{settings.paymentMethodsConfig?.stripe?.testMode !== false ? 'sk_test_...' : 'sk_live_...'}</span>
                            </label>
                            <input
                              type="password"
                              value={settings.stripeSecretKey || ''}
                              onChange={(e) => setSettings(prev => ({
                                ...prev,
                                stripeSecretKey: e.target.value
                              }))}
                              placeholder={settings.stripeSecretKey === '********' ? '••••••••' : (settings.paymentMethodsConfig?.stripe?.testMode !== false ? 'sk_test_xxxxxxxxxxxx' : 'sk_live_xxxxxxxxxxxx')}
                              className="stripe-key-input"
                            />
                            <p className="helper-text warning">
                              🔒 La clave secreta se guarda encriptada y nunca se muestra.
                            </p>
                          </div>
                          
                          <p className="helper-text">
                            📋 Obtén tus claves en <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer">dashboard.stripe.com/apikeys</a>
                          </p>
                        </div>
                      </div>
                    )}
                  </section>

                  {/* Sección 4: PayPal */}
                  <section className="settings-section collapsible" style={{ marginTop: '0.5rem' }}>
                    <button type="button" className="section-toggle" onClick={() => toggleSection('paymentPaypal')}>
                      <span className="payment-toggle-header">
                        <span>🅿️ PayPal</span>
                        <span className={`status-badge-inline ${settings.paymentMethodsConfig?.paypal?.enabled ? 'active' : ''}`}>
                          {settings.paymentMethodsConfig?.paypal?.enabled ? 'Activo' : 'Inactivo'}
                        </span>
                      </span>
                      <span className="toggle-indicator">{openSections.paymentPaypal ? '−' : '+'}</span>
                    </button>
                    {openSections.paymentPaypal && (
                      <div className="section-content">
                        <div className="form-group checkbox-group">
                          <label>
                            <input
                              type="checkbox"
                              checked={settings.paymentMethodsConfig?.paypal?.enabled ?? false}
                              onChange={(e) => setSettings(prev => ({
                                ...prev,
                                paymentMethodsConfig: {
                                  ...prev.paymentMethodsConfig,
                                  paypal: { ...prev.paymentMethodsConfig?.paypal, enabled: e.target.checked }
                                }
                              }))}
                            />
                            Habilitar este método de pago
                          </label>
                        </div>
                        <div className="form-group">
                          <label>Descripción</label>
                          <input
                            type="text"
                            value={settings.paymentMethodsConfig?.paypal?.description || ''}
                            onChange={(e) => setSettings(prev => ({
                              ...prev,
                              paymentMethodsConfig: {
                                ...prev.paymentMethodsConfig,
                                paypal: { ...prev.paymentMethodsConfig?.paypal, description: e.target.value }
                              }
                            }))}
                            placeholder="Paga con tu cuenta PayPal"
                          />
                        </div>
                        
                        {/* PayPal API Configuration */}
                        <div className="stripe-config-section paypal-config-section">
                          <h4 className="stripe-config-title">🔑 Credenciales de PayPal</h4>
                          
                          <div className="form-group">
                            <label className="flex-label">
                              Modo de Pruebas
                              <span className={`mode-badge ${settings.paymentMethodsConfig?.paypal?.testMode !== false ? 'test' : 'live'}`}>
                                {settings.paymentMethodsConfig?.paypal?.testMode !== false ? '🧪 Sandbox' : '🔴 Producción'}
                              </span>
                            </label>
                            <div className="toggle-switch-container">
                              <label className="toggle-switch">
                                <input
                                  type="checkbox"
                                  checked={settings.paymentMethodsConfig?.paypal?.testMode !== false}
                                  onChange={(e) => setSettings(prev => ({
                                    ...prev,
                                    paymentMethodsConfig: {
                                      ...prev.paymentMethodsConfig,
                                      paypal: { ...prev.paymentMethodsConfig?.paypal, testMode: e.target.checked }
                                    }
                                  }))}
                                />
                                <span className="toggle-slider"></span>
                              </label>
                              <span className="toggle-label-text">
                                {settings.paymentMethodsConfig?.paypal?.testMode !== false 
                                  ? 'Usa credenciales de Sandbox' 
                                  : 'Usa credenciales de Producción'}
                              </span>
                            </div>
                          </div>
                          
                          <div className="form-group">
                            <label>
                              Client ID
                              <span className="key-hint">ID de la aplicación</span>
                            </label>
                            <input
                              type="text"
                              value={settings.paypalClientId || ''}
                              onChange={(e) => setSettings(prev => ({
                                ...prev,
                                paypalClientId: e.target.value
                              }))}
                              placeholder="AX..."
                              className="stripe-key-input"
                            />
                          </div>
                          
                          <div className="form-group">
                            <label>
                              Client Secret
                              <span className="key-hint">Secreto de la aplicación</span>
                            </label>
                            <input
                              type="password"
                              value={settings.paypalClientSecret || ''}
                              onChange={(e) => setSettings(prev => ({
                                ...prev,
                                paypalClientSecret: e.target.value
                              }))}
                              placeholder={settings.paypalClientSecret === '********' ? '••••••••' : 'EL...'}
                              className="stripe-key-input"
                            />
                            <p className="helper-text warning">
                              🔒 El Client Secret se guarda encriptado y nunca se muestra.
                            </p>
                          </div>
                          
                          <p className="helper-text">
                            📋 Obtén tus credenciales en <a href="https://developer.paypal.com/dashboard/applications" target="_blank" rel="noopener noreferrer">developer.paypal.com</a>
                          </p>
                        </div>
                      </div>
                    )}
                  </section>
                </div>
              )}

              {siteTab === 'ecommerce' && (
                <section className="settings-section collapsible">
                  <button type="button" className="section-toggle" onClick={() => toggleSection('ecommerce')}>
                    <span>⚙️ E-commerce y Otros</span>
                    <span className="toggle-indicator">{openSections.ecommerce ? '−' : '+'}</span>
                  </button>
                  {openSections.ecommerce && (
                    <>
                      <div className="form-group">
                        <label>Email de Contacto</label>
                        <input type="email" name="contactEmail" value={settings.contactEmail} onChange={handleChange} />
                      </div>
                      <div className="form-group">
                        <label>Umbral Envío Gratis ($)</label>
                        <input type="number" name="freeShippingThreshold" value={settings.freeShippingThreshold} onChange={handleChange} />
                      </div>
                      <div className="form-group checkbox-group">
                        <label>
                          <input type="checkbox" name="maintenanceMode" checked={settings.maintenanceMode} onChange={handleChange} />
                          Activar Modo Mantenimiento
                        </label>
                      </div>
                    </>
                  )}
                </section>
              )}

              {siteTab === 'promos' && (
                <section className="settings-section collapsible">
                  <button type="button" className="section-toggle" onClick={() => toggleSection('promos')}>
                    <span>Promociones</span>
                    <span className="toggle-indicator">{openSections.promos ? '−' : '+'}</span>
                  </button>
                  {openSections.promos && (
                    <>
                      <div className="form-group checkbox-group">
                        <label>
                          <input 
                            type="checkbox" 
                            name="showPromotionBanner" 
                            checked={settings.showPromotionBanner} 
                            onChange={handleChange} 
                          />
                          Mostrar Banner de Promoción
                        </label>
                      </div>
                      <div className="form-group">
                        <label>Texto de la Promoción</label>
                        <textarea 
                          name="promoText" 
                          value={settings.promoText} 
                          onChange={handleChange}
                          rows="2"
                        />
                      </div>
                    </>
                  )}
                </section>
              )}

              {siteTab === 'filters' && (
                <div className="filters-main-section">
                  <p className="section-description" style={{ marginBottom: '1rem' }}>
                    Administra las categorías del Home y personaliza su estilo.
                  </p>

                  <div className="form-group checkbox-group" style={{ marginBottom: '1rem' }}>
                    <label>
                      <input
                        type="checkbox"
                        checked={!!categoryConfig.useDefault}
                        onChange={(e) => updateCategoryConfig(prev => ({ ...prev, useDefault: e.target.checked }))}
                      />
                      Usar configuración predeterminada
                    </label>
                    <button type="button" className="settings-secondary-btn" onClick={handleResetCategoryFilters} style={{ marginLeft: '1rem' }}>
                      Restablecer
                    </button>
                  </div>

                  {/* Sección 1: Filtros por Categoría */}
                  <section className="settings-section collapsible">
                    <button type="button" className="section-toggle" onClick={() => toggleSection('filterCategories')}>
                      <span>🧩 Filtros por Categoría</span>
                      <span className="toggle-indicator">{openSections.filterCategories ? '−' : '+'}</span>
                    </button>
                    {openSections.filterCategories && (
                      <div className="section-content">
                        <div className="category-settings-list compact">
                          {categoryConfig.categories?.map((category, index) => {
                            const isExpanded = expandedCategories[index];
                            return (
                              <div key={category.id || `${category.slug}-${index}`} className={`category-settings-card compact ${isExpanded ? 'expanded' : ''}`}>
                                <div 
                                  className="category-card-header"
                                  onClick={() => setExpandedCategories(prev => ({ ...prev, [index]: !prev[index] }))}
                                >
                                  <span className="category-preview">
                                    <span className="category-icon">{category.icon || '📌'}</span>
                                    <span className="category-name">{category.name || 'Sin nombre'}</span>
                                    <span className="category-slug">({category.slug})</span>
                                  </span>
                                  <span className="category-expand-icon">{isExpanded ? '▲' : '▼'}</span>
                                </div>
                                {isExpanded && (
                                  <div className="category-card-body">
                                    <div className="settings-grid">
                                      <div className="form-group">
                                        <label>Nombre</label>
                                        <input
                                          type="text"
                                          value={category.name || ''}
                                          onChange={(e) => handleCategoryItemChange(index, 'name', e.target.value)}
                                          disabled={categoryConfig.useDefault}
                                        />
                                      </div>
                                      <div className="form-group">
                                        <label>Slug (valor de filtro)</label>
                                        <input
                                          type="text"
                                          value={category.slug || ''}
                                          onChange={(e) => handleCategoryItemChange(index, 'slug', e.target.value)}
                                          disabled={categoryConfig.useDefault || category.slug === 'todos'}
                                        />
                                      </div>
                                      <div className="form-group">
                                        <label>Emoji</label>
                                        <input
                                          type="text"
                                          value={category.icon || ''}
                                          onChange={(e) => handleCategoryItemChange(index, 'icon', e.target.value)}
                                          disabled={categoryConfig.useDefault}
                                        />
                                      </div>
                                      <div className="form-group">
                                        <label>Imagen (URL)</label>
                                        <input
                                          type="text"
                                          value={category.image || ''}
                                          onChange={(e) => handleCategoryItemChange(index, 'image', e.target.value)}
                                          disabled={categoryConfig.useDefault}
                                        />
                                      </div>
                                    </div>
                                    <div className="category-settings-actions">
                                      <button
                                        type="button"
                                        className="settings-danger-btn"
                                        onClick={() => handleRemoveCategory(index)}
                                        disabled={categoryConfig.useDefault || category.slug === 'todos'}
                                      >
                                        Eliminar
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          className="settings-secondary-btn"
                          onClick={handleAddCategory}
                          disabled={categoryConfig.useDefault}
                          style={{ marginTop: '0.75rem' }}
                        >
                          + Agregar categoría
                        </button>
                      </div>
                    )}
                  </section>

                  {/* Sección 2: Estilos globales */}
                  <section className="settings-section collapsible" style={{ marginTop: '1rem' }}>
                    <button type="button" className="section-toggle" onClick={() => toggleSection('filterStyles')}>
                      <span>🎨 Estilos globales</span>
                      <span className="toggle-indicator">{openSections.filterStyles ? '−' : '+'}</span>
                    </button>
                    {openSections.filterStyles && (
                      <div className="section-content styles-compact-content">
                        {/* Dimensiones */}
                        <details className="style-group">
                          <summary>📐 Dimensiones</summary>
                          <div className="style-group-content">
                            <div className="inline-field">
                              <label>Ancho</label>
                              <input type="number" value={categoryConfig.styles?.cardWidth || ''} onChange={(e) => handleCategoryStyleChange('cardWidth', e.target.value)} disabled={categoryConfig.useDefault} />
                              <span>px</span>
                            </div>
                            <div className="inline-field">
                              <label>Alto</label>
                              <input type="number" value={categoryConfig.styles?.cardHeight || ''} onChange={(e) => handleCategoryStyleChange('cardHeight', e.target.value)} disabled={categoryConfig.useDefault} />
                              <span>px</span>
                            </div>
                            <div className="inline-field">
                              <label>Padding</label>
                              <input type="number" value={categoryConfig.styles?.cardPadding || ''} onChange={(e) => handleCategoryStyleChange('cardPadding', e.target.value)} disabled={categoryConfig.useDefault} />
                              <span>px</span>
                            </div>
                            <div className="inline-field">
                              <label>Radio</label>
                              <input type="number" value={categoryConfig.styles?.cardRadius || ''} onChange={(e) => handleCategoryStyleChange('cardRadius', e.target.value)} disabled={categoryConfig.useDefault} />
                              <span>px</span>
                            </div>
                          </div>
                        </details>

                        {/* Colores base */}
                        <details className="style-group">
                          <summary>🎨 Colores base</summary>
                          <div className="style-group-content colors-row">
                            <div className="color-field">
                              <input type="color" value={categoryConfig.styles?.cardBackground || '#f8fafc'} onChange={(e) => handleCategoryStyleChange('cardBackground', e.target.value)} disabled={categoryConfig.useDefault} />
                              <span>Fondo</span>
                            </div>
                            <div className="color-field">
                              <input type="color" value={categoryConfig.styles?.cardBorderColor || '#e2e8f0'} onChange={(e) => handleCategoryStyleChange('cardBorderColor', e.target.value)} disabled={categoryConfig.useDefault} />
                              <span>Borde</span>
                            </div>
                            <div className="color-field">
                              <input type="color" value={categoryConfig.styles?.titleColor || '#1f2937'} onChange={(e) => handleCategoryStyleChange('titleColor', e.target.value)} disabled={categoryConfig.useDefault} />
                              <span>Texto</span>
                            </div>
                          </div>
                        </details>

                        {/* Estado Hover */}
                        <details className="style-group">
                          <summary>👆 Estado Hover</summary>
                          <div className="style-group-content colors-row">
                            <div className="color-field">
                              <input type="color" value={categoryConfig.styles?.hoverBackground || '#eff6ff'} onChange={(e) => handleCategoryStyleChange('hoverBackground', e.target.value)} disabled={categoryConfig.useDefault} />
                              <span>Fondo</span>
                            </div>
                            <div className="color-field">
                              <input type="color" value={categoryConfig.styles?.hoverTitleColor || '#2563eb'} onChange={(e) => handleCategoryStyleChange('hoverTitleColor', e.target.value)} disabled={categoryConfig.useDefault} />
                              <span>Texto</span>
                            </div>
                            <div className="inline-field small">
                              <label>Borde</label>
                              <input type="text" value={categoryConfig.styles?.hoverBorderColor || ''} onChange={(e) => handleCategoryStyleChange('hoverBorderColor', e.target.value)} disabled={categoryConfig.useDefault} placeholder="#color" />
                            </div>
                            <div className="inline-field small">
                              <label>Sombra</label>
                              <input type="text" value={categoryConfig.styles?.hoverShadow || ''} onChange={(e) => handleCategoryStyleChange('hoverShadow', e.target.value)} disabled={categoryConfig.useDefault} placeholder="0 2px 8px..." />
                            </div>
                          </div>
                        </details>

                        {/* Estado Activo */}
                        <details className="style-group">
                          <summary>✅ Estado Activo</summary>
                          <div className="style-group-content colors-row">
                            <div className="color-field">
                              <input type="color" value={categoryConfig.styles?.activeTitleColor || '#ffffff'} onChange={(e) => handleCategoryStyleChange('activeTitleColor', e.target.value)} disabled={categoryConfig.useDefault} />
                              <span>Texto</span>
                            </div>
                            <div className="inline-field small">
                              <label>Fondo</label>
                              <input type="text" value={categoryConfig.styles?.activeBackground || ''} onChange={(e) => handleCategoryStyleChange('activeBackground', e.target.value)} disabled={categoryConfig.useDefault} placeholder="gradient o #color" />
                            </div>
                            <div className="inline-field small">
                              <label>Borde</label>
                              <input type="text" value={categoryConfig.styles?.activeBorderColor || ''} onChange={(e) => handleCategoryStyleChange('activeBorderColor', e.target.value)} disabled={categoryConfig.useDefault} placeholder="#color" />
                            </div>
                            <div className="inline-field small">
                              <label>Sombra</label>
                              <input type="text" value={categoryConfig.styles?.activeShadow || ''} onChange={(e) => handleCategoryStyleChange('activeShadow', e.target.value)} disabled={categoryConfig.useDefault} placeholder="0 2px 8px..." />
                            </div>
                          </div>
                        </details>

                        {/* Tipografía */}
                        <details className="style-group">
                          <summary>✏️ Tipografía</summary>
                          <div className="style-group-content">
                            <div className="inline-field">
                              <label>Tamaño</label>
                              <input type="number" value={categoryConfig.styles?.titleSize || ''} onChange={(e) => handleCategoryStyleChange('titleSize', e.target.value)} disabled={categoryConfig.useDefault} />
                              <span>px</span>
                            </div>
                            <div className="inline-field">
                              <label>Grosor</label>
                              <input type="number" value={categoryConfig.styles?.titleWeight || ''} onChange={(e) => handleCategoryStyleChange('titleWeight', e.target.value)} disabled={categoryConfig.useDefault} placeholder="600" />
                            </div>
                            <div className="inline-field">
                              <label>Espaciado</label>
                              <input type="number" value={categoryConfig.styles?.titleLetterSpacing || ''} onChange={(e) => handleCategoryStyleChange('titleLetterSpacing', e.target.value)} disabled={categoryConfig.useDefault} />
                              <span>px</span>
                            </div>
                            <div className="inline-field">
                              <label>Transformar</label>
                              <select value={categoryConfig.styles?.titleTransform || ''} onChange={(e) => handleCategoryStyleChange('titleTransform', e.target.value)} disabled={categoryConfig.useDefault}>
                                <option value="">Normal</option>
                                <option value="uppercase">MAYÚSCULAS</option>
                                <option value="capitalize">Capitalizar</option>
                                <option value="lowercase">minúsculas</option>
                              </select>
                            </div>
                          </div>
                        </details>

                        {/* Icono y Sombra */}
                        <details className="style-group">
                          <summary>🔧 Otros</summary>
                          <div className="style-group-content">
                            <div className="inline-field">
                              <label>Tamaño icono</label>
                              <input type="number" value={categoryConfig.styles?.iconSize || ''} onChange={(e) => handleCategoryStyleChange('iconSize', e.target.value)} disabled={categoryConfig.useDefault} />
                              <span>px</span>
                            </div>
                            <div className="inline-field wide">
                              <label>Sombra base</label>
                              <input type="text" value={categoryConfig.styles?.cardShadow || ''} onChange={(e) => handleCategoryStyleChange('cardShadow', e.target.value)} disabled={categoryConfig.useDefault} placeholder="0 1px 3px rgba(0,0,0,0.1)" />
                            </div>
                          </div>
                        </details>
                      </div>
                    )}
                  </section>
                </div>
              )}

              {siteTab === 'email' && (
                <EmailSettingsSection settings={settings} onChange={handleChange} setSettings={setSettings} />
              )}

              {siteTab === 'database' && (
                <DatabaseSection settings={settings} onChange={handleChange} setSettings={setSettings} />
              )}

            </div>
          </div>
        )}

          <div className="form-actions">
            <button type="submit" className="save-settings-btn" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    );
}

export default SettingsManager;
