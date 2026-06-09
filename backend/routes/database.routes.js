const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const multer = require('multer');

const { authenticateToken, requireAdmin } = require('../middleware/auth');
const backupService = require('../services/backup.service');

const router = express.Router();
const MAX_UPLOAD_SIZE = 500 * 1024 * 1024;

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, os.tmpdir()),
    filename: (_req, file, cb) => cb(null, file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'))
  }),
  limits: { fileSize: MAX_UPLOAD_SIZE },
  fileFilter: (_req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    if (name.endsWith('.tar.gz') || name.endsWith('.tar') || name.endsWith('.sql')) return cb(null, true);
    return cb(new Error('Solo se permiten archivos .tar.gz, .tar o .sql'));
  }
}).single('backupFile');

const restoreUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, os.tmpdir()),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`)
  }),
  limits: { fileSize: MAX_UPLOAD_SIZE },
  fileFilter: (_req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    if (name.endsWith('.tar.gz') || name.endsWith('.tar') || name.endsWith('.sql')) return cb(null, true);
    return cb(new Error('Solo se permiten archivos .tar.gz, .tar o .sql'));
  }
}).single('backupFile');

router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!req.tenant?.schema_name) {
      return res.status(400).json({ message: 'Tenant context is required' });
    }
    const stats = await backupService.getTableStats(req.tenant.schema_name);
    const imageCount = await backupService.countProductImages();
    return res.json({ stats, imageCount });
  } catch (err) {
    console.error('Database stats error:', err);
    return res.status(500).json({ message: err.message || 'Error al obtener estadísticas' });
  }
});

router.post('/backup', authenticateToken, requireAdmin, async (req, res) => {
  let artifact = null;
  try {
    artifact = await backupService.createTenantBackup({
      tenant: req.tenant,
      name: req.body?.name,
      version: req.body?.version,
      includeImages: req.body?.includeImages !== false
    });
    const contentType = artifact.filename.endsWith('.tar.gz')
      ? 'application/gzip'
      : artifact.filename.endsWith('.sql')
        ? 'application/sql'
        : 'application/x-tar';
    res.setHeader('Content-Type', contentType);
    return res.download(artifact.archivePath, artifact.filename, async () => {
      await backupService.cleanupTenantBackupArtifact(artifact);
    });
  } catch (err) {
    console.error('Tenant backup error:', err);
    if (artifact) await backupService.cleanupTenantBackupArtifact(artifact);
    return res.status(500).json({ message: err.message || 'Error al crear backup' });
  }
});

router.post('/restore/validate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { filename } = req.body || {};
    if (!filename) return res.status(400).json({ message: 'filename es requerido' });

    const result = await backupService.validateTenantRestoreArchive({
      tenant: req.tenant,
      filename
    });
    return res.json(result);
  } catch (err) {
    console.error('Backup validate error:', err);
    return res.status(400).json({ message: err.message || 'Error validando backup' });
  }
});

router.post('/restore', authenticateToken, requireAdmin, (req, res) => {
  const startedAt = Date.now();
  let lastMarkAt = startedAt;
  const mark = (step, filename = null) => {
    const now = Date.now();
    const delta = now - lastMarkAt;
    const total = now - startedAt;
    lastMarkAt = now;
    const filePart = filename ? `[${filename}] ` : '';
    console.log(`[restore-route] ${filePart}${step}: +${delta}ms (total ${total}ms)`);
  };

  restoreUpload(req, res, async (err) => {
    let uploadedPath = null;
    try {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: `Error: ${err.message}` });
      }
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      if (!req.file) {
        return res.status(400).json({ message: 'backupFile es requerido' });
      }

      uploadedPath = req.file.path;
      const filename = backupService.sanitizeFilename(req.file.originalname || req.file.filename);
      const confirmText = req.body?.confirmText;
      mark('upload received', req.file.originalname || req.file.filename);
      if (!filename) {
        return res.status(400).json({ message: 'Nombre de archivo inválido' });
      }

      const saved = await backupService.storage.uploadArchive(uploadedPath, filename);
      mark('stored uploaded archive', saved.filename);

      try {
        const result = await backupService.restoreTenantBackup({
          tenant: req.tenant,
          filename: saved.filename,
          confirmText
        });
        mark('restore service completed', saved.filename);
        return res.json(result);
      } finally {
        await backupService.storage.deleteArchive(saved.filename).catch(() => {});
        mark('cleanup stored archive', saved.filename);
      }
    } catch (restoreErr) {
      const total = Date.now() - startedAt;
      console.error(`[restore-route] failed after ${total}ms: ${restoreErr.message}`);
      console.error('Tenant restore error:', restoreErr);
      return res.status(500).json({ message: restoreErr.message || 'Error al restaurar backup' });
    } finally {
      if (uploadedPath && fs.existsSync(uploadedPath)) {
        fs.rmSync(uploadedPath, { force: true });
      }
      mark('request finished');
    }
  });
});

router.get('/backups', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const storeName = (req.tenant?.slug || 'store').replace(/[^a-zA-Z0-9_-]/g, '');
    return res.json({ backups: [], storeName });
  } catch (err) {
    console.error('List backups error:', err);
    return res.status(500).json({ message: err.message || 'Error al listar backups' });
  }
});

router.get('/backup/:filename/manifest', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const manifest = await backupService.getBackupManifest({ filename: req.params.filename });
    if (!manifest) return res.status(404).json({ message: 'Manifest no encontrado' });
    return res.json({ manifest });
  } catch (err) {
    console.error('Get manifest error:', err);
    return res.status(400).json({ message: err.message || 'Error al obtener manifest' });
  }
});

router.delete('/backups/:filename', authenticateToken, requireAdmin, async (req, res) => {
  return res.status(410).json({ message: 'No hay backups persistidos en servidor para eliminar.' });
});

router.get('/backups/:filename/download', authenticateToken, requireAdmin, async (req, res) => {
  return res.status(410).json({ message: 'No hay backups almacenados en servidor. Usa Crear Backup para descargar al dispositivo.' });
});

router.post('/backups/upload', authenticateToken, requireAdmin, (req, res) => {
  upload(req, res, async (err) => {
    let uploadedPath = null;

    try {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: `Error: ${err.message}` });
      }
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      if (!req.file) {
        return res.status(400).json({ message: 'No se subió ningún archivo' });
      }

      uploadedPath = req.file.path;
      const safeName = backupService.sanitizeFilename(req.file.filename || req.file.originalname);
      if (!safeName) {
        return res.status(400).json({ message: 'Nombre de archivo inválido' });
      }

      const stats = fs.statSync(uploadedPath);
      return res.json({ success: true, filename: safeName, size: stats.size, date: stats.mtime });
    } catch (uploadErr) {
      console.error('Upload backup error:', uploadErr);
      return res.status(500).json({ message: uploadErr.message || 'Error al subir backup' });
    } finally {
      if (uploadedPath && fs.existsSync(uploadedPath)) {
        fs.rmSync(uploadedPath, { force: true });
      }
    }
  });
});

module.exports = router;
