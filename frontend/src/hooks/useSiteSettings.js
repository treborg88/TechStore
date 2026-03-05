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
  const [siteName, setSiteName] = useState(() => localStorage.getItem('siteName') || 'TechStore');
  const [siteIcon, setSiteIcon] = useState(() => localStorage.getItem('siteIcon') || '🛍️');
  const [siteLogo, setSiteLogo] = useState(() => localStorage.getItem('siteLogo') || '');
  const [siteLogoSize, setSiteLogoSize] = useState(() => parseInt(localStorage.getItem('siteLogoSize')) || 40);
  const [siteNameImage, setSiteNameImage] = useState(() => localStorage.getItem('siteNameImage') || '');
  const [siteNameImageSize, setSiteNameImageSize] = useState(() => parseInt(localStorage.getItem('siteNameImageSize')) || 32);

  const [heroSettings, setHeroSettings] = useState({
    title: 'La Mejor Tecnología a Tu Alcance',
    description: 'Descubre nuestra selección de smartphones y accesorios con las mejores ofertas del mercado.',
    primaryBtn: 'Ver Productos',
    secondaryBtn: 'Ofertas Especiales',
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
    textColor: '#1e293b'
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
    showPromotionBanner: true,
    promoTitle: '¡Oferta Especial del Mes!',
    promoText: '¡Gran venta de año nuevo! 20% de descuento en todo.',
    promoButtonText: 'Ver Oferta',
    promoImage: ''
  });

  // Landing page config (enabled/disabled + route)
  const [landingPageConfig, setLandingPageConfig] = useState(() => cloneLandingPageConfig(null));

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
    if (data.heroTitle || data.heroDescription || data.heroPrimaryBtn || data.heroSecondaryBtn || data.heroImage || data.heroTitleSize || data.heroDescriptionSize || data.heroPositionY || data.heroPositionX || data.heroImageWidth !== undefined || data.heroOverlayOpacity !== undefined || data.heroHeight !== undefined || data.heroTextColor || data.heroBannerImage) {
      setHeroSettings({
        title: data.heroTitle || 'La Mejor Tecnología a Tu Alcance',
        description: data.heroDescription || 'Descubre nuestra selección de smartphones y accesorios con las mejores ofertas del mercado.',
        primaryBtn: data.heroPrimaryBtn || 'Ver Productos',
        secondaryBtn: data.heroSecondaryBtn || 'Ofertas Especiales',
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
        bannerOpacity: parseFloat(data.heroBannerOpacity) || 100
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
        textColor: data.textColor || '#1e293b'
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
      showPromotionBanner: data.showPromotionBanner !== 'false' && data.showPromotionBanner !== false,
      promoTitle: data.promoTitle || '¡Oferta Especial del Mes!',
      promoText: data.promoText || '',
      promoButtonText: data.promoButtonText || 'Ver Oferta',
      promoImage: data.promoImage || ''
    });

    // Category filters config
    if (data.categoryFiltersConfig) {
      try {
        const parsed = typeof data.categoryFiltersConfig === 'string'
          ? JSON.parse(data.categoryFiltersConfig)
          : data.categoryFiltersConfig;
        setCategoryFilterSettings(cloneCategoryConfig(parsed));
      } catch (err) {
        console.error('Error parsing categoryFiltersConfig:', err);
        setCategoryFilterSettings(cloneCategoryConfig(null));
      }
    }

    // Product card config
    if (data.productCardConfig) {
      try {
        const parsed = typeof data.productCardConfig === 'string'
          ? JSON.parse(data.productCardConfig)
          : data.productCardConfig;
        setProductCardSettings(cloneProductCardConfig(parsed));
      } catch (err) {
        console.error('Error parsing productCardConfig:', err);
        setProductCardSettings(cloneProductCardConfig(null));
      }
    }

    // Landing page config
    if (data.landingPageConfig) {
      try {
        const parsed = typeof data.landingPageConfig === 'string'
          ? JSON.parse(data.landingPageConfig)
          : data.landingPageConfig;
        setLandingPageConfig(cloneLandingPageConfig(parsed));
      } catch (err) {
        console.error('Error parsing landingPageConfig:', err);
      }
    }
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
  }, []);

  // --- Efecto: actualizar título de la página y favicon dinámicamente ---
  useEffect(() => {
    document.title = siteName || 'Tienda en linea';
    
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
    root.style.setProperty('--text-color', themeSettings.textColor);
    
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
    landingPageConfig
  };
}
