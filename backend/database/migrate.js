#!/usr/bin/env node
// =============================================================================
// Database Migration Script — runs schema.sql + seed.sql via pg (no psql needed)
// =============================================================================
// Usage: node backend/database/migrate.js
// Checks DATABASE_URL or SUPABASE_DB_URL from .env / .env.local.
// Safe to re-run: schema uses IF NOT EXISTS, seed uses ON CONFLICT DO NOTHING.
// =============================================================================

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local'), override: true });

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const SCHEMA_FILE = path.join(__dirname, 'schema.sql');
const SEED_FILE = path.join(__dirname, 'seed.sql');

async function run() {
  // Accept DATABASE_URL (postgres adapter) or SUPABASE_DB_URL (direct PG for Supabase)
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error('❌ No database connection string found.');
    console.error('   Set one of these in backend/.env.local:');
    console.error('   - DATABASE_URL  (for native PostgreSQL)');
    console.error('   - SUPABASE_DB_URL  (Supabase → Project Settings → Database → Connection string → URI)');
    process.exit(1);
  }

  // Connect with SSL auto-detect (Supabase requires SSL)
  let client;
  try {
    client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
  } catch {
    // Retry without SSL (local Postgres)
    client = new Client({ connectionString: dbUrl });
    await client.connect();
  }

  try {
    // Run schema
    const schema = fs.readFileSync(SCHEMA_FILE, 'utf-8');
    console.log('▶ Running schema.sql ...');
    await client.query(schema);
    console.log('✔ schema.sql applied');

    // Run seed
    const seed = fs.readFileSync(SEED_FILE, 'utf-8');
    console.log('▶ Running seed.sql ...');
    await client.query(seed);
    console.log('✔ seed.sql applied');

    console.log('MIGRATE_OK');
  } finally {
    await client.end();
  }
}

run().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
