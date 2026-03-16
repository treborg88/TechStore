import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { apiFetch, apiUrl } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import './SettingsManager.css';
import EmailSettingsSection from './EmailSettingsSection';
import DatabaseSection from './DatabaseSection';
import ChatBotAdmin from '../chatbot/ChatBotAdmin';
import LandingPageAdmin from './LandingPageAdmin';
import InvoicePdfSection from './InvoicePdfSection';
import StoreLocationMap from '../common/StoreLocationMap';
import { DEFAULT_CATEGORY_FILTERS_CONFIG, DEFAULT_PRODUCT_CARD_CONFIG } from '../../config';
import { normalizeCurrencyCode } from '../../utils/settingsHelpers';
import { cloneLandingPageConfig } from '../../utils/landingPageDefaults';
import { CACHE_KEYS, getCacheItem, setCacheItem } from '../../utils/cacheStorage';

const PRODUCT_CURRENCY_OPTIONS = [
  { code: 'DOP', label: 'DOP (RD$)' },
  { code: 'USD', label: 'USD (USD$)' },
  { code: 'EUR', label: 'EUR (€)' }
];

function SettingsManager() {
  const location = useLocation();
  const [activeSection, setActiveSection] = useState('site');
  const [siteTab, setSiteTab] = useState('general');
  const [uiMode, setUiMode] = useState('quick');
  const [openSections, setOpenSections] = useState({
    theme: true,
    home: true,
    product: true,
    identity: false,
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
    storeModule: true,
    mapLocation: true,
    mapShippingZones: true,
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

  // Default map & shipping configuration
  const DEFAULT_MAP_CONFIG = {
    mapEnabled: true,
    shippingCalcEnabled: true,
    storeLocation: { lat: 18.462673, lng: -69.936051 },
    shippingZones: [
      { maxDistance: 5, price: 100, label: 'Zona 1' },
      { maxDistance: 10, price: 150, label: 'Zona 2' },
      { maxDistance: 20, price: 200, label: 'Zona 3' },
      { maxDistance: 50, price: 350, label: 'Zona 4' },
      { maxDistance: 9999, price: 600, label: 'Zona 5' }
    ]
  };

  const cloneMapConfig = (config = DEFAULT_MAP_CONFIG) => (
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
    siteDomain: '',
    freeShippingThreshold: 50000,
    contactEmail: 'soporte@techstore.com',
    showPromotionBanner: true,
    promoTitle: '¡Oferta Especial del Mes!',
    promoText: '¡Gran venta de año nuevo! 20% de descuento en todo.',
    promoButtonText: 'Ver Oferta',
    promoImage: '',
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
    // Landing page config
    landingPageConfig: cloneLandingPageConfig(null),
    // Store module (tienda) config
    storeModuleConfig: {
      enabled: true
    },
    // Header navigation visibility
    navigationConfig: {
      showHomeLink: true,
      showStoreLink: true
    },
    // Database credentials (reference copy)
    dbSupabaseUrl: '',
    dbSupabaseKey: '',
    // Map & shipping configuration
    mapConfig: cloneMapConfig(),
    // Invoice PDF configuration
    invoicePdfConfig: {}
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [credentialWarnings, setCredentialWarnings] = useState([]);

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

  const ADVANCED_ONLY_TABS = ['cards', 'filters', 'promos', 'ecommerce', 'email', 'database', 'chatbot', 'landing'];

  useEffect(() => {
    if (uiMode === 'quick' && ADVANCED_ONLY_TABS.includes(siteTab)) {
      setSiteTab('general');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiMode, siteTab]);

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
            merged.currency = normalizeCurrencyCode(parsed?.currency ?? merged.currency);
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
        } else if (key === 'landingPageConfig') {
          try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            typedData[key] = cloneLandingPageConfig(parsed);
          } catch {
            typedData[key] = cloneLandingPageConfig(null);
          }
        } else if (key === 'navigationConfig') {
          try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            typedData[key] = {
              showHomeLink: parsed?.showHomeLink !== false,
              showStoreLink: parsed?.showStoreLink !== false
            };
          } catch {
            typedData[key] = {
              showHomeLink: true,
              showStoreLink: true
            };
          }
        } else if (key === 'storeModuleConfig') {
          try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            typedData[key] = {
              enabled: parsed?.enabled !== false
            };
          } catch {
            typedData[key] = { enabled: true };
          }
        } else if (key === 'mapConfig') {
          try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            // Strip legacy hardcoded distance text from zone labels (e.g. "Zona 1 (0-5km)" → "Zona 1")
            const cleanZones = (zones) => zones.map(z => ({
              ...z,
              label: z.label?.replace(/\s*\([\d>]+-?\d*km\)$/, '') || z.label
            }));
            const rawZones = Array.isArray(parsed?.shippingZones) && parsed.shippingZones.length > 0
              ? parsed.shippingZones
              : cloneMapConfig().shippingZones;
            typedData[key] = {
              mapEnabled: parsed?.mapEnabled !== false,
              shippingCalcEnabled: parsed?.shippingCalcEnabled !== false,
              storeLocation: {
                ...cloneMapConfig().storeLocation,
                ...(parsed?.storeLocation || {})
              },
              shippingZones: cleanZones(rawZones)
            };
          } catch {
            typedData[key] = cloneMapConfig();
          }
        } else if (key === 'invoicePdfConfig') {
          try {
            typedData[key] = typeof value === 'string' ? JSON.parse(value) : (value || {});
          } catch {
            typedData[key] = {};
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
        const cached = getCacheItem(CACHE_KEYS.settings);
        if (cached?.data) {
          applySettingsData(cached.data);
          setLoading(false);
        }

        const response = await apiFetch(apiUrl('/settings'));
        if (response.ok) {
          const data = await response.json();
          applySettingsData(data);
          setCacheItem(CACHE_KEYS.settings, {
            timestamp: new Date().getTime(),
            lastValidatedAt: new Date().getTime(),
            data
          });
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();

    // Verificar estado de credenciales
    const fetchCredentials = async () => {
      try {
        const res = await apiFetch(apiUrl('/settings/credentials-status'));
        if (res.ok) {
          const data = await res.json();
          setCredentialWarnings(data.missing || []);
        }
      } catch { /* silently ignore */ }
    };
    fetchCredentials();
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
      const normalizedLandingConfig = cloneLandingPageConfig(settings.landingPageConfig);
      const normalizedNavigationConfig = {
        showHomeLink: true,
        showStoreLink: settings.navigationConfig?.showStoreLink !== false
      };

      // Guardrail: if landing is disabled and both main nav entries are hidden,
      // keep at least one visible entry to avoid a dead-end menu.
      if (!normalizedLandingConfig.enabled && !normalizedNavigationConfig.showHomeLink && !normalizedNavigationConfig.showStoreLink) {
        normalizedNavigationConfig.showHomeLink = true;
        toast('Se activo "Inicio" automaticamente para mantener una entrada principal visible.', { icon: 'ℹ️' });
      }

      const normalizedStoreModuleConfig = {
        enabled: settings.storeModuleConfig?.enabled !== false
      };

      // Guardrail: at least one main browsing module must remain active.
      if (!normalizedLandingConfig.enabled && !normalizedStoreModuleConfig.enabled) {
        normalizedLandingConfig.enabled = true;
        toast('Se activo Landing automaticamente para evitar desactivar Inicio y Tienda al mismo tiempo.', { icon: 'ℹ️' });
      }

      const payload = {
        ...settings,
        categoryFiltersConfig: JSON.stringify(settings.categoryFiltersConfig || cloneCategoryConfig()),
        productCardConfig: JSON.stringify({
          ...(settings.productCardConfig || cloneProductCardConfig()),
          currency: normalizeCurrencyCode(settings.productCardConfig?.currency)
        }),
        paymentMethodsConfig: JSON.stringify(settings.paymentMethodsConfig || clonePaymentMethodsConfig()),
        landingPageConfig: JSON.stringify(normalizedLandingConfig),
        navigationConfig: JSON.stringify(normalizedNavigationConfig),
        storeModuleConfig: JSON.stringify(normalizedStoreModuleConfig),
        mapConfig: JSON.stringify(settings.mapConfig || cloneMapConfig()),
        invoicePdfConfig: JSON.stringify(settings.invoicePdfConfig || {})
      };
      const response = await apiFetch(apiUrl('/settings'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setSettings(prev => ({
          ...prev,
          landingPageConfig: normalizedLandingConfig,
          navigationConfig: normalizedNavigationConfig,
          storeModuleConfig: normalizedStoreModuleConfig
        }));
        toast.success('Ajustes guardados correctamente');
        const cachePayload = {
          timestamp: new Date().getTime(),
          lastValidatedAt: new Date().getTime(),
          data: payload
        };
        setCacheItem(CACHE_KEYS.settings, cachePayload);
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
      setCacheItem(CACHE_KEYS.settings, {
        timestamp: new Date().getTime(),
        lastValidatedAt: new Date().getTime(),
        data: cachePayload
      });
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

  const TAB_METADATA = {
    general: {
      title: 'General',
      subtitle: 'Paleta global y apariencia base de la tienda.'
    },
    identity: {
      title: 'Identidad',
      subtitle: 'Logo, nombre comercial e imagen de marca en cabecera.'
    },
    home: {
      title: 'Home',
      subtitle: 'Contenido principal del hero y banner de inicio.'
    },
    product: {
      title: 'Productos',
      subtitle: 'Ajustes del detalle del producto y hero de la ficha.'
    },
    store: {
      title: 'Tienda',
      subtitle: 'Control del modulo tienda y sus secciones internas.'
    },
    cards: {
      title: 'Tarjetas',
      subtitle: 'Diseño visual y layout de tarjetas en catálogo.'
    },
    filters: {
      title: 'Filtros',
      subtitle: 'Categorías del Home y estilos de filtros.'
    },
    promos: {
      title: 'Promociones',
      subtitle: 'Banners y textos promocionales visibles al cliente.'
    },
    ecommerce: {
      title: 'E-commerce',
      subtitle: 'Parámetros operativos de la tienda y mantenimiento.'
    },
    payments: {
      title: 'Pagos',
      subtitle: 'Configuración de métodos de pago y credenciales.'
    },
    email: {
      title: 'Correo',
      subtitle: 'SMTP, remitente y plantilla de correos transaccionales.'
    },
    database: {
      title: 'Base de datos',
      subtitle: 'Estado y conexión de la base de datos.'
    },
    chatbot: {
      title: 'Chatbot',
      subtitle: 'Proveedor LLM, personalidad y controles del bot.'
    },
    landing: {
      title: 'Landing Page',
      subtitle: 'Gestión visual y estructural de la landing independiente.'
    },
    map: {
      title: 'Mapa y Envíos',
      subtitle: 'Ubicación de la tienda y tarifas de envío por distancia.'
    },
    invoice: {
      title: 'Factura PDF',
      subtitle: 'Personaliza el formato, fuentes, colores y contenido de la factura en PDF.'
    }
  };

  const renderTabButton = (tabId, label) => (
    <button
      key={tabId}
      type="button"
      className={`settings-nav-item ${siteTab === tabId ? 'active' : ''}`}
      onClick={() => setSiteTab(tabId)}
    >
      {label}
    </button>
  );

  const tabMeta = TAB_METADATA[siteTab] || TAB_METADATA.general;
  const isAdvancedMode = uiMode === 'advanced';

  return (
    <div className="settings-manager">
      {activeSection === 'site' && (
        <div className="settings-header">
          <div className="settings-header-row">
            <h2>⚙️ Ajustes del Sitio</h2>
            {credentialWarnings.length > 0 && (
              <div className="credentials-warning-badge">
                <span className="credentials-warning-icon">⚠️</span>
                <div className="credentials-warning-tooltip">
                  <p className="credentials-warning-title">Credenciales pendientes</p>
                  <ul>
                    {credentialWarnings.map(c => (
                      <li key={c.id}>{c.label}</li>
                    ))}
                  </ul>
                  <p className="credentials-warning-hint">Configúralas en Modo Avanzado para habilitar estas funciones.</p>
                </div>
              </div>
            )}
          </div>
          <p>Configura parámetros globales de la tienda.</p>
        </div>
      )}

      <form onSubmit={handleSave} className="settings-form">
        {activeSection === 'site' && (
          <div className="settings-layout">
            <nav className="settings-sidebar">
              <div className="settings-nav-group">
                <p className="settings-nav-group-title">Nucleo de Sitio</p>
                {renderTabButton('general', '🎨 General')}
                {renderTabButton('identity', '🏷️ Identidad')}
                {renderTabButton('home', '🏠 Home')}
                {renderTabButton('store', '🛍️ Tienda')}
              </div>

              <div className="settings-nav-group">
                <p className="settings-nav-group-title">Catalogo</p>
                {isAdvancedMode && renderTabButton('product', '📦 Productos')}
                {isAdvancedMode && renderTabButton('cards', '🃏 Tarjetas')}
                {isAdvancedMode && renderTabButton('filters', '🔍 Filtros')}
                {isAdvancedMode && renderTabButton('promos', '🏷️ Promociones')}
              </div>

              <div className="settings-nav-group">
                <p className="settings-nav-group-title">Operacion</p>
                {isAdvancedMode && renderTabButton('ecommerce', '🛒 E-commerce')}
                {renderTabButton('payments', '💳 Pagos')}
                {renderTabButton('map', '🗺️ Mapa')}
                {isAdvancedMode && renderTabButton('email', '✉️ Correo')}
                {isAdvancedMode && renderTabButton('database', '🗄️ Base de datos')}
                {isAdvancedMode && renderTabButton('chatbot', '🤖 Chatbot')}
                {isAdvancedMode && renderTabButton('landing', '🚀 Landing Page')}
                {renderTabButton('invoice', '🧾 Factura PDF')}
              </div>
            </nav>

            <div className="settings-content">
              <div className="settings-tab-intro">
                <h3>{tabMeta.title}</h3>
                <p>{tabMeta.subtitle}</p>
              </div>

              <div className="settings-mode-switch" role="group" aria-label="Modo de configuracion">
                <button
                  type="button"
                  className={`settings-mode-btn ${uiMode === 'quick' ? 'active' : ''}`}
                  onClick={() => setUiMode('quick')}
                >
                  Modo Rapido
                </button>
                <button
                  type="button"
                  className={`settings-mode-btn ${uiMode === 'advanced' ? 'active' : ''}`}
                  onClick={() => setUiMode('advanced')}
                >
                  Modo Avanzado
                </button>
                <span className="settings-mode-hint">
                  {isAdvancedMode ? 'Todas las opciones visibles.' : 'Vista simplificada para configuracion rapida.'}
                </span>
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

                      <div className="settings-subsection" style={{ paddingTop: 0 }}>
                        <h4 style={{ marginTop: 0, marginBottom: '0.75rem', color: '#374151' }}>Cabecera y Acceso</h4>
                        <div className="settings-grid">
                          <div className="form-group">
                            <label>Color de Fondo del Header</label>
                            <div className="color-input-wrapper">
                              <input type="color" name="headerBgColor" value={settings.headerBgColor || '#2563eb'} onChange={handleChange} />
                              <span>{settings.headerBgColor || '#2563eb'}</span>
                            </div>
                          </div>

                          <div className="form-group">
                            <label>Color de Texto del Header</label>
                            <div className="color-input-wrapper">
                              <input type="color" name="headerTextColor" value={settings.headerTextColor || '#ffffff'} onChange={handleChange} />
                              <span>{settings.headerTextColor || '#ffffff'}</span>
                            </div>
                          </div>

                          <div className="form-group">
                            <label>Botón de Login (Fondo)</label>
                            <div className="color-input-wrapper">
                              <input type="color" name="headerButtonColor" value={settings.headerButtonColor || '#ffffff'} onChange={handleChange} />
                              <span>{settings.headerButtonColor || '#ffffff'}</span>
                            </div>
                          </div>

                          <div className="form-group">
                            <label>Botón de Login (Texto)</label>
                            <div className="color-input-wrapper">
                              <input type="color" name="headerButtonTextColor" value={settings.headerButtonTextColor || '#2563eb'} onChange={handleChange} />
                              <span>{settings.headerButtonTextColor || '#2563eb'}</span>
                            </div>
                          </div>

                          <div className="form-group">
                            <label>Transparencia del Header (%)</label>
                            <input
                              type="number"
                              name="headerTransparency"
                              min="0"
                              max="100"
                              value={settings.headerTransparency || 100}
                              onChange={handleChange}
                            />
                          </div>
                        </div>

                        <p className="field-hint" style={{ marginTop: '0.5rem' }}>
                          La activación completa de Tienda se controla en el tab <strong>Tienda</strong>.
                        </p>
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
                    <div className="hero-settings-compact">
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

                      <div className="settings-grid" style={{ marginTop: '0.25rem' }}>
                        <div className="form-group checkbox-group">
                          <label>
                            <input
                              type="checkbox"
                              checked={settings.landingPageConfig?.enabled === true}
                              onChange={(e) => setSettings(prev => ({
                                ...prev,
                                landingPageConfig: {
                                  ...cloneLandingPageConfig(prev.landingPageConfig),
                                  enabled: e.target.checked
                                }
                              }))}
                            />
                            Activar Landing Page como pagina principal (`/`)
                          </label>
                        </div>
                      </div>

                      <p className="field-hint" style={{ marginTop: 0 }}>
                        Si Landing está activa, la ruta `/` muestra la landing. Si está apagada, `/` muestra la página Inicio de la tienda.
                      </p>

                      {isAdvancedMode && (
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
                      )}

                      <div className="settings-grid-3">
                        <div className="form-group-compact inline-label">
                          <label>Altura <input type="number" name="heroHeight" min="200" max="600" step="20" value={settings.heroHeight || 360} onChange={handleChange} className="size-input-mini" />px</label>
                        </div>
                        {isAdvancedMode && (
                          <div className="form-group-compact inline-label">
                            <label>Ancho <input type="number" name="heroImageWidth" min="50" max="100" step="5" value={settings.heroImageWidth || 100} onChange={handleChange} className="size-input-mini" />%</label>
                          </div>
                        )}
                        <div className="form-group-compact inline-label">
                          <label>Oscurecer <input type="number" name="heroOverlayOpacity" min="0" max="80" step="5" value={Math.round((settings.heroOverlayOpacity ?? 0.5) * 100)} onChange={(e) => handleChange({ target: { name: 'heroOverlayOpacity', value: parseFloat(e.target.value) / 100 } })} className="size-input-mini" />%</label>
                        </div>
                      </div>

                      <div className="settings-grid" style={{ marginTop: '0.5rem' }}>
                        <div className="form-group">
                          <label>Color del Texto del Hero</label>
                          <div className="color-input-wrapper">
                            <input type="color" name="heroTextColor" value={settings.heroTextColor || '#ffffff'} onChange={handleChange} />
                            <span>{settings.heroTextColor || '#ffffff'}</span>
                          </div>
                        </div>
                      </div>

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

                      {isAdvancedMode && (
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
                      )}
                    </div>
                  )}
                </section>
              )}

              {siteTab === 'store' && (
                <section className="settings-section collapsible">
                  <button type="button" className="section-toggle" onClick={() => toggleSection('storeModule')}>
                    <span>🧩 Módulo Tienda</span>
                    <span className="toggle-indicator">{openSections.storeModule ? '−' : '+'}</span>
                  </button>
                  {openSections.storeModule && (
                    <>
                      <div className="form-group checkbox-group" style={{ padding: '0 1.5rem 0.5rem' }}>
                        <label>
                          <input
                            type="checkbox"
                            checked={settings.storeModuleConfig?.enabled !== false}
                            onChange={(e) => setSettings(prev => ({
                              ...prev,
                              storeModuleConfig: {
                                ...(prev.storeModuleConfig || {}),
                                enabled: e.target.checked
                              },
                              navigationConfig: {
                                ...(prev.navigationConfig || {}),
                                showStoreLink: e.target.checked
                              }
                            }))}
                          />
                          Activar módulo Tienda (rutas `/tienda`, `/products`, `/product/:id`)
                        </label>
                      </div>
                      <p className="section-description">
                        Cuando está desactivado, la tienda queda desconectada del sitio público sin afectar pagos, carrito y demás funciones existentes.
                      </p>
                    </>
                  )}
                </section>
              )}

              {(siteTab === 'cards' || siteTab === 'store') && (
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

              {(siteTab === 'product' || siteTab === 'store') && (
                <section className="settings-section collapsible">
                  <button type="button" className="section-toggle" onClick={() => toggleSection('product')}>
                    <span>📦 Detalle de Producto</span>
                    <span className="toggle-indicator">{openSections.product ? '−' : '+'}</span>
                  </button>
                  {openSections.product && (
                    <>
                      {/* Configuración de moneda global para precios de productos */}
                      <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label>Moneda de Productos</label>
                        <select
                          value={normalizeCurrencyCode(productCardConfig.currency)}
                          onChange={(e) => updateProductCardConfig(prev => ({
                            ...prev,
                            currency: normalizeCurrencyCode(e.target.value)
                          }))}
                        >
                          {PRODUCT_CURRENCY_OPTIONS.map((currencyOption) => (
                            <option key={currencyOption.code} value={currencyOption.code}>{currencyOption.label}</option>
                          ))}
                        </select>
                        <small className="field-hint">Este ajuste se aplica a Home, detalle de producto, carrito, checkout y órdenes.</small>
                      </div>

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
                          {isAdvancedMode && (
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
                          )}
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

              {(siteTab === 'ecommerce' || siteTab === 'store') && (
                <section className="settings-section collapsible">
                  <button type="button" className="section-toggle" onClick={() => toggleSection('ecommerce')}>
                    <span>⚙️ E-commerce y Otros</span>
                    <span className="toggle-indicator">{openSections.ecommerce ? '−' : '+'}</span>
                  </button>
                  {openSections.ecommerce && (
                    <>
                      <div className="form-group">
                        <label>Dominio del Sitio</label>
                        <input 
                          type="text" 
                          name="siteDomain" 
                          value={settings.siteDomain} 
                          onChange={handleChange} 
                          placeholder="ejemplo.com"
                        />
                        <small style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                          Dominio principal de tu tienda (sin https://). Se usa para configurar CORS automáticamente.
                        </small>
                      </div>
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
                      <div className="form-group checkbox-group">
                        <label>
                          <input type="checkbox" name="shippingSlipEnabled" checked={settings.shippingSlipEnabled} onChange={handleChange} />
                          Habilitar Cartilla de Envío en detalle de orden
                        </label>
                        <small style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                          Permite generar una cartilla con los datos de envío para copiar o compartir.
                        </small>
                      </div>
                    </>
                  )}
                </section>
              )}

              {(siteTab === 'promos' || siteTab === 'store') && (
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
                        <label>Título de la Promoción</label>
                        <input 
                          type="text" 
                          name="promoTitle" 
                          value={settings.promoTitle} 
                          onChange={handleChange}
                          placeholder="¡Oferta Especial del Mes!"
                        />
                      </div>
                      <div className="form-group">
                        <label>Texto de la Promoción</label>
                        <textarea 
                          name="promoText" 
                          value={settings.promoText} 
                          onChange={handleChange}
                          rows="2"
                          placeholder="Descripción de la oferta o promoción"
                        />
                      </div>
                      <div className="form-group">
                        <label>Texto del Botón</label>
                        <input 
                          type="text" 
                          name="promoButtonText" 
                          value={settings.promoButtonText} 
                          onChange={handleChange}
                          placeholder="Ver Oferta"
                        />
                      </div>
                      <div className="form-group">
                        <label>Imagen de Promoción</label>
                        <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'promoImage')} />
                        {settings.promoImage && (
                          <div style={{ marginTop: '8px' }}>
                            <img src={settings.promoImage} alt="Promo" style={{ maxHeight: 120, borderRadius: 8 }} />
                            <button 
                              type="button" 
                              className="remove-btn" 
                              style={{ marginLeft: 8 }}
                              onClick={() => setSettings(prev => ({ ...prev, promoImage: '' }))}
                            >
                              ✕ Quitar
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </section>
              )}

              {(siteTab === 'filters' || siteTab === 'store') && (
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

              {siteTab === 'chatbot' && (
                <ChatBotAdmin settings={settings} onChange={handleChange} setSettings={setSettings} />
              )}

              {siteTab === 'landing' && (
                <LandingPageAdmin settings={settings} setSettings={setSettings} />
              )}

              {siteTab === 'invoice' && (
                <InvoicePdfSection settings={settings} setSettings={setSettings} />
              )}

              {siteTab === 'map' && (
                <div className="settings-section-scroll">
                  {/* Store Location (with map toggle) */}
                  <section className="settings-section">
                    <div className="feature-toggle-banner">
                      <div className="feature-toggle-left">
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={settings.mapConfig?.mapEnabled !== false}
                            onChange={(e) => setSettings(prev => ({
                              ...prev,
                              mapConfig: { ...prev.mapConfig, mapEnabled: e.target.checked }
                            }))}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                        <span className="feature-toggle-text">Mapa de entrega en checkout</span>
                      </div>
                      <span className={`feature-toggle-badge ${settings.mapConfig?.mapEnabled !== false ? 'active' : 'inactive'}`}>
                        {settings.mapConfig?.mapEnabled !== false ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    <div
                      className="section-header clickable"
                      onClick={() => toggleSection('mapLocation')}
                    >
                      <h4>📍 Ubicación de la Tienda</h4>
                      <span className={`collapse-icon ${openSections.mapLocation ? 'open' : ''}`}>▼</span>
                    </div>
                    {openSections.mapLocation && (
                      <div className="section-body">
                        <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem', marginBottom: '10px' }}>
                          Haz clic en el mapa o arrastra el marcador para establecer la ubicación.
                          Se usa en la página de contacto y como origen para calcular envíos.
                        </p>
                        <StoreLocationMap
                          lat={settings.mapConfig?.storeLocation?.lat || null}
                          lng={settings.mapConfig?.storeLocation?.lng || null}
                          editable={true}
                          onLocationChange={({ lat, lng }) => {
                            setSettings(prev => ({
                              ...prev,
                              mapConfig: {
                                ...prev.mapConfig,
                                storeLocation: { lat, lng }
                              }
                            }));
                          }}
                          height={320}
                        />
                        {settings.mapConfig?.storeLocation?.lat && settings.mapConfig?.storeLocation?.lng && (
                          <p style={{ color: 'var(--gray-500)', fontSize: '0.8rem', marginTop: '8px' }}>
                            Coordenadas: {Number(settings.mapConfig.storeLocation.lat).toFixed(6)}, {Number(settings.mapConfig.storeLocation.lng).toFixed(6)}
                          </p>
                        )}
                      </div>
                    )}
                  </section>

                  {/* Shipping Zones (with shipping calc toggle) */}
                  <section className="settings-section">
                    <div className="feature-toggle-banner">
                      <div className="feature-toggle-left">
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={settings.mapConfig?.shippingCalcEnabled !== false}
                            onChange={(e) => setSettings(prev => ({
                              ...prev,
                              mapConfig: { ...prev.mapConfig, shippingCalcEnabled: e.target.checked }
                            }))}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                        <span className="feature-toggle-text">Calcular costo de envío por distancia</span>
                      </div>
                      <span className={`feature-toggle-badge ${settings.mapConfig?.shippingCalcEnabled !== false ? 'active' : 'inactive'}`}>
                        {settings.mapConfig?.shippingCalcEnabled !== false ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    <div
                      className="section-header clickable"
                      onClick={() => toggleSection('mapShippingZones')}
                    >
                      <h4>🚚 Zonas de Envío</h4>
                      <span className={`collapse-icon ${openSections.mapShippingZones ? 'open' : ''}`}>▼</span>
                    </div>
                    {openSections.mapShippingZones && (
                      <div className="section-body">
                        <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem', marginBottom: '12px' }}>
                          Define las tarifas de envío según la distancia desde la tienda.
                          La última zona cubre todas las distancias mayores.
                        </p>
                        {(settings.mapConfig?.shippingZones || []).map((zone, index) => (
                          <div key={index} style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 120px 120px auto',
                            gap: '8px',
                            alignItems: 'center',
                            marginBottom: '8px'
                          }}>
                            <input
                              type="text"
                              value={zone.label}
                              placeholder="Nombre de la zona"
                              onChange={(e) => {
                                const zones = [...(settings.mapConfig?.shippingZones || [])];
                                zones[index] = { ...zones[index], label: e.target.value };
                                setSettings(prev => ({
                                  ...prev,
                                  mapConfig: { ...prev.mapConfig, shippingZones: zones }
                                }));
                              }}
                              style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--gray-200)', fontSize: '0.9rem' }}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <input
                                type="number"
                                min="0"
                                value={zone.maxDistance >= 9999 ? '' : zone.maxDistance}
                                placeholder="∞"
                                onChange={(e) => {
                                  const zones = [...(settings.mapConfig?.shippingZones || [])];
                                  const val = e.target.value === '' ? 9999 : Number(e.target.value);
                                  zones[index] = { ...zones[index], maxDistance: val };
                                  setSettings(prev => ({
                                    ...prev,
                                    mapConfig: { ...prev.mapConfig, shippingZones: zones }
                                  }));
                                }}
                                style={{ width: '80px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--gray-200)', fontSize: '0.9rem' }}
                              />
                              <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>km</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <input
                                type="number"
                                min="0"
                                value={zone.price}
                                placeholder="Tarifa"
                                onChange={(e) => {
                                  const zones = [...(settings.mapConfig?.shippingZones || [])];
                                  zones[index] = { ...zones[index], price: Number(e.target.value) || 0 };
                                  setSettings(prev => ({
                                    ...prev,
                                    mapConfig: { ...prev.mapConfig, shippingZones: zones }
                                  }));
                                }}
                                style={{ width: '80px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--gray-200)', fontSize: '0.9rem' }}
                              />
                              <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>$</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const zones = (settings.mapConfig?.shippingZones || []).filter((_, i) => i !== index);
                                setSettings(prev => ({
                                  ...prev,
                                  mapConfig: { ...prev.mapConfig, shippingZones: zones }
                                }));
                              }}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                fontSize: '1.1rem', color: '#ef4444', padding: '4px 8px'
                              }}
                              title="Eliminar zona"
                            >✕</button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const zones = [...(settings.mapConfig?.shippingZones || [])];
                            const lastMax = zones.length > 0 ? (zones[zones.length - 1].maxDistance || 50) : 0;
                            const newMax = lastMax >= 9999 ? 9999 : lastMax + 10;
                            zones.push({ maxDistance: newMax, price: 0, label: `Zona ${zones.length + 1}` });
                            setSettings(prev => ({
                              ...prev,
                              mapConfig: { ...prev.mapConfig, shippingZones: zones }
                            }));
                          }}
                          style={{
                            marginTop: '8px', padding: '8px 16px', borderRadius: '8px',
                            border: '1px dashed var(--gray-300)', background: 'none',
                            cursor: 'pointer', color: 'var(--primary-color)', fontWeight: 600,
                            fontSize: '0.9rem', width: '100%'
                          }}
                        >+ Agregar zona</button>
                      </div>
                    )}
                  </section>
                </div>
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
