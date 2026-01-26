const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const stripTags = (value = '') => String(value).replace(/<[^>]*>/g, '').trim();

/**
 * Truncate text to a maximum length for meta descriptions
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length (default 160 for SEO)
 */
const truncateText = (text = '', maxLength = 160) => {
  const clean = stripTags(text);
  if (clean.length <= maxLength) return clean;
  return clean.substring(0, maxLength - 3).trim() + '...';
};

const ensureAbsoluteUrl = (url, baseUrl) => {
  if (!url) return '';
  // Already absolute URL
  if (/^https?:\/\//i.test(url)) return url;
  const normalizedBase = (baseUrl || '').replace(/\/$/, '');
  const normalizedPath = url.startsWith('/') ? url : `/${url}`;
  return `${normalizedBase}${normalizedPath}`;
};

const extractProductIdFromSlug = (slug = '') => {
  // Match product ID at the end of slug (e.g., "product-name-123" -> 123)
  const match = String(slug).match(/(\d+)(?:\/)?$/);
  if (!match) return null;
  return parseInt(match[1], 10);
};

/**
 * Build HTML page with Open Graph and Twitter Card meta tags
 * @param {Object} params - Page parameters
 * @param {string} params.title - Product title
 * @param {string} params.description - Product description
 * @param {string} params.imageUrl - Product image URL
 * @param {string} params.url - Canonical URL (frontend product page)
 * @param {string} [params.siteName] - Site name for og:site_name
 * @param {string} [params.price] - Product price for og:price
 * @param {string} [params.currency] - Price currency (default: DOP)
 */
const buildShareHtml = ({ title, description, imageUrl, url, siteName = 'TechStore', price, currency = 'DOP' }) => {
  const safeTitle = escapeHtml(title || 'Producto');
  const safeDescription = escapeHtml(truncateText(description || '', 200));
  const safeImage = escapeHtml(imageUrl || '');
  const safeUrl = escapeHtml(url || '');
  const safeSiteName = escapeHtml(siteName);

  // Price meta tags (optional)
  const priceMetaTags = price ? `
  <meta property="product:price:amount" content="${escapeHtml(String(price))}">
  <meta property="product:price:currency" content="${escapeHtml(currency)}">` : '';

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle} - ${safeSiteName}</title>
  <meta name="description" content="${safeDescription}">
  <link rel="canonical" href="${safeUrl}">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="${safeSiteName}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:image" content="${safeImage}">
  <meta property="og:image:alt" content="${safeTitle}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${safeUrl}">
  <meta property="og:locale" content="es_DO">${priceMetaTags}

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDescription}">
  <meta name="twitter:image" content="${safeImage}">
  <meta name="twitter:image:alt" content="${safeTitle}">

  <!-- WhatsApp / Telegram preview support -->
  <meta property="og:image:secure_url" content="${safeImage}">

  <!-- Redirect to product page -->
  <meta http-equiv="refresh" content="0; url=${safeUrl}">
  
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
    .loading { text-align: center; color: #666; }
    .spinner { width: 40px; height: 40px; border: 3px solid #e0e0e0; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="loading">
    <div class="spinner"></div>
    <p>Cargando producto...</p>
  </div>
  <script>window.location.replace(${JSON.stringify(url || '')});</script>
</body>
</html>`;
};

module.exports = {
  buildShareHtml,
  extractProductIdFromSlug,
  ensureAbsoluteUrl,
  truncateText,
  stripTags,
  escapeHtml
};
