// useSeo.js - Hook que inyecta meta tags SEO dinámicamente en el <head>
// Cada página llama useSeo('pageKey', { productName, productImage, ... })
// Lee la configuración de seoConfig via useSiteSettings (ya cacheado)
import { useEffect } from 'react';
import { useSiteSettings } from './useSiteSettings';
import { SEO_DEFAULTS } from '../utils/seoDefaults';

/**
 * Helper: actualiza o crea un meta tag en el <head>
 * @param {string} attr - 'name' o 'property'
 * @param {string} key - Valor del atributo (ej: 'description', 'og:title')
 * @param {string} content - Contenido del meta tag
 */
const setMeta = (attr, key, content) => {
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (content) {
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  } else if (el) {
    // Limpiar si no hay contenido
    el.setAttribute('content', '');
  }
};
/**
 * Helper: actualiza o crea un <link> tag
 */
const setLink = (rel, href) => {
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (href) {
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', rel);
      document.head.appendChild(el);
    }
    el.setAttribute('href', href);
  }
};

/**
 * Inyecta JSON-LD script en el <head>
 */
const setJsonLd = (data) => {
  const id = 'seo-json-ld';
  let script = document.getElementById(id);
  if (data) {
    if (!script) {
      script = document.createElement('script');
      script.id = id;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
  } else if (script) {
    script.remove();
  }
};

/**
 * Hook principal de SEO
 * @param {string} pageKey - Clave de la página (home, store, product, cart, etc.)
 * @param {Object} [dynamicData={}] - Datos dinámicos para placeholders
 * @param {string} [dynamicData.productName] - Nombre del producto (para product pages)
 * @param {string} [dynamicData.productDescription] - Descripción del producto
 * @param {string} [dynamicData.productImage] - Imagen del producto
 * @param {number} [dynamicData.productPrice] - Precio del producto
 * @param {string} [dynamicData.categoryName] - Nombre de categoría
 */
export function useSeo(pageKey = 'home', dynamicData = {}) {
  const { siteName, seoConfig, siteLogo } = useSiteSettings();

  useEffect(() => {
    // Si pageKey es null (ej: componente embedded), no hacer nada
    if (!pageKey) return;

    // Merge config con defaults
    const cfg = { ...SEO_DEFAULTS, ...seoConfig, pages: { ...SEO_DEFAULTS.pages, ...(seoConfig?.pages || {}) } };
    const pageConfig = cfg.pages[pageKey] || SEO_DEFAULTS.pages[pageKey] || {};
    const origin = window.location.origin;
    const currentUrl = window.location.href;

    // --- 1. Title ---
    const titleTemplate = pageConfig.titleTemplate || `${pageKey} | {siteName}`;
    const resolvedTitle = titleTemplate
      .replace(/\{siteName\}/g, siteName || 'Tienda')
      .replace(/\{productName\}/g, dynamicData.productName || '')
      .replace(/\{categoryName\}/g, dynamicData.categoryName || '');
    document.title = resolvedTitle;

    // --- 2. Meta Description ---
    const description = dynamicData.productDescription
      || pageConfig.description
      || cfg.metaDescription
      || '';
    setMeta('name', 'description', description.slice(0, 200));

    // --- 3. Keywords ---
    setMeta('name', 'keywords', cfg.metaKeywords || '');

    // --- 4. Robots ---
    setMeta('name', 'robots', cfg.robots || 'index, follow');

    // --- 5. Canonical ---
    setLink('canonical', currentUrl.split('?')[0]);

    // --- 6. OG Tags ---
    const ogImage = dynamicData.productImage || cfg.ogImage || siteLogo || '';
    setMeta('property', 'og:title', resolvedTitle);
    setMeta('property', 'og:description', description.slice(0, 200));
    setMeta('property', 'og:image', ogImage.startsWith('http') ? ogImage : (ogImage ? `${origin}${ogImage}` : ''));
    setMeta('property', 'og:url', currentUrl);
    setMeta('property', 'og:type', pageKey === 'product' ? 'product' : (cfg.ogType || 'website'));
    setMeta('property', 'og:site_name', siteName || '');
    setMeta('property', 'og:locale', cfg.locale || 'es_DO');

    // Product-specific OG tags
    if (pageKey === 'product' && dynamicData.productPrice) {
      setMeta('property', 'product:price:amount', String(dynamicData.productPrice));
      setMeta('property', 'product:price:currency', dynamicData.currency || 'DOP');
    }

    // --- 7. Twitter Card ---
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', resolvedTitle);
    setMeta('name', 'twitter:description', description.slice(0, 200));
    setMeta('name', 'twitter:image', ogImage.startsWith('http') ? ogImage : (ogImage ? `${origin}${ogImage}` : ''));

    // --- 8. Verification tags ---
    if (cfg.googleVerification) setMeta('name', 'google-site-verification', cfg.googleVerification);
    if (cfg.bingVerification) setMeta('name', 'msvalidate.01', cfg.bingVerification);

    // --- 9. JSON-LD ---
    if (cfg.jsonLdEnabled !== false) {
      if (pageKey === 'product' && dynamicData.productName) {
        // Product structured data
        setJsonLd({
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: dynamicData.productName,
          description: dynamicData.productDescription || description,
          image: ogImage,
          url: currentUrl,
          offers: dynamicData.productPrice ? {
            '@type': 'Offer',
            price: dynamicData.productPrice,
            priceCurrency: dynamicData.currency || 'DOP',
            availability: dynamicData.productStock > 0
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock'
          } : undefined
        });
      } else {
        // Organization structured data (global pages)
        setJsonLd({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: siteName,
          url: origin,
          logo: siteLogo ? (siteLogo.startsWith('http') ? siteLogo : `${origin}${siteLogo}`) : undefined
        });
      }
    } else {
      setJsonLd(null);
    }
  }, [pageKey, siteName, seoConfig, siteLogo, dynamicData.productName, dynamicData.productDescription, dynamicData.productImage, dynamicData.productPrice, dynamicData.productStock, dynamicData.currency, dynamicData.categoryName]);
}
