// routes/storage.routes.js - Proxy for Supabase Storage images
// Serves /storage/* by fetching from Supabase Storage.
// This makes images work immediately after Setup Wizard (no Nginx reconfiguration needed).
// Cloudflare caches responses at the edge via long Cache-Control headers.

const express = require('express');
const router = express.Router();

/**
 * GET /storage/*
 * Proxies to Supabase Storage: {SUPABASE_URL}/storage/v1/object/public/{path}
 * Returns the image with cache-friendly headers for Cloudflare CDN.
 */
router.get('/*', async (req, res) => {
  // Extract the path after /storage/ (e.g., "products/products/image.png")
  const storagePath = req.params[0];
  if (!storagePath) {
    return res.status(400).json({ message: 'Storage path required' });
  }

  // Read SUPABASE_URL at request time (may change after Setup Wizard)
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    return res.status(503).json({ message: 'Database not configured yet' });
  }

  // Build the full Supabase Storage URL
  const targetUrl = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${storagePath}`;

  try {
    const response = await fetch(targetUrl);

    if (!response.ok) {
      return res.status(response.status).end();
    }

    // Forward content-type from Supabase
    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);

    // Cache headers: 30 days (Cloudflare CDN will cache this)
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    res.setHeader('X-Cache-Proxy', 'backend-storage-proxy');

    // Strip cookies/auth from response (public images only)
    res.removeHeader('Set-Cookie');

    // Pipe the image body to the client
    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('Storage proxy error:', err.message);
    res.status(502).json({ message: 'Failed to fetch from storage' });
  }
});

module.exports = router;
