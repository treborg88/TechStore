// database/index.js — PostgreSQL adapter re-export
// All consumers (routes, middleware, services) do:
//   const { statements } = require('../database');
// and get the PostgreSQL adapter transparently.

require('dotenv').config();
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local'), override: true });

const adapter = require('./postgres');

console.log('🐘 Database provider: PostgreSQL');

// ── Module exports ─────────────────────────────────────────────────────────
module.exports = {
  statements:     adapter.statements,
  get pool()      { return adapter.pool || null; },
  provider:       adapter.provider,
  get UPLOADS_DIR() { return adapter.UPLOADS_DIR || null; },
  dbConfigured:   () => adapter.dbConfigured(),
  reinitializeDb: (...args) => adapter.reinitializeDb(...args),
  disconnectDb:   () => adapter.disconnectDb(),
  testConnection: () => (adapter.testConnection ? adapter.testConnection() : Promise.resolve(false)),
  withTenantSchema:   (...args) => adapter.withTenantSchema(...args),
  withTransaction:    (...args) => adapter.withTransaction(...args),
  get tenantContext() { return adapter.tenantContext; },
  deleteUploadedFile: (...args) => adapter.deleteUploadedFile(...args),
};
