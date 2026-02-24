// routes/storage.routes.js - Unified image storage proxy
// Supabase mode: proxies to Supabase Storage (remote fetch)
// Postgres mode: serves from local filesystem (uploads/)
// Cloudflare caches responses at the edge via long Cache-Control headers.

const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Resolve uploads directory (same default as postgres adapter)
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');

/**
 * GET /storage/*
 * Routes to local filesystem (postgres) or Supabase Storage (supabase).
 */
router.get('/*', async (req, res) => {
  const storagePath = req.params[0];
  if (!storagePath) {
    return res.status(400).json({ message: 'Storage path required' });
  }

  // Common cache headers (Cloudflare CDN caches these)
  res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
  res.setHeader('X-Cache-Proxy', 'backend-storage-proxy');
  res.removeHeader('Set-Cookie');

  const provider = (process.env.DB_PROVIDER || 'supabase').toLowerCase();

  // ── Postgres: serve from local filesystem ──
  if (provider === 'postgres') {
    const filePath = path.join(UPLOADS_DIR, storagePath);
    // Prevent directory traversal
    if (!filePath.startsWith(UPLOADS_DIR)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).end();
    }
    return res.sendFile(filePath);
  }

  // ── Supabase: proxy to remote storage ──
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    return res.status(503).json({ message: 'Database not configured yet' });
  }

  const targetUrl = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${storagePath}`;

  try {
    const response = await fetch(targetUrl);
    if (!response.ok) return res.status(response.status).end();

    // Forward content-type from Supabase
    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);

    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('Storage proxy error:', err.message);
    res.status(502).json({ message: 'Failed to fetch from storage' });
  }
});

module.exports = router;
