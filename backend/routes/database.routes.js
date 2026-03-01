// routes/database.routes.js — Database backup/restore management (admin only)
// Provides endpoints to create, list, download, upload, restore, and delete
// paired SQL + images backups. Uses pg_dump/psql/tar CLI tools (apk).

const express = require('express');
const router = express.Router();
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const { authenticateToken, requireAdmin } = require('../middleware/auth');

// ── Constants ───────────────────────────────────────────────────────────────
const BACKUPS_DIR = path.join(__dirname, '..', 'backups');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const PRODUCTS_DIR = path.join(UPLOADS_DIR, 'products');
const MAX_UPLOAD_SIZE = 500 * 1024 * 1024; // 500 MB (images can be large)
const MAIN_TABLES = ['users', 'products', 'product_images', 'orders', 'order_items', 'cart', 'app_settings', 'verification_codes'];

// Ensure directories exist on load
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
if (!fs.existsSync(PRODUCTS_DIR)) fs.mkdirSync(PRODUCTS_DIR, { recursive: true });

// ── Multer config for .sql / .tar.gz uploads ────────────────────────────────
const backupUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, BACKUPS_DIR),
    filename: (_req, file, cb) => {
      // Preserve original name (sanitized) so orchestrator pairs stay intact
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      // Avoid overwrites — append timestamp suffix if file exists
      let final = safe;
      if (fs.existsSync(path.join(BACKUPS_DIR, final))) {
        const ts = Date.now();
        // Handle .tar.gz (double ext) and .sql (single ext)
        if (final.endsWith('.tar.gz')) {
          final = final.replace(/\.tar\.gz$/, `-${ts}.tar.gz`);
        } else {
          final = final.replace(/(\.[^.]+)$/, `-${ts}$1`);
        }
      }
      cb(null, final);
    }
  }),
  limits: { fileSize: MAX_UPLOAD_SIZE },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (name.endsWith('.sql') || name.endsWith('.tar.gz')) cb(null, true);
    else cb(new Error('Solo se permiten archivos .sql o .tar.gz'), false);
  }
}).array('backupFile', 2); // accept up to 2 files (sql + images)

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse DATABASE_URL into components for pg_dump/psql commands.
 * Returns { host, port, user, password, dbname } or null.
 */
const parseDbUrl = (url) => {
  try {
    const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (!match) return null;
    return { user: match[1], password: match[2], host: match[3], port: match[4], dbname: match[5] };
  } catch { return null; }
};

/**
 * Run pg_dump or psql via execFile (no shell — safer, no redirection issues).
 * PGPASSWORD is injected via env to avoid shell escaping problems.
 */
const pgExec = (bin, args, parsed, opts = {}) => new Promise((resolve, reject) => {
  const timeout = opts.timeout || 120000;
  const env = { ...process.env, PGPASSWORD: parsed.password };
  execFile(bin, args, { timeout, maxBuffer: 50 * 1024 * 1024, env }, (err, stdout, stderr) => {
    if (err) reject(new Error(stderr || err.message));
    else resolve({ stdout, stderr });
  });
});

/**
 * Run tar via execFile (no shell). Returns promise.
 */
const tarExec = (args, opts = {}) => new Promise((resolve, reject) => {
  const timeout = opts.timeout || 120000;
  execFile('tar', args, { timeout, maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
    if (err) reject(new Error(stderr || err.message));
    else resolve({ stdout, stderr });
  });
});

/**
 * Get row counts for all main tables using a fresh one-off query.
 */
const getTableStats = async () => {
  const db = require('../database');
  if (!db.pool) return {};
  const stats = {};
  for (const table of MAIN_TABLES) {
    try {
      const { rows } = await db.pool.query(`SELECT COUNT(*) AS count FROM ${table}`);
      stats[table] = parseInt(rows[0].count, 10);
    } catch {
      stats[table] = -1; // table doesn't exist or pool re-connecting
    }
  }
  return stats;
};

/**
 * Validate filename parameter — prevent path traversal.
 * Accepts .sql and .tar.gz extensions.
 */
const sanitizeFilename = (name) => {
  if (!name || typeof name !== 'string') return null;
  const base = path.basename(name);
  const valid = base.endsWith('.sql') || base.endsWith('.tar.gz');
  if (!valid) return null;
  if (base.includes('..') || base.includes('/') || base.includes('\\')) return null;
  return base;
};

/**
 * Derive the images archive filename from a SQL backup filename.
 * Pattern: replace first 'backup' → 'images' and '.sql' → '.tar.gz'
 * Works for both local names and orchestrator names (with IP).
 */
const getImagesPairName = (sqlFilename) => {
  if (!sqlFilename.includes('backup')) return null;
  return sqlFilename.replace('backup', 'images').replace(/\.sql$/, '.tar.gz');
};

/**
 * Count files in uploads/products/ directory.
 */
const countProductImages = () => {
  try {
    if (!fs.existsSync(PRODUCTS_DIR)) return 0;
    return fs.readdirSync(PRODUCTS_DIR).filter(f => !f.startsWith('.')).length;
  } catch { return 0; }
};

// =============================================================================
// GET /api/database/stats — Live table row counts
// =============================================================================
router.get('/stats', authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const stats = await getTableStats();
    res.json({ stats });
  } catch (err) {
    console.error('Error getting DB stats:', err);
    res.status(500).json({ message: 'Error al obtener estadísticas' });
  }
});

// =============================================================================
// POST /api/database/backup — Create paired SQL + images tar.gz backup
// =============================================================================
router.post('/backup', authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const now = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const sqlFilename = `techstore-backup-${now}.sql`;
    const imgFilename = `techstore-images-${now}.tar.gz`;
    const sqlPath = path.join(BACKUPS_DIR, sqlFilename);
    const imgPath = path.join(BACKUPS_DIR, imgFilename);

    // Parse DATABASE_URL for connection
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return res.status(400).json({ message: 'DATABASE_URL no configurada' });
    const parsed = parseDbUrl(dbUrl);
    if (!parsed) return res.status(400).json({ message: 'DATABASE_URL inválida' });

    // Step 1: pg_dump with --file flag
    await pgExec('pg_dump', [
      '-h', parsed.host, '-p', parsed.port, '-U', parsed.user,
      '--file', sqlPath,
      parsed.dbname
    ], parsed);

    // Verify SQL file
    if (!fs.existsSync(sqlPath) || fs.statSync(sqlPath).size === 0) {
      if (fs.existsSync(sqlPath)) fs.unlinkSync(sqlPath);
      return res.status(500).json({ message: 'pg_dump generó un archivo vacío' });
    }

    // Step 2: tar.gz the product images (from uploads/ dir, preserving 'products/' subfolder)
    let imagesIncluded = false;
    const imgCount = countProductImages();
    if (imgCount > 0) {
      try {
        // tar from uploads/ dir, include 'products/' subfolder so extraction restores the structure
        await tarExec(['-czf', imgPath, '-C', UPLOADS_DIR, 'products']);
        if (fs.existsSync(imgPath) && fs.statSync(imgPath).size > 0) {
          imagesIncluded = true;
          console.log(`🖼️ Images backup: ${imgFilename} (${imgCount} files)`);
        }
      } catch (tarErr) {
        console.warn('⚠️ Images tar failed (SQL backup still OK):', tarErr.message);
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
      }
    }

    const sqlStat = fs.statSync(sqlPath);
    const imgStat = imagesIncluded ? fs.statSync(imgPath) : null;
    const tableStats = await getTableStats();

    console.log(`💾 Backup creado: ${sqlFilename} (${(sqlStat.size / 1024).toFixed(1)} KB)`);
    res.json({
      success: true,
      filename: sqlFilename,
      size: sqlStat.size,
      date: sqlStat.mtime,
      imagesFile: imagesIncluded ? imgFilename : null,
      imagesSize: imgStat?.size || 0,
      imageCount: imgCount,
      tableStats
    });
  } catch (err) {
    console.error('Error creating backup:', err);
    res.status(500).json({ message: `Error al crear backup: ${err.message}` });
  }
});

// =============================================================================
// GET /api/database/backups — List all available backup files (with image pair info)
// =============================================================================
router.get('/backups', authenticateToken, requireAdmin, async (_req, res) => {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) return res.json([]);

    const allFiles = fs.readdirSync(BACKUPS_DIR);
    // Build a set of tar.gz files for quick pair lookup
    const tarFiles = new Set(allFiles.filter(f => f.endsWith('.tar.gz')));

    const files = allFiles
      .filter(f => f.endsWith('.sql'))
      .map(f => {
        const st = fs.statSync(path.join(BACKUPS_DIR, f));
        // Check if a paired images archive exists
        const pairName = getImagesPairName(f);
        const hasPair = pairName && tarFiles.has(pairName);
        const pairStat = hasPair ? fs.statSync(path.join(BACKUPS_DIR, pairName)) : null;
        return {
          filename: f,
          size: st.size,
          date: st.mtime,
          imagesFile: hasPair ? pairName : null,
          imagesSize: pairStat?.size || 0
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(files);
  } catch (err) {
    console.error('Error listing backups:', err);
    res.status(500).json({ message: 'Error al listar backups' });
  }
});

// =============================================================================
// POST /api/database/restore — Restore SQL + images from a paired backup
// =============================================================================
router.post('/restore', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { filename, confirmText } = req.body;

    // Double-confirm: user must type "RESTAURAR"
    if (confirmText !== 'RESTAURAR') {
      return res.status(400).json({ message: 'Escribe RESTAURAR para confirmar' });
    }

    const safe = sanitizeFilename(filename);
    if (!safe) return res.status(400).json({ message: 'Nombre de archivo inválido' });

    const filePath = path.join(BACKUPS_DIR, safe);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Archivo de backup no encontrado' });
    }

    // Parse DATABASE_URL for connection
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return res.status(400).json({ message: 'DATABASE_URL no configurada' });
    const parsed = parseDbUrl(dbUrl);
    if (!parsed) return res.status(400).json({ message: 'DATABASE_URL inválida' });
    const db = require('../database');

    // Step 1: Disconnect pool BEFORE any destructive SQL — prevents "pool ended" errors
    console.log('🔄 Restaurando BD: desconectando pool...');
    if (db.pool) {
      try { await db.pool.end(); } catch { /* already ended */ }
    }

    // Step 2: Safety backup (pool is closed, use pg_dump CLI directly)
    const safetyName = `pre-restore-${Date.now()}.sql`;
    const safetyPath = path.join(BACKUPS_DIR, safetyName);
    try {
      await pgExec('pg_dump', [
        '-h', parsed.host, '-p', parsed.port, '-U', parsed.user,
        '--file', safetyPath, parsed.dbname
      ], parsed);
      console.log(`🛡️ Safety backup: ${safetyName}`);
    } catch (safetyErr) {
      console.warn('⚠️ Safety backup falló (continuando):', safetyErr.message);
    }

    // Step 3: Drop schema + recreate clean
    await pgExec('psql', [
      '-h', parsed.host, '-p', parsed.port, '-U', parsed.user, '-d', parsed.dbname,
      '-c', `DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO ${parsed.user}; GRANT ALL ON SCHEMA public TO public;`
    ], parsed);

    // Step 4: Restore SQL from backup file
    await pgExec('psql', [
      '-h', parsed.host, '-p', parsed.port, '-U', parsed.user, '-d', parsed.dbname,
      '-f', filePath
    ], parsed, { timeout: 300000 });

    // Step 5: Restore images if paired tar.gz exists
    let imagesRestored = false;
    const pairName = getImagesPairName(safe);
    const pairPath = pairName ? path.join(BACKUPS_DIR, pairName) : null;
    if (pairPath && fs.existsSync(pairPath)) {
      try {
        console.log(`🖼️ Restaurando imágenes desde ${pairName}...`);
        // Clear current product images before extracting
        if (fs.existsSync(PRODUCTS_DIR)) {
          const existing = fs.readdirSync(PRODUCTS_DIR);
          for (const f of existing) {
            try { fs.unlinkSync(path.join(PRODUCTS_DIR, f)); } catch { /* skip */ }
          }
        }
        // Extract tar.gz into uploads/ — archive contains 'products/' subfolder
        await tarExec(['-xzf', pairPath, '-C', UPLOADS_DIR], { timeout: 300000 });
        const restored = countProductImages();
        imagesRestored = true;
        console.log(`🖼️ Imágenes restauradas: ${restored} archivos`);
      } catch (imgErr) {
        console.warn('⚠️ Image restore failed (SQL restored OK):', imgErr.message);
      }
    }

    // Step 6: Reinitialize pool with fresh connection
    console.log('🔄 Reconectando pool de base de datos...');
    db.reinitializeDb(process.env.DATABASE_URL);

    // Brief delay for pool to stabilize before querying stats
    await new Promise(r => setTimeout(r, 1000));

    const tableStats = await getTableStats();
    const imgCount = countProductImages();
    console.log(`♻️ Backup restaurado: ${safe}${imagesRestored ? ' + imágenes' : ''}`);
    res.json({
      success: true,
      message: imagesRestored
        ? 'Base de datos e imágenes restauradas correctamente'
        : 'Base de datos restaurada correctamente',
      safetyBackup: safetyName,
      imagesRestored,
      imageCount: imgCount,
      tableStats
    });
  } catch (err) {
    console.error('Error restoring backup:', err);
    // Always try to reconnect pool on error so the app doesn't stay dead
    try {
      const db = require('../database');
      db.reinitializeDb(process.env.DATABASE_URL);
      console.log('🔄 Pool reconectado tras error de restauración');
    } catch { /* last resort */ }
    res.status(500).json({ message: `Error al restaurar: ${err.message}` });
  }
});

// =============================================================================
// DELETE /api/database/backups/:filename — Delete a backup + its paired images archive
// =============================================================================
router.delete('/backups/:filename', authenticateToken, requireAdmin, (req, res) => {
  try {
    const safe = sanitizeFilename(req.params.filename);
    if (!safe) return res.status(400).json({ message: 'Nombre de archivo inválido' });

    const filePath = path.join(BACKUPS_DIR, safe);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }

    fs.unlinkSync(filePath);

    // Also delete paired images archive if this is a .sql file
    if (safe.endsWith('.sql')) {
      const pairName = getImagesPairName(safe);
      const pairPath = pairName ? path.join(BACKUPS_DIR, pairName) : null;
      if (pairPath && fs.existsSync(pairPath)) {
        fs.unlinkSync(pairPath);
        console.log(`🗑️ Backup eliminado: ${safe} + ${pairName}`);
      } else {
        console.log(`🗑️ Backup eliminado: ${safe}`);
      }
    } else {
      console.log(`🗑️ Archivo eliminado: ${safe}`);
    }

    res.json({ success: true, message: 'Backup eliminado' });
  } catch (err) {
    console.error('Error deleting backup:', err);
    res.status(500).json({ message: 'Error al eliminar backup' });
  }
});

// =============================================================================
// GET /api/database/backups/:filename/download — Download a backup or images file
// =============================================================================
router.get('/backups/:filename/download', authenticateToken, requireAdmin, (req, res) => {
  const safe = sanitizeFilename(req.params.filename);
  if (!safe) return res.status(400).json({ message: 'Nombre de archivo inválido' });

  const filePath = path.join(BACKUPS_DIR, safe);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'Archivo no encontrado' });
  }

  res.download(filePath, safe);
});

// =============================================================================
// POST /api/database/backups/upload — Upload external .sql and/or .tar.gz files
// =============================================================================
router.post('/backups/upload', authenticateToken, requireAdmin, (req, res) => {
  backupUpload(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: `Error de subida: ${err.message}` });
      }
      return res.status(400).json({ message: err.message });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No se subió ningún archivo' });
    }

    // Report all uploaded files
    const uploaded = req.files.map(f => {
      const st = fs.statSync(f.path);
      return { filename: f.filename, size: st.size, date: st.mtime };
    });

    const names = uploaded.map(u => u.filename).join(', ');
    console.log(`📤 Backup subido: ${names}`);
    res.json({
      success: true,
      files: uploaded,
      filename: uploaded[0]?.filename, // backward compat
      size: uploaded[0]?.size,
      date: uploaded[0]?.date
    });
  });
});

module.exports = router;
