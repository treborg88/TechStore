// routes/setup.routes.js - Setup wizard API (no auth required, only works when DB is not configured)
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const { dbConfigured, reinitializeDb } = require('../database');
const { JWT_SECRET } = require('../config');

/**
 * Create a pg Client and connect with SSL auto-fallback.
 * Tries ssl: { rejectUnauthorized: false } first; if the server
 * doesn't support SSL (e.g. Docker PostgreSQL), retries with ssl: false.
 */
async function connectPg(connectionString, timeoutMs = 10000) {
  const { Client } = require('pg');
  // 1st attempt: with SSL
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: timeoutMs });
  try {
    await client.connect();
    return client;
  } catch (err) {
    await client.end().catch(() => {});
    // If server doesn't support SSL, retry without it
    if (err.message && err.message.includes('does not support SSL')) {
      const plainClient = new Client({ connectionString, ssl: false, connectionTimeoutMillis: timeoutMs });
      await plainClient.connect();
      return plainClient;
    }
    throw err;
  }
}

/**
 * Middleware: only allow setup routes when DB is NOT configured.
 * Once the app is fully set up, these endpoints return 403.
 */
const requireSetupMode = (req, res, next) => {
  if (dbConfigured()) {
    return res.status(403).json({ 
      message: 'La aplicación ya está configurada',
      code: 'ALREADY_CONFIGURED' 
    });
  }
  next();
};

// Apply guard to all setup routes
router.use(requireSetupMode);

/**
 * GET /api/setup/status
 * Returns current setup state (what's configured, what's missing)
 */
router.get('/status', (req, res) => {
  res.json({
    database: dbConfigured(),
    jwtSecret: !!JWT_SECRET,
    providers: [
      {
        id: 'postgres',
        name: 'PostgreSQL',
        description: 'PostgreSQL (Docker, auto-hospedado o cualquier proveedor)',
        enabled: true,
        fields: [
          { key: 'connectionString', label: 'Connection String', placeholder: 'postgresql://user:pass@host:5432/dbname', type: 'url', required: true }
        ]
      }
    ]
  });
});

/**
 * POST /api/setup/test-connection
 * Test database credentials without saving them
 */
router.post('/test-connection', async (req, res) => {
  const { connectionString } = req.body;

  if (!connectionString) {
    return res.status(400).json({ message: 'Connection string es requerido' });
  }

  let client;
  try {
    client = await connectPg(connectionString);
    // Test if schema exists
    const { rows } = await client.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'app_settings') AS exists"
    );
    const schemaReady = rows[0]?.exists === true;
    await client.end().catch(() => {});
    return res.json({
      connected: true,
      schemaReady,
      message: schemaReady ? 'Conexión exitosa — base de datos lista' : 'Conexión exitosa, pero las tablas no existen.'
    });
  } catch (err) {
    if (client) await client.end().catch(() => {});
    return res.status(400).json({ connected: false, message: `Error de conexión: ${err.message}` });
  }
});

/**
 * POST /api/setup/initialize-schema
 * Creates tables and seed data directly via PostgreSQL (pg).
 * Uses IF NOT EXISTS / ON CONFLICT DO NOTHING — safe to re-run.
 */
router.post('/initialize-schema', async (req, res) => {
  const { connectionString } = req.body;

  if (!connectionString) {
    return res.status(400).json({ message: 'Connection string es requerido' });
  }

  // Validate it looks like a postgres URI
  if (!connectionString.startsWith('postgresql://') && !connectionString.startsWith('postgres://')) {
    return res.status(400).json({ message: 'Formato inválido. Usa un URI PostgreSQL (postgresql://...)' });
  }

  // Read SQL files (schema + seed)
  const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
  const seedPath = path.join(__dirname, '..', 'database', 'seed.sql');
  let schemaSql, seedSql;
  try {
    schemaSql = fs.readFileSync(schemaPath, 'utf8');
    seedSql = fs.readFileSync(seedPath, 'utf8');
  } catch (err) {
    return res.status(500).json({ message: 'Error leyendo archivos SQL: ' + err.message });
  }

  // Connect directly to PostgreSQL via pg (auto SSL fallback for Docker/local)
  let client;
  try {
    client = await connectPg(connectionString, 15000);

    // Execute schema (tables, indexes, RPC functions) — IF NOT EXISTS is idempotent
    await client.query(schemaSql);

    // Execute seed (admin user, default settings) — ON CONFLICT DO NOTHING is idempotent
    await client.query(seedSql);

    console.log('✅ Schema + seed ejecutados correctamente via pg');
    res.json({ success: true, message: 'Tablas y datos iniciales creados correctamente' });
  } catch (err) {
    const msg = err.message || 'Error desconocido';
    console.error('❌ initialize-schema error:', msg);
    // Friendly error messages for common failures
    if (msg.includes('password authentication failed')) {
      return res.status(401).json({ message: 'Contraseña de base de datos incorrecta. Revisa el password en tu Connection String.' });
    }
    if (msg.includes('ENOTFOUND') || msg.includes('ETIMEDOUT') || msg.includes('getaddrinfo')) {
      return res.status(400).json({ message: 'No se pudo resolver el host. Verifica el hostname en el connection string.' });
    }
    if (msg.includes('ECONNREFUSED')) {
      return res.status(400).json({ message: 'Conexión rechazada. Verifica que PostgreSQL esté corriendo y accesible.' });
    }
    res.status(500).json({ message: `Error inicializando schema: ${msg}` });
  } finally {
    await client.end().catch(() => {});
  }
});

/**
 * POST /api/setup/configure
 * Save database credentials and activate the app.
 * Writes to .env.local (persists across restarts) and reinitializes the DB client.
 */
router.post('/configure', async (req, res) => {
  const { connectionString } = req.body;

  if (!connectionString) {
    return res.status(400).json({ message: 'Connection string es requerido' });
  }

  // 1. Verify connection + schema (auto SSL fallback for Docker)
  let client;
  try {
    client = await connectPg(connectionString);
    const { rows } = await client.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'app_settings') AS exists"
    );
    await client.end().catch(() => {});
    if (!rows[0]?.exists) {
      return res.status(400).json({ message: 'Las tablas no existen. Inicializa el schema primero.', code: 'SCHEMA_MISSING' });
    }
  } catch (err) {
    if (client) await client.end().catch(() => {});
    return res.status(400).json({ message: `Error de conexión: ${err.message}` });
  }

  // 2. Write credentials to .env.local
  const envLocalPath = path.join(__dirname, '..', '.env.local');
  const envLines = [
    '# Auto-generated by Setup Wizard',
    `# Created: ${new Date().toISOString()}`,
    `DATABASE_URL=${connectionString}`,
    `JWT_SECRET=${JWT_SECRET}`
  ];
  try {
    fs.writeFileSync(envLocalPath, envLines.join('\n') + '\n', 'utf8');
  } catch (err) {
    console.error('❌ Error writing .env.local:', err.message);
    return res.status(500).json({ message: 'Error guardando credenciales en el servidor' });
  }

  // 3. Set env vars in current process
  process.env.DATABASE_URL = connectionString;

  // 4. Reinitialize the database adapter
  const success = reinitializeDb(connectionString);
  if (!success) {
    return res.status(500).json({ message: 'Credenciales guardadas pero la reconexión falló. Reinicia el servidor.' });
  }

  console.log('✅ Setup completado: PostgreSQL configurado via Setup Wizard');
  return res.json({ message: 'Configuración completada exitosamente', database: true, restart: false });
});

module.exports = router;
