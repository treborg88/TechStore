// database/index.js — Adapter router with hot-swap support
// Reads DB_PROVIDER from env: 'supabase' (default) or 'postgres'.
// Re-exports the matching adapter module with identical interface.
//
// All consumers (routes, middleware, services) do:
//   const { statements } = require('../database');
// and get the active adapter transparently — no path changes needed.
//
// switchProvider('postgres') — hot-swaps the adapter at runtime
// (used by Setup Wizard when user picks a provider different from the initial one).

require('dotenv').config();
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local'), override: true });

let currentAdapter = null;

/**
 * Load (or reload) the adapter for the given provider name.
 * Clears module caches so a fresh instance is created.
 */
function loadAdapter(name) {
  // Clear cached modules so env changes take effect on re-require
  try { delete require.cache[require.resolve('./supabase')]; } catch { /* first load */ }
  try { delete require.cache[require.resolve('./postgres')]; } catch { /* first load */ }

  if (name === 'postgres') {
    console.log('🐘 Database provider: PostgreSQL (native)');
    currentAdapter = require('./postgres');
  } else {
    console.log('⚡ Database provider: Supabase');
    currentAdapter = require('./supabase');
  }
  return currentAdapter;
}

// Initial load based on env
loadAdapter((process.env.DB_PROVIDER || 'supabase').toLowerCase());

// ── Proxy for `statements` ─────────────────────────────────────────────────
// Route files destructure `const { statements } = require('../database')` at
// module top level.  A plain getter would snapshot the value at require-time,
// so a later switchProvider() wouldn't propagate.  The Proxy delegates every
// property access to `currentAdapter.statements` dynamically, so hot-swap
// works even for already-destructured references.
const statementsProxy = new Proxy({}, {
  get(_, prop) { return currentAdapter.statements[prop]; },
  has(_, prop) { return prop in currentAdapter.statements; },
  ownKeys()   { return Object.keys(currentAdapter.statements); },
  getOwnPropertyDescriptor(_, prop) {
    if (prop in currentAdapter.statements) {
      return { configurable: true, enumerable: true, value: currentAdapter.statements[prop] };
    }
  }
});

// ── Module exports ─────────────────────────────────────────────────────────
// Live accessors for adapter-specific objects (use via require, not destructure)
// Function wrappers for operations (safe to destructure)
module.exports = {
  // Proxy — safe to destructure, follows hot-swaps
  statements: statementsProxy,

  // Getters — read from the active adapter (use require('../database').X directly)
  get supabase() { return currentAdapter.supabase; },
  get pool()     { return currentAdapter.pool || null; },
  get provider() { return currentAdapter.provider; },
  get UPLOADS_DIR() { return currentAdapter.UPLOADS_DIR || null; },

  // Functions — safe to destructure, follow hot-swaps via closure
  dbConfigured:    () => currentAdapter.dbConfigured(),
  reinitializeDb:  (...args) => currentAdapter.reinitializeDb(...args),
  disconnectDb:    () => currentAdapter.disconnectDb(),
  testConnection:  () => (currentAdapter.testConnection ? currentAdapter.testConnection() : Promise.resolve(false)),
  switchProvider:  (name) => loadAdapter(name)
};
