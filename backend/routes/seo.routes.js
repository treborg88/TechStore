// seo.routes.js - Rutas para robots.txt y sitemap.xml dinámicos
const express = require('express');
const router = express.Router();
const { statements, dbConfigured } = require('../database');

// Cache de seoConfig (5 min TTL)
let _seoCache = null;
let _seoCacheTime = 0;
const SEO_CACHE_TTL = 5 * 60 * 1000;

/**
 * Lee seoConfig de app_settings con cache
 */
async function getSeoConfig() {
  const now = Date.now();
  if (_seoCache && now - _seoCacheTime < SEO_CACHE_TTL) return _seoCache;
  try {
    if (!dbConfigured()) return {};
    const settings = await statements.getSettings();
    const raw = settings.find(s => s.id === 'seoConfig')?.value;
    _seoCache = raw ? JSON.parse(raw) : {};
  } catch {
    _seoCache = {};
  }
  _seoCacheTime = now;
  return _seoCache;
}

/**
 * GET /robots.txt
 * Genera robots.txt dinámico basado en seoConfig.robots
 */
router.get('/robots.txt', async (_req, res) => {
  try {
    const cfg = await getSeoConfig();
    const robotsDirective = cfg.robots || 'index, follow';
    // Convertir directiva a formato robots.txt
    const disallow = robotsDirective.includes('noindex') ? '/' : '';
    const sitemapUrl = cfg.sitemapEnabled !== false
      ? `${_req.protocol}://${_req.get('host')}/sitemap.xml`
      : '';

    let body = `User-agent: *\n`;
    if (disallow) {
      body += `Disallow: ${disallow}\n`;
    } else {
      body += `Disallow: /api/\nDisallow: /admin\n`;
    }
    if (sitemapUrl) {
      body += `\nSitemap: ${sitemapUrl}\n`;
    }

    res.type('text/plain').send(body);
  } catch (err) {
    res.type('text/plain').send('User-agent: *\nDisallow: /api/\n');
  }
});

/**
 * GET /sitemap.xml
 * Genera sitemap.xml dinámico con páginas estáticas + productos
 */
router.get('/sitemap.xml', async (req, res) => {
  try {
    const cfg = await getSeoConfig();
    // Si sitemap deshabilitado, devolver 404
    if (cfg.sitemapEnabled === false) {
      return res.status(404).send('Sitemap disabled');
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const today = new Date().toISOString().split('T')[0];

    // Páginas estáticas
    const staticPages = [
      { loc: '/', priority: '1.0', changefreq: 'daily' },
      { loc: '/tienda', priority: '0.9', changefreq: 'daily' },
      { loc: '/contacto', priority: '0.5', changefreq: 'monthly' },
      { loc: '/orders/track', priority: '0.3', changefreq: 'monthly' },
    ];

    // Productos dinámicos desde la base de datos
    let products = [];
    if (dbConfigured()) {
      try {
        const result = await statements.getProducts({ page: 1, limit: 1000 });
        products = (result?.data || []).filter(p => !p.is_hidden);
      } catch {
        // Si falla, no incluir productos
      }
    }

    // Construir XML
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Páginas estáticas
    for (const page of staticPages) {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}${page.loc}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += `  </url>\n`;
    }

    // Productos
    for (const product of products) {
      const slug = product.name
        ? product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        : product.id;
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/product/${product.id}</loc>\n`;
      xml += `    <lastmod>${product.updated_at?.split('T')[0] || today}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    }

    xml += `</urlset>`;

    res.type('application/xml').send(xml);
  } catch (err) {
    res.status(500).type('text/plain').send('Error generating sitemap');
  }
});

module.exports = router;
