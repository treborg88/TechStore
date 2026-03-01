// routes/database.routes.js — Database backup/restore management (admin only)
// Provides endpoints to create, list, download, upload, restore, and delete
// SQL backups. Works in Docker mode (techstore-db container) and native mode.

const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const { authenticateToken, requireAdmin } = require('../middleware/auth');

// ── Constants ───────────────────────────────────────────────────────────────
const BACKUPS_DIR = path.join(__dirname, '..', 'backups');
const MAX_UPLOAD_SIZE = 100 * 1024 * 1024; // 100 MB
const MAIN_TABLES = ['users', 'products', 'product_images', 'orders', 'order_items', 'cart', 'app_settings', 'verification_codes'];

// Ensure backups directory exists on load
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

// ── Multer config for .sql uploads ──────────────────────────────────────────
const sqlUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, BACKUPS_DIR),
    filename: (_req, file, cb) => {
      // Sanitize and prefix with timestamp
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `upload-${Date.now()}-${safe}`);
    }
  }),
  limits: { fileSize: MAX_UPLOAD_SIZE },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.endsWith('.sql')) cb(null, true);
    else cb(new Error('Solo se permiten archivos .sql'), false);
  }
}).single('backupFile');

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Detect if running inside Docker (techstore-db container reachable)
 * by checking if the DATABASE_URL points to "database" hostname.
 */
const isDockerMode = () => {
  const url = process.env.DATABASE_URL || '';
  return url.includes('@database:');
};

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
 * Execute a shell command as a promise with timeout.
 */
const execAsync = (cmd, opts = {}) => new Promise((resolve, reject) => {
  const timeout = opts.timeout || 120000; // 2 min default
  const child = exec(cmd, { timeout, maxBuffer: 50 * 1024 * 1024, ...opts }, (err, stdout, stderr) => {
    if (err) reject(new Error(stderr || err.message));
    else resolve({ stdout, stderr });
  });
});

/**
 * Get row counts for all main tables.
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
      stats[table] = -1; // table doesn't exist
    }
  }
  return stats;
};

/**
 * Validate filename parameter — prevent path traversal.
 */
const sanitizeFilename = (name) => {
  if (!name || typeof name !== 'string') return null;
  const base = path.basename(name);
  if (!base.endsWith('.sql')) return null;
  if (base.includes('..') || base.includes('/') || base.includes('\\')) return null;
  return base;
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
// POST /api/database/backup — Create a new pg_dump backup
// =============================================================================
router.post('/backup', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const now = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `techstore-backup-${now}.sql`;
    const filePath = path.join(BACKUPS_DIR, filename);
    let cmd;

    if (isDockerMode()) {
      // Docker: pg_dump inside the techstore-db container
      cmd = `docker exec techstore-db pg_dump -U techstore techstore > "${filePath}"`;
    } else {
      // Native: use DATABASE_URL directly
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) return res.status(400).json({ message: 'DATABASE_URL no configurada' });
      // Set PGPASSWORD via env to avoid password prompt
      const parsed = parseDbUrl(dbUrl);
      if (!parsed) return res.status(400).json({ message: 'DATABASE_URL inválida' });
      cmd = `PGPASSWORD="${parsed.password}" pg_dump -h ${parsed.host} -p ${parsed.port} -U ${parsed.user} ${parsed.dbname} > "${filePath}"`;
    }

    await execAsync(cmd);

    // Verify file was created and has content
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
      // Clean up empty file
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(500).json({ message: 'pg_dump generó un archivo vacío' });
    }

    const stats = fs.statSync(filePath);
    const tableStats = await getTableStats();

    console.log(`💾 Backup creado: ${filename} (${(stats.size / 1024).toFixed(1)} KB)`);
    res.json({
      success: true,
      filename,
      size: stats.size,
      date: stats.mtime,
      tableStats
    });
  } catch (err) {
    console.error('Error creating backup:', err);
    res.status(500).json({ message: `Error al crear backup: ${err.message}` });
  }
});

// =============================================================================
// GET /api/database/backups — List all available backup files
// =============================================================================
router.get('/backups', authenticateToken, requireAdmin, async (_req, res) => {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) return res.json([]);
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.endsWith('.sql'))
      .map(f => {
        const st = fs.statSync(path.join(BACKUPS_DIR, f));
        return { filename: f, size: st.size, date: st.mtime };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(files);
  } catch (err) {
    console.error('Error listing backups:', err);
    res.status(500).json({ message: 'Error al listar backups' });
  }
});

// =============================================================================
// POST /api/database/restore — Restore from a backup file
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

    // Step 1: Create a safety backup before restoring
    const safetyName = `pre-restore-${Date.now()}.sql`;
    const safetyPath = path.join(BACKUPS_DIR, safetyName);

    if (isDockerMode()) {
      // Docker mode — all commands via docker exec
      try {
        await execAsync(`docker exec techstore-db pg_dump -U techstore techstore > "${safetyPath}"`);
        console.log(`🛡️ Safety backup: ${safetyName}`);
      } catch (safetyErr) {
        console.warn('⚠️ Safety backup failed (continuing):', safetyErr.message);
      }

      // Step 2: Drop all tables and restore
      // Use psql to run the backup (it contains CREATE TABLE IF NOT EXISTS)
      // First, drop existing tables to avoid conflicts
      const dropCmd = `docker exec techstore-db psql -U techstore -d techstore -c "
        DROP SCHEMA public CASCADE;
        CREATE SCHEMA public;
        GRANT ALL ON SCHEMA public TO techstore;
        GRANT ALL ON SCHEMA public TO public;
      "`;
      await execAsync(dropCmd);

      // Step 3: Restore from backup file
      // Copy file into container, then psql it
      const containerPath = `/tmp/${safe}`;
      await execAsync(`docker cp "${filePath}" techstore-db:${containerPath}`);
      await execAsync(`docker exec techstore-db psql -U techstore -d techstore -f ${containerPath}`, { timeout: 300000 });
      await execAsync(`docker exec techstore-db rm -f ${containerPath}`);

    } else {
      // Native mode
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) return res.status(400).json({ message: 'DATABASE_URL no configurada' });
      const parsed = parseDbUrl(dbUrl);
      if (!parsed) return res.status(400).json({ message: 'DATABASE_URL inválida' });
      const pgEnv = `PGPASSWORD="${parsed.password}"`;

      // Safety backup
      try {
        await execAsync(`${pgEnv} pg_dump -h ${parsed.host} -p ${parsed.port} -U ${parsed.user} ${parsed.dbname} > "${safetyPath}"`);
      } catch { /* continue */ }

      // Drop + restore
      await execAsync(`${pgEnv} psql -h ${parsed.host} -p ${parsed.port} -U ${parsed.user} -d ${parsed.dbname} -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"`);
      await execAsync(`${pgEnv} psql -h ${parsed.host} -p ${parsed.port} -U ${parsed.user} -d ${parsed.dbname} -f "${filePath}"`, { timeout: 300000 });
    }

    // Step 4: Reinitialize database connection pool
    const db = require('../database');
    if (db.reinitializeDb) {
      await db.reinitializeDb();
    }

    const tableStats = await getTableStats();
    console.log(`♻️ Backup restaurado: ${safe}`);
    res.json({ success: true, message: 'Base de datos restaurada correctamente', safetyBackup: safetyName, tableStats });
  } catch (err) {
    console.error('Error restoring backup:', err);
    res.status(500).json({ message: `Error al restaurar: ${err.message}` });
  }
});

// =============================================================================
// DELETE /api/database/backups/:filename — Delete a backup file
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
    console.log(`🗑️ Backup eliminado: ${safe}`);
    res.json({ success: true, message: 'Backup eliminado' });
  } catch (err) {
    console.error('Error deleting backup:', err);
    res.status(500).json({ message: 'Error al eliminar backup' });
  }
});

// =============================================================================
// GET /api/database/backups/:filename/download — Download a backup file
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
// POST /api/database/backups/upload — Upload an external .sql backup
// =============================================================================
router.post('/backups/upload', authenticateToken, requireAdmin, (req, res) => {
  sqlUpload(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: `Error de subida: ${err.message}` });
      }
      return res.status(400).json({ message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No se subió ningún archivo' });
    }

    const stats = fs.statSync(req.file.path);
    console.log(`📤 Backup subido: ${req.file.filename} (${(stats.size / 1024).toFixed(1)} KB)`);
    res.json({
      success: true,
      filename: req.file.filename,
      size: stats.size,
      date: stats.mtime
    });
  });
});

module.exports = router;
