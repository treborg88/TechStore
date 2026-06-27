import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSeo } from '../hooks/useSeo';
import ProductImageGallery from '../components/products/ProductImageGallery';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Footer from '../components/common/Footer';
import { apiFetch, apiUrl } from '../services/apiClient';
import { DEFAULT_CATEGORY_FILTERS_CONFIG, DEFAULT_PRODUCT_CARD_CONFIG } from '../config';
import { formatCurrency } from '../utils/formatCurrency';
import { resolveImageUrl } from '../utils/resolveImageUrl';
import { stripHtml } from '../utils/stripHtml';
import { toast } from 'react-hot-toast';

const HERO_IMAGE_CACHE_KEY = 'hero_image_cache';
const HERO_IMAGE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Pixel sizes for the 10 steps of the images-style card size stepper (step 5 = 90px default)
const IMG_SIZE_STEPS = [40, 54, 68, 80, 90, 110, 134, 162, 196, 234];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const HOME_PAGE_SIZE = 20;

function Home({ products, loading, error, addToCart, heroSettings, categoryFilterSettings, productCardSettings, promoSettings, searchBarConfig, whyChooseUsConfig, newsletterConfig }) {
  // SEO dinámico para la página principal
  useSeo('home');
  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const sortDropdownRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Ref para el scroll de categorías
  const categoriesScrollRef = useRef(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  // Ref para el scroll de productos
  const productsScrollRef = useRef(null);
  const isDraggingProducts = useRef(false);
  const startXProducts = useRef(0);
  const scrollLeftProducts = useRef(0);
  const navigate = useNavigate();

  const [localHeroImage, setLocalHeroImage] = useState(null);
  const [promoProductDetails, setPromoProductDetails] = useState(null);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSubmitting, setNewsletterSubmitting] = useState(false);

  const defaultWhyChooseUs = useMemo(() => ({
    enabled: true,
    sectionTitle: '¿Por Qué Elegirnos?',
    items: [
      { icon: '🚚', title: 'Envío Gratis', text: 'En todos tus pedidos superiores a $50' },
      { icon: '⚡', title: 'Garantía Extendida', text: '12 meses adicionales en todos nuestros productos' },
      { icon: '🔒', title: 'Pago Seguro', text: 'Todas las transacciones son 100% seguras' }
    ]
  }), []);

  const whyChooseUs = useMemo(() => {
    const source = whyChooseUsConfig || {};
    return {
      enabled: source.enabled !== false,
      sectionTitle: source.sectionTitle || defaultWhyChooseUs.sectionTitle,
      items: Array.isArray(source.items) && source.items.length > 0 ? source.items : defaultWhyChooseUs.items
    };
  }, [whyChooseUsConfig, defaultWhyChooseUs]);

  const defaultNewsletter = useMemo(() => ({
    enabled: false,
    title: 'Únete a Nuestra Newsletter',
    text: 'Recibe las últimas noticias sobre tecnología y ofertas exclusivas directamente en tu correo.',
    placeholder: 'Tu correo electrónico',
    buttonText: 'Suscribirse'
  }), []);

  const newsletter = useMemo(() => {
    const source = newsletterConfig || {};
    return {
      enabled: source.enabled === true,
      title: source.title || defaultNewsletter.title,
      text: source.text || defaultNewsletter.text,
      placeholder: source.placeholder || defaultNewsletter.placeholder,
      buttonText: source.buttonText || defaultNewsletter.buttonText
    };
  }, [newsletterConfig, defaultNewsletter]);

  const handleNewsletterSubmit = async (e) => {
    e.preventDefault();

    const email = String(newsletterEmail || '').toLowerCase().trim();
    if (!EMAIL_REGEX.test(email)) {
      toast.error('Ingresa un email válido para suscribirte.');
      return;
    }

    setNewsletterSubmitting(true);
    try {
      const response = await apiFetch(apiUrl('/newsletter/subscribe'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data.message || 'No se pudo registrar la suscripción.');
        return;
      }

      setNewsletterEmail('');
      toast.success('Gracias por unirte a nuestra newsletter.');
    } catch {
      toast.error('No se pudo registrar la suscripción.');
    } finally {
      setNewsletterSubmitting(false);
    }
  };

  const selectedPromoProductId = String(promoSettings?.promoProductId || '').trim();
  const selectedPromoProductFromList = useMemo(() => {
    if (!selectedPromoProductId) return null;
    return (products || []).find((product) => String(product.id) === selectedPromoProductId) || null;
  }, [products, selectedPromoProductId]);

  const selectedPromoProduct = selectedPromoProductFromList || promoProductDetails;

  useEffect(() => {
    const fetchPromoProduct = async () => {
      if (!selectedPromoProductId || selectedPromoProductFromList) {
        setPromoProductDetails(null);
        return;
      }

      try {
        const response = await apiFetch(apiUrl(`/products/${selectedPromoProductId}`));
        if (response.ok) {
          const data = await response.json();
          setPromoProductDetails(data || null);
        } else {
          setPromoProductDetails(null);
        }
      } catch {
        setPromoProductDetails(null);
      }
    };

    fetchPromoProduct();
  }, [selectedPromoProductId, selectedPromoProductFromList]);

  // Efecto para pre-cargar la imagen del Hero y guardarla localmente
  useEffect(() => {
    const isValidCachedImage = (entry, expectedUrl) => {
      if (!entry || typeof entry !== 'object') return false;
      if (entry.url !== expectedUrl) return false;
      if (!entry.data || typeof entry.data !== 'string') return false;
      if (!entry.data.startsWith('data:image/')) return false;
      const age = Date.now() - Number(entry.timestamp || 0);
      if (!Number.isFinite(age) || age < 0 || age > HERO_IMAGE_CACHE_TTL_MS) return false;
      return true;
    };

    const clearHeroCache = () => {
      try { localStorage.removeItem(HERO_IMAGE_CACHE_KEY); } catch { /* no-op */ }
    };
    
    if (heroSettings?.image) {
      // 1. Intentar cargar desde localStorage primero
      try {
        const cachedEntry = localStorage.getItem(HERO_IMAGE_CACHE_KEY);
        if (cachedEntry) {
          const parsedEntry = JSON.parse(cachedEntry);
          if (isValidCachedImage(parsedEntry, heroSettings.image)) {
            setLocalHeroImage(parsedEntry.data);
            setImageLoaded(true);
            return; // Usamos la imagen en caché y terminamos
          }
          clearHeroCache();
        }
      } catch (e) {
        console.error("Error reading hero cache", e);
        clearHeroCache();
      }

      // 2. Si no está en caché o la URL cambió, descargar y guardar
      setImageLoaded(false);
      setLocalHeroImage(null); // Reset local image while loading new one

      const fetchAndCacheImage = async () => {
        try {
          // Usar fetch para obtener el blob
          const response = await fetch(heroSettings.image);
          const blob = await response.blob();
          
          // Convertir a base64
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result;
            
            // Actualizar estado
            setLocalHeroImage(base64data);
            setImageLoaded(true);

            // Guardar en localStorage
            try {
              localStorage.setItem(HERO_IMAGE_CACHE_KEY, JSON.stringify({
                url: heroSettings.image,
                data: base64data,
                timestamp: new Date().getTime()
              }));
            } catch (storageError) {
              console.warn("Could not cache hero image locally (likely quota exceeded)", storageError);
              // Si falla el caché, al menos la mostramos
            }
          };
          reader.readAsDataURL(blob);
        } catch (err) {
          console.error("Error fetching hero image for caching:", err);
          clearHeroCache();
          // Fallback: usar la URL directa si falla la descarga
          setLocalHeroImage(heroSettings.image);
          setImageLoaded(true);
        }
      };

      fetchAndCacheImage();
    } else {
      setImageLoaded(false);
      setLocalHeroImage(null);
    }
  }, [heroSettings?.image]);

  const toCssUnit = useCallback((value, unit = 'px') => {
    if (value === null || value === undefined || value === '') return undefined;
    if (typeof value === 'number') return `${value}${unit}`;
    const trimmed = String(value).trim();
    if (trimmed.length === 0) return undefined;
    return /^[0-9]+(\.[0-9]+)?$/.test(trimmed) ? `${trimmed}${unit}` : trimmed;
  }, []);

  const categoryConfig = useMemo(() => {
    const base = DEFAULT_CATEGORY_FILTERS_CONFIG;
    const incoming = categoryFilterSettings && typeof categoryFilterSettings === 'object'
      ? categoryFilterSettings
      : base;
    if (incoming.useDefault) {
      return { ...base, useDefault: true };
    }
    return {
      ...base,
      ...incoming,
      categories: Array.isArray(incoming.categories) && incoming.categories.length > 0
        ? incoming.categories
        : base.categories,
      styles: {
        ...base.styles,
        ...(incoming.styles || {})
      }
    };
  }, [categoryFilterSettings]);

  const filterStyle = categoryConfig.filterStyle || 'cards';

  const categories = useMemo(() => {
    const list = Array.isArray(categoryConfig.categories) ? categoryConfig.categories : [];
    const hasTodos = list.some((item) => item?.slug === 'todos');
    if (hasTodos) return list;
    return [DEFAULT_CATEGORY_FILTERS_CONFIG.categories[0], ...list];
  }, [categoryConfig.categories]);

  // Detectar si las categorías caben en la pantalla (sin overflow)
  const [categoriesFitOnScreen, setCategoriesFitOnScreen] = useState(true);

  useEffect(() => {
    const el = categoriesScrollRef.current;
    if (!el) return;

    const checkFit = () => {
      setCategoriesFitOnScreen(el.scrollWidth <= el.clientWidth);
    };

    checkFit();

    // Re-evaluar en resize
    const observer = new ResizeObserver(checkFit);
    observer.observe(el.parentElement);

    return () => observer.disconnect();
  }, [categories, filterStyle]);

  const categoryStyleVars = useMemo(() => {
    if (categoryConfig.useDefault) return {};
    const styles = categoryConfig.styles || {};
    const imgSizePx = (IMG_SIZE_STEPS[(categoryConfig.filterImageSize ?? 5) - 1] ?? 90) + 'px';
    return {
      '--category-card-width': toCssUnit(styles.cardWidth),
      '--category-card-height': toCssUnit(styles.cardHeight),
      '--category-card-padding': toCssUnit(styles.cardPadding),
      '--category-card-radius': toCssUnit(styles.cardRadius),
      '--category-card-bg': styles.cardBackground || undefined,
      '--category-card-border': styles.cardBorderColor || undefined,
      '--category-card-shadow': styles.cardShadow || undefined,
      '--category-card-hover-bg': styles.hoverBackground || undefined,
      '--category-card-hover-border': styles.hoverBorderColor || undefined,
      '--category-card-hover-shadow': styles.hoverShadow || undefined,
      '--category-title-hover-color': styles.hoverTitleColor || undefined,
      '--category-card-active-bg': styles.activeBackground || undefined,
      '--category-card-active-border': styles.activeBorderColor || undefined,
      '--category-card-active-shadow': styles.activeShadow || undefined,
      '--category-title-color': styles.titleColor || undefined,
      '--category-title-active-color': styles.activeTitleColor || undefined,
      '--category-title-size': toCssUnit(styles.titleSize, 'px'),
      '--category-title-weight': styles.titleWeight || undefined,
      '--category-title-transform': styles.titleTransform || undefined,
      '--category-title-letter-spacing': toCssUnit(styles.titleLetterSpacing, 'px'),
      '--category-icon-size': toCssUnit(styles.iconSize, 'px'),
      '--filter-img-size': imgSizePx
    };
  }, [categoryConfig, toCssUnit]);

  const productCardConfig = useMemo(() => {
    const base = DEFAULT_PRODUCT_CARD_CONFIG;
    const incoming = productCardSettings && typeof productCardSettings === 'object'
      ? productCardSettings
      : base;
    if (incoming.useDefault) {
      return { ...base, useDefault: true };
    }
    return {
      ...base,
      ...incoming,
      layout: {
        ...base.layout,
        ...(incoming.layout || {})
      },
      styles: {
        ...base.styles,
        ...(incoming.styles || {})
      }
    };
  }, [productCardSettings]);

  const productCardStyleVars = useMemo(() => {
    if (productCardConfig.useDefault) return {};
    const styles = productCardConfig.styles || {};
    const layout = productCardConfig.layout || {};
    return {
      '--product-grid-columns': layout.columnsMobile || undefined,
      '--product-grid-columns-md': layout.columnsTablet || undefined,
      '--product-grid-columns-lg': layout.columnsDesktop || undefined,
      '--product-grid-columns-xl': layout.columnsWide || undefined,
      '--product-card-width': toCssUnit(styles.cardWidth),
      '--product-card-height': toCssUnit(styles.cardHeight),
      '--product-card-padding': toCssUnit(styles.cardPadding),
      '--product-card-radius': toCssUnit(styles.cardRadius),
      '--product-card-border-width': toCssUnit(styles.borderWidth),
      '--product-card-border-style': styles.borderStyle || undefined,
      '--product-card-border-color': styles.borderColor || undefined,
      '--product-card-bg': styles.background || undefined,
      '--product-card-shadow': styles.shadow || undefined,
      '--product-title-color': styles.titleColor || undefined,
      '--product-title-size': toCssUnit(styles.titleSize, 'px'),
      '--product-title-weight': styles.titleWeight || undefined,
      '--product-price-color': styles.priceColor || undefined,
      '--product-price-size': toCssUnit(styles.priceSize, 'px'),
      '--product-price-weight': styles.priceWeight || undefined,
      '--product-desc-color': styles.descriptionColor || undefined,
      '--product-desc-size': toCssUnit(styles.descriptionSize, 'px'),
      '--product-category-color': styles.categoryColor || undefined,
      '--product-category-size': toCssUnit(styles.categorySize, 'px'),
      '--product-button-bg': styles.buttonBg || undefined,
      '--product-button-color': styles.buttonText || undefined,
      '--product-button-radius': toCssUnit(styles.buttonRadius),
      '--product-button-border': styles.buttonBorder || undefined,
      '--product-button-shadow': styles.buttonShadow || undefined,
      '--product-card-gap': toCssUnit(styles.cardGap),
      '--product-grid-padding': toCssUnit(styles.gridPadding)
    };
  }, [productCardConfig, toCssUnit]);

  const productCardOrientationClass = productCardConfig.layout?.orientation === 'horizontal'
    ? 'product-card-horizontal'
    : 'product-card-vertical';

  useEffect(() => {
    const valid = categories.some((category) => category?.slug === selectedCategory);
    if (!valid) {
      setSelectedCategory('todos');
    }
  }, [categories, selectedCategory]);

  // Funciones para drag con mouse en categorías
  const handleMouseDown = (e) => {
    isDragging.current = true;
    startX.current = e.pageX - categoriesScrollRef.current.offsetLeft;
    scrollLeft.current = categoriesScrollRef.current.scrollLeft;
    categoriesScrollRef.current.style.cursor = 'grabbing';
  };

  const handleMouseLeave = () => {
    isDragging.current = false;
    if (categoriesScrollRef.current) {
      categoriesScrollRef.current.style.cursor = 'grab';
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    if (categoriesScrollRef.current) {
      categoriesScrollRef.current.style.cursor = 'grab';
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const x = e.pageX - categoriesScrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 2; // Multiplicador para velocidad de scroll
    categoriesScrollRef.current.scrollLeft = scrollLeft.current - walk;
  };

  // Funciones para drag con mouse en productos
  const handleProductsMouseDown = (e) => {
    isDraggingProducts.current = true;
    startXProducts.current = e.pageX - productsScrollRef.current.offsetLeft;
    scrollLeftProducts.current = productsScrollRef.current.scrollLeft;
    productsScrollRef.current.style.cursor = 'grabbing';
  };

  const handleProductsMouseLeave = () => {
    isDraggingProducts.current = false;
    if (productsScrollRef.current) {
      productsScrollRef.current.style.cursor = 'grab';
    }
  };

  const handleProductsMouseUp = () => {
    isDraggingProducts.current = false;
    if (productsScrollRef.current) {
      productsScrollRef.current.style.cursor = 'grab';
    }
  };

  const handleProductsMouseMove = (e) => {
    if (!isDraggingProducts.current) return;
    e.preventDefault();
    const x = e.pageX - productsScrollRef.current.offsetLeft;
    const walk = (x - startXProducts.current) * 2;
    productsScrollRef.current.scrollLeft = scrollLeftProducts.current - walk;
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchQuery, sortBy]);

  // Client-side filtered + paginated products
  const filteredProducts = useMemo(() => {
    let result = products.filter(p => !p.is_hidden);

    // Category filter
    if (selectedCategory !== 'todos') {
      result = result.filter(p => p.category === selectedCategory);
    }

    // Search filter
    const searchTerm = searchQuery.trim().toLowerCase();
    if (searchTerm.length > 0) {
      result = result.filter(p =>
        p.name.toLowerCase().includes(searchTerm) ||
        (p.description ?? '').toLowerCase().includes(searchTerm)
      );
    }

    // Sort
    switch (sortBy) {
      case 'oldest':
        result.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
        break;
      case 'price_asc':
        result.sort((a, b) => Number(a.price) - Number(b.price));
        break;
      case 'price_desc':
        result.sort((a, b) => Number(b.price) - Number(a.price));
        break;
      case 'name_asc':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name_desc':
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      default: // 'Más recientes'
        result.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    return result;
  }, [products, selectedCategory, searchQuery, sortBy]);

  // Pagination derived from filtered products
  const homePagination = useMemo(() => {
    const total = filteredProducts.length;
    const totalPages = Math.max(1, Math.ceil(total / HOME_PAGE_SIZE));
    const safePage = Math.min(currentPage, totalPages);
    return { page: safePage, limit: HOME_PAGE_SIZE, total, totalPages };
  }, [filteredProducts, currentPage]);

  // Current page slice
  const pageProducts = useMemo(() => {
    const start = (homePagination.page - 1) * HOME_PAGE_SIZE;
    return filteredProducts.slice(start, start + HOME_PAGE_SIZE);
  }, [filteredProducts, homePagination]);

  // Clear search when changing category
  const handleCategoryChangeWithClear = (categorySlug) => {
    setSearchQuery('');
    setSelectedCategory(categorySlug);
  };

  // Immediate search (no server round-trip)
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  // Clear search input
  const handleSearchClear = () => {
    setSearchQuery('');
  };

  // Sort change handler
  const handleSortChange = (value) => {
    setSortBy(value);
    setSortDropdownOpen(false);
  };

  // Close sort dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target)) {
        setSortDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sort options config
  const sortOptions = [
    { value: '', label: 'Más recientes' },
    { value: 'oldest', label: 'Más antiguos' },
    { value: 'price_asc', label: 'Precio: menor a mayor' },
    { value: 'price_desc', label: 'Precio: mayor a menor' },
    { value: 'name_asc', label: 'Nombre: A-Z' },
    { value: 'name_desc', label: 'Nombre: Z-A' },
  ];

  // Hero style variables for dynamic positioning and sizing
  const heroStyleVars = useMemo(() => {
    const positionX = heroSettings?.positionX || 'left';
    const positionY = heroSettings?.positionY || 'center';
    
    // Map positionX to text-align and align-items
    const textAlign = positionX === 'center' ? 'center' : positionX === 'right' ? 'right' : 'left';
    const alignItems = positionX === 'center' ? 'center' : positionX === 'right' ? 'flex-end' : 'flex-start';
    
    return {
      '--hero-title-size': `${heroSettings?.titleSize || 2.1}rem`,
      '--hero-description-size': `${heroSettings?.descriptionSize || 1.05}rem`,
      '--hero-justify-content': positionY,
      '--hero-align-items': alignItems,
      '--hero-text-align': textAlign,
      '--hero-image-width': `${heroSettings?.imageWidth || 100}%`,
      '--hero-min-height': `${heroSettings?.height || 360}px`,
      '--hero-text-color': heroSettings?.textColor || '#ffffff',
      '--hero-bg-size': heroSettings?.imageBgZoom && heroSettings.imageBgZoom !== 100
        ? `${heroSettings.imageBgZoom}%` : 'cover',
      '--hero-text-padding-x': `${heroSettings?.textPaddingX ?? 0}px`,
      '--hero-text-padding-y': `${heroSettings?.textPaddingY ?? 0}px`
    };
  }, [heroSettings?.titleSize, heroSettings?.descriptionSize, heroSettings?.positionX, heroSettings?.positionY, heroSettings?.imageWidth, heroSettings?.height, heroSettings?.textColor, heroSettings?.imageBgZoom, heroSettings?.textPaddingX, heroSettings?.textPaddingY]);

  // Banner overlay image styles
  const bannerOverlayStyles = useMemo(() => {
    if (!heroSettings?.bannerImage) return null;
    
    const posX = heroSettings?.bannerPositionX;
    const posY = heroSettings?.bannerPositionY;
    
    const styles = {
      position: 'absolute',
      width: `${heroSettings?.bannerSize || 150}px`,
      height: 'auto',
      maxHeight: '90%',
      objectFit: 'contain',
      opacity: (heroSettings?.bannerOpacity || 100) / 100,
      zIndex: 1,
      pointerEvents: 'none'
    };
    
    // Numeric % positioning (from fine-tune panel) — takes priority over keywords
    if (!isNaN(Number(posX))) {
      styles.left = `${posX}%`;
      styles.right = 'auto';
    } else if (posX === 'left') {
      styles.left = '5%';
      styles.right = 'auto';
    } else if (posX === 'center') {
      styles.left = '50%';
      styles.transform = 'translateX(-50%)';
    } else {
      styles.right = '5%';
      styles.left = 'auto';
    }
    
    if (!isNaN(Number(posY))) {
      styles.top = `${posY}%`;
      styles.bottom = 'auto';
    } else if (posY === 'top') {
      styles.top = '10%';
      styles.bottom = 'auto';
    } else if (posY === 'center') {
      styles.top = '50%';
      styles.transform = (styles.transform || '') + ' translateY(-50%)';
    } else {
      styles.bottom = '10%';
      styles.top = 'auto';
    }
    
    return styles;
  }, [heroSettings?.bannerImage, heroSettings?.bannerSize, heroSettings?.bannerPositionX, heroSettings?.bannerPositionY, heroSettings?.bannerOpacity]);

  // Calculate overlay opacity for hero image
  const overlayOpacity = heroSettings?.overlayOpacity ?? 0.5;

  return (
    <>
      {/* Hero Section */}
      <section 
        className={`hero-section ${heroSettings?.image && imageLoaded ? 'has-bg show-image' : 'has-bg'}`}
        style={{
          ...(heroSettings?.image && imageLoaded ? { 
            backgroundImage: `linear-gradient(rgba(0,0,0,${overlayOpacity}), rgba(0,0,0,${overlayOpacity})), url(${localHeroImage || heroSettings.image})`,
            backgroundSize: '100% 100%, var(--hero-bg-size, cover)',
            backgroundPosition: '0 0, 50% 50%',
            backgroundRepeat: 'no-repeat, no-repeat'
          } : {}),
          ...heroStyleVars,
          position: 'relative'
        }}
      >
        {/* Banner overlay image */}
        {heroSettings?.bannerImage && bannerOverlayStyles && (
          <img 
            src={heroSettings.bannerImage} 
            alt="" 
            style={bannerOverlayStyles}
            className="hero-banner-overlay"
          />
        )}
        <div className="container hero-container">
          <div className="hero-content">
            <h2 className="hero-title">{heroSettings?.title ?? "La Mejor Tecnología a Tu Alcance"}</h2>
            <p className="hero-text">{heroSettings?.description ?? "Descubre nuestra selección de smartphones y accesorios con las mejores ofertas del mercado."}</p>
          </div>
        </div>
      </section>
      
      {/* Categories */}
      {filterStyle !== 'none' && (
      <section className={`categories-section filter-style-${filterStyle}`} style={categoryStyleVars}>
        <div className="container">
          <h2 className="section-title">Explora Nuestras Categorías</h2>
          <div className="categories-scroll-container">
            <div 
              className={`categories-grid-scroll${categoriesFitOnScreen ? ' categories-fit-center' : ''}`}
              ref={categoriesScrollRef}
              onMouseDown={handleMouseDown}
              onMouseLeave={handleMouseLeave}
              onMouseUp={handleMouseUp}
              onMouseMove={handleMouseMove}
            >
              {categories.map(category => (
                <button
                  key={category.id}
                  className={`category-card ${selectedCategory === category.slug ? 'active' : ''}`}
                  onClick={() => handleCategoryChangeWithClear(category.slug)}
                >
                  {filterStyle === 'images' && category.image ? (
                    <>
                      {/* Blurry fill behind the contained image */}
                      <img src={category.image} className="cat-img-blur-bg" aria-hidden="true" alt="" />
                      {/* Main image, contained (no crop) */}
                      <img src={category.image} className="cat-img-main" alt="" />
                    </>
                  ) : (
                    <div className="category-icon">
                      {category.image ? (
                        <img src={category.image} alt={category.name} className="category-icon-image" />
                      ) : (
                        category.icon
                      )}
                    </div>
                  )}
                  <h3 className="category-title">{category.name}</h3>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
      )}

      {/* Search Bar with integrated Sort */}
      {searchBarConfig?.enabled !== false && (
      <section className="search-section">
        <div className="container">
          <div className="search-bar-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Buscar productos por nombre o descripción..."
              value={searchQuery}
              onChange={handleSearchChange}
              aria-label="Buscar productos"
            />
            {searchQuery && (
              <button 
                className="search-clear-btn"
                onClick={handleSearchClear}
                aria-label="Limpiar búsqueda"
              >
                ✕
              </button>
            )}
            {/* Sort dropdown integrado en la barra */}
            <div className="sort-dropdown" ref={sortDropdownRef}>
              <button
                className="sort-dropdown-toggle"
                onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                aria-label="Ordenar productos"
                aria-expanded={sortDropdownOpen}
              >
                <span className="sort-dropdown-arrow">▾</span>
              </button>
              {sortDropdownOpen && (
                <ul className="sort-dropdown-menu">
                  {sortOptions.map((opt) => (
                    <li
                      key={opt.value}
                      className={`sort-dropdown-item${sortBy === opt.value ? ' active' : ''}`}
                      onClick={() => handleSortChange(opt.value)}
                    >
                      {sortBy === opt.value && <span className="sort-check">✓</span>}
                      {opt.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {(searchQuery || sortBy) && (
            <p className="search-results-count">
              {homePagination.total} producto{homePagination.total !== 1 ? 's' : ''} encontrado{homePagination.total !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </section>
      )}
      
      {/* Featured Products */}
      <section className="products-section" style={productCardStyleVars}>
        <div className="container">
          <h2 className="section-title">Productos Destacados</h2>
          
          {loading && <LoadingSpinner size="large" />}
          
          {error && <div className="error-message">{error}</div>}
          
          {!loading && !error && (
            <>
            <div className="products-scroll-container">
              <div 
                className="products-grid"
                ref={productsScrollRef}
                onMouseDown={handleProductsMouseDown}
                onMouseLeave={handleProductsMouseLeave}
                onMouseUp={handleProductsMouseUp}
                onMouseMove={handleProductsMouseMove}
              >
                {pageProducts.length > 0 ? (
                  pageProducts.map(product => (
                    <div key={product.id} className={`product-card ${productCardOrientationClass}`}>
                      <ProductImageGallery
                        images={product.images || product.image}
                        productName={product.name}
                        productDescription={product.description}
                        className="product-image"
                        onImageClick={() => navigate(`/product/${product.id}`)}
                      />
                      <div className="product-content">
                        <span className="product-category">{product.category}</span>
                        <Link to={`/product/${product.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                          <h3 className="product-title">{product.name}</h3>
                        </Link>
                        <p className="product-description">{stripHtml(product.description)}</p>
                        <div className="product-footer">
                          <span className="product-price">{formatCurrency(product.price, productCardConfig.currency)}</span>
                          {/* Variant products navigate to detail page for selection */}
                          <button
                            onClick={() => product.has_variants ? navigate(`/product/${product.id}`) : addToCart(product)}
                            className="add-to-cart-button"
                          >
                            {product.has_variants ? 'Ver opciones' : 'Agregar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-products-message">
                    {searchQuery ? `No se encontraron productos${selectedCategory !== 'todos' ? ` en "${selectedCategory}"` : ''} con tu búsqueda.` : selectedCategory !== 'todos' ? `No hay productos en "${selectedCategory}".` : 'No hay productos disponibles.'}
                  </div>
                )}
              </div>
            </div>
            
            {homePagination.totalPages > 1 && (
                <div className="pagination-controls">
                    <button 
                        className="secondary-button"
                        disabled={homePagination.page === 1}
                        onClick={() => setCurrentPage(homePagination.page - 1)}
                    >
                        &laquo; Anterior
                    </button>
                    <span>Página {homePagination.page} de {homePagination.totalPages}</span>
                    <button 
                        className="secondary-button"
                        disabled={homePagination.page === homePagination.totalPages}
                        onClick={() => setCurrentPage(homePagination.page + 1)}
                    >
                        Siguiente &raquo;
                    </button>
                </div>
            )}
            </>
          )}
        </div>
      </section>
      
      {/* Promo Section - controlado por admin settings */}
      {promoSettings?.showPromotionBanner && (
        <section className="promo-section">
          <div className="container promo-container">
            <div className="promo-content">
              <h2 className="promo-title">{promoSettings?.promoTitle || '¡Oferta Especial del Mes!'}</h2>
              <div
                className="promo-text"
                dangerouslySetInnerHTML={{
                  __html: promoSettings?.promoText || 'Obtén un 20% de descuento en todos nuestros smartphones cuando compras cualquier accesorio.'
                }}
              />
              <button
                className="promo-button"
                onClick={() => {
                  if (selectedPromoProductId) {
                    navigate(`/product/${selectedPromoProductId}`);
                    return;
                  }
                  navigate('/tienda');
                }}
              >
                {promoSettings?.promoButtonText || 'Ver Oferta'}
              </button>
            </div>
            {/* Imagen de promo: usa el producto seleccionado */}
            {(selectedPromoProduct?.images?.[0]?.image_url || selectedPromoProduct?.image) && (
              <div className="promo-image">
                <img
                  src={resolveImageUrl(selectedPromoProduct?.images?.[0]?.image_url || selectedPromoProduct?.image)}
                  alt={selectedPromoProduct?.name || 'Promoción especial'}
                />
              </div>
            )}
          </div>
        </section>
      )}
      
      {/* Features */}
      {whyChooseUs.enabled && (
        <section className="features-section">
          <div className="container">
            <h2 className="section-title">{whyChooseUs.sectionTitle}</h2>
            <div className="features-grid">
              {whyChooseUs.items.map((item, index) => (
                <div className="feature-card" key={`feature-${index}`}>
                  <div className="feature-icon">{item.icon || '⭐'}</div>
                  <h3 className="feature-title">{item.title || 'Beneficio'}</h3>
                  <p className="feature-text">{item.text || ''}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      
      {/* Newsletter */}
      {newsletter.enabled && (
        <section className="newsletter-section">
          <div className="container">
            <h2 className="newsletter-title">{newsletter.title}</h2>
            <p className="newsletter-text">{newsletter.text}</p>
            <form className="newsletter-form" onSubmit={handleNewsletterSubmit}>
              <input
                type="email"
                placeholder={newsletter.placeholder}
                className="newsletter-input"
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                required
              />
              <button className="newsletter-button" type="submit" disabled={newsletterSubmitting}>
                {newsletterSubmitting ? 'Enviando...' : newsletter.buttonText}
              </button>
            </form>
          </div>
        </section>
      )}
    </>
  );
}

export default Home;
