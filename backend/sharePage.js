const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const stripTags = (value = '') => String(value).replace(/<[^>]*>/g, '').trim();

const ensureAbsoluteUrl = (url, baseUrl) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const normalizedBase = (baseUrl || '').replace(/\/$/, '');
  const normalizedPath = url.startsWith('/') ? url : `/${url}`;
  return `${normalizedBase}${normalizedPath}`;
};

const extractProductIdFromSlug = (slug = '') => {
  const match = String(slug).match(/(\d+)(?:\/)?$/);
  if (!match) return null;
  return parseInt(match[1], 10);
};

const buildShareHtml = ({ title, description, imageUrl, url }) => {
  const safeTitle = escapeHtml(title || 'Producto');
  const safeDescription = escapeHtml(stripTags(description || ''));
  const safeImage = escapeHtml(imageUrl || '');
  const safeUrl = escapeHtml(url || '');

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}">

  <meta property="og:type" content="product">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:image" content="${safeImage}">
  <meta property="og:image:alt" content="${safeTitle}">
  <meta property="og:url" content="${safeUrl}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDescription}">
  <meta name="twitter:image" content="${safeImage}">

  <meta http-equiv="refresh" content="0; url=${safeUrl}">
</head>
<body>
  <p>Redirigiendo...</p>
  <script>window.location.replace(${JSON.stringify(url || '')});</script>
</body>
</html>`;
};

module.exports = {
  buildShareHtml,
  extractProductIdFromSlug,
  ensureAbsoluteUrl
};
