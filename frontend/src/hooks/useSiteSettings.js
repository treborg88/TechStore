// useSiteSettings.js - Hook para gestión de toda la configuración visual del sitio
import { useState, useEffect } from 'react';
import { DEFAULT_CATEGORY_FILTERS_CONFIG, DEFAULT_PRODUCT_CARD_CONFIG } from '../config';
import { apiFetch, apiUrl } from '../services/apiClient';
import { cloneCategoryConfig, cloneProductCardConfig } from '../utils/settingsHelpers';
import { cloneLandingPageConfig } from '../utils/landingPageDefaults';
import { CACHE_KEYS, getCacheItem, setCacheItem, removeCacheItem } from '../utils/cacheStorage';

const SETTINGS_CACHE_FRESH_MS = 2 * 60 * 1000;
const SETTINGS_CACHE_MAX_STALE_MS = 24 * 60 * 60 * 1000;
const SETTINGS_REVALIDATE_COOLDOWN_MS = 30 * 1000;

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

/**
 * Hook que encapsula toda la configuración visual del sitio:
 * - Nombre, icono, logo del sitio
 * - Hero settings (imagen, textos, posición)
 * - Header settings (colores, transparencia)
 * - Theme settings (colores del tema)
 * - Product detail hero settings
 * - Category filter settings
 * - Product card settings
 * - Efecto de favicon/título dinámico
 * - Efecto de variables CSS de tema
 * - Fetch desde backend con caché (10 min)
 */
export function useSiteSettings() {
  // --- Estado de configuración del sitio ---
  const [siteName, setSiteName] = useState(() => localStorage.getItem('siteName') || 'Eonsclover');
  const [siteIcon, setSiteIcon] = useState(() => localStorage.getItem('siteIcon') || '🛍️');
  const [siteLogo, setSiteLogo] = useState(() => localStorage.getItem('siteLogo') || '');
  const [siteLogoSize, setSiteLogoSize] = useState(() => parseInt(localStorage.getItem('siteLogoSize')) || 40);
  const [siteNameImage, setSiteNameImage] = useState(() => localStorage.getItem('siteNameImage') || '');
  const [siteNameImageSize, setSiteNameImageSize] = useState(() => parseInt(localStorage.getItem('siteNameImageSize')) || 32);

  const [heroSettings, setHeroSettings] = useState({
    title: 'La Mejor Tecnología a Tu Alcance',
    description: 'Descubre nuestra selección de smartphones y accesorios con las mejores ofertas del mercado.',
    image: '',
    titleSize: 2.1,
    descriptionSize: 1.05,
    positionY: 'center',
    positionX: 'left',
    imageWidth: 100,
    overlayOpacity: 0.5,
    height: 360,
    textColor: '#ffffff',
    bannerImage: '',
    bannerSize: 150,
    bannerPositionX: 'right',
    bannerPositionY: 'center',
    bannerOpacity: 100
  });

  const [headerSettings, setHeaderSettings] = useState({
    bgColor: '#2563eb',
    transparency: 100,
    textColor: '#ffffff',
    buttonColor: '#ffffff',
    buttonTextColor: '#2563eb'
  });

  const [themeSettings, setThemeSettings] = useState({
    primaryColor: '#2563eb',
    secondaryColor: '#7c3aed',
    accentColor: '#f59e0b',
    backgroundColor: '#f8fafc',
    textColor: '#1e293b',
    fontFamily: 'system-ui, sans-serif'
  });

  const [productDetailHeroImage, setProductDetailHeroImage] = useState('');
  const [productDetailHeroSettings, setProductDetailHeroSettings] = useState({
    useHomeHero: true,
    height: 200,
    overlayOpacity: 0.5,
    bannerImage: '',
    bannerSize: 120,
    bannerPositionX: 'right',
    bannerPositionY: 'center',
    bannerOpacity: 100
  });

  const [categoryFilterSettings, setCategoryFilterSettings] = useState(() => (
    JSON.parse(JSON.stringify(DEFAULT_CATEGORY_FILTERS_CONFIG))
  ));

  const [productCardSettings, setProductCardSettings] = useState(() => (
    JSON.parse(JSON.stringify(DEFAULT_PRODUCT_CARD_CONFIG))
  ));

  // --- Estado de configuración de promo ---
  const [promoSettings, setPromoSettings] = useState({
    showPromotionBanner: false,
    promoTitle: '¡Oferta Especial del Mes!',
    promoText: '¡Gran venta de año nuevo! 20% de descuento en todo.',
    promoButtonText: 'Ver Oferta',
    promoImage: '',
    promoProductId: ''
  });

  // Landing page config (enabled/disabled + route)
  const [landingPageConfig, setLandingPageConfig] = useState(() => cloneLandingPageConfig(null));

  // Header nav links visibility
  const [navigationConfig, setNavigationConfig] = useState({
    showHomeLink: true,
    showStoreLink: true
  });

  const [storeModuleConfig, setStoreModuleConfig] = useState({
    enabled: true
  });

  const [searchBarConfig, setSearchBarConfig] = useState({
    enabled: true
  });

  const [whyChooseUsConfig, setWhyChooseUsConfig] = useState({
    enabled: true,
    sectionTitle: '¿Por Qué Elegirnos?',
    items: [
      { icon: '🚚', title: 'Envío Gratis', text: 'En todos tus pedidos superiores a $50' },
      { icon: '⚡', title: 'Garantía Extendida', text: '12 meses adicionales en todos nuestros productos' },
      { icon: '🔒', title: 'Pago Seguro', text: 'Todas las transacciones son 100% seguras' }
    ]
  });

  const [newsletterConfig, setNewsletterConfig] = useState({
    enabled: false,
    title: 'Únete a Nuestra Newsletter',
    text: 'Recibe las últimas noticias sobre tecnología y ofertas exclusivas directamente en tu correo.',
    placeholder: 'Tu correo electrónico',
    buttonText: 'Suscribirse'
  });

  const [footerConfig, setFooterConfig] = useState(DEFAULT_FOOTER_CONFIG);

  // SEO configuration
  const [seoConfig, setSeoConfig] = useState({});

  const parseJsonSetting = (rawValue, settingName) => {
    if (rawValue === undefined || rawValue === null) return null;
    if (typeof rawValue !== 'string') return rawValue;

    const normalized = rawValue.trim();
    // Legacy/broken values may be serialized as plain object string.
    if (!normalized || normalized === '[object Object]') return null;

    try {
      return JSON.parse(normalized);
    } catch (err) {
      console.error(`Error parsing ${settingName}:`, err);
      return null;
    }
  };

  // --- Aplica los datos del backend al estado local ---
  const applySettings = (data) => {
    if (data.siteName) {
      setSiteName(data.siteName);
      localStorage.setItem('siteName', data.siteName);
    }
    if (data.siteIcon) {
      setSiteIcon(data.siteIcon);
      localStorage.setItem('siteIcon', data.siteIcon);
    }
    if (data.siteLogo !== undefined) {
      setSiteLogo(data.siteLogo || '');
      localStorage.setItem('siteLogo', data.siteLogo || '');
    }
    if (data.siteNameImage !== undefined) {
      setSiteNameImage(data.siteNameImage || '');
      localStorage.setItem('siteNameImage', data.siteNameImage || '');
    }
    if (data.siteLogoSize !== undefined) {
      const size = parseInt(data.siteLogoSize) || 40;
      setSiteLogoSize(size);
      localStorage.setItem('siteLogoSize', size.toString());
    }
    if (data.siteNameImageSize !== undefined) {
      const size = parseInt(data.siteNameImageSize) || 32;
      setSiteNameImageSize(size);
      localStorage.setItem('siteNameImageSize', size.toString());
    }

    // Hero settings
    if (data.heroTitle || data.heroDescription || data.heroImage || data.heroTitleSize || data.heroDescriptionSize || data.heroPositionY || data.heroPositionX || data.heroImageWidth !== undefined || data.heroOverlayOpacity !== undefined || data.heroHeight !== undefined || data.heroTextColor || data.heroBannerImage || data.heroImageBgX !== undefined || data.heroImageBgY !== undefined || data.heroImageBgZoom !== undefined || data.heroTextPaddingX !== undefined || data.heroTextPaddingY !== undefined) {
      setHeroSettings({
        title: data.heroTitle || 'La Mejor Tecnología a Tu Alcance',
        description: data.heroDescription || 'Descubre nuestra selección de smartphones y accesorios con las mejores ofertas del mercado.',
        image: data.heroImage || '',
        titleSize: parseFloat(data.heroTitleSize) || 2.1,
        descriptionSize: parseFloat(data.heroDescriptionSize) || 1.05,
        positionY: data.heroPositionY || 'center',
        positionX: data.heroPositionX || 'left',
        imageWidth: parseFloat(data.heroImageWidth) || 100,
        overlayOpacity: parseFloat(data.heroOverlayOpacity) ?? 0.5,
        height: parseFloat(data.heroHeight) || 360,
        textColor: data.heroTextColor || '#ffffff',
        bannerImage: data.heroBannerImage || '',
        bannerSize: parseFloat(data.heroBannerSize) || 150,
        bannerPositionX: data.heroBannerPositionX || 'right',
        bannerPositionY: data.heroBannerPositionY || 'center',
        bannerOpacity: parseFloat(data.heroBannerOpacity) || 100,
        imageBgX:     parseInt(data.heroImageBgX)     ?? 50,
        imageBgY:     parseInt(data.heroImageBgY)     ?? 50,
        imageBgZoom:  parseInt(data.heroImageBgZoom)  ?? 100,
        textPaddingX: parseInt(data.heroTextPaddingX) ?? 0,
        textPaddingY: parseInt(data.heroTextPaddingY) ?? 0
      });
    }

    // Header settings
    if (data.headerBgColor || data.headerTransparency !== undefined || data.headerTextColor || data.headerButtonColor || data.headerButtonTextColor) {
      const transparencyValue = parseInt(data.headerTransparency);
      setHeaderSettings({
        bgColor: data.headerBgColor || '#2563eb',
        transparency: !isNaN(transparencyValue) ? transparencyValue : 100,
        textColor: data.headerTextColor || '#ffffff',
        buttonColor: data.headerButtonColor || '#ffffff',
        buttonTextColor: data.headerButtonTextColor || '#2563eb'
      });
    }

    // Theme settings
    if (data.primaryColor) {
      setThemeSettings({
        primaryColor: data.primaryColor || '#2563eb',
        secondaryColor: data.secondaryColor || '#7c3aed',
        accentColor: data.accentColor || '#f59e0b',
        backgroundColor: data.backgroundColor || '#f8fafc',
        textColor: data.textColor || '#1e293b',
        fontFamily: data.fontFamily || 'system-ui, sans-serif'
      });
    }

    // Product detail hero
    if (data.productDetailHeroImage || data.productDetailUseHomeHero !== undefined) {
      setProductDetailHeroImage(data.productDetailHeroImage || '');
      setProductDetailHeroSettings({
        useHomeHero: data.productDetailUseHomeHero !== 'false' && data.productDetailUseHomeHero !== false,
        height: parseFloat(data.productDetailHeroHeight) || 200,
        overlayOpacity: parseFloat(data.productDetailHeroOverlayOpacity) ?? 0.5,
        bannerImage: data.productDetailHeroBannerImage || '',
        bannerSize: parseFloat(data.productDetailHeroBannerSize) || 120,
        bannerPositionX: data.productDetailHeroBannerPositionX || 'right',
        bannerPositionY: data.productDetailHeroBannerPositionY || 'center',
        bannerOpacity: parseFloat(data.productDetailHeroBannerOpacity) || 100
      });
    }

    // Promo settings
    setPromoSettings({
      showPromotionBanner: data.showPromotionBanner === 'true' || data.showPromotionBanner === true,
      promoTitle: data.promoTitle || '¡Oferta Especial del Mes!',
      promoText: data.promoText || '',
      promoButtonText: data.promoButtonText || 'Ver Oferta',
      promoImage: data.promoImage || '',
      promoProductId: data.promoProductId || ''
    });

    // Category filters config
    if (data.categoryFiltersConfig) {
      const parsed = parseJsonSetting(data.categoryFiltersConfig, 'categoryFiltersConfig');
      setCategoryFilterSettings(cloneCategoryConfig(parsed));
    }

    // Product card config
    if (data.productCardConfig) {
      const parsed = parseJsonSetting(data.productCardConfig, 'productCardConfig');
      setProductCardSettings(cloneProductCardConfig(parsed));
    }

    // Landing page config (con fallback explícito para restauraciones antiguas)
    const parsedLanding = parseJsonSetting(data.landingPageConfig, 'landingPageConfig');
    setLandingPageConfig(cloneLandingPageConfig(parsedLanding));

    const parsedNavigation = parseJsonSetting(data.navigationConfig, 'navigationConfig');
    // Tie "Inicio" visibility to landing page enabled state
    const landingEnabled = parsedLanding?.enabled === true;
    setNavigationConfig({
      showHomeLink: landingEnabled,
      showStoreLink: parsedNavigation?.showStoreLink !== false
    });

    const parsedStoreModule = parseJsonSetting(data.storeModuleConfig, 'storeModuleConfig');
    setStoreModuleConfig({
      enabled: parsedStoreModule?.enabled !== false
    });

    const parsedSearchBar = parseJsonSetting(data.searchBarConfig, 'searchBarConfig');
    setSearchBarConfig({
      enabled: parsedSearchBar?.enabled !== false
    });

    const parsedWhyChooseUs = parseJsonSetting(data.whyChooseUsConfig, 'whyChooseUsConfig');
    setWhyChooseUsConfig({
      enabled: parsedWhyChooseUs?.enabled !== false,
      sectionTitle: parsedWhyChooseUs?.sectionTitle || '¿Por Qué Elegirnos?',
      items: Array.isArray(parsedWhyChooseUs?.items) && parsedWhyChooseUs.items.length > 0
        ? parsedWhyChooseUs.items
        : [
            { icon: '🚚', title: 'Envío Gratis', text: 'En todos tus pedidos superiores a $50' },
            { icon: '⚡', title: 'Garantía Extendida', text: '12 meses adicionales en todos nuestros productos' },
            { icon: '🔒', title: 'Pago Seguro', text: 'Todas las transacciones son 100% seguras' }
          ]
    });

    const parsedNewsletter = parseJsonSetting(data.newsletterConfig, 'newsletterConfig');
    setNewsletterConfig({
      enabled: parsedNewsletter?.enabled === true,
      title: parsedNewsletter?.title || 'Únete a Nuestra Newsletter',
      text: parsedNewsletter?.text || 'Recibe las últimas noticias sobre tecnología y ofertas exclusivas directamente en tu correo.',
      placeholder: parsedNewsletter?.placeholder || 'Tu correo electrónico',
      buttonText: parsedNewsletter?.buttonText || 'Suscribirse'
    });

    const parsedFooter = parseJsonSetting(data.footerConfig, 'footerConfig');
    setFooterConfig({
      ...DEFAULT_FOOTER_CONFIG,
      ...(parsedFooter || {}),
      quickLinks: Array.isArray(parsedFooter?.quickLinks) && parsedFooter.quickLinks.length > 0
        ? parsedFooter.quickLinks
        : DEFAULT_FOOTER_CONFIG.quickLinks,
      supportLinks: Array.isArray(parsedFooter?.supportLinks) && parsedFooter.supportLinks.length > 0
        ? parsedFooter.supportLinks
        : DEFAULT_FOOTER_CONFIG.supportLinks,
      socialLinks: Array.isArray(parsedFooter?.socialLinks) && parsedFooter.socialLinks.length > 0
        ? parsedFooter.socialLinks
        : DEFAULT_FOOTER_CONFIG.socialLinks
    });

    // SEO config
    const parsedSeo = parseJsonSetting(data.seoConfig, 'seoConfig');
    if (parsedSeo) setSeoConfig(parsedSeo);
  };

  // --- Efecto: fetch de settings con caché ---
  useEffect(() => {
    const fetchSettings = async (options = {}) => {
      const { force = false } = options;
      const cached = getCacheItem(CACHE_KEYS.settings);
      const now = new Date().getTime();
      const hasCached = !!cached?.data;
      const cacheAge = hasCached ? (now - (cached.timestamp || 0)) : Number.POSITIVE_INFINITY;
      const isCacheFresh = hasCached && cacheAge < SETTINGS_CACHE_FRESH_MS;
      const isCacheTooOld = hasCached && cacheAge > SETTINGS_CACHE_MAX_STALE_MS;
      const lastValidatedAt = Number(cached?.lastValidatedAt || 0);
      const shouldThrottleRevalidate = (now - lastValidatedAt) < SETTINGS_REVALIDATE_COOLDOWN_MS;

      if (isCacheTooOld) {
        removeCacheItem(CACHE_KEYS.settings);
      }

      // Aplicar caché inmediatamente si existe
      if (hasCached && !isCacheTooOld) {
        applySettings(cached.data);
      }

      // Política balanceada: siempre permitir revalidación, pero con throttle
      if (!force && hasCached && isCacheFresh && shouldThrottleRevalidate) {
        return;
      }

      try {
        const response = await apiFetch(apiUrl('/settings/public'));
        if (response.ok) {
          const data = await response.json();
          applySettings(data);
          setCacheItem(CACHE_KEYS.settings, {
            timestamp: new Date().getTime(),
            lastValidatedAt: new Date().getTime(),
            data
          });
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      }
    };

    fetchSettings();

    const revalidateOnFocus = () => fetchSettings({ force: false });
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        revalidateOnFocus();
      }
    };

    window.addEventListener('focus', revalidateOnFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', revalidateOnFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Efecto: actualizar favicon dinámicamente (título manejado por useSeo) ---
  useEffect(() => {
    const favicon = document.getElementById('favicon');
    if (favicon) {
      if (siteLogo) {
        favicon.href = siteLogo;
        favicon.type = 'image/png';
      } else if (siteIcon) {
        // Crear emoji favicon usando canvas
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.font = '56px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(siteIcon, 32, 36);
        favicon.href = canvas.toDataURL('image/png');
        favicon.type = 'image/png';
      }
    }
  }, [siteName, siteIcon, siteLogo]);

  // --- Efecto: aplicar variables CSS de tema ---
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', themeSettings.primaryColor);
    root.style.setProperty('--secondary-color', themeSettings.secondaryColor);
    root.style.setProperty('--accent-color', themeSettings.accentColor);
    root.style.setProperty('--background-color', themeSettings.backgroundColor);
    root.style.setProperty('--light-bg', themeSettings.backgroundColor);
    root.style.setProperty('--text-color', themeSettings.textColor);
    root.style.setProperty('--font-family', themeSettings.fontFamily || 'system-ui, sans-serif');
    
    // Generar hover automáticamente (un poco más oscuro)
    const darkenColor = (hex, div = 1.2) => {
      try {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgb(${Math.floor(r/div)}, ${Math.floor(g/div)}, ${Math.floor(b/div)})`;
      } catch { return hex; }
    };
    root.style.setProperty('--primary-hover', darkenColor(themeSettings.primaryColor));
  }, [themeSettings]);

  return {
    siteName,
    siteIcon,
    siteLogo,
    siteLogoSize,
    siteNameImage,
    siteNameImageSize,
    heroSettings,
    headerSettings,
    themeSettings,
    productDetailHeroImage,
    productDetailHeroSettings,
    categoryFilterSettings,
    productCardSettings,
    promoSettings,
    landingPageConfig,
    navigationConfig,
    storeModuleConfig,
    searchBarConfig,
    whyChooseUsConfig,
    newsletterConfig,
    footerConfig,
    seoConfig
  };
}
