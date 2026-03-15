// database/postgres.js — Native PostgreSQL adapter (pg Pool + filesystem storage)
// Same interface as supabase.js so the rest of the app is provider-agnostic.
require('dotenv').config();
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local'), override: true });

const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// --- Connection pool (nullable — app runs in "setup mode" without credentials) ---
let pool = null;
let dbConfigured = false;

// Base uploads directory for filesystem storage (images, etc.)
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');

/**
 * Detect if the PostgreSQL server supports SSL.
 * Returns the appropriate ssl config for the Pool.
 */
const detectSslConfig = async (connectionString) => {
  const { Client } = require('pg');
  // Try with SSL first
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    await client.end().catch(() => {});
    return { rejectUnauthorized: false }; // SSL works
  } catch (err) {
    await client.end().catch(() => {});
    if (err.message && err.message.includes('does not support SSL')) {
      return false; // No SSL
    }
    // Other error — default to no SSL to avoid blocking startup
    return false;
  }
};

const initPool = (connectionString) => {
  if (!connectionString) return false;
  try {
    // Start pool without SSL by default; async detection upgrades if available
    pool = new Pool({ connectionString, max: 20, ssl: false });
    pool.on('error', (err) => console.error('PG Pool error:', err.message));
    dbConfigured = true;

    // Async: detect SSL support and recreate pool if needed
    detectSslConfig(connectionString).then(sslConfig => {
      if (sslConfig !== false) {
        const oldPool = pool;
        pool = new Pool({ connectionString, max: 20, ssl: sslConfig });
        pool.on('error', (err) => console.error('PG Pool error:', err.message));
        oldPool.end().catch(() => {});
        console.log('🔒 PostgreSQL SSL enabled');
      } else {
        console.log('🔓 PostgreSQL SSL not available — using plain connection');
      }
    }).catch(() => {
      // Detection failed — keep the non-SSL pool
    });

    return true;
  } catch (err) {
    console.error('❌ Error initializing PostgreSQL pool:', err.message);
    return false;
  }
};

// Boot: try env vars
if (!initPool(process.env.DATABASE_URL)) {
  console.warn('⚠️  DATABASE_URL not configured.');
  console.warn('   App starts in setup mode (no data).');
  console.warn('   Set DATABASE_URL in .env or configure via Setup Wizard.');
}

// -- Shared helpers -------------------------------------------------------

const VALID_PRODUCT_UNIT_TYPES = ['unidad', 'paquete', 'caja', 'docena', 'lb', 'kg', 'g', 'l', 'ml', 'm'];

const normalizeProductUnitType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return VALID_PRODUCT_UNIT_TYPES.includes(normalized) ? normalized : 'unidad';
};

let productUnitTypeColumnSupported = null;
let productIsHiddenColumnSupported = null;

// Check if legacy deployments have the unit_type column
const ensureProductUnitTypeColumnSupport = async () => {
  if (productUnitTypeColumnSupported !== null) return productUnitTypeColumnSupported;
  if (!pool) { productUnitTypeColumnSupported = false; return false; }
  try {
    await pool.query('SELECT unit_type FROM products LIMIT 1');
    productUnitTypeColumnSupported = true;
  } catch {
    productUnitTypeColumnSupported = false;
  }
  return productUnitTypeColumnSupported;
};

// Check if legacy deployments have the is_hidden column
const ensureProductIsHiddenColumnSupport = async () => {
  if (productIsHiddenColumnSupported !== null) return productIsHiddenColumnSupported;
  if (!pool) { productIsHiddenColumnSupported = false; return false; }
  try {
    await pool.query('SELECT is_hidden FROM products LIMIT 1');
    productIsHiddenColumnSupported = true;
  } catch {
    productIsHiddenColumnSupported = false;
  }
  return productIsHiddenColumnSupported;
};

// Ensure a directory exists (recursive), used for uploads
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

// Safely delete a file from the uploads directory
const deleteUploadedFile = (imagePath) => {
  if (!imagePath) return;
  const relativePath = imagePath.replace(/^\/storage\//, '');
  const filePath = path.join(UPLOADS_DIR, relativePath);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
};

// ---------------------------------------------------------------------------
// statements — all CRUD operations via raw parameterized SQL
// ---------------------------------------------------------------------------
const statements = {

  // ── Storage (filesystem) ─────────────────────────────────
  uploadImage: async (file) => {
    // Strip all metadata (EXIF, GPS, ICC profiles, etc.) for privacy/security
    const sharp = require('sharp');
    const cleanBuffer = await sharp(file.buffer)
      .rotate() // Auto-rotate based on EXIF orientation before stripping
      .withMetadata(false) // Remove all metadata
      .toBuffer();

    ensureDir(path.join(UPLOADS_DIR, 'products'));
    // Sanitize filename: lowercase, remove accents, replace non-alphanum
    const originalName = file.originalname.split('.').slice(0, -1).join('.');
    const fileExt = file.originalname.split('.').pop();
    const sanitizedName = originalName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const fileName = `${sanitizedName}-${Date.now()}.${fileExt}`;
    const filePath = path.join(UPLOADS_DIR, 'products', fileName);
    // Write clean buffer to filesystem
    fs.writeFileSync(filePath, cleanBuffer);
    // Return path the /storage/* route will serve
    return `/storage/products/${fileName}`;
  },

  // ── Users ────────────────────────────────────────────────
  getUserById: async (id) => {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, phone, street, sector, city, country,
              is_active, is_guest, created_at, updated_at, last_login
       FROM users WHERE id = $1`, [id]
    );
    return rows[0] || null;
  },
  getUserByEmail: async (email) => {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0] || null;
  },
  createUser: async (name, email, password, role, is_guest) => {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password, role, is_guest)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, email, password, role, !!is_guest]
    );
    return { lastInsertRowid: rows[0].id };
  },
  updateUser: async (name, phone, street, sector, city, country, id) => {
    const { rows } = await pool.query(
      `UPDATE users SET name=$1, phone=$2, street=$3, sector=$4,
       city=$5, country=$6, updated_at=NOW() WHERE id=$7 RETURNING *`,
      [name, phone, street, sector, city, country, id]
    );
    return rows[0] || null;
  },
  updateUserPassword: async (password, id) => {
    const { rows } = await pool.query(
      'UPDATE users SET password=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [password, id]
    );
    return rows[0] || null;
  },
  updateLastLogin: async (id) => {
    await pool.query('UPDATE users SET last_login=NOW() WHERE id=$1', [id]);
    return null;
  },

  // ── Products ─────────────────────────────────────────────
  getAllProducts: async () => {
    const { rows } = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
    return rows;
  },
  getProductsPaginated: async (page = 1, limit = 20, search = '', category = '', sort = '') => {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (search) {
      // Sanitize search input: remove wildcards, limit length
      const safe = search.replace(/%/g, '').replace(/_/g, '\\_').trim().slice(0, 50);
      if (safe) {
        conditions.push(`(name ILIKE $${idx} OR description ILIKE $${idx})`);
        params.push(`%${safe}%`);
        idx++;
      }
    }
    if (category && category !== 'all') {
      conditions.push(`category = $${idx}`);
      params.push(category);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Resolve ORDER BY clause from sort param (whitelist to prevent injection)
    const SORT_MAP = {
      newest: 'created_at DESC',
      oldest: 'created_at ASC',
      price_asc: 'price ASC',
      price_desc: 'price DESC',
      name_asc: 'name ASC',
      name_desc: 'name DESC',
    };
    const orderBy = SORT_MAP[sort] || 'created_at DESC';

    // Count query
    const countRes = await pool.query(`SELECT count(*)::int FROM products ${where}`, params);
    const total = countRes.rows[0].count;

    // Data query with pagination
    const dataParams = [...params, limit, offset];
    const { rows } = await pool.query(
      `SELECT * FROM products ${where} ORDER BY ${orderBy} LIMIT $${idx} OFFSET $${idx + 1}`,
      dataParams
    );
    return { data: rows, total };
  },
  getProductById: async (id) => {
    const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    return rows[0] || null;
  },
  getProductsByCategory: async (category) => {
    const { rows } = await pool.query(
      'SELECT * FROM products WHERE category = $1 ORDER BY created_at DESC', [category]
    );
    return rows;
  },
  createProduct: async (name, description, price, category, stock, unitType = 'unidad') => {
    const supportsUnitType = await ensureProductUnitTypeColumnSupport();
    let query, params;
    if (supportsUnitType) {
      query = `INSERT INTO products (name, description, price, category, stock, unit_type)
               VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
      params = [name, description, price, category, stock, normalizeProductUnitType(unitType)];
    } else {
      query = `INSERT INTO products (name, description, price, category, stock)
               VALUES ($1, $2, $3, $4, $5) RETURNING *`;
      params = [name, description, price, category, stock];
    }
    const { rows } = await pool.query(query, params);
    return { lastInsertRowid: rows[0].id };
  },
  updateProduct: async (name, description, price, category, stock, id, unitType, isHidden) => {
    const supportsUnitType = await ensureProductUnitTypeColumnSupport();
    const supportsIsHidden = await ensureProductIsHiddenColumnSupport();
    let query, params;
    if (supportsUnitType && supportsIsHidden && unitType !== undefined) {
      query = `UPDATE products SET name=$1, description=$2, price=$3, category=$4,
               stock=$5, unit_type=$6, is_hidden=$7, updated_at=NOW() WHERE id=$8 RETURNING *`;
      params = [name, description, price, category, stock, normalizeProductUnitType(unitType), !!isHidden, id];
    } else if (supportsUnitType && unitType !== undefined) {
      query = `UPDATE products SET name=$1, description=$2, price=$3, category=$4,
               stock=$5, unit_type=$6, updated_at=NOW() WHERE id=$7 RETURNING *`;
      params = [name, description, price, category, stock, normalizeProductUnitType(unitType), id];
    } else if (supportsIsHidden && isHidden !== undefined) {
      query = `UPDATE products SET name=$1, description=$2, price=$3, category=$4,
               stock=$5, is_hidden=$6, updated_at=NOW() WHERE id=$7 RETURNING *`;
      params = [name, description, price, category, stock, !!isHidden, id];
    } else {
      query = `UPDATE products SET name=$1, description=$2, price=$3, category=$4,
               stock=$5, updated_at=NOW() WHERE id=$6 RETURNING *`;
      params = [name, description, price, category, stock, id];
    }
    const { rows } = await pool.query(query, params);
    return rows[0] || null;
  },
  deleteProduct: async (id) => {
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    return true;
  },

  // ── Stock (atomic via RPC functions) ─────────────────────
  decrementStockIfAvailable: async (product_id, quantity) => {
    const { rows } = await pool.query(
      'SELECT decrement_stock_if_available($1, $2) AS result', [product_id, quantity]
    );
    return !!rows[0]?.result;
  },
  incrementStock: async (product_id, quantity) => {
    const { rows } = await pool.query(
      'SELECT increment_stock($1, $2) AS result', [product_id, quantity]
    );
    return !!rows[0]?.result;
  },

  // ── Product Images ───────────────────────────────────────
  getProductImages: async (product_id) => {
    const { rows } = await pool.query(
      'SELECT * FROM product_images WHERE product_id = $1 ORDER BY created_at ASC', [product_id]
    );
    return rows;
  },
  addProductImage: async (product_id, image_path) => {
    const { rows } = await pool.query(
      'INSERT INTO product_images (product_id, image_path) VALUES ($1, $2) RETURNING *',
      [product_id, image_path]
    );
    return rows;
  },
  deleteProductImage: async (id, product_id) => {
    // Fetch image path to delete from filesystem
    const { rows } = await pool.query(
      'SELECT image_path FROM product_images WHERE id = $1 AND product_id = $2',
      [id, product_id]
    );
    if (rows[0]?.image_path) deleteUploadedFile(rows[0].image_path);

    // Delete DB row
    await pool.query(
      'DELETE FROM product_images WHERE id = $1 AND product_id = $2', [id, product_id]
    );
    return true;
  },
  deleteAllProductImages: async (product_id) => {
    // Fetch all image paths for batch filesystem deletion
    const { rows } = await pool.query(
      'SELECT image_path FROM product_images WHERE product_id = $1', [product_id]
    );
    rows.forEach((img) => deleteUploadedFile(img.image_path));

    await pool.query('DELETE FROM product_images WHERE product_id = $1', [product_id]);
    return true;
  },

  // ── Product Variants ─────────────────────────────────────
  // Get all variants for a product — includes attributes array
  getVariantsByProduct: async (product_id) => {
    const { rows: variants } = await pool.query(
      'SELECT * FROM product_variants WHERE product_id = $1 ORDER BY created_at ASC', [product_id]
    );
    if (variants.length === 0) return [];

    const variantIds = variants.map(v => v.id);
    const { rows: attrs } = await pool.query(
      'SELECT * FROM product_variant_attributes WHERE variant_id = ANY($1)', [variantIds]
    );

    const attrsMap = attrs.reduce((acc, a) => {
      if (!acc[a.variant_id]) acc[a.variant_id] = [];
      acc[a.variant_id].push({ type: a.attribute_type, value: a.attribute_value, color_hex: a.color_hex || null });
      return acc;
    }, {});

    return variants.map(v => ({ ...v, price_override: v.price, attributes: attrsMap[v.id] || [] }));
  },

  getVariantById: async (variant_id) => {
    const { rows } = await pool.query('SELECT * FROM product_variants WHERE id = $1', [variant_id]);
    if (rows.length === 0) return null;
    const variant = rows[0];
    const { rows: attrs } = await pool.query(
      'SELECT * FROM product_variant_attributes WHERE variant_id = $1', [variant_id]
    );
    return { ...variant, price_override: variant.price, attributes: attrs.map(a => ({ type: a.attribute_type, value: a.attribute_value, color_hex: a.color_hex || null })) };
  },

  createVariant: async (product_id, { sku, price, stock, image_url, is_active = true, attributes = [] }) => {
    const { rows } = await pool.query(
      `INSERT INTO product_variants (product_id, sku, price, stock, image_url, is_active)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [product_id, sku || null, price ?? null, stock || 0, image_url || null, is_active]
    );
    const variant = rows[0];

    for (const a of attributes) {
      await pool.query(
        'INSERT INTO product_variant_attributes (variant_id, attribute_type, attribute_value, color_hex) VALUES ($1, $2, $3, $4)',
        [variant.id, a.type, a.value, a.color_hex || null]
      );
    }

    // Mark parent as has_variants = true
    await pool.query('UPDATE products SET has_variants = TRUE, updated_at = NOW() WHERE id = $1', [product_id]);
    return { ...variant, attributes };
  },

  updateVariant: async (variant_id, { sku, price, stock, image_url, is_active, attributes }) => {
    const sets = ['updated_at = NOW()'];
    const vals = [];
    let idx = 1;
    if (sku !== undefined)       { sets.push(`sku = $${idx}`);       vals.push(sku);       idx++; }
    if (price !== undefined)     { sets.push(`price = $${idx}`);     vals.push(price);     idx++; }
    if (stock !== undefined)     { sets.push(`stock = $${idx}`);     vals.push(stock);     idx++; }
    if (image_url !== undefined) { sets.push(`image_url = $${idx}`); vals.push(image_url); idx++; }
    if (is_active !== undefined) { sets.push(`is_active = $${idx}`); vals.push(is_active); idx++; }
    vals.push(variant_id);

    const { rows } = await pool.query(
      `UPDATE product_variants SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, vals
    );
    const variant = rows[0];

    if (attributes && Array.isArray(attributes)) {
      await pool.query('DELETE FROM product_variant_attributes WHERE variant_id = $1', [variant_id]);
      for (const a of attributes) {
        await pool.query(
          'INSERT INTO product_variant_attributes (variant_id, attribute_type, attribute_value, color_hex) VALUES ($1, $2, $3, $4)',
          [variant_id, a.type, a.value, a.color_hex || null]
        );
      }
    }
    return { ...variant, attributes: attributes || [] };
  },

  deleteVariant: async (variant_id) => {
    const { rows } = await pool.query('SELECT product_id FROM product_variants WHERE id = $1', [variant_id]);
    const productId = rows[0]?.product_id;

    await pool.query('DELETE FROM product_variants WHERE id = $1', [variant_id]);

    if (productId) {
      const { rows: remaining } = await pool.query(
        'SELECT id FROM product_variants WHERE product_id = $1 LIMIT 1', [productId]
      );
      if (remaining.length === 0) {
        await pool.query('UPDATE products SET has_variants = FALSE, updated_at = NOW() WHERE id = $1', [productId]);
      }
    }
    return true;
  },

  getAttributeTypes: async () => {
    const { rows } = await pool.query('SELECT * FROM product_attribute_types ORDER BY name ASC');
    return rows;
  },

  // ── Variant Stock (atomic via RPC) ───────────────────────
  decrementVariantStock: async (variant_id, quantity) => {
    const result = await pool.query('SELECT decrement_variant_stock($1, $2) AS ok', [variant_id, quantity]);
    return result.rows[0]?.ok || false;
  },
  incrementVariantStock: async (variant_id, quantity) => {
    const result = await pool.query('SELECT increment_variant_stock($1, $2) AS ok', [variant_id, quantity]);
    return result.rows[0]?.ok || false;
  },

  // ── Cart ─────────────────────────────────────────────────
  getCartByUserId: async (user_id) => {
    const supportsUnitType = await ensureProductUnitTypeColumnSupport();
    const unitCol = supportsUnitType ? ', p.unit_type' : '';

    const { rows } = await pool.query(`
      SELECT c.id, c.product_id, c.variant_id, c.quantity,
             p.name, p.price, p.stock${unitCol}, p.image, p.has_variants,
             (SELECT pi.image_path FROM product_images pi
              WHERE pi.product_id = c.product_id
              ORDER BY pi.created_at ASC LIMIT 1) AS gallery_image,
             pv.sku AS variant_sku, pv.price AS variant_price,
             pv.stock AS variant_stock, pv.image_url AS variant_image, pv.is_active AS variant_active
      FROM cart c
      JOIN products p ON p.id = c.product_id
      LEFT JOIN product_variants pv ON pv.id = c.variant_id
      WHERE c.user_id = $1
      ORDER BY c.created_at DESC
    `, [user_id]);

    // Fetch variant attributes for items with variant_id
    const variantIds = rows.filter(r => r.variant_id).map(r => r.variant_id);
    let variantAttrs = {};
    if (variantIds.length > 0) {
      const { rows: attrs } = await pool.query(
        `SELECT variant_id, attribute_type AS type, attribute_value AS value
         FROM product_variant_attributes WHERE variant_id = ANY($1)`,
        [variantIds]
      );
      for (const a of attrs) {
        if (!variantAttrs[a.variant_id]) variantAttrs[a.variant_id] = [];
        variantAttrs[a.variant_id].push({ type: a.type, value: a.value });
      }
    }

    return rows.map((r) => ({
      id: r.id,
      product_id: r.product_id,
      variant_id: r.variant_id || null,
      quantity: r.quantity,
      name: r.name,
      // Price: variant override > product price
      price: (r.variant_price != null) ? r.variant_price : r.price,
      // Stock: variant stock when applicable
      stock: r.variant_id ? r.variant_stock : r.stock,
      unit_type: normalizeProductUnitType(r.unit_type),
      // Image priority: variant > gallery > legacy
      image: r.variant_image || r.gallery_image || r.image,
      variant_attributes: variantAttrs[r.variant_id] || null
    }));
  },
  // variant_id is optional — null for non-variant products
  addToCart: async (user_id, product_id, quantity, variant_id = null) => {
    await pool.query(
      `INSERT INTO cart (user_id, product_id, quantity, variant_id, updated_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [user_id, product_id, quantity, variant_id]
    );
    return null;
  },
  updateCartItem: async (quantity, user_id, product_id, variant_id = null) => {
    await pool.query(
      `UPDATE cart SET quantity=$1, updated_at=NOW()
       WHERE user_id=$2 AND product_id=$3
       AND variant_id IS NOT DISTINCT FROM $4`,
      [quantity, user_id, product_id, variant_id]
    );
    return null;
  },
  removeFromCart: async (user_id, product_id, variant_id = null) => {
    await pool.query(
      `DELETE FROM cart WHERE user_id=$1 AND product_id=$2
       AND variant_id IS NOT DISTINCT FROM $3`,
      [user_id, product_id, variant_id]
    );
    return true;
  },
  clearCart: async (user_id) => {
    await pool.query('DELETE FROM cart WHERE user_id = $1', [user_id]);
    return true;
  },
  getCartItem: async (user_id, product_id, variant_id = null) => {
    const { rows } = await pool.query(
      `SELECT * FROM cart WHERE user_id=$1 AND product_id=$2
       AND variant_id IS NOT DISTINCT FROM $3`,
      [user_id, product_id, variant_id]
    );
    return rows[0] || null;
  },

  // ── Orders ───────────────────────────────────────────────
  createOrder: async (user_id, total, shipping_address, payment_method, customer_name, customer_email, customer_phone, shipping_street, shipping_city, shipping_postal_code, shipping_sector, shipping_cost, shipping_distance, shipping_coordinates) => {
    const { rows } = await pool.query(
      `INSERT INTO orders (user_id, total, shipping_address, payment_method,
       customer_name, customer_email, customer_phone,
       shipping_street, shipping_city, shipping_postal_code, shipping_sector,
       shipping_cost, shipping_distance, shipping_coordinates)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [user_id, total, shipping_address, payment_method,
       customer_name, customer_email, customer_phone,
       shipping_street, shipping_city, shipping_postal_code, shipping_sector,
       shipping_cost || 0, shipping_distance || null, shipping_coordinates || null]
    );
    return { lastInsertRowid: rows[0].id };
  },
  getOrdersByUserId: async (user_id) => {
    const { rows } = await pool.query(
      'SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC', [user_id]
    );
    return rows;
  },
  getOrderById: async (id) => {
    const { rows } = await pool.query('SELECT * FROM orders WHERE id=$1', [id]);
    return rows[0] || null;
  },
  updateOrderStatus: async (status, id) => {
    const { rows } = await pool.query(
      'UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *', [status, id]
    );
    return rows[0] || null;
  },
  updateOrder: async (id, updates) => {
    // Whitelist of allowed columns to prevent SQL injection via dynamic keys
    const ALLOWED = new Set([
      'status', 'total', 'shipping_address', 'payment_method', 'payment_status',
      'customer_name', 'customer_email', 'customer_phone',
      'shipping_street', 'shipping_city', 'shipping_postal_code', 'shipping_sector',
      'tracking_number', 'tracking_carrier', 'admin_notes', 'order_number',
      'shipping_cost', 'stripe_payment_intent_id', 'paypal_order_id'
    ]);
    const entries = Object.entries(updates).filter(([k]) => ALLOWED.has(k));
    if (!entries.length) return null;

    // Build parameterized SET clause
    const sets = entries.map(([k], i) => `"${k}" = $${i + 1}`);
    sets.push('updated_at = NOW()');
    const values = entries.map(([, v]) => v);
    values.push(id);

    const { rows } = await pool.query(
      `UPDATE orders SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    return rows[0] || null;
  },
  updateOrderNumber: async (order_number, id) => {
    const { rows } = await pool.query(
      'UPDATE orders SET order_number=$1 WHERE id=$2 RETURNING *', [order_number, id]
    );
    return rows[0] || null;
  },
  deleteOrder: async (id) => {
    await pool.query('DELETE FROM orders WHERE id=$1', [id]);
    return true;
  },
  getAllOrdersWithCustomer: async () => {
    const { rows } = await pool.query(`
      SELECT o.*, u.name AS user_name, u.email AS user_email
      FROM orders o LEFT JOIN users u ON u.id = o.user_id
      ORDER BY o.created_at DESC
    `);
    // Map joined user data to top-level customer fields (same shape as supabase adapter)
    return rows.map(({ user_name, user_email, ...o }) => ({
      ...o,
      customer_name: user_name || o.customer_name,
      customer_email: user_email || o.customer_email
    }));
  },
  getOrdersPaginated: async (page = 1, limit = 20, search = '', status = 'all', paymentType = 'all', type = 'all') => {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (status !== 'all') {
      conditions.push(`o.status = $${idx++}`);
      params.push(status);
    }
    if (paymentType === 'online') {
      conditions.push(`o.payment_method != $${idx++}`);
      params.push('cash');
    }
    if (paymentType === 'cod') {
      conditions.push(`o.payment_method = $${idx++}`);
      params.push('cash');
    }
    if (type === 'registered') conditions.push('o.user_id IS NOT NULL');
    if (type === 'guest') conditions.push('o.user_id IS NULL');

    if (search) {
      const searchNum = isNaN(search) ? -1 : parseInt(search, 10);
      conditions.push(`(o.order_number ILIKE $${idx} OR o.customer_name ILIKE $${idx} OR o.customer_email ILIKE $${idx} OR o.id = $${idx + 1})`);
      params.push(`%${search}%`, searchNum);
      idx += 2;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count query
    const countRes = await pool.query(`SELECT count(*)::int FROM orders o ${where}`, params);
    const total = countRes.rows[0].count;

    // Data query with JOIN + pagination
    const dataParams = [...params, limit, offset];
    const { rows } = await pool.query(
      `SELECT o.*, u.name AS user_name, u.email AS user_email
       FROM orders o LEFT JOIN users u ON u.id = o.user_id
       ${where} ORDER BY o.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      dataParams
    );

    const data = rows.map(({ user_name, user_email, ...o }) => ({
      ...o,
      customer_name: user_name || o.customer_name,
      customer_email: user_email || o.customer_email
    }));
    return { data, total };
  },
  getOrderCounts: async () => {
    const { rows } = await pool.query('SELECT status, count(*)::int FROM orders GROUP BY status');
    return rows.reduce((acc, r) => { acc[r.status] = r.count; return acc; }, {});
  },
  getOrderWithCustomerById: async (id) => {
    const { rows } = await pool.query(`
      SELECT o.*, u.name AS user_name, u.email AS user_email
      FROM orders o LEFT JOIN users u ON u.id = o.user_id
      WHERE o.id = $1
    `, [id]);
    if (!rows[0]) return null;
    const { user_name, user_email, ...o } = rows[0];
    return { ...o, customer_name: user_name || o.customer_name, customer_email: user_email || o.customer_email };
  },
  getOrderByNumber: async (order_number) => {
    const { rows } = await pool.query(`
      SELECT o.*, u.name AS user_name, u.email AS user_email
      FROM orders o LEFT JOIN users u ON u.id = o.user_id
      WHERE o.order_number = $1
    `, [order_number]);
    if (!rows[0]) return null;
    const { user_name, user_email, ...o } = rows[0];
    return { ...o, customer_name: user_name || o.customer_name, customer_email: user_email || o.customer_email };
  },
  getOrdersByEmail: async (email) => {
    try {
      // Find user by email first, then fetch their orders
      const { rows: userRows } = await pool.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]
      );
      if (!userRows[0]) return [];

      const { rows } = await pool.query(`
        SELECT o.*, u.name AS user_name, u.email AS user_email
        FROM orders o LEFT JOIN users u ON u.id = o.user_id
        WHERE o.user_id = $1 ORDER BY o.created_at DESC
      `, [userRows[0].id]);

      return rows.map(({ user_name, user_email, ...o }) => ({
        ...o,
        customer_name: user_name || o.customer_name,
        customer_email: user_email || o.customer_email
      }));
    } catch (err) {
      console.error('Error en getOrdersByEmail:', err);
      return [];
    }
  },

  // ── Order Items ──────────────────────────────────────────
  // variant_id and variant_attributes are optional (null for non-variant items)
  addOrderItem: async (order_id, product_id, quantity, price, variant_id = null, variant_attributes = null) => {
    const { rows } = await pool.query(
      `INSERT INTO order_items (order_id, product_id, quantity, price, variant_id, variant_attributes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [order_id, product_id, quantity, price, variant_id, variant_attributes ? JSON.stringify(variant_attributes) : null]
    );
    return rows;
  },
  getOrderItems: async (order_id) => {
    const supportsUnitType = await ensureProductUnitTypeColumnSupport();
    const unitCol = supportsUnitType ? ', p.unit_type AS product_unit_type' : '';

    const { rows } = await pool.query(`
      SELECT oi.*,
             p.name AS product_name${unitCol}, p.image AS product_image,
             (SELECT pi.image_path FROM product_images pi
              WHERE pi.product_id = oi.product_id
              ORDER BY pi.created_at ASC LIMIT 1) AS gallery_image
      FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = $1
    `, [order_id]);

    // Map joined fields to top-level (same shape as supabase adapter output)
    return rows.map(({ product_name, product_unit_type, product_image, gallery_image, ...item }) => ({
      ...item,
      name: product_name || 'Producto eliminado',
      unit_type: normalizeProductUnitType(product_unit_type),
      image: gallery_image || product_image || null,
      // Include variant snapshot for display
      variant_id: item.variant_id || null,
      variant_attributes: item.variant_attributes || null
    }));
  },

  // ── Users Admin ──────────────────────────────────────────
  getAllUsers: async () => {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, is_active, created_at, updated_at, last_login FROM users ORDER BY created_at DESC'
    );
    return rows;
  },
  getUsersPaginated: async (page = 1, limit = 20, search = '', role = 'all', status = 'all') => {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (role !== 'all') {
      conditions.push(`role = $${idx++}`);
      params.push(role);
    }
    if (status === 'active') conditions.push('is_active = true');
    if (status === 'inactive') conditions.push('is_active = false');
    if (search) {
      conditions.push(`(name ILIKE $${idx} OR email ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await pool.query(`SELECT count(*)::int FROM users ${where}`, params);
    const total = countRes.rows[0].count;

    const dataParams = [...params, limit, offset];
    const { rows } = await pool.query(
      `SELECT id, name, email, role, is_active, created_at, updated_at, last_login
       FROM users ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      dataParams
    );
    return { data: rows, total };
  },
  updateUserRole: async (role, id) => {
    const { rows } = await pool.query(
      'UPDATE users SET role=$1, updated_at=NOW() WHERE id=$2 RETURNING *', [role, id]
    );
    return rows[0] || null;
  },
  updateUserStatus: async (is_active, id) => {
    const { rows } = await pool.query(
      'UPDATE users SET is_active=$1, updated_at=NOW() WHERE id=$2 RETURNING *', [is_active, id]
    );
    return rows[0] || null;
  },

  // ── Verification Codes ───────────────────────────────────
  createVerificationCode: async (email, code, purpose, expires_at) => {
    const { rows } = await pool.query(
      'INSERT INTO verification_codes (email, code, purpose, expires_at) VALUES ($1,$2,$3,$4) RETURNING *',
      [email, code, purpose, expires_at]
    );
    return rows;
  },
  getVerificationCode: async (email, code, purpose) => {
    const { rows } = await pool.query(
      `SELECT * FROM verification_codes
       WHERE email=$1 AND code=$2 AND purpose=$3 AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [email, code, purpose]
    );
    return rows[0] || null;
  },
  deleteVerificationCodes: async (email, purpose) => {
    await pool.query('DELETE FROM verification_codes WHERE email=$1 AND purpose=$2', [email, purpose]);
    return true;
  },
  cleanupExpiredCodes: async () => {
    await pool.query('DELETE FROM verification_codes WHERE expires_at <= NOW()');
    return true;
  },

  // ── App Settings ─────────────────────────────────────────
  getSettings: async () => {
    try {
      const { rows } = await pool.query('SELECT * FROM app_settings');
      return rows;
    } catch (err) {
      // 42P01 = undefined_table (table doesn't exist yet)
      if (err.code === '42P01') return [];
      throw err;
    }
  },
  updateSetting: async (key, value) => {
    const stringValue = typeof value === 'string' ? value : String(value);
    try {
      await pool.query(
        `INSERT INTO app_settings (id, value) VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET value = $2`,
        [key, stringValue]
      );
      return null;
    } catch (err) {
      if (err.code === '42P01') {
        throw new Error('La tabla "app_settings" no existe. Ejecuta el schema SQL.');
      }
      throw err;
    }
  },

  // ── Token Blacklist ──────────────────────────────────────
  addToBlacklist: async (tokenHash, sessionId, userId, expiresAt, reason = 'logout') => {
    try {
      const { rows } = await pool.query(
        `INSERT INTO token_blacklist (token_hash, session_id, user_id, expires_at, reason)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [tokenHash, sessionId, userId, expiresAt, reason]
      );
      return rows[0];
    } catch (err) {
      if (err.code === '42P01') {
        console.warn('⚠️ token_blacklist table not found. Using in-memory fallback.');
        return null;
      }
      throw err;
    }
  },
  isTokenBlacklisted: async (tokenHash) => {
    try {
      const { rows } = await pool.query(
        'SELECT id FROM token_blacklist WHERE token_hash=$1 AND expires_at > NOW() LIMIT 1',
        [tokenHash]
      );
      return rows.length > 0;
    } catch (err) {
      if (err.code === '42P01') return false;
      throw err;
    }
  },
  revokeAllUserSessions: async (userId, exceptSessionId = null) => {
    console.log(`Revoking all sessions for user ${userId} except ${exceptSessionId}`);
    return true;
  },
  cleanupExpiredBlacklistTokens: async () => {
    try {
      await pool.query('DELETE FROM token_blacklist WHERE expires_at < NOW()');
    } catch (err) {
      if (err.code !== '42P01') console.error('Error cleaning up blacklist:', err);
    }
    return true;
  }
};

// ---------------------------------------------------------------------------
// Reinitialize / Disconnect — hot-swap credentials at runtime
// ---------------------------------------------------------------------------
const reinitializeDb = (connectionString) => {
  // Close old pool gracefully — set to null first to prevent concurrent usage
  const oldPool = pool;
  pool = null;
  dbConfigured = false;
  if (oldPool) oldPool.end().catch(() => {});
  productUnitTypeColumnSupported = null;
  return initPool(connectionString);
};

const disconnectDb = () => {
  if (pool) { pool.end().catch(() => {}); pool = null; }
  dbConfigured = false;
  productUnitTypeColumnSupported = null;
  delete process.env.DATABASE_URL;
  console.log('⚠️  Database disconnected — app in setup mode.');
  return true;
};

// ---------------------------------------------------------------------------
// Safe proxy: throws DB_NOT_CONFIGURED if pool is null
// ---------------------------------------------------------------------------
const safeStatements = new Proxy(statements, {
  get(target, prop) {
    const original = target[prop];
    if (typeof original !== 'function') return original;
    return async (...args) => {
      if (!pool) {
        const err = new Error('Base de datos no configurada. Añade DATABASE_URL en .env o configura desde Setup Wizard.');
        err.code = 'DB_NOT_CONFIGURED';
        err.statusCode = 503;
        throw err;
      }
      return original.apply(target, args);
    };
  }
});

// Test connection with a lightweight query (used by settings db-status endpoint)
const testConnection = async () => {
  if (!pool) return false;
  try {
    await pool.query('SELECT 1');
    return true;
  } catch { return false; }
};

module.exports = {
  get supabase() { return null; },            // No supabase client in PG mode
  get pool() { return pool; },                // Expose pool for direct access if needed
  provider: 'postgres',                        // Provider identifier
  statements: safeStatements,
  dbConfigured: () => dbConfigured,
  reinitializeDb,
  disconnectDb,
  testConnection,
  UPLOADS_DIR
};
