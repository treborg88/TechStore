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
import SeoSection from './SeoSection';
import StoreLocationMap from '../common/StoreLocationMap';
import SiteCustomizer from './SiteCustomizer';
import { DEFAULT_CATEGORY_FILTERS_CONFIG, DEFAULT_PRODUCT_CARD_CONFIG } from '../../config';
import { normalizeCurrencyCode } from '../../utils/settingsHelpers';
import { cloneLandingPageConfig } from '../../utils/landingPageDefaults';
import { CACHE_KEYS, getCacheItem, setCacheItem } from '../../utils/cacheStorage';

function SettingsManager() {
  const location = useLocation();
  const [activeSection, setActiveSection] = useState('site');
  const [siteTab, setSiteTab] = useState('general');
  const [uiMode, setUiMode] = useState('quick');
  const [openSections, setOpenSections] = useState({
    theme: true,
    home: true,
    identity: false,
    ecommerce: true,
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
    siteName: 'Eonsclover',
    siteIcon: '🛍️',
    siteLogo: '',
    siteLogoSize: 40,
    siteNameImage: '',
    siteNameImageSize: 32,
    maintenanceMode: false,
    siteDomain: '',
    freeShippingThreshold: 50000,
    contactEmail: 'soporte@eonsclover.com',
    showPromotionBanner: false,
    promoTitle: '¡Oferta Especial del Mes!',
    promoText: '¡Gran venta de año nuevo! 20% de descuento en todo.',
    promoButtonText: 'Ver Oferta',
    promoImage: '',
    promoProductId: '',
    whyChooseUsConfig: {
      enabled: true,
      sectionTitle: '¿Por Qué Elegirnos?',
      items: [
        { icon: '🚚', title: 'Envío Gratis', text: 'En todos tus pedidos superiores a $50' },
        { icon: '⚡', title: 'Garantía Extendida', text: '12 meses adicionales en todos nuestros productos' },
        { icon: '🔒', title: 'Pago Seguro', text: 'Todas las transacciones son 100% seguras' }
      ]
    },
    newsletterConfig: {
      enabled: false,
      title: 'Únete a Nuestra Newsletter',
      text: 'Recibe las últimas noticias sobre tecnología y ofertas exclusivas directamente en tu correo.',
      placeholder: 'Tu correo electrónico',
      buttonText: 'Suscribirse'
    },
    footerConfig: {
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
    },
    mailFromName: 'Eonsclover',
    mailFrom: '',
    mailUser: '',
    mailPassword: '',
    mailHost: '',
    mailPort: 587,
    mailUseTls: true,
    mailTemplateHtml: '<div style="font-family: Arial, sans-serif; color:#111827; line-height:1.6;">\n  <div style="background:#111827;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0;">\n    <h2 style="margin:0;">{{siteIcon}} {{siteName}}</h2>\n    <p style="margin:4px 0 0;">Tu pedido fue recibido</p>\n  </div>\n  <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 10px 10px;">\n    <p>Hola <strong>{{customerName}}</strong>,</p>\n    <p>Tu orden <strong>{{orderNumber}}</strong> fue tomada y está en proceso de preparación para envío.</p>\n    <h3 style="margin-top:20px;">Resumen</h3>\n    {{itemsTable}}\n    <p style="margin-top:16px;"><strong>Total:</strong> {{total}}</p>\n    <p><strong>Dirección:</strong> {{shippingAddress}}</p>\n    <p><strong>Pago:</strong> {{paymentMethod}}</p>\n    <p style="margin-top:20px;">Gracias por comprar con nosotros.</p>\n  </div>\n</div>',
    fontFamily: 'system-ui, sans-serif',
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
    // Search bar config
    searchBarConfig: {
      enabled: true
    },
    // Header navigation visibility
    navigationConfig: {
      showHomeLink: true,
      showStoreLink: true
    },
    // Map & shipping configuration
    mapConfig: cloneMapConfig(),
    // Invoice PDF configuration
    invoicePdfConfig: {},
    // SEO configuration
    seoConfig: {}
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

  const ADVANCED_ONLY_TABS = ['cards', 'filters', 'ecommerce', 'email', 'database', 'chatbot'];

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
        } else if (key === 'searchBarConfig') {
          try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            typedData[key] = {
              enabled: parsed?.enabled !== false
            };
          } catch {
            typedData[key] = { enabled: true };
          }
        } else if (key === 'whyChooseUsConfig') {
          try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            const fallbackItems = [
              { icon: '🚚', title: 'Envío Gratis', text: 'En todos tus pedidos superiores a $50' },
              { icon: '⚡', title: 'Garantía Extendida', text: '12 meses adicionales en todos nuestros productos' },
              { icon: '🔒', title: 'Pago Seguro', text: 'Todas las transacciones son 100% seguras' }
            ];
            typedData[key] = {
              enabled: parsed?.enabled !== false,
              sectionTitle: parsed?.sectionTitle || '¿Por Qué Elegirnos?',
              items: Array.isArray(parsed?.items) && parsed.items.length > 0 ? parsed.items : fallbackItems
            };
          } catch {
            typedData[key] = {
              enabled: true,
              sectionTitle: '¿Por Qué Elegirnos?',
              items: [
                { icon: '🚚', title: 'Envío Gratis', text: 'En todos tus pedidos superiores a $50' },
                { icon: '⚡', title: 'Garantía Extendida', text: '12 meses adicionales en todos nuestros productos' },
                { icon: '🔒', title: 'Pago Seguro', text: 'Todas las transacciones son 100% seguras' }
              ]
            };
          }
        } else if (key === 'newsletterConfig') {
          try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            typedData[key] = {
              enabled: parsed?.enabled === true,
              title: parsed?.title || 'Únete a Nuestra Newsletter',
              text: parsed?.text || 'Recibe las últimas noticias sobre tecnología y ofertas exclusivas directamente en tu correo.',
              placeholder: parsed?.placeholder || 'Tu correo electrónico',
              buttonText: parsed?.buttonText || 'Suscribirse'
            };
          } catch {
            typedData[key] = {
              enabled: false,
              title: 'Únete a Nuestra Newsletter',
              text: 'Recibe las últimas noticias sobre tecnología y ofertas exclusivas directamente en tu correo.',
              placeholder: 'Tu correo electrónico',
              buttonText: 'Suscribirse'
            };
          }
        } else if (key === 'footerConfig') {
          try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            const fallback = {
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
            typedData[key] = {
              ...fallback,
              ...(parsed || {}),
              quickLinks: Array.isArray(parsed?.quickLinks) && parsed.quickLinks.length > 0 ? parsed.quickLinks : fallback.quickLinks,
              supportLinks: Array.isArray(parsed?.supportLinks) && parsed.supportLinks.length > 0 ? parsed.supportLinks : fallback.supportLinks,
              socialLinks: Array.isArray(parsed?.socialLinks) && parsed.socialLinks.length > 0 ? parsed.socialLinks : fallback.socialLinks
            };
          } catch {
            typedData[key] = {
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
        } else if (key === 'seoConfig') {
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

  // Bulk-update multiple settings keys at once (used by SiteCustomizer palette/layout presets)
  const handleBulkChange = (values) => {
    setSettings(prev => ({ ...prev, ...values }));
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
        searchBarConfig: JSON.stringify({ enabled: settings.searchBarConfig?.enabled !== false }),
        whyChooseUsConfig: JSON.stringify(settings.whyChooseUsConfig || {
          enabled: true,
          sectionTitle: '¿Por Qué Elegirnos?',
          items: [
            { icon: '🚚', title: 'Envío Gratis', text: 'En todos tus pedidos superiores a $50' },
            { icon: '⚡', title: 'Garantía Extendida', text: '12 meses adicionales en todos nuestros productos' },
            { icon: '🔒', title: 'Pago Seguro', text: 'Todas las transacciones son 100% seguras' }
          ]
        }),
        newsletterConfig: JSON.stringify(settings.newsletterConfig || {
          enabled: false,
          title: 'Únete a Nuestra Newsletter',
          text: 'Recibe las últimas noticias sobre tecnología y ofertas exclusivas directamente en tu correo.',
          placeholder: 'Tu correo electrónico',
          buttonText: 'Suscribirse'
        }),
        footerConfig: JSON.stringify(settings.footerConfig || {
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
        }),
        mapConfig: JSON.stringify(settings.mapConfig || cloneMapConfig()),
        invoicePdfConfig: JSON.stringify(settings.invoicePdfConfig || {}),
        seoConfig: JSON.stringify(settings.seoConfig || {})
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
        setTimeout(() => window.location.reload(), 500);
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
    },
    seo: {
      title: 'SEO',
      subtitle: 'Meta tags, títulos por página, sitemap y verificación de buscadores.'
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
              <button
                type="button"
                className="settings-mode-toggle"
                onClick={() => setUiMode(isAdvancedMode ? 'quick' : 'advanced')}
              >
                {isAdvancedMode ? 'Básico' : 'Avanzado'}
              </button>

              <div className="settings-nav-group">
                <p className="settings-nav-group-title">Nucleo de Sitio</p>
                {renderTabButton('general', '🎨 General')}
                {renderTabButton('landing', '🚀 Landing Page')}
                {renderTabButton('store', '🛍️ Tienda')}
              </div>

              <div className="settings-nav-group">
                <p className="settings-nav-group-title">Catalogo</p>
                {isAdvancedMode && renderTabButton('cards', '🃏 Tarjetas')}
                {isAdvancedMode && renderTabButton('filters', '🔍 Filtros')}
              </div>

              <div className="settings-nav-group">
                <p className="settings-nav-group-title">Operacion</p>
                {isAdvancedMode && renderTabButton('ecommerce', '🛒 E-commerce')}
                {renderTabButton('payments', '💳 Pagos')}
                {renderTabButton('map', '🗺️ Mapa')}
                {isAdvancedMode && renderTabButton('email', '✉️ Correo')}
                {isAdvancedMode && renderTabButton('database', '🗄️ Base de datos')}
                {isAdvancedMode && renderTabButton('chatbot', '🤖 Chatbot')}
                {renderTabButton('invoice', '🧾 Factura PDF')}
                {renderTabButton('seo', '🔎 SEO')}
              </div>
            </nav>

            <div className="settings-content">
              {siteTab !== 'database' && (
                <div className="settings-tab-intro">
                  <h3>{tabMeta.title}</h3>
                  <p>{tabMeta.subtitle}</p>
                </div>
              )}

              {siteTab === 'general' && (
                <SiteCustomizer
                  settings={settings}
                  onChange={handleChange}
                  onBulkChange={handleBulkChange}
                  onImageUpload={handleImageUpload}
                />
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

              {siteTab === 'seo' && (
                <SeoSection settings={settings} setSettings={setSettings} />
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
