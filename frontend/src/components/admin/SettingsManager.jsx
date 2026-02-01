import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { apiFetch, apiUrl } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import './SettingsManager.css';
import EmailSettingsSection from './EmailSettingsSection';
import { DEFAULT_CATEGORY_FILTERS_CONFIG, DEFAULT_PRODUCT_CARD_CONFIG } from '../../config';

function SettingsManager() {
  const location = useLocation();
  const [_menuOpen, _setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('site');
  const [siteTab, setSiteTab] = useState('general');
  const [openSections, setOpenSections] = useState({
    theme: true,
    home: true,
    product: true,
    identity: true,
    ecommerce: true,
    promos: true,
    filters: true,
    productCards: true
  });
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
      bankInfo: ''
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
    categoryFiltersConfig: cloneCategoryConfig(),
    productCardConfig: cloneProductCardConfig(),
    paymentMethodsConfig: clonePaymentMethodsConfig(),
    // Stripe API Keys (stored separately for encryption)
    stripePublishableKey: '',
    stripeSecretKey: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const hash = location.hash?.replace('#', '').trim();
    if (hash === 'email' || hash === 'site') {
      setActiveSection(hash);
    }
  }, [location.hash]);

  useEffect(() => {
    if (activeSection === 'site') {
      setSiteTab('general');
    }
  }, [activeSection]);

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
          <>
            <div className="settings-subtabs">
                <button
                  type="button"
                  className={`settings-subtab ${siteTab === 'general' ? 'active' : ''}`}
                  onClick={() => setSiteTab('general')}
                >
                  General
                </button>
                <button
                  type="button"
                  className={`settings-subtab ${siteTab === 'home' ? 'active' : ''}`}
                  onClick={() => setSiteTab('home')}
                >
                  Home
                </button>
                <button
                  type="button"
                  className={`settings-subtab ${siteTab === 'cards' ? 'active' : ''}`}
                  onClick={() => setSiteTab('cards')}
                >
                  Tarjetas
                </button>
                <button
                  type="button"
                  className={`settings-subtab ${siteTab === 'product' ? 'active' : ''}`}
                  onClick={() => setSiteTab('product')}
                >
                  Producto
                </button>
                <button
                  type="button"
                  className={`settings-subtab ${siteTab === 'identity' ? 'active' : ''}`}
                  onClick={() => setSiteTab('identity')}
                >
                  Identidad
                </button>
                <button
                  type="button"
                  className={`settings-subtab ${siteTab === 'ecommerce' ? 'active' : ''}`}
                  onClick={() => setSiteTab('ecommerce')}
                >
                  E-commerce
                </button>
                <button
                  type="button"
                  className={`settings-subtab ${siteTab === 'payments' ? 'active' : ''}`}
                  onClick={() => setSiteTab('payments')}
                >
                  💳 Pagos
                </button>
                <button
                  type="button"
                  className={`settings-subtab ${siteTab === 'promos' ? 'active' : ''}`}
                  onClick={() => setSiteTab('promos')}
                >
                  Promociones
                </button>
                <button
                  type="button"
                  className={`settings-subtab ${siteTab === 'filters' ? 'active' : ''}`}
                  onClick={() => setSiteTab('filters')}
                >
                  Filtro principal
                </button>
              </div>

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
                <section className="settings-section collapsible">
                  <button type="button" className="section-toggle" onClick={() => toggleSection('productCards')}>
                    <span>🧱 Product Cards</span>
                    <span className="toggle-indicator">{openSections.productCards ? '−' : '+'}</span>
                  </button>
                  {openSections.productCards && (
                    <>
                      <p className="section-description">Configura las tarjetas de producto y la moneda.</p>

                      <div className="form-group checkbox-group">
                        <label>
                          <input
                            type="checkbox"
                            checked={!!productCardConfig.useDefault}
                            onChange={(e) => updateProductCardConfig(prev => ({ ...prev, useDefault: e.target.checked }))}
                          />
                          Usar configuración predeterminada
                        </label>
                      </div>

                      <div className="form-group">
                        <button type="button" className="settings-secondary-btn" onClick={handleResetProductCard}>
                          Restablecer configuración predeterminada
                        </button>
                      </div>

                      <div className="settings-subsection">
                        <h4>Distribución</h4>
                        <div className="settings-grid">
                          <div className="form-group">
                            <label>Columnas móvil</label>
                            <input
                              type="number"
                              value={productCardConfig.layout?.columnsMobile ?? ''}
                              onChange={(e) => handleProductCardLayoutChange('columnsMobile', e.target.value)}
                              disabled={productCardConfig.useDefault}
                              min="1"
                              max="6"
                            />
                          </div>
                          <div className="form-group">
                            <label>Columnas tablet</label>
                            <input
                              type="number"
                              value={productCardConfig.layout?.columnsTablet ?? ''}
                              onChange={(e) => handleProductCardLayoutChange('columnsTablet', e.target.value)}
                              disabled={productCardConfig.useDefault}
                              min="1"
                              max="8"
                            />
                          </div>
                          <div className="form-group">
                            <label>Columnas desktop</label>
                            <input
                              type="number"
                              value={productCardConfig.layout?.columnsDesktop ?? ''}
                              onChange={(e) => handleProductCardLayoutChange('columnsDesktop', e.target.value)}
                              disabled={productCardConfig.useDefault}
                              min="1"
                              max="8"
                            />
                          </div>
                          <div className="form-group">
                            <label>Columnas wide</label>
                            <input
                              type="number"
                              value={productCardConfig.layout?.columnsWide ?? ''}
                              onChange={(e) => handleProductCardLayoutChange('columnsWide', e.target.value)}
                              disabled={productCardConfig.useDefault}
                              min="1"
                              max="10"
                            />
                          </div>
                          <div className="form-group">
                            <label>Orientación</label>
                            <select
                              value={productCardConfig.layout?.orientation || 'vertical'}
                              onChange={(e) => handleProductCardLayoutChange('orientation', e.target.value)}
                              disabled={productCardConfig.useDefault}
                            >
                              <option value="vertical">Vertical</option>
                              <option value="horizontal">Horizontal</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Moneda</label>
                            <select
                              value={productCardConfig.currency || 'USD'}
                              onChange={(e) => updateProductCardConfig(prev => ({ ...prev, currency: e.target.value }))}
                            >
                              <option value="DOP">RD (DOP)</option>
                              <option value="USD">USD</option>
                              <option value="EUR">EUR</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="settings-subsection">
                        <h4>Tamaño y bordes</h4>
                        <div className="settings-grid">
                          <div className="form-group">
                            <label>Ancho tarjeta (px)</label>
                            <input
                              type="number"
                              value={productCardConfig.styles?.cardWidth || ''}
                              onChange={(e) => handleProductCardStyleChange('cardWidth', e.target.value)}
                              disabled={productCardConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Alto tarjeta (px)</label>
                            <input
                              type="number"
                              value={productCardConfig.styles?.cardHeight || ''}
                              onChange={(e) => handleProductCardStyleChange('cardHeight', e.target.value)}
                              disabled={productCardConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Padding (px)</label>
                            <input
                              type="number"
                              value={productCardConfig.styles?.cardPadding || ''}
                              onChange={(e) => handleProductCardStyleChange('cardPadding', e.target.value)}
                              disabled={productCardConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Radio (px)</label>
                            <input
                              type="number"
                              value={productCardConfig.styles?.cardRadius || ''}
                              onChange={(e) => handleProductCardStyleChange('cardRadius', e.target.value)}
                              disabled={productCardConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Borde (px)</label>
                            <input
                              type="number"
                              value={productCardConfig.styles?.borderWidth || ''}
                              onChange={(e) => handleProductCardStyleChange('borderWidth', e.target.value)}
                              disabled={productCardConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Estilo borde</label>
                            <input
                              type="text"
                              value={productCardConfig.styles?.borderStyle || ''}
                              onChange={(e) => handleProductCardStyleChange('borderStyle', e.target.value)}
                              disabled={productCardConfig.useDefault}
                              placeholder="solid, dashed, none"
                            />
                          </div>
                          <div className="form-group">
                            <label>Color borde</label>
                            <input
                              type="color"
                              value={productCardConfig.styles?.borderColor || '#e5e7eb'}
                              onChange={(e) => handleProductCardStyleChange('borderColor', e.target.value)}
                              disabled={productCardConfig.useDefault}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="settings-subsection">
                        <h4>Colores y texto</h4>
                        <div className="settings-grid">
                          <div className="form-group">
                            <label>Fondo tarjeta</label>
                            <input
                              type="color"
                              value={productCardConfig.styles?.background || '#ffffff'}
                              onChange={(e) => handleProductCardStyleChange('background', e.target.value)}
                              disabled={productCardConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Sombra</label>
                            <input
                              type="text"
                              value={productCardConfig.styles?.shadow || ''}
                              onChange={(e) => handleProductCardStyleChange('shadow', e.target.value)}
                              disabled={productCardConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Color título</label>
                            <input
                              type="color"
                              value={productCardConfig.styles?.titleColor || '#111827'}
                              onChange={(e) => handleProductCardStyleChange('titleColor', e.target.value)}
                              disabled={productCardConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Tamaño título (px)</label>
                            <input
                              type="number"
                              value={productCardConfig.styles?.titleSize || ''}
                              onChange={(e) => handleProductCardStyleChange('titleSize', e.target.value)}
                              disabled={productCardConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Grosor título</label>
                            <input
                              type="number"
                              value={productCardConfig.styles?.titleWeight || ''}
                              onChange={(e) => handleProductCardStyleChange('titleWeight', e.target.value)}
                              disabled={productCardConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Color precio</label>
                            <input
                              type="color"
                              value={productCardConfig.styles?.priceColor || '#111827'}
                              onChange={(e) => handleProductCardStyleChange('priceColor', e.target.value)}
                              disabled={productCardConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Tamaño precio (px)</label>
                            <input
                              type="number"
                              value={productCardConfig.styles?.priceSize || ''}
                              onChange={(e) => handleProductCardStyleChange('priceSize', e.target.value)}
                              disabled={productCardConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Grosor precio</label>
                            <input
                              type="number"
                              value={productCardConfig.styles?.priceWeight || ''}
                              onChange={(e) => handleProductCardStyleChange('priceWeight', e.target.value)}
                              disabled={productCardConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Color descripción</label>
                            <input
                              type="color"
                              value={productCardConfig.styles?.descriptionColor || '#6b7280'}
                              onChange={(e) => handleProductCardStyleChange('descriptionColor', e.target.value)}
                              disabled={productCardConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Tamaño descripción (px)</label>
                            <input
                              type="number"
                              value={productCardConfig.styles?.descriptionSize || ''}
                              onChange={(e) => handleProductCardStyleChange('descriptionSize', e.target.value)}
                              disabled={productCardConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Color categoría</label>
                            <input
                              type="color"
                              value={productCardConfig.styles?.categoryColor || '#2563eb'}
                              onChange={(e) => handleProductCardStyleChange('categoryColor', e.target.value)}
                              disabled={productCardConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Tamaño categoría (px)</label>
                            <input
                              type="number"
                              value={productCardConfig.styles?.categorySize || ''}
                              onChange={(e) => handleProductCardStyleChange('categorySize', e.target.value)}
                              disabled={productCardConfig.useDefault}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="settings-subsection">
                        <h4>Botón</h4>
                        <div className="settings-grid">
                          <div className="form-group">
                            <label>Fondo botón</label>
                            <input
                              type="color"
                              value={productCardConfig.styles?.buttonBg || '#2563eb'}
                              onChange={(e) => handleProductCardStyleChange('buttonBg', e.target.value)}
                              disabled={productCardConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Texto botón</label>
                            <input
                              type="color"
                              value={productCardConfig.styles?.buttonText || '#ffffff'}
                              onChange={(e) => handleProductCardStyleChange('buttonText', e.target.value)}
                              disabled={productCardConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Radio botón (px)</label>
                            <input
                              type="number"
                              value={productCardConfig.styles?.buttonRadius || ''}
                              onChange={(e) => handleProductCardStyleChange('buttonRadius', e.target.value)}
                              disabled={productCardConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Borde botón</label>
                            <input
                              type="text"
                              value={productCardConfig.styles?.buttonBorder || ''}
                              onChange={(e) => handleProductCardStyleChange('buttonBorder', e.target.value)}
                              disabled={productCardConfig.useDefault}
                              placeholder="1px solid #000"
                            />
                          </div>
                          <div className="form-group">
                            <label>Sombra botón</label>
                            <input
                              type="text"
                              value={productCardConfig.styles?.buttonShadow || ''}
                              onChange={(e) => handleProductCardStyleChange('buttonShadow', e.target.value)}
                              disabled={productCardConfig.useDefault}
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </section>
              )}

              {siteTab === 'product' && (
                <section className="settings-section collapsible">
                  <button type="button" className="section-toggle" onClick={() => toggleSection('product')}>
                    <span>📦 Detalle de Producto</span>
                    <span className="toggle-indicator">{openSections.product ? '−' : '+'}</span>
                  </button>
                  {openSections.product && (
                    <>
                      <div className="form-group">
                        <label>Banner Superior (Opcional)</label>
                        <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'productDetailHeroImage')} />
                        {settings.productDetailHeroImage && (
                          <div className="settings-preview">
                            <img src={settings.productDetailHeroImage} alt="Product Detail Banner" />
                            <button type="button" onClick={() => setSettings(prev => ({ ...prev, productDetailHeroImage: '' }))} className="delete-image-btn">Eliminar</button>
                          </div>
                        )}
                        <p className="field-hint">Este banner aparecerá en la parte superior de cada producto.</p>
                      </div>
                    </>
                  )}
                </section>
              )}

              {siteTab === 'identity' && (
                <section className="settings-section collapsible">
                  <button type="button" className="section-toggle" onClick={() => toggleSection('identity')}>
                    <span>🏠 Identidad y Navegación</span>
                    <span className="toggle-indicator">{openSections.identity ? '−' : '+'}</span>
                  </button>
                  {openSections.identity && (
                    <>
                      <div className="settings-grid">
                        <div className="form-group">
                          <label>Nombre del Sitio</label>
                          <input type="text" name="siteName" value={settings.siteName} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                          <label>Icono (Emoji)</label>
                          <input type="text" name="siteIcon" value={settings.siteIcon} onChange={handleChange} />
                        </div>
                      </div>
                
                      <div className="form-group">
                        <label>Color de Barra Superior</label>
                        <div className="color-input-wrapper">
                          <input type="color" name="headerBgColor" value={settings.headerBgColor || '#2563eb'} onChange={handleChange} />
                          <span>{settings.headerBgColor}</span>
                        </div>
                      </div>
                
                      <div className="form-group">
                        <label>Transparencia de Barra ({settings.headerTransparency || 100}%)</label>
                        <input type="range" name="headerTransparency" min="0" max="100" value={settings.headerTransparency || 100} onChange={handleChange} />
                      </div>
                    </>
                  )}
                </section>
              )}

              {siteTab === 'payments' && (
                <section className="settings-section">
                  <div className="section-header-static">
                    <span>💳 Métodos de Pago</span>
                  </div>
                  <p className="section-description">
                    Configura qué métodos de pago estarán disponibles en el checkout. 
                    Solo los métodos habilitados se mostrarán a los clientes.
                  </p>

                  <div className="payment-methods-config">
                    {/* Cash on Delivery */}
                    <div className={`payment-method-card ${settings.paymentMethodsConfig?.cash?.enabled ? 'enabled' : 'disabled'}`}>
                      <div className="payment-method-header">
                        <div className="payment-method-toggle">
                          <input
                            type="checkbox"
                            id="payment-cash"
                            checked={settings.paymentMethodsConfig?.cash?.enabled ?? true}
                            onChange={(e) => setSettings(prev => ({
                              ...prev,
                              paymentMethodsConfig: {
                                ...prev.paymentMethodsConfig,
                                cash: { ...prev.paymentMethodsConfig?.cash, enabled: e.target.checked }
                              }
                            }))}
                          />
                          <label htmlFor="payment-cash" className="toggle-label">
                            <span className="payment-icon">💵</span>
                            <span className="payment-name">Pago Contra Entrega</span>
                          </label>
                        </div>
                        <span className={`status-badge ${settings.paymentMethodsConfig?.cash?.enabled ? 'active' : ''}`}>
                          {settings.paymentMethodsConfig?.cash?.enabled ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <div className="payment-method-details">
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
                    </div>

                    {/* Bank Transfer */}
                    <div className={`payment-method-card ${settings.paymentMethodsConfig?.transfer?.enabled ? 'enabled' : 'disabled'}`}>
                      <div className="payment-method-header">
                        <div className="payment-method-toggle">
                          <input
                            type="checkbox"
                            id="payment-transfer"
                            checked={settings.paymentMethodsConfig?.transfer?.enabled ?? true}
                            onChange={(e) => setSettings(prev => ({
                              ...prev,
                              paymentMethodsConfig: {
                                ...prev.paymentMethodsConfig,
                                transfer: { ...prev.paymentMethodsConfig?.transfer, enabled: e.target.checked }
                              }
                            }))}
                          />
                          <label htmlFor="payment-transfer" className="toggle-label">
                            <span className="payment-icon">🏦</span>
                            <span className="payment-name">Transferencia Bancaria</span>
                          </label>
                        </div>
                        <span className={`status-badge ${settings.paymentMethodsConfig?.transfer?.enabled ? 'active' : ''}`}>
                          {settings.paymentMethodsConfig?.transfer?.enabled ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <div className="payment-method-details">
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
                        <div className="form-group">
                          <label>Información Bancaria (opcional)</label>
                          <textarea
                            value={settings.paymentMethodsConfig?.transfer?.bankInfo || ''}
                            onChange={(e) => setSettings(prev => ({
                              ...prev,
                              paymentMethodsConfig: {
                                ...prev.paymentMethodsConfig,
                                transfer: { ...prev.paymentMethodsConfig?.transfer, bankInfo: e.target.value }
                              }
                            }))}
                            placeholder="Banco: XXXX&#10;Cuenta: XXXX-XXXX&#10;Titular: XXXX"
                            rows="3"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Stripe (Credit/Debit Cards) */}
                    <div className={`payment-method-card ${settings.paymentMethodsConfig?.stripe?.enabled ? 'enabled' : 'disabled'}`}>
                      <div className="payment-method-header">
                        <div className="payment-method-toggle">
                          <input
                            type="checkbox"
                            id="payment-stripe"
                            checked={settings.paymentMethodsConfig?.stripe?.enabled ?? true}
                            onChange={(e) => setSettings(prev => ({
                              ...prev,
                              paymentMethodsConfig: {
                                ...prev.paymentMethodsConfig,
                                stripe: { ...prev.paymentMethodsConfig?.stripe, enabled: e.target.checked }
                              }
                            }))}
                          />
                          <label htmlFor="payment-stripe" className="toggle-label">
                            <span className="payment-icon">💳</span>
                            <span className="payment-name">Tarjeta de Crédito/Débito</span>
                          </label>
                        </div>
                        <span className={`status-badge ${settings.paymentMethodsConfig?.stripe?.enabled ? 'active' : ''}`}>
                          {settings.paymentMethodsConfig?.stripe?.enabled ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <div className="payment-method-details">
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
                    </div>

                    {/* PayPal (Coming Soon) */}
                    <div className={`payment-method-card ${settings.paymentMethodsConfig?.paypal?.enabled ? 'enabled' : 'disabled'} coming-soon`}>
                      <div className="payment-method-header">
                        <div className="payment-method-toggle">
                          <input
                            type="checkbox"
                            id="payment-paypal"
                            checked={settings.paymentMethodsConfig?.paypal?.enabled ?? false}
                            onChange={(e) => setSettings(prev => ({
                              ...prev,
                              paymentMethodsConfig: {
                                ...prev.paymentMethodsConfig,
                                paypal: { ...prev.paymentMethodsConfig?.paypal, enabled: e.target.checked }
                              }
                            }))}
                            disabled
                          />
                          <label htmlFor="payment-paypal" className="toggle-label">
                            <span className="payment-icon">🅿️</span>
                            <span className="payment-name">PayPal</span>
                            <span className="coming-soon-badge">Próximamente</span>
                          </label>
                        </div>
                        <span className={`status-badge ${settings.paymentMethodsConfig?.paypal?.enabled ? 'active' : ''}`}>
                          {settings.paymentMethodsConfig?.paypal?.enabled ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <div className="payment-method-details">
                        <p className="helper-text">
                          🔜 La integración con PayPal estará disponible próximamente.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
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
                <section className="settings-section collapsible">
                  <button type="button" className="section-toggle" onClick={() => toggleSection('filters')}>
                    <span>🧩 Filtros por Categoría</span>
                    <span className="toggle-indicator">{openSections.filters ? '−' : '+'}</span>
                  </button>
                  {openSections.filters && (
                    <>
                      <p className="section-description">Administra las categorías del Home y personaliza su estilo.</p>

                      <div className="form-group checkbox-group">
                        <label>
                          <input
                            type="checkbox"
                            checked={!!categoryConfig.useDefault}
                            onChange={(e) => updateCategoryConfig(prev => ({ ...prev, useDefault: e.target.checked }))}
                          />
                          Usar configuración predeterminada
                        </label>
                      </div>

                      <div className="form-group">
                        <button type="button" className="settings-secondary-btn" onClick={handleResetCategoryFilters}>
                          Restablecer configuración predeterminada
                        </button>
                      </div>

                      <div className="settings-subsection">
                        <h4>Opciones de filtros</h4>
                        <div className="category-settings-list">
                          {categoryConfig.categories?.map((category, index) => (
                            <div key={category.id || `${category.slug}-${index}`} className="category-settings-card">
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
                          ))}
                        </div>
                        <button
                          type="button"
                          className="settings-secondary-btn"
                          onClick={handleAddCategory}
                          disabled={categoryConfig.useDefault}
                        >
                          Agregar categoría
                        </button>
                      </div>

                      <div className="settings-subsection">
                        <h4>Estilos globales</h4>
                        <div className="settings-grid">
                          <div className="form-group">
                            <label>Ancho (px)</label>
                            <input
                              type="number"
                              value={categoryConfig.styles?.cardWidth || ''}
                              onChange={(e) => handleCategoryStyleChange('cardWidth', e.target.value)}
                              disabled={categoryConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Alto (px)</label>
                            <input
                              type="number"
                              value={categoryConfig.styles?.cardHeight || ''}
                              onChange={(e) => handleCategoryStyleChange('cardHeight', e.target.value)}
                              disabled={categoryConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Padding (px)</label>
                            <input
                              type="number"
                              value={categoryConfig.styles?.cardPadding || ''}
                              onChange={(e) => handleCategoryStyleChange('cardPadding', e.target.value)}
                              disabled={categoryConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Radio (px)</label>
                            <input
                              type="number"
                              value={categoryConfig.styles?.cardRadius || ''}
                              onChange={(e) => handleCategoryStyleChange('cardRadius', e.target.value)}
                              disabled={categoryConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Color fondo</label>
                            <input
                              type="color"
                              value={categoryConfig.styles?.cardBackground || '#f8fafc'}
                              onChange={(e) => handleCategoryStyleChange('cardBackground', e.target.value)}
                              disabled={categoryConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Color borde</label>
                            <input
                              type="color"
                              value={categoryConfig.styles?.cardBorderColor || '#e2e8f0'}
                              onChange={(e) => handleCategoryStyleChange('cardBorderColor', e.target.value)}
                              disabled={categoryConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Sombra</label>
                            <input
                              type="text"
                              value={categoryConfig.styles?.cardShadow || ''}
                              onChange={(e) => handleCategoryStyleChange('cardShadow', e.target.value)}
                              disabled={categoryConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Fondo hover</label>
                            <input
                              type="color"
                              value={categoryConfig.styles?.hoverBackground || '#eff6ff'}
                              onChange={(e) => handleCategoryStyleChange('hoverBackground', e.target.value)}
                              disabled={categoryConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Borde hover</label>
                            <input
                              type="text"
                              value={categoryConfig.styles?.hoverBorderColor || ''}
                              onChange={(e) => handleCategoryStyleChange('hoverBorderColor', e.target.value)}
                              disabled={categoryConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Sombra hover</label>
                            <input
                              type="text"
                              value={categoryConfig.styles?.hoverShadow || ''}
                              onChange={(e) => handleCategoryStyleChange('hoverShadow', e.target.value)}
                              disabled={categoryConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Color texto hover</label>
                            <input
                              type="color"
                              value={categoryConfig.styles?.hoverTitleColor || '#2563eb'}
                              onChange={(e) => handleCategoryStyleChange('hoverTitleColor', e.target.value)}
                              disabled={categoryConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Fondo activo</label>
                            <input
                              type="text"
                              value={categoryConfig.styles?.activeBackground || ''}
                              onChange={(e) => handleCategoryStyleChange('activeBackground', e.target.value)}
                              disabled={categoryConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Borde activo</label>
                            <input
                              type="text"
                              value={categoryConfig.styles?.activeBorderColor || ''}
                              onChange={(e) => handleCategoryStyleChange('activeBorderColor', e.target.value)}
                              disabled={categoryConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Sombra activa</label>
                            <input
                              type="text"
                              value={categoryConfig.styles?.activeShadow || ''}
                              onChange={(e) => handleCategoryStyleChange('activeShadow', e.target.value)}
                              disabled={categoryConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Color texto</label>
                            <input
                              type="color"
                              value={categoryConfig.styles?.titleColor || '#1f2937'}
                              onChange={(e) => handleCategoryStyleChange('titleColor', e.target.value)}
                              disabled={categoryConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Color texto activo</label>
                            <input
                              type="color"
                              value={categoryConfig.styles?.activeTitleColor || '#ffffff'}
                              onChange={(e) => handleCategoryStyleChange('activeTitleColor', e.target.value)}
                              disabled={categoryConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Tamaño texto (px)</label>
                            <input
                              type="number"
                              value={categoryConfig.styles?.titleSize || ''}
                              onChange={(e) => handleCategoryStyleChange('titleSize', e.target.value)}
                              disabled={categoryConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Grosor texto</label>
                            <input
                              type="number"
                              value={categoryConfig.styles?.titleWeight || ''}
                              onChange={(e) => handleCategoryStyleChange('titleWeight', e.target.value)}
                              disabled={categoryConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Transformación</label>
                            <input
                              type="text"
                              value={categoryConfig.styles?.titleTransform || ''}
                              onChange={(e) => handleCategoryStyleChange('titleTransform', e.target.value)}
                              placeholder="uppercase, capitalize, none"
                              disabled={categoryConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Espaciado letras (px)</label>
                            <input
                              type="number"
                              value={categoryConfig.styles?.titleLetterSpacing || ''}
                              onChange={(e) => handleCategoryStyleChange('titleLetterSpacing', e.target.value)}
                              disabled={categoryConfig.useDefault}
                            />
                          </div>
                          <div className="form-group">
                            <label>Tamaño icono (px)</label>
                            <input
                              type="number"
                              value={categoryConfig.styles?.iconSize || ''}
                              onChange={(e) => handleCategoryStyleChange('iconSize', e.target.value)}
                              disabled={categoryConfig.useDefault}
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </section>
              )}

            </>
          )}

          {activeSection === 'email' && (
            <EmailSettingsSection settings={settings} onChange={handleChange} />
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
