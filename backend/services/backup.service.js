const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const db = require('../database');
const { createBackupStorageAdapter } = require('../storage/backup-storage');

const DEFAULT_BACKUPS_DIR = path.join(__dirname, '..', 'backups');
const DEFAULT_IMAGE_DIR = path.join(__dirname, '..', 'uploads', 'products');
const TEMP_BASE_DIR = path.join(DEFAULT_BACKUPS_DIR, '.tmp');
const MAIN_TABLES = ['users', 'products', 'product_images', 'orders', 'order_items', 'cart', 'app_settings', 'verification_codes'];
const BACKUP_MANIFEST_VERSION = '1.1';

const storage = createBackupStorageAdapter({
  BACKUP_STORAGE: process.env.BACKUP_STORAGE || 'local',
  BACKUP_STORAGE_PATH: process.env.BACKUP_STORAGE_PATH || DEFAULT_BACKUPS_DIR,
  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
  S3_REGION: process.env.S3_REGION,
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
  S3_ENDPOINT: process.env.S3_ENDPOINT,
  S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE === 'true'
});

const parseDbUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  return m ? { user: m[1], password: m[2], host: m[3], port: m[4], dbname: m[5] } : null;
};

const isValidTenantSchema = (schemaName) => /^tenant_[a-z0-9_]+$/.test(schemaName || '');

const sanitizeFilename = (name) => {
  if (!name || typeof name !== 'string') return null;
  const base = path.basename(name);
  if (base.includes('..') || base.includes('/') || base.includes('\\')) return null;
  if (!base.endsWith('.sql') && !base.endsWith('.tar.gz') && !base.endsWith('.tar')) return null;
  return base;
};

const runExec = (bin, args, parsed, opts = {}) => new Promise((resolve, reject) => {
  const env = { ...process.env, PGPASSWORD: parsed.password };
  execFile(bin, args, {
    timeout: opts.timeout || 120000,
    maxBuffer: opts.maxBuffer || 50 * 1024 * 1024,
    env
  }, (err, stdout, stderr) => {
    if (err) {
      if (err.code === 'ENOENT') {
        const inDocker = fs.existsSync('/.dockerenv');
        const baseMessage = `Binary not found: ${bin}.`;
        const containerHint = inDocker
          ? 'The backend container is missing PostgreSQL client tools. Rebuild the backend image with the correct toolchain.'
          : 'Install PostgreSQL client tools or run the app with Docker Compose.';
        return reject(new Error(`${baseMessage} ${containerHint}`));
      }
      return reject(new Error(stderr || err.message));
    }
    resolve({ stdout, stderr });
  });
});

const tarExec = (args, opts = {}) => new Promise((resolve, reject) => {
  execFile('tar', args, {
    timeout: opts.timeout || 300000,
    maxBuffer: opts.maxBuffer || 50 * 1024 * 1024
  }, (err, stdout, stderr) => {
    if (err) return reject(new Error(stderr || err.message));
    resolve({ stdout, stderr });
  });
});

const ensureTempBase = async () => {
  await fs.promises.mkdir(TEMP_BASE_DIR, { recursive: true });
};

const makeTempDir = async () => {
  await ensureTempBase();
  return fs.promises.mkdtemp(path.join(TEMP_BASE_DIR, 'bk-'));
};

const rmDir = async (dirPath) => {
  try {
    await fs.promises.rm(dirPath, { recursive: true, force: true });
  } catch (_) {
    // ignore cleanup failures
  }
};

const rmFile = async (filePath) => {
  try {
    await fs.promises.unlink(filePath);
  } catch (_) {
    // ignore cleanup failures
  }
};

const formatTimestamp = () => {
  const d = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
};

const formatDateOnly = () => {
  const d = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

const makeSchemaSuffix = () => formatTimestamp().slice(2);

const truncatePgIdentifier = (name) => {
  if (name.length <= 63) return name;
  return name.slice(0, 63);
};

let schemaCleanupQueue = Promise.resolve();

const enqueueSchemaDropCleanup = ({ parsed, dbName, schemaName }) => {
  if (!schemaName || !isValidTenantSchema(schemaName)) return;
  schemaCleanupQueue = schemaCleanupQueue
    .then(async () => {
      const startedAt = Date.now();
      console.log(`[restore-cleanup][${schemaName}] drop start`);
      await dropSchemaIfExists({ parsed, dbName, schemaName });
      const elapsed = Date.now() - startedAt;
      console.log(`[restore-cleanup][${schemaName}] drop done in ${elapsed}ms`);
    })
    .catch((err) => {
      console.error(`[restore-cleanup][${schemaName}] drop failed: ${err.message}`);
    });
};

const getStoreName = async (tenant) => {
  if (tenant?.slug) return tenant.slug.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || 'tenant';
  return 'saas';
};

const countProductImages = async () => {
  try {
    const entries = await fs.promises.readdir(DEFAULT_IMAGE_DIR);
    return entries.filter((name) => !name.startsWith('.')).length;
  } catch {
    return 0;
  }
};

const getTableStats = async (schemaName) => {
  if (!db.pool || !isValidTenantSchema(schemaName)) return {};
  try {
    return await db.withTenantSchema(schemaName, async (client) => {
      const stats = {};
      for (const table of MAIN_TABLES) {
        try {
          const result = await client.query(`SELECT COUNT(*) AS count FROM ${table}`);
          stats[table] = parseInt(result.rows[0].count, 10);
        } catch {
          stats[table] = -1;
        }
      }
      return stats;
    });
  } catch {
    return {};
  }
};

const inspectArchive = async (archivePath) => {
  const { stdout } = await tarExec(['-tzf', archivePath]);
  const files = stdout.split('\n').filter(Boolean);
  const hasSql = files.some((f) => f === 'database.sql' || f.endsWith('.sql'));
  const imageFiles = files.filter((f) => f.startsWith('products/') || f.startsWith('images/'));
  const hasManifest = files.includes('manifest.json');
  return { hasSql, imageCount: imageFiles.length, hasManifest };
};

const buildManifest = async ({ type, tenant, tenantFiles = [], rowCounts = {}, imageCount = 0, name, version, archiveFilename, tenantCount = null }) => ({
  manifestVersion: BACKUP_MANIFEST_VERSION,
  type,
  createdAt: new Date().toISOString(),
  archiveName: archiveFilename,
  label: name || null,
  version: version || null,
  tenant: tenant ? { slug: tenant.slug, schema: tenant.schema_name } : null,
  tenantCount,
  tenants: tenantFiles,
  rowCounts,
  imageCount,
  appVersion: process.env.npm_package_version || 'unknown'
});

const readJsonSafe = async (jsonPath) => {
  try {
    const raw = await fs.promises.readFile(jsonPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const extractSchemaFromSql = (sqlContent) => {
  if (!sqlContent) return null;
  const searchPathMatch = sqlContent.match(/SET\s+search_path\s*=\s*"?([a-zA-Z0-9_]+)"?\s*,\s*public\s*;/i);
  if (searchPathMatch && isValidTenantSchema(searchPathMatch[1])) {
    return searchPathMatch[1];
  }
  const createSchemaMatch = sqlContent.match(/CREATE\s+SCHEMA\s+"?([a-zA-Z0-9_]+)"?\s*;/i);
  if (createSchemaMatch && isValidTenantSchema(createSchemaMatch[1])) {
    return createSchemaMatch[1];
  }
  return null;
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const rewriteSqlSchema = ({ sqlContent, sourceSchema, targetSchema }) => {
  if (!sqlContent || !sourceSchema || !targetSchema || sourceSchema === targetSchema) {
    return { content: sqlContent, rewritten: false };
  }
  const sourceEscaped = escapeRegExp(sourceSchema);
  const quotedSource = new RegExp(`"${sourceEscaped}"`, 'g');
  const plainSource = new RegExp(`\\b${sourceEscaped}\\b`, 'g');
  const replacedQuoted = sqlContent.replace(quotedSource, `"${targetSchema}"`);
  const replacedPlain = replacedQuoted.replace(plainSource, targetSchema);
  return { content: replacedPlain, rewritten: replacedPlain !== sqlContent };
};

const ensureRequiredTenantTables = async (schemaName) => {
  if (!isValidTenantSchema(schemaName)) throw new Error('Invalid tenant schema for validation');
  return db.withTenantSchema(schemaName, async (client) => {
    const required = ['users', 'products', 'orders', 'order_items', 'cart'];
    const missing = [];
    for (const table of required) {
      const result = await client.query(
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = $1 AND table_name = $2
        ) AS exists`,
        [schemaName, table]
      );
      if (!result.rows[0].exists) missing.push(table);
    }
    if (missing.length > 0) {
      throw new Error(`Restored schema validation failed. Missing tables: ${missing.join(', ')}`);
    }
    return true;
  });
};

const replaceImagesSafely = async (incomingImagesDir) => {
  if (!incomingImagesDir || !fs.existsSync(incomingImagesDir)) {
    return { imagesRestored: false, imageCount: await countProductImages() };
  }

  const productsParent = path.dirname(DEFAULT_IMAGE_DIR);
  await fs.promises.mkdir(productsParent, { recursive: true });

  const incomingDir = await fs.promises.mkdtemp(path.join(productsParent, 'products-incoming-'));
  const backupDir = await fs.promises.mkdtemp(path.join(productsParent, 'products-prev-'));

  try {
    const entries = await fs.promises.readdir(incomingImagesDir);
    for (const entry of entries) {
      const src = path.join(incomingImagesDir, entry);
      const dst = path.join(incomingDir, entry);
      await fs.promises.copyFile(src, dst);
    }

    let hadCurrentProducts = false;
    try {
      const st = await fs.promises.stat(DEFAULT_IMAGE_DIR);
      hadCurrentProducts = st.isDirectory();
    } catch {
      hadCurrentProducts = false;
    }

    if (hadCurrentProducts) {
      await fs.promises.rename(DEFAULT_IMAGE_DIR, backupDir);
    }

    await fs.promises.rename(incomingDir, DEFAULT_IMAGE_DIR);

    // Cleanup old images after successful swap.
    if (hadCurrentProducts) {
      await rmDir(backupDir);
    }

    const finalCount = await countProductImages();
    return { imagesRestored: true, imageCount: finalCount };
  } catch (err) {
    try {
      const incomingExists = await fs.promises.stat(incomingDir).then(() => true).catch(() => false);
      const backupExists = await fs.promises.stat(backupDir).then(() => true).catch(() => false);
      const currentExists = await fs.promises.stat(DEFAULT_IMAGE_DIR).then(() => true).catch(() => false);
      if (!currentExists && backupExists) {
        await fs.promises.rename(backupDir, DEFAULT_IMAGE_DIR);
      }
      if (incomingExists) {
        await rmDir(incomingDir);
      }
    } catch (_) {
      // no-op
    }
    throw err;
  }
};

const stageArchiveForRestore = async ({ backupFilename, storageAdapter, requireDatabaseSql = true }) => {
  const backupPath = await storageAdapter.getArchivePath(backupFilename);
  const tempDir = await makeTempDir();

  try {
    let sqlPath = backupPath;
    let imagesDir = null;
    let manifest = null;

    if (backupFilename.endsWith('.tar.gz') || backupFilename.endsWith('.tar')) {
      const extractArgs = backupFilename.endsWith('.tar.gz')
        ? ['-xzf', backupPath, '-C', tempDir]
        : ['-xf', backupPath, '-C', tempDir];
      await tarExec(extractArgs, { timeout: 300000 });
      sqlPath = path.join(tempDir, 'database.sql');
      imagesDir = path.join(tempDir, 'products');
      manifest = await readJsonSafe(path.join(tempDir, 'manifest.json'));
      if (requireDatabaseSql && !fs.existsSync(sqlPath)) {
        throw new Error('The archive does not contain database.sql');
      }
    }

    return { backupPath, tempDir, sqlPath, imagesDir, manifest };
  } catch (err) {
    await rmDir(tempDir);
    await storageAdapter.cleanupDownloadedArchive(backupPath);
    throw err;
  }
};

const createTenantBackup = async ({ tenant, name, version, includeImages = true, dbUrl = process.env.DATABASE_URL, storageAdapter = storage }) => {
  if (!tenant || !isValidTenantSchema(tenant.schema_name)) {
    throw new Error('Tenant context is required for tenant backup');
  }

  const parsed = parseDbUrl(dbUrl);
  if (!parsed) throw new Error('Invalid DATABASE_URL');

  const storeName = (name || await getStoreName(tenant) || 'store').replace(/[^a-zA-Z0-9_-]/g, '');
  const normalizedVersion = (version || '').replace(/[^a-zA-Z0-9._-]/g, '');
  const suffix = normalizedVersion ? `-${normalizedVersion}` : '';
  const archiveExtension = includeImages ? '.tar.gz' : '.sql';
  const archiveFilename = `${storeName}${suffix}-${formatDateOnly()}${archiveExtension}`;

  const stageDir = await makeTempDir();
  try {
    const sqlPath = includeImages
      ? path.join(stageDir, 'database.sql')
      : path.join(stageDir, archiveFilename);
    await runExec('pg_dump', [
      '-h', parsed.host,
      '-p', parsed.port,
      '-U', parsed.user,
      '--schema', tenant.schema_name,
      '--no-owner',
      '--no-privileges',
      '-f', sqlPath,
      parsed.dbname
    ], parsed);

    const sqlStat = await fs.promises.stat(sqlPath).catch(() => null);
    if (!sqlStat || sqlStat.size === 0) {
      throw new Error('pg_dump produced an empty SQL file');
    }

    let archiveTempPath = sqlPath;
    let manifest = null;
    if (includeImages) {
      const imageCount = await countProductImages();
      manifest = await buildManifest({
        type: 'tenant',
        tenant,
        rowCounts: await getTableStats(tenant.schema_name),
        imageCount,
        name,
        version,
        archiveFilename
      });

      await fs.promises.writeFile(path.join(stageDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

      const tarEntries = ['manifest.json', 'database.sql'];
      if (imageCount > 0) {
        const linkPath = path.join(stageDir, 'products');
        await fs.promises.symlink(DEFAULT_IMAGE_DIR, linkPath, 'dir');
        tarEntries.push('products');
      }

      archiveTempPath = path.join(stageDir, archiveFilename);
      await tarExec(['-chzf', archiveTempPath, '-C', stageDir, ...tarEntries], { timeout: 300000 });
    }

    const stats = await fs.promises.stat(archiveTempPath);

    return {
      success: true,
      filename: archiveFilename,
      size: stats.size,
      date: stats.mtime,
      manifest,
      archivePath: archiveTempPath,
      stageDir
    };
  } catch (err) {
    await rmDir(stageDir);
    throw err;
  } finally {
    // Caller is responsible for cleanup in transient mode.
  }
};

const cleanupTenantBackupArtifact = async ({ archivePath, stageDir }) => {
  if (archivePath) await rmFile(archivePath);
  if (stageDir) await rmDir(stageDir);
};

const dropSchemaIfExists = async ({ parsed, dbName, schemaName }) => {
  if (!schemaName || !isValidTenantSchema(schemaName)) return;
  try {
    await runExec('psql', [
      '-h', parsed.host,
      '-p', parsed.port,
      '-U', parsed.user,
      '-d', dbName,
      '-c', `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`
    ], parsed);
  } catch (_) {
    // best effort cleanup
  }
};

const createBusinessWideBackup = async ({ name, version, includePublicSchema = true, dbUrl = process.env.DATABASE_URL, storageAdapter = storage }) => {
  const parsed = parseDbUrl(dbUrl);
  if (!parsed) throw new Error('Invalid DATABASE_URL');
  if (!db.pool) throw new Error('Database pool not available');

  const tenants = await db.pool.query('SELECT slug, schema_name FROM public.tenants ORDER BY id ASC');
  const tenantRows = tenants.rows || [];
  const archiveFilename = `saas-business-backup${version ? `-${version.replace(/[^a-zA-Z0-9._-]/g, '')}` : ''}-${formatTimestamp()}.tar.gz`;
  const stageDir = await makeTempDir();

  try {
    const manifest = {
      manifestVersion: BACKUP_MANIFEST_VERSION,
      type: 'business',
      createdAt: new Date().toISOString(),
      archiveName: archiveFilename,
      label: name || null,
      version: version || null,
      tenantCount: tenantRows.length,
      tenants: [],
      imageCount: 0,
      appVersion: process.env.npm_package_version || 'unknown'
    };

    const tarEntries = ['manifest.json'];

    if (includePublicSchema) {
      const publicSql = path.join(stageDir, 'public.sql');
      await runExec('pg_dump', [
        '-h', parsed.host,
        '-p', parsed.port,
        '-U', parsed.user,
        '--schema', 'public',
        '--no-owner',
        '--no-privileges',
        '-f', publicSql,
        parsed.dbname
      ], parsed);
      tarEntries.push('public.sql');
      manifest.public = { filename: 'public.sql' };
    }

    for (const tenant of tenantRows) {
      if (!isValidTenantSchema(tenant.schema_name)) continue;
      const tenantFilename = `tenant-${tenant.slug}.sql`;
      const tenantSql = path.join(stageDir, tenantFilename);
      await runExec('pg_dump', [
        '-h', parsed.host,
        '-p', parsed.port,
        '-U', parsed.user,
        '--schema', tenant.schema_name,
        '--no-owner',
        '--no-privileges',
        '-f', tenantSql,
        parsed.dbname
      ], parsed);
      tarEntries.push(tenantFilename);
      manifest.tenants.push({ slug: tenant.slug, schema: tenant.schema_name, filename: tenantFilename });
    }

    const imageCount = await countProductImages();
    if (imageCount > 0) {
      const linkPath = path.join(stageDir, 'products');
      await fs.promises.symlink(DEFAULT_IMAGE_DIR, linkPath, 'dir');
      tarEntries.push('products');
      manifest.imageCount = imageCount;
    }

    await fs.promises.writeFile(path.join(stageDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

    const archiveTempPath = path.join(stageDir, archiveFilename);
    await tarExec(['-chzf', archiveTempPath, '-C', stageDir, ...tarEntries], { timeout: 600000 });

    const { path: finalPath } = await storageAdapter.saveArchive(archiveTempPath, archiveFilename);
    const stats = await fs.promises.stat(finalPath).catch(async () => {
      const foundPath = await storageAdapter.getArchivePath(archiveFilename);
      const st = await fs.promises.stat(foundPath);
      await storageAdapter.cleanupDownloadedArchive(foundPath);
      return st;
    });

    return { success: true, filename: archiveFilename, size: stats.size, date: stats.mtime, manifest };
  } finally {
    await rmDir(stageDir);
  }
};

const validateTenantRestoreArchive = async ({ tenant, filename, dbUrl = process.env.DATABASE_URL, storageAdapter = storage }) => {
  if (!tenant || !isValidTenantSchema(tenant.schema_name)) {
    throw new Error('Tenant context is required for restore validation');
  }

  const safeFilename = sanitizeFilename(filename);
  if (!safeFilename) throw new Error('Invalid backup filename');
  if (!parseDbUrl(dbUrl)) throw new Error('Invalid DATABASE_URL');

  const staged = await stageArchiveForRestore({ backupFilename: safeFilename, storageAdapter });

  try {
    const sqlContent = await fs.promises.readFile(staged.sqlPath, 'utf8');
    const sourceSchema = extractSchemaFromSql(sqlContent);
    const requiredSql = sqlContent.includes('CREATE TABLE') || sqlContent.includes('ALTER TABLE');

    let tenantMatch = true;
    const warnings = [];
    if (staged.manifest?.tenant?.schema && staged.manifest.tenant.schema !== tenant.schema_name) {
      tenantMatch = false;
      warnings.push(`Manifest schema mismatch: ${staged.manifest.tenant.schema} -> ${tenant.schema_name}`);
    }
    if (sourceSchema && sourceSchema !== tenant.schema_name) {
      warnings.push(`SQL schema will be rewritten: ${sourceSchema} -> ${tenant.schema_name}`);
    }

    return {
      success: true,
      filename: safeFilename,
      type: staged.manifest?.type || 'legacy',
      hasSql: requiredSql,
      hasManifest: !!staged.manifest,
      sourceSchema,
      targetSchema: tenant.schema_name,
      tenantMatch,
      imageCount: staged.imagesDir && fs.existsSync(staged.imagesDir)
        ? (await fs.promises.readdir(staged.imagesDir)).length
        : 0,
      warnings,
      manifest: staged.manifest || null
    };
  } finally {
    await rmDir(staged.tempDir);
    await storageAdapter.cleanupDownloadedArchive(staged.backupPath);
  }
};

const restoreSqlIntoSchema = async ({ parsed, dbName, sqlPath, sourceSchema, targetSchema, timeout = 300000 }) => {
  if (!isValidTenantSchema(targetSchema)) {
    throw new Error(`Invalid target schema: ${targetSchema}`);
  }

  let restoreSqlPath = sqlPath;
  if (sourceSchema && sourceSchema !== targetSchema) {
    const sqlContent = await fs.promises.readFile(sqlPath, 'utf8');
    const rewritten = rewriteSqlSchema({ sqlContent, sourceSchema, targetSchema });
    restoreSqlPath = path.join(os.tmpdir(), `restore-${targetSchema}-${Date.now()}.sql`);
    await fs.promises.writeFile(restoreSqlPath, rewritten.content, 'utf8');
  }

  try {
    await runExec('psql', [
      '-h', parsed.host,
      '-p', parsed.port,
      '-U', parsed.user,
      '-d', dbName,
      '-c', `DROP SCHEMA IF EXISTS "${targetSchema}" CASCADE; CREATE SCHEMA "${targetSchema}";`
    ], parsed);

    await runExec('psql', [
      '-h', parsed.host,
      '-p', parsed.port,
      '-U', parsed.user,
      '-d', dbName,
      '-f', restoreSqlPath
    ], parsed, { timeout });
  } finally {
    if (restoreSqlPath !== sqlPath) {
      await rmFile(restoreSqlPath);
    }
  }
};

const swapSchemasAtomically = async ({ parsed, dbName, liveSchema, restoredSchema, previousSchema }) => {
  const swapSql = [
    'BEGIN;',
    `DROP SCHEMA IF EXISTS "${previousSchema}" CASCADE;`,
    `ALTER SCHEMA "${liveSchema}" RENAME TO "${previousSchema}";`,
    `ALTER SCHEMA "${restoredSchema}" RENAME TO "${liveSchema}";`,
    'COMMIT;'
  ].join(' ');

  await runExec('psql', [
    '-h', parsed.host,
    '-p', parsed.port,
    '-U', parsed.user,
    '-d', dbName,
    '-c', swapSql
  ], parsed);
};

const restoreTenantBackup = async ({ tenant, filename, confirmText, dbUrl = process.env.DATABASE_URL, storageAdapter = storage }) => {
  if (confirmText !== 'RESTAURAR') {
    throw new Error('Restore confirmation text must be RESTAURAR');
  }
  if (!tenant || !isValidTenantSchema(tenant.schema_name)) {
    throw new Error('Tenant context is required for restore');
  }

  const parsed = parseDbUrl(dbUrl);
  if (!parsed) throw new Error('Invalid DATABASE_URL');

  const safeFilename = sanitizeFilename(filename);
  if (!safeFilename) throw new Error('Invalid backup filename');

  const startedAt = Date.now();
  let lastMarkAt = startedAt;
  const mark = (step) => {
    const now = Date.now();
    const delta = now - lastMarkAt;
    const total = now - startedAt;
    lastMarkAt = now;
    console.log(`[restore][${safeFilename}] ${step}: +${delta}ms (total ${total}ms)`);
  };

  const staged = await stageArchiveForRestore({ backupFilename: safeFilename, storageAdapter });
  mark('stage archive');

  const liveSchema = tenant.schema_name;
  const suffix = makeSchemaSuffix();
  const restoreSchema = truncatePgIdentifier(`${liveSchema}_restore_${suffix}`);
  const previousSchema = truncatePgIdentifier(`${liveSchema}_prev_${suffix}`);
  const safetyName = `pre-restore-${liveSchema}-${formatTimestamp()}.sql`;
  const safetyPath = path.join(DEFAULT_BACKUPS_DIR, safetyName);
  const createSafetyBackup = String(process.env.RESTORE_CREATE_SAFETY_BACKUP || 'false').toLowerCase() === 'true';

  try {
    const sqlContent = await fs.promises.readFile(staged.sqlPath, 'utf8');
    const sourceSchema = extractSchemaFromSql(sqlContent);
    mark('read sql and detect schema');

    // Manifest schema is informational for tenant restores. The SQL is always
    // restored into the active tenant schema via schema rewrite when needed.

    if (createSafetyBackup) {
      try {
        await runExec('pg_dump', [
          '-h', parsed.host,
          '-p', parsed.port,
          '-U', parsed.user,
          '--schema', liveSchema,
          '--no-owner',
          '--no-privileges',
          '-f', safetyPath,
          parsed.dbname
        ], parsed);
        mark('create safety backup');
      } catch (_) {
        // best effort safety backup
      }
    }

    await restoreSqlIntoSchema({
      parsed,
      dbName: parsed.dbname,
      sqlPath: staged.sqlPath,
      sourceSchema,
      targetSchema: restoreSchema,
      timeout: 300000
    });
    mark('restore sql into temp schema');

    await ensureRequiredTenantTables(restoreSchema);
    mark('validate required tables');
    await swapSchemasAtomically({
      parsed,
      dbName: parsed.dbname,
      liveSchema,
      restoredSchema: restoreSchema,
      previousSchema
    });
    mark('swap schemas atomically');

    const imageResult = await replaceImagesSafely(staged.imagesDir);
    mark('replace images');

    db.reinitializeDb(process.env.DATABASE_URL);
    mark('reinitialize db pool');

    const tableStats = await getTableStats(liveSchema);
    mark('collect table stats');
    enqueueSchemaDropCleanup({ parsed, dbName: parsed.dbname, schemaName: previousSchema });
    mark('queue previous schema drop');
    if (createSafetyBackup) {
      await rmFile(safetyPath);
      mark('cleanup safety backup');
    }

    mark('restore completed');

    return {
      success: true,
      filename: safeFilename,
      safetyBackup: null,
      previousSchema,
      imagesRestored: imageResult.imagesRestored,
      imageCount: imageResult.imageCount,
      tableStats
    };
  } catch (err) {
    const total = Date.now() - startedAt;
    console.error(`[restore][${safeFilename}] failed after ${total}ms: ${err.message}`);
    throw err;
  } finally {
    await rmDir(staged.tempDir);
    await storageAdapter.cleanupDownloadedArchive(staged.backupPath);
  }
};

const restoreBusinessWideBackup = async ({ filename, confirmText, restorePublicSchema = false, dbUrl = process.env.DATABASE_URL, storageAdapter = storage }) => {
  if (confirmText !== 'RESTAURAR') {
    throw new Error('Restore confirmation text must be RESTAURAR');
  }

  const safeFilename = sanitizeFilename(filename);
  if (!safeFilename || !safeFilename.endsWith('.tar.gz')) {
    throw new Error('Business restore requires a .tar.gz backup archive');
  }

  const parsed = parseDbUrl(dbUrl);
  if (!parsed) throw new Error('Invalid DATABASE_URL');

  const staged = await stageArchiveForRestore({ backupFilename: safeFilename, storageAdapter, requireDatabaseSql: false });
  try {
    if (!staged.manifest || staged.manifest.type !== 'business') {
      throw new Error('Archive manifest is not a business-wide backup');
    }

    const results = [];
    for (const tenantEntry of staged.manifest.tenants || []) {
      const targetSchema = tenantEntry.schema;
      if (!isValidTenantSchema(targetSchema)) continue;

      const sqlFile = path.join(staged.tempDir, tenantEntry.filename || `tenant-${tenantEntry.slug}.sql`);
      if (!fs.existsSync(sqlFile)) {
        throw new Error(`Missing tenant SQL file in archive: ${tenantEntry.filename}`);
      }

      const suffix = makeSchemaSuffix();
      const restoreSchema = truncatePgIdentifier(`${targetSchema}_restore_${suffix}`);
      const previousSchema = truncatePgIdentifier(`${targetSchema}_prev_${suffix}`);
      const sqlContent = await fs.promises.readFile(sqlFile, 'utf8');
      const sourceSchema = extractSchemaFromSql(sqlContent) || targetSchema;

      await restoreSqlIntoSchema({
        parsed,
        dbName: parsed.dbname,
        sqlPath: sqlFile,
        sourceSchema,
        targetSchema: restoreSchema,
        timeout: 600000
      });

      await ensureRequiredTenantTables(restoreSchema);

      // Check if the live schema still exists (may have been deleted after backup)
      const schemaCheck = await runExec('psql', [
        '-h', parsed.host,
        '-p', parsed.port,
        '-U', parsed.user,
        '-d', parsed.dbname,
        '-c', `SELECT 1 FROM information_schema.schemata WHERE schema_name = '${targetSchema}'`
      ], parsed);

      if (schemaCheck.stdout.includes('(1 row)')) {
        // Live schema exists — perform atomic swap
        await swapSchemasAtomically({
          parsed,
          dbName: parsed.dbname,
          liveSchema: targetSchema,
          restoredSchema: restoreSchema,
          previousSchema
        });
      } else {
        // Live schema was deleted — just rename restored schema into place
        await runExec('psql', [
          '-h', parsed.host,
          '-p', parsed.port,
          '-U', parsed.user,
          '-d', parsed.dbname,
          '-c', `ALTER SCHEMA "${restoreSchema}" RENAME TO "${targetSchema}";`
        ], parsed);
        // Re-register the tenant in public.tenants since it was deleted
        try {
          await db.pool.query(
            `INSERT INTO public.tenants (slug, name, owner_email, status, plan_id, schema_name, trial_ends_at)
             VALUES ($1, $2, $3, 'active', 'trial', $4, NOW() + INTERVAL '14 days')
             ON CONFLICT (slug) DO UPDATE SET status = 'active', schema_name = $4`,
            [tenantEntry.slug, tenantEntry.slug, `restored@${tenantEntry.slug}.local`, targetSchema]
          );
        } catch (reRegisterErr) {
          console.warn(`[restore] Could not re-register tenant ${tenantEntry.slug}:`, reRegisterErr.message);
        }
      }

      results.push({ slug: tenantEntry.slug, schema: targetSchema, previousSchema });
    }

    if (restorePublicSchema) {
      const publicSql = path.join(staged.tempDir, 'public.sql');
      if (fs.existsSync(publicSql)) {
        await runExec('psql', [
          '-h', parsed.host,
          '-p', parsed.port,
          '-U', parsed.user,
          '-d', parsed.dbname,
          '-f', publicSql
        ], parsed, { timeout: 600000 });
      }
    }

    const imageResult = await replaceImagesSafely(staged.imagesDir);
    db.reinitializeDb(process.env.DATABASE_URL);

    return {
      success: true,
      filename: safeFilename,
      restoredTenants: results,
      restoredTenantCount: results.length,
      imagesRestored: imageResult.imagesRestored,
      imageCount: imageResult.imageCount
    };
  } finally {
    await rmDir(staged.tempDir);
    await storageAdapter.cleanupDownloadedArchive(staged.backupPath);
  }
};

const listBackups = async ({ storageAdapter = storage } = {}) => {
  const backups = await storageAdapter.listArchives();
  const enriched = [];

  for (const backup of backups) {
    const result = { ...backup, hasSql: true, imageCount: 0, hasManifest: false };
    if (backup.isArchive) {
      let localPath = null;
      try {
        localPath = await storageAdapter.getArchivePath(backup.filename);
        const info = await inspectArchive(localPath);
        result.hasSql = info.hasSql;
        result.imageCount = info.imageCount;
        result.hasManifest = info.hasManifest;
      } catch {
        result.hasSql = false;
      } finally {
        if (localPath) await storageAdapter.cleanupDownloadedArchive(localPath);
      }
    }
    enriched.push(result);
  }

  return enriched;
};

const getBackupManifest = async ({ filename, storageAdapter = storage }) => {
  const safeFilename = sanitizeFilename(filename);
  if (!safeFilename) throw new Error('Invalid backup filename');

  const archivePath = await storageAdapter.getArchivePath(safeFilename);
  try {
    if (!safeFilename.endsWith('.tar.gz')) {
      return null;
    }

    const tempDir = await makeTempDir();
    try {
      await tarExec(['-xzf', archivePath, '-C', tempDir, 'manifest.json'], { timeout: 300000 });
      const manifestPath = path.join(tempDir, 'manifest.json');
      return await readJsonSafe(manifestPath);
    } finally {
      await rmDir(tempDir);
    }
  } finally {
    await storageAdapter.cleanupDownloadedArchive(archivePath);
  }
};

const deleteBackup = async ({ filename, storageAdapter = storage }) => {
  const safeFilename = sanitizeFilename(filename);
  if (!safeFilename) throw new Error('Invalid backup filename');
  await storageAdapter.deleteArchive(safeFilename);
  return { success: true, filename: safeFilename };
};

const uploadBackup = async ({ tempPath, filename, storageAdapter = storage }) => {
  const safeFilename = sanitizeFilename(filename);
  if (!safeFilename) throw new Error('Invalid backup filename');
  const { filename: savedFilename } = await storageAdapter.uploadArchive(tempPath, safeFilename);
  return { success: true, filename: savedFilename };
};

module.exports = {
  createTenantBackup,
  restoreTenantBackup,
  createBusinessWideBackup,
  restoreBusinessWideBackup,
  validateTenantRestoreArchive,
  listBackups,
  getBackupManifest,
  deleteBackup,
  uploadBackup,
  cleanupTenantBackupArtifact,
  sanitizeFilename,
  getTableStats,
  countProductImages,
  extractSchemaFromSql,
  rewriteSqlSchema,
  storage
};
