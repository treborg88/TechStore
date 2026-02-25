// routes/setup.routes.js - Setup wizard API (no auth required, only works when DB is not configured)
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const { dbConfigured, reinitializeDb, switchProvider } = require('../database');
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
        id: 'supabase', 
        name: 'Supabase', 
        description: 'Base de datos PostgreSQL gestionada en la nube',
        enabled: true,
        fields: [
          { key: 'url', label: 'Supabase URL', placeholder: 'https://xxxxx.supabase.co', type: 'url', required: true },
          { key: 'key', label: 'Supabase Anon Key', placeholder: 'eyJhbGciOi...', type: 'password', required: true }
        ]
      },
      {
        id: 'postgres',
        name: 'PostgreSQL',
        description: 'PostgreSQL nativo (Docker, auto-hospedado o cualquier proveedor)',
        enabled: true,
        fields: [
          { key: 'connectionString', label: 'Connection String', placeholder: 'postgresql://user:pass@host:5432/dbname', type: 'url', required: true }
        ]
      }
    ]
  });
});

/**
 * GET /api/setup/detect
 * Auto-detect a local PostgreSQL database from DATABASE_URL env var.
 * Returns host/port/database/user (never the password) + connection status.
 */
router.get('/detect', async (req, res) => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return res.json({ detected: false, message: 'No se detectó DATABASE_URL en el entorno' });
  }

  // Parse the connection string to extract components (mask password)
  try {
    const parsed = new URL(dbUrl);
    const info = {
      detected: true,
      host: parsed.hostname,
      port: parsed.port || '5432',
      database: parsed.pathname.replace('/', ''),
      user: decodeURIComponent(parsed.username),
    };

    // Try connecting to verify it's reachable
    let client;
    try {
      client = await connectPg(dbUrl, 5000);
      const { rows } = await client.query(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'app_settings') AS exists"
      );
      info.reachable = true;
      info.schemaReady = rows[0]?.exists === true;
      await client.end().catch(() => {});
    } catch {
      if (client) await client.end().catch(() => {});
      info.reachable = false;
      info.schemaReady = false;
    }

    return res.json(info);
  } catch {
    return res.json({ detected: false, message: 'DATABASE_URL tiene formato inválido' });
  }
});

/**
 * POST /api/setup/test-connection
 * Test database credentials without saving them.
 * Accepts either { connectionString } or { host, port, database, user, password }.
 */
router.post('/test-connection', async (req, res) => {
  let { provider, url, key, connectionString, host, port, database, user, password } = req.body;

  // ── PostgreSQL native ──
  if (provider === 'postgres') {
    // Build connection string from individual fields if not provided directly
    if (!connectionString && host && user && password) {
      const dbName = database || 'postgres';
      const dbPort = port || '5432';
      connectionString = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${dbPort}/${dbName}`;
    }
    if (!connectionString) {
      return res.status(400).json({ message: 'Credenciales incompletas' });
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
  }

  // ── Supabase ──
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
    
    const { data, error } = await testClient
      .from('app_settings')
      .select('id')
      .limit(1);

    if (error) {
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
  const { connectionString, provider: reqProvider } = req.body;

  if (!connectionString) {
    return res.status(400).json({ message: 'Connection string es requerido' });
  }

  // Validate it looks like a postgres URI
  if (!connectionString.startsWith('postgresql://') && !connectionString.startsWith('postgres://')) {
    return res.status(400).json({ message: 'Formato inválido. Usa un URI PostgreSQL (postgresql://...)' });
  }

  // Supabase-specific validations (skip for native postgres)
  let finalConnectionString = connectionString;
  const isSupabaseProvider = reqProvider !== 'postgres';
  try {
    const parsed = new URL(connectionString);

    if (isSupabaseProvider) {
      // Block Transaction mode (port 6543) — DDL requires Session mode (port 5432)
      if (parsed.port === '6543') {
        return res.status(400).json({
          message: 'Puerto 6543 es Transaction mode — no soporta CREATE TABLE. Usa Session mode (puerto 5432). En Supabase Dashboard → Connect → Session mode.'
        });
      }

      // Reject deprecated db.<ref>.supabase.co hosts
      const dbHostMatch = parsed.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/);
      if (dbHostMatch) {
        return res.status(400).json({
          message: 'El host db.<ref>.supabase.co ya no funciona (IPv6 only). Usa Session pooler desde Supabase Dashboard → Connect → Method: Session pooler.'
        });
      }
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

  // Connect directly to PostgreSQL via pg (auto SSL fallback for Docker/local)
  let client;
  try {
    client = await connectPg(finalConnectionString, 15000);

    // Execute schema (tables, indexes, RPC functions) — IF NOT EXISTS is idempotent
    await client.query(schemaSql);

    // Execute seed (admin user, default settings) — ON CONFLICT DO NOTHING is idempotent
    await client.query(seedSql);

    // Notify PostgREST to reload schema cache (Supabase only — harmless elsewhere)
    try { await client.query("NOTIFY pgrst, 'reload schema'"); } catch { /* not Supabase */ }

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
  let { provider, url, key, connectionString, host, port, database, user, password } = req.body;

  // ── PostgreSQL native ──
  if (provider === 'postgres') {
    // Build connection string from individual fields if not provided directly
    if (!connectionString && host && user && password) {
      const dbName = database || 'postgres';
      const dbPort = port || '5432';
      connectionString = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${dbPort}/${dbName}`;
    }
    if (!connectionString) {
      return res.status(400).json({ message: 'Credenciales incompletas' });
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
      'DB_PROVIDER=postgres',
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
    process.env.DB_PROVIDER = 'postgres';
    process.env.DATABASE_URL = connectionString;

    // 4. Hot-swap to postgres adapter and reinitialize
    switchProvider('postgres');
    const success = reinitializeDb(connectionString);
    if (!success) {
      return res.status(500).json({ message: 'Credenciales guardadas pero la reconexión falló. Reinicia el servidor.' });
    }

    console.log('✅ Setup completado: PostgreSQL configurado via Setup Wizard');
    return res.json({ message: 'Configuración completada exitosamente', database: true, restart: false });
  }

  // ── Supabase ──
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
      const msg = (error.message || '').toLowerCase();
      const code = error.code || '';
      const isSchemaError = code === '42P01' || code.startsWith('PGRST') || msg.includes('does not exist') || msg.includes('relation') || msg.includes('not find');
      if (!isSchemaError) {
        return res.status(400).json({ message: `No se pudo conectar: ${error.message}` });
      }
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

  // 2. Write credentials to .env.local
  const envLocalPath = path.join(__dirname, '..', '.env.local');
  const envLines = [
    '# Auto-generated by Setup Wizard',
    `# Created: ${new Date().toISOString()}`,
    'DB_PROVIDER=supabase',
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
  process.env.DB_PROVIDER = 'supabase';
  process.env.SUPABASE_URL = url;
  process.env.SUPABASE_KEY = key;

  // 4. Reinitialize DB client (hot-reconnect, no restart needed)
  const success = reinitializeDb(url, key);
  if (!success) {
    return res.status(500).json({ message: 'Credenciales guardadas pero la reconexión falló. Reinicia el servidor.' });
  }

  console.log('✅ Setup completado: Supabase configurado via Setup Wizard');
  console.log(`   .env.local creado en: ${envLocalPath}`);

  res.json({ 
    message: 'Configuración completada exitosamente',
    database: true,
    restart: false
  });
});

module.exports = router;
