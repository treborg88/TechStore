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
    // Available DB providers (extensible for future: docker, etc.)
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
 * GET /api/setup/schema
 * Returns the combined SQL (schema + seed) for manual execution in Supabase SQL Editor
 */
router.get('/schema', (req, res) => {
  try {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const seedPath = path.join(__dirname, '..', 'database', 'seed.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    const seed = fs.readFileSync(seedPath, 'utf8');
    res.json({ 
      sql: schema + '\n\n' + seed,
      schemaLines: schema.split('\n').length,
      seedLines: seed.split('\n').length
    });
  } catch (err) {
    res.status(500).json({ message: 'Error leyendo archivos SQL: ' + err.message });
  }
});

/**
 * POST /api/setup/check-schema
 * Verify that essential tables exist in the connected database
 */
router.post('/check-schema', async (req, res) => {
  const { url, key } = req.body;
  if (!url || !key) {
    return res.status(400).json({ message: 'URL y Key son requeridos' });
  }

  try {
    const { createClient } = require('@supabase/supabase-js');
    const client = createClient(url, key);

    // Check essential tables
    const tables = ['users', 'products', 'orders', 'app_settings'];
    const results = {};

    for (const table of tables) {
      const { error } = await client.from(table).select('id', { count: 'exact', head: true });
      results[table] = !error || (error.code !== '42P01' && !error.message?.includes('does not exist'));
    }

    const allReady = Object.values(results).every(Boolean);
    res.json({ schemaReady: allReady, tables: results });
  } catch (err) {
    res.status(400).json({ message: 'Error verificando schema: ' + err.message });
  }
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
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ message: 'URL inválida. Formato esperado: https://xxxxx.supabase.co' });
  }

  // Test connection with a lightweight query
  try {
    const { createClient } = require('@supabase/supabase-js');
    const testClient = createClient(url, key);
    
    // Try querying a known table (settings) or just test auth
    const { error } = await testClient
      .from('app_settings')
      .select('id', { count: 'exact', head: true });

    if (error) {
      // If table doesn't exist, connection works but schema is missing
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return res.json({ 
          connected: true, 
          schemaReady: false,
          message: 'Conexión exitosa, pero las tablas no existen. Ejecuta schema.sql en Supabase.'
        });
      }
      return res.status(400).json({ 
        connected: false, 
        message: `Error de conexión: ${error.message}` 
      });
    }

    res.json({ 
      connected: true, 
      schemaReady: true,
      message: 'Conexión exitosa — base de datos lista'
    });
  } catch (err) {
    res.status(400).json({ 
      connected: false, 
      message: `Error de conexión: ${err.message}` 
    });
  }
});

/**
 * POST /api/setup/configure
 * Save database credentials and activate the app.
 * Writes to .env.local (persists across restarts) and reinitializes the DB client.
 */
router.post('/configure', async (req, res) => {
  const { provider, url, key } = req.body;

  if (provider !== 'supabase') {
    return res.status(400).json({ message: 'Proveedor no soportado' });
  }

  if (!url || !key) {
    return res.status(400).json({ message: 'URL y Key son requeridos' });
  }

  // 1. Test connection and verify schema exists
  try {
    const { createClient } = require('@supabase/supabase-js');
    const testClient = createClient(url, key);
    const { error } = await testClient
      .from('app_settings')
      .select('id', { count: 'exact', head: true });

    if (error) {
      // Table doesn't exist → schema not initialized
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return res.status(400).json({ 
          message: 'Las tablas no existen. Ejecuta el schema SQL en Supabase antes de configurar.',
          code: 'SCHEMA_MISSING'
        });
      }
      return res.status(400).json({ 
        message: `No se pudo conectar: ${error.message}` 
      });
    }
  } catch (err) {
    return res.status(400).json({ 
      message: `Error de conexión: ${err.message}` 
    });
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
    return res.status(500).json({ 
      message: 'Error guardando credenciales en el servidor' 
    });
  }

  // 3. Set env vars in current process
  process.env.SUPABASE_URL = url;
  process.env.SUPABASE_KEY = key;

  // 4. Reinitialize DB client (hot-reconnect, no restart needed)
  const success = reinitializeDb(url, key);
  if (!success) {
    return res.status(500).json({ 
      message: 'Credenciales guardadas pero la reconexión falló. Reinicia el servidor.' 
    });
  }

  console.log('✅ Setup completado: DB configurada via Setup Wizard');
  console.log(`   .env.local creado en: ${envLocalPath}`);

  res.json({ 
    message: 'Configuración completada exitosamente',
    database: true,
    restart: false // No restart needed — reinitializeDb handles it
  });
});

module.exports = router;
