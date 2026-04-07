// routes/storage.routes.js - Image storage proxy (local filesystem)
// Serves product images from the uploads/ directory.
// Cloudflare caches responses at the edge via long Cache-Control headers.

const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Resolve uploads directory (same default as postgres adapter)
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');

/**
 * GET /storage/*
 * Serves images from local filesystem (uploads/ directory).
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

  // Serve from local filesystem
  const filePath = path.join(UPLOADS_DIR, storagePath);

  // Prevent directory traversal
  if (!filePath.startsWith(UPLOADS_DIR)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).end();
  }
  return res.sendFile(filePath);
});

module.exports = router;
