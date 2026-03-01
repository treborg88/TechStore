// routes/database.routes.js — Database backup/restore management (admin only)
// Creates unified .tar.gz backups containing database.sql + product images.
// Uses pg_dump/psql/tar CLI tools (installed via apk in container).

const express = require('express');
const router = express.Router();
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const multer = require('multer');

const { authenticateToken, requireAdmin } = require('../middleware/auth');

// ── Constants ───────────────────────────────────────────────────────────────
const BACKUPS_DIR = path.join(__dirname, '..', 'backups');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const PRODUCTS_DIR = path.join(UPLOADS_DIR, 'products');
const MAX_UPLOAD_SIZE = 500 * 1024 * 1024; // 500 MB
const MAIN_TABLES = ['users', 'products', 'product_images', 'orders', 'order_items', 'cart', 'app_settings', 'verification_codes'];
const DEFAULT_NAME = 'techstore'; // fallback store name

// Ensure directories exist on load
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
if (!fs.existsSync(PRODUCTS_DIR)) fs.mkdirSync(PRODUCTS_DIR, { recursive: true });

// ── Multer — overwrites same-name files by design (no accumulation) ─────────
const backupUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, BACKUPS_DIR),
    filename: (_req, file, cb) => {
      // Sanitize but keep original name so same-name overwrites work
      cb(null, file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'));
    }
  }),
  limits: { fileSize: MAX_UPLOAD_SIZE },
  fileFilter: (_req, file, cb) => {
    const n = file.originalname.toLowerCase();
    if (n.endsWith('.tar.gz') || n.endsWith('.sql')) cb(null, true);
    else cb(new Error('Solo se permiten archivos .tar.gz o .sql'), false);
  }
}).single('backupFile');

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Parse DATABASE_URL → { host, port, user, password, dbname } */
const parseDbUrl = (url) => {
  try {
    const m = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    return m ? { user: m[1], password: m[2], host: m[3], port: m[4], dbname: m[5] } : null;
  } catch { return null; }
};

/** Run pg_dump/psql via execFile (no shell). PGPASSWORD injected via env. */
const pgExec = (bin, args, parsed, opts = {}) => new Promise((resolve, reject) => {
  const env = { ...process.env, PGPASSWORD: parsed.password };
  execFile(bin, args, { timeout: opts.timeout || 120000, maxBuffer: 50 * 1024 * 1024, env },
    (err, stdout, stderr) => err ? reject(new Error(stderr || err.message)) : resolve({ stdout, stderr }));
});

/** Run tar via execFile (no shell). */
const tarExec = (args, opts = {}) => new Promise((resolve, reject) => {
  execFile('tar', args, { timeout: opts.timeout || 300000, maxBuffer: 50 * 1024 * 1024 },
    (err, stdout, stderr) => err ? reject(new Error(stderr || err.message)) : resolve({ stdout, stderr }));
});

/** Row counts for main tables. */
const getTableStats = async () => {
  const db = require('../database');
  if (!db.pool) return {};
  const stats = {};
  for (const t of MAIN_TABLES) {
    try {
      const { rows } = await db.pool.query(`SELECT COUNT(*) AS count FROM ${t}`);
      stats[t] = parseInt(rows[0].count, 10);
    } catch { stats[t] = -1; }
  }
  return stats;
};

/** Validate filename — prevent path traversal. Accepts .sql and .tar.gz. */
const sanitizeFilename = (name) => {
  if (!name || typeof name !== 'string') return null;
  const base = path.basename(name);
  if (!base.endsWith('.sql') && !base.endsWith('.tar.gz')) return null;
  if (base.includes('..') || base.includes('/') || base.includes('\\')) return null;
  return base;
};

/** Count files in uploads/products/. */
const countProductImages = () => {
  try {
    if (!fs.existsSync(PRODUCTS_DIR)) return 0;
    return fs.readdirSync(PRODUCTS_DIR).filter(f => !f.startsWith('.')).length;
  } catch { return 0; }
};

/** Create a temp directory; caller must clean up. */
const makeTempDir = () => {
  const base = path.join(os.tmpdir(), 'techstore-bk');
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
  return fs.mkdtempSync(path.join(base, 'bk-'));
};

/** Remove directory recursively (best-effort). */
const rmDir = (dir) => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ok */ } };

/** Get store name from app_settings for default backup name. */
const getStoreName = async () => {
  try {
    const db = require('../database');
    if (!db.pool) return DEFAULT_NAME;
    const { rows } = await db.pool.query("SELECT value FROM app_settings WHERE key = 'siteName'");
    if (rows.length && rows[0].value) {
      return rows[0].value.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || DEFAULT_NAME;
    }
  } catch { /* fallback */ }
  return DEFAULT_NAME;
};

/** Inspect a .tar.gz to check contents (has database.sql? has products/?). */
const inspectArchive = async (archivePath) => {
  try {
    const { stdout } = await tarExec(['-tzf', archivePath]);
    const files = stdout.split('\n').filter(Boolean);
    const hasSql = files.some(f => f === 'database.sql' || f.endsWith('/database.sql'));
    const imgFiles = files.filter(f => f.startsWith('products/') && f !== 'products/');
    return { hasSql, imageCount: imgFiles.length };
  } catch { return { hasSql: false, imageCount: 0 }; }
};

// =============================================================================
// GET /api/database/stats — Live table row counts + image count
// =============================================================================
router.get('/stats', authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const stats = await getTableStats();
    res.json({ stats, imageCount: countProductImages() });
  } catch (err) {
    console.error('Error getting DB stats:', err);
    res.status(500).json({ message: 'Error al obtener estadísticas' });
  }
});

// =============================================================================
// POST /api/database/backup — Create unified .tar.gz (database.sql + products/)
// Body: { name?: string, version?: string }
// Same name overwrites previous backup — no accumulation by default.
// =============================================================================
router.post('/backup', authenticateToken, requireAdmin, async (req, res) => {
  let tempDir = null;
  try {
    const { name, version } = req.body || {};

    // Build filename: {name}[-{version}].tar.gz
    const storeName = (name || await getStoreName()).replace(/[^a-zA-Z0-9_-]/g, '') || DEFAULT_NAME;
    const vSuffix = version ? `-${version.replace(/[^a-zA-Z0-9._-]/g, '')}` : '';
    const filename = `${storeName}${vSuffix}.tar.gz`;
    const archivePath = path.join(BACKUPS_DIR, filename);
    const replacing = fs.existsSync(archivePath);

    // Parse DATABASE_URL
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return res.status(400).json({ message: 'DATABASE_URL no configurada' });
    const parsed = parseDbUrl(dbUrl);
    if (!parsed) return res.status(400).json({ message: 'DATABASE_URL inválida' });

    // Stage in temp dir
    tempDir = makeTempDir();
    const sqlPath = path.join(tempDir, 'database.sql');

    // Step 1: pg_dump → temp/database.sql
    await pgExec('pg_dump', [
      '-h', parsed.host, '-p', parsed.port, '-U', parsed.user,
      '--file', sqlPath, parsed.dbname
    ], parsed);

    if (!fs.existsSync(sqlPath) || fs.statSync(sqlPath).size === 0) {
      return res.status(500).json({ message: 'pg_dump generó un archivo vacío' });
    }

    // Step 2: Build tar.gz with database.sql + products/ images
    const imgCount = countProductImages();
    // tar -czf <out> -C <tempDir> database.sql [-C <uploadsDir> products]
    const tarArgs = ['-czf', archivePath, '-C', tempDir, 'database.sql'];
    if (imgCount > 0 && fs.existsSync(PRODUCTS_DIR)) {
      tarArgs.push('-C', UPLOADS_DIR, 'products');
    }

    // Remove old if replacing
    if (replacing) fs.unlinkSync(archivePath);
    await tarExec(tarArgs, { timeout: 300000 });

    const archiveStat = fs.statSync(archivePath);
    const tableStats = await getTableStats();

    console.log(`💾 Backup: ${filename} (${(archiveStat.size / 1024 / 1024).toFixed(1)} MB, ${imgCount} imgs${replacing ? ', reemplazado' : ''})`);
    res.json({
      success: true, filename,
      size: archiveStat.size, date: archiveStat.mtime,
      imageCount: imgCount, replaced: replacing, tableStats
    });
  } catch (err) {
    console.error('Error creating backup:', err);
    res.status(500).json({ message: `Error al crear backup: ${err.message}` });
  } finally {
    if (tempDir) rmDir(tempDir);
  }
});

// =============================================================================
// GET /api/database/backups — List all backups with content info + store name
// =============================================================================
router.get('/backups', authenticateToken, requireAdmin, async (_req, res) => {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) return res.json({ backups: [], storeName: DEFAULT_NAME });

    const storeName = await getStoreName();
    const allFiles = fs.readdirSync(BACKUPS_DIR);
    const backups = [];

    for (const f of allFiles) {
      if (!f.endsWith('.tar.gz') && !f.endsWith('.sql')) continue;
      const fp = path.join(BACKUPS_DIR, f);
      const st = fs.statSync(fp);

      // Inspect archive contents (fast — reads tar index only)
      let info = { hasSql: false, imageCount: 0 };
      if (f.endsWith('.tar.gz')) {
        info = await inspectArchive(fp);
      } else {
        info = { hasSql: true, imageCount: 0 };
      }

      backups.push({
        filename: f, size: st.size, date: st.mtime,
        isArchive: f.endsWith('.tar.gz'),
        hasSql: info.hasSql, imageCount: info.imageCount
      });
    }

    backups.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ backups, storeName });
  } catch (err) {
    console.error('Error listing backups:', err);
    res.status(500).json({ message: 'Error al listar backups' });
  }
});

// =============================================================================
// POST /api/database/restore — Restore from unified .tar.gz or legacy .sql
// =============================================================================
router.post('/restore', authenticateToken, requireAdmin, async (req, res) => {
  let tempDir = null;
  try {
    const { filename, confirmText } = req.body;
    if (confirmText !== 'RESTAURAR') {
      return res.status(400).json({ message: 'Escribe RESTAURAR para confirmar' });
    }

    const safe = sanitizeFilename(filename);
    if (!safe) return res.status(400).json({ message: 'Nombre de archivo inválido' });

    const filePath = path.join(BACKUPS_DIR, safe);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Archivo de backup no encontrado' });
    }

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return res.status(400).json({ message: 'DATABASE_URL no configurada' });
    const parsed = parseDbUrl(dbUrl);
    if (!parsed) return res.status(400).json({ message: 'DATABASE_URL inválida' });
    const db = require('../database');

    // Determine SQL and images paths (archive vs plain .sql)
    let sqlPath, imagesDir;
    if (safe.endsWith('.tar.gz')) {
      tempDir = makeTempDir();
      await tarExec(['-xzf', filePath, '-C', tempDir], { timeout: 300000 });
      sqlPath = path.join(tempDir, 'database.sql');
      imagesDir = path.join(tempDir, 'products');
      if (!fs.existsSync(sqlPath)) {
        return res.status(400).json({ message: 'El archivo no contiene database.sql' });
      }
    } else {
      // Legacy .sql file support
      sqlPath = filePath;
      imagesDir = null;
    }

    // Step 1: Disconnect pool BEFORE destructive SQL
    console.log('🔄 Restaurando: desconectando pool...');
    if (db.pool) { try { await db.pool.end(); } catch { /* ok */ } }

    // Step 2: Safety backup (quick pg_dump via CLI)
    const safetyName = `pre-restore-${Date.now()}.sql`;
    const safetyPath = path.join(BACKUPS_DIR, safetyName);
    try {
      await pgExec('pg_dump', ['-h', parsed.host, '-p', parsed.port, '-U', parsed.user, '--file', safetyPath, parsed.dbname], parsed);
      console.log(`🛡️ Safety backup: ${safetyName}`);
    } catch (e) { console.warn('⚠️ Safety backup falló:', e.message); }

    // Step 3: Drop + recreate schema
    await pgExec('psql', [
      '-h', parsed.host, '-p', parsed.port, '-U', parsed.user, '-d', parsed.dbname,
      '-c', `DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO ${parsed.user}; GRANT ALL ON SCHEMA public TO public;`
    ], parsed);

    // Step 4: Restore SQL
    await pgExec('psql', [
      '-h', parsed.host, '-p', parsed.port, '-U', parsed.user, '-d', parsed.dbname,
      '-f', sqlPath
    ], parsed, { timeout: 300000 });

    // Step 5: Restore images if present in archive
    let imagesRestored = false;
    if (imagesDir && fs.existsSync(imagesDir)) {
      try {
        // Clear current product images
        if (fs.existsSync(PRODUCTS_DIR)) {
          for (const f of fs.readdirSync(PRODUCTS_DIR)) {
            try { fs.unlinkSync(path.join(PRODUCTS_DIR, f)); } catch { /* skip */ }
          }
        }
        // Copy extracted images
        for (const img of fs.readdirSync(imagesDir)) {
          fs.copyFileSync(path.join(imagesDir, img), path.join(PRODUCTS_DIR, img));
        }
        imagesRestored = true;
        console.log(`🖼️ Imágenes restauradas: ${fs.readdirSync(imagesDir).length} archivos`);
      } catch (imgErr) {
        console.warn('⚠️ Image restore failed:', imgErr.message);
      }
    }

    // Step 6: Reconnect pool
    console.log('🔄 Reconectando pool...');
    db.reinitializeDb(process.env.DATABASE_URL);
    await new Promise(r => setTimeout(r, 1000));

    const tableStats = await getTableStats();
    const imgCount = countProductImages();
    console.log(`♻️ Restaurado: ${safe}${imagesRestored ? ' + imágenes' : ''}`);
    res.json({
      success: true,
      message: imagesRestored ? 'Base de datos e imágenes restauradas' : 'Base de datos restaurada',
      safetyBackup: safetyName, imagesRestored, imageCount: imgCount, tableStats
    });
  } catch (err) {
    console.error('Error restoring backup:', err);
    try { const db = require('../database'); db.reinitializeDb(process.env.DATABASE_URL); } catch { /* last resort */ }
    res.status(500).json({ message: `Error al restaurar: ${err.message}` });
  } finally {
    if (tempDir) rmDir(tempDir);
  }
});

// =============================================================================
// DELETE /api/database/backups/:filename — Delete a backup file
// =============================================================================
router.delete('/backups/:filename', authenticateToken, requireAdmin, (req, res) => {
  try {
    const safe = sanitizeFilename(req.params.filename);
    if (!safe) return res.status(400).json({ message: 'Nombre de archivo inválido' });

    const fp = path.join(BACKUPS_DIR, safe);
    if (!fs.existsSync(fp)) return res.status(404).json({ message: 'Archivo no encontrado' });

    fs.unlinkSync(fp);
    console.log(`🗑️ Backup eliminado: ${safe}`);
    res.json({ success: true, message: 'Backup eliminado' });
  } catch (err) {
    console.error('Error deleting backup:', err);
    res.status(500).json({ message: 'Error al eliminar backup' });
  }
});

// =============================================================================
// GET /api/database/backups/:filename/download?type=data|sql|images
// Downloads full archive, only SQL, or only images.
// =============================================================================
router.get('/backups/:filename/download', authenticateToken, requireAdmin, async (req, res) => {
  const safe = sanitizeFilename(req.params.filename);
  if (!safe) return res.status(400).json({ message: 'Nombre de archivo inválido' });

  const filePath = path.join(BACKUPS_DIR, safe);
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Archivo no encontrado' });

  const type = req.query.type || 'data';
  const baseName = safe.replace(/\.(tar\.gz|sql)$/, '');

  // Plain .sql or full data download — serve directly
  if (safe.endsWith('.sql') || type === 'data') {
    return res.download(filePath, safe);
  }

  // Extract specific content from .tar.gz archive
  const tempDir = makeTempDir();
  try {
    if (type === 'sql') {
      // Extract only database.sql from archive
      await tarExec(['-xzf', filePath, '-C', tempDir, 'database.sql']);
      const sqlFile = path.join(tempDir, 'database.sql');
      if (!fs.existsSync(sqlFile)) { rmDir(tempDir); return res.status(404).json({ message: 'No contiene database.sql' }); }
      return res.download(sqlFile, `${baseName}.sql`, () => rmDir(tempDir));
    }

    if (type === 'images') {
      // Extract products/ from archive, re-tar just those
      await tarExec(['-xzf', filePath, '-C', tempDir, 'products']);
      const prodDir = path.join(tempDir, 'products');
      if (!fs.existsSync(prodDir) || fs.readdirSync(prodDir).length === 0) {
        rmDir(tempDir);
        return res.status(404).json({ message: 'No contiene imágenes' });
      }
      const imgTar = path.join(tempDir, `${baseName}-images.tar.gz`);
      await tarExec(['-czf', imgTar, '-C', tempDir, 'products']);
      return res.download(imgTar, `${baseName}-images.tar.gz`, () => rmDir(tempDir));
    }

    rmDir(tempDir);
    return res.status(400).json({ message: 'Tipo inválido: data, sql, images' });
  } catch (err) {
    rmDir(tempDir);
    console.error('Error downloading backup:', err);
    res.status(500).json({ message: `Error: ${err.message}` });
  }
});

// =============================================================================
// POST /api/database/backups/upload — Upload a .tar.gz or legacy .sql file
// Same-name overwrites by design (no accumulation).
// =============================================================================
router.post('/backups/upload', authenticateToken, requireAdmin, (req, res) => {
  backupUpload(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) return res.status(400).json({ message: `Error: ${err.message}` });
      return res.status(400).json({ message: err.message });
    }
    if (!req.file) return res.status(400).json({ message: 'No se subió ningún archivo' });

    const st = fs.statSync(req.file.path);
    console.log(`📤 Backup subido: ${req.file.filename} (${(st.size / 1024).toFixed(1)} KB)`);
    res.json({ success: true, filename: req.file.filename, size: st.size, date: st.mtime });
  });
});

module.exports = router;
