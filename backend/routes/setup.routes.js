// routes/setup.routes.js - Setup wizard API (no auth required, only works when DB is not configured)
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const { dbConfigured, reinitializeDb } = require('../database');
const { JWT_SECRET } = require('../config');

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
        id: 'supabase', 
        name: 'Supabase', 
        description: 'Base de datos PostgreSQL gestionada en la nube',
        enabled: true,
        fields: [
          { key: 'url', label: 'Supabase URL', placeholder: 'https://xxxxx.supabase.co', type: 'url', required: true },
          { key: 'key', label: 'Supabase Anon Key', placeholder: 'eyJhbGciOi...', type: 'password', required: true }
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
  const { provider, url, key } = req.body;

  if (provider !== 'supabase') {
    return res.status(400).json({ message: 'Proveedor no soportado' });
  }
  if (!url || !key) {
    return res.status(400).json({ message: 'URL y Key son requeridos' });
  }

  // Validate URL format
  try { new URL(url); } catch {
    return res.status(400).json({ message: 'URL inválida. Formato esperado: https://xxxxx.supabase.co' });
  }

  try {
    const { createClient } = require('@supabase/supabase-js');
    const testClient = createClient(url, key);
    
    // Use regular SELECT (not head:true) — HEAD requests may return 200 for missing tables
    const { data, error } = await testClient
      .from('app_settings')
      .select('id')
      .limit(1);

    if (error) {
      // Table doesn't exist → connection works but schema missing
      const msg = (error.message || '').toLowerCase();
      const code = error.code || '';
      if (code === '42P01' || code.startsWith('PGRST') || msg.includes('does not exist') || msg.includes('relation') || msg.includes('not find')) {
        return res.json({ 
          connected: true, 
          schemaReady: false,
          message: 'Conexión exitosa, pero las tablas no existen.'
        });
      }
      return res.status(400).json({ connected: false, message: `Error de conexión: ${error.message}` });
    }

    // data is an array (possibly empty) — table exists
    res.json({ connected: true, schemaReady: true, message: 'Conexión exitosa — base de datos lista' });
  } catch (err) {
    res.status(400).json({ connected: false, message: `Error de conexión: ${err.message}` });
  }
});

/**
 * POST /api/setup/initialize-schema
 * Creates tables and seed data directly via PostgreSQL (pg).
 * Accepts a full connection string (from Supabase Dashboard → Connect → URI).
 * Uses IF NOT EXISTS / ON CONFLICT DO NOTHING — safe to re-run.
 */
router.post('/initialize-schema', async (req, res) => {
  const { connectionString } = req.body;

  if (!connectionString) {
    return res.status(400).json({ message: 'Connection string es requerido' });
  }

  // Validate it looks like a postgres URI
  if (!connectionString.startsWith('postgresql://') && !connectionString.startsWith('postgres://')) {
    return res.status(400).json({ message: 'Formato inválido. Usa el URI de conexión de Supabase (postgresql://...)' });
  }

  // Parse and validate the connection string before attempting connection
  let finalConnectionString = connectionString;
  try {
    const parsed = new URL(connectionString);

    // Block Transaction mode (port 6543) — DDL requires Session mode (port 5432)
    if (parsed.port === '6543') {
      return res.status(400).json({
        message: 'Puerto 6543 es Transaction mode — no soporta CREATE TABLE. Usa Session mode (puerto 5432). En Supabase Dashboard → Connect → Session mode.'
      });
    }

    // Auto-fix deprecated db.<ref>.supabase.co → reject with clear instructions
    // Cannot auto-convert because the pooler region (us-east-1, us-west-2, etc.) is unknown
    const dbHostMatch = parsed.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/);
    if (dbHostMatch) {
      return res.status(400).json({
        message: 'El host db.<ref>.supabase.co ya no funciona (IPv6 only). Usa Session pooler desde Supabase Dashboard → Connect → Method: Session pooler. El URI correcto tiene este formato: postgresql://postgres.<ref>:[PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres'
      });
    }
  } catch { /* URL parse failed — pg will handle it */ }

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

  // Connect directly to PostgreSQL via pg using the (possibly rewritten) connection string
  const { Client } = require('pg');
  const client = new Client({
    connectionString: finalConnectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();

    // Execute schema (tables, indexes, RPC functions) — IF NOT EXISTS is idempotent
    await client.query(schemaSql);

    // Execute seed (admin user, default settings) — ON CONFLICT DO NOTHING is idempotent
    await client.query(seedSql);

    // Notify PostgREST to reload schema cache so Supabase REST API sees new tables
    await client.query("NOTIFY pgrst, 'reload schema'");

    console.log('✅ Schema + seed ejecutados correctamente via pg');
    res.json({ success: true, message: 'Tablas y datos iniciales creados correctamente' });
  } catch (err) {
    const msg = err.message || 'Error desconocido';
    console.error('❌ initialize-schema error:', msg);
    // Friendly error messages for common failures
    if (msg.includes('password authentication failed')) {
      return res.status(401).json({ message: 'Contraseña de base de datos incorrecta. Revisa el password en tu Connection String.' });
    }
    if (msg.includes('Tenant or user not found') || msg.includes('tenant')) {
      return res.status(401).json({
        message: 'Proyecto no encontrado o contraseña incorrecta. Copia el Connection String exacto desde Supabase Dashboard → Connect → Session mode (puerto 5432).'
      });
    }
    if (msg.includes('ENOTFOUND') || msg.includes('ETIMEDOUT') || msg.includes('getaddrinfo')) {
      return res.status(400).json({ message: 'No se pudo resolver el host. Usa Session mode desde Supabase Dashboard → Connect.' });
    }
    if (msg.includes('ECONNREFUSED')) {
      return res.status(400).json({ message: 'Conexión rechazada. Verifica que el proyecto de Supabase esté activo (no pausado).' });
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
 * Retries schema check to allow PostgREST schema cache to refresh after initialize-schema.
 */
router.post('/configure', async (req, res) => {
  const { provider, url, key } = req.body;

  if (provider !== 'supabase') {
    return res.status(400).json({ message: 'Proveedor no soportado' });
  }
  if (!url || !key) {
    return res.status(400).json({ message: 'URL y Key son requeridos' });
  }

  // 1. Test connection — retry up to 3 times (PostgREST may need time to reload schema cache)
  try {
    const { createClient } = require('@supabase/supabase-js');
    const testClient = createClient(url, key);

    // Use regular SELECT (not head:true) — HEAD requests may bypass error detection
    let schemaFound = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await testClient
        .from('app_settings')
        .select('id')
        .limit(1);

      if (!error) {
        schemaFound = true;
        break;
      }
      // Non-schema error → fail immediately
      const msg = (error.message || '').toLowerCase();
      const code = error.code || '';
      const isSchemaError = code === '42P01' || code.startsWith('PGRST') || msg.includes('does not exist') || msg.includes('relation') || msg.includes('not find');
      if (!isSchemaError) {
        return res.status(400).json({ message: `No se pudo conectar: ${error.message}` });
      }
      // Schema not visible yet — wait before retry
      if (attempt < 2) await new Promise(r => setTimeout(r, 1500));
    }

    if (!schemaFound) {
      return res.status(400).json({ 
        message: 'Las tablas no existen. Inicializa el schema primero.',
        code: 'SCHEMA_MISSING'
      });
    }
  } catch (err) {
    return res.status(400).json({ message: `Error de conexión: ${err.message}` });
  }

  // 2. Write credentials to .env.local (persists across deploys/restarts)
  const envLocalPath = path.join(__dirname, '..', '.env.local');
  const envLines = [
    '# Auto-generated by Setup Wizard',
    `# Created: ${new Date().toISOString()}`,
    `SUPABASE_URL=${url}`,
    `SUPABASE_KEY=${key}`,
    `JWT_SECRET=${JWT_SECRET}`
  ];

  try {
    fs.writeFileSync(envLocalPath, envLines.join('\n') + '\n', 'utf8');
  } catch (err) {
    console.error('❌ Error writing .env.local:', err.message);
    return res.status(500).json({ message: 'Error guardando credenciales en el servidor' });
  }

  // 3. Set env vars in current process
  process.env.SUPABASE_URL = url;
  process.env.SUPABASE_KEY = key;

  // 4. Reinitialize DB client (hot-reconnect, no restart needed)
  const success = reinitializeDb(url, key);
  if (!success) {
    return res.status(500).json({ message: 'Credenciales guardadas pero la reconexión falló. Reinicia el servidor.' });
  }

  console.log('✅ Setup completado: DB configurada via Setup Wizard');
  console.log(`   .env.local creado en: ${envLocalPath}`);

  res.json({ 
    message: 'Configuración completada exitosamente',
    database: true,
    restart: false
  });
});

module.exports = router;
