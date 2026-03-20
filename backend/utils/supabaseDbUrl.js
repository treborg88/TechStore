// utils/supabaseDbUrl.js
// Helpers to derive a usable PostgreSQL connection string from Supabase credentials.

const { Client } = require('pg');
const { URL } = require('url');

const DEFAULT_PG_USER = 'postgres';
const DEFAULT_PG_DB = 'postgres';
const DEFAULT_PG_PORT = 5432;

/**
 * Build a Postgres connection string for Supabase given a project URL and anon key.
 * Does not validate connectivity.
 */
function buildSupabasePgUrl(supabaseUrl, supabaseKey) {
  if (!supabaseUrl || !supabaseKey) return null;
  try {
    const urlObj = new URL(supabaseUrl);
    const projectRef = urlObj.hostname.split('.')[0];
    if (!projectRef) return null;

    const host = `${projectRef}.supabase.co`;
    const encodedKey = encodeURIComponent(supabaseKey);

    return `postgresql://${DEFAULT_PG_USER}:${encodedKey}@${host}:${DEFAULT_PG_PORT}/${DEFAULT_PG_DB}`;
  } catch {
    return null;
  }
}

/**
 * Quick check that a Postgres connection string works (uses a short timeout).
 */
async function validatePostgresUrl(connectionString, timeoutMs = 5000) {
  if (!connectionString) return false;
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: timeoutMs,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    return true;
  } catch {
    try { await client.end(); } catch { /* ignore */ }
    return false;
  }
}

/**
 * Derive a DATABASE_URL from SUPABASE_URL and SUPABASE_KEY, validating connectivity.
 * Returns null if unable to derive/connect.
 */
async function getSupabaseDerivedDatabaseUrl(opts = {}) {
  const supabaseUrl = opts.supabaseUrl || process.env.SUPABASE_URL;
  const supabaseKey = opts.supabaseKey || process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) return null;

  const candidate = buildSupabasePgUrl(supabaseUrl, supabaseKey);
  if (!candidate) return null;

  const ok = await validatePostgresUrl(candidate);
  return ok ? candidate : null;
}

module.exports = {
  buildSupabasePgUrl,
  validatePostgresUrl,
  getSupabaseDerivedDatabaseUrl
};
