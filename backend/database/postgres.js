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

const initPool = (connectionString) => {
  if (!connectionString) return false;
  try {
    pool = new Pool({ connectionString, max: 20 });
    pool.on('error', (err) => console.error('PG Pool error:', err.message));
    dbConfigured = true;
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
    // Write buffer to filesystem
    fs.writeFileSync(filePath, file.buffer);
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
  getProductsPaginated: async (page = 1, limit = 20, search = '', category = '') => {
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

    // Count query
    const countRes = await pool.query(`SELECT count(*)::int FROM products ${where}`, params);
    const total = countRes.rows[0].count;

    // Data query with pagination
    const dataParams = [...params, limit, offset];
    const { rows } = await pool.query(
      `SELECT * FROM products ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
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
  updateProduct: async (name, description, price, category, stock, id, unitType) => {
    const supportsUnitType = await ensureProductUnitTypeColumnSupport();
    let query, params;
    if (supportsUnitType && unitType !== undefined) {
      query = `UPDATE products SET name=$1, description=$2, price=$3, category=$4,
               stock=$5, unit_type=$6, updated_at=NOW() WHERE id=$7 RETURNING *`;
      params = [name, description, price, category, stock, normalizeProductUnitType(unitType), id];
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

  // ── Cart ─────────────────────────────────────────────────
  getCartByUserId: async (user_id) => {
    const supportsUnitType = await ensureProductUnitTypeColumnSupport();
    const unitCol = supportsUnitType ? ', p.unit_type' : '';

    const { rows } = await pool.query(`
      SELECT c.id, c.product_id, c.quantity,
             p.name, p.price, p.stock${unitCol}, p.image,
             (SELECT pi.image_path FROM product_images pi
              WHERE pi.product_id = c.product_id
              ORDER BY pi.created_at ASC LIMIT 1) AS gallery_image
      FROM cart c
      JOIN products p ON p.id = c.product_id
      WHERE c.user_id = $1
      ORDER BY c.created_at DESC
    `, [user_id]);

    return rows.map((r) => ({
      id: r.id,
      product_id: r.product_id,
      quantity: r.quantity,
      name: r.name,
      price: r.price,
      stock: r.stock,
      unit_type: normalizeProductUnitType(r.unit_type),
      image: r.gallery_image || r.image
    }));
  },
  addToCart: async (user_id, product_id, quantity) => {
    await pool.query(
      `INSERT INTO cart (user_id, product_id, quantity, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = $3, updated_at = NOW()`,
      [user_id, product_id, quantity]
    );
    return null;
  },
  updateCartItem: async (quantity, user_id, product_id) => {
    await pool.query(
      'UPDATE cart SET quantity=$1, updated_at=NOW() WHERE user_id=$2 AND product_id=$3',
      [quantity, user_id, product_id]
    );
    return null;
  },
  removeFromCart: async (user_id, product_id) => {
    await pool.query('DELETE FROM cart WHERE user_id=$1 AND product_id=$2', [user_id, product_id]);
    return true;
  },
  clearCart: async (user_id) => {
    await pool.query('DELETE FROM cart WHERE user_id = $1', [user_id]);
    return true;
  },
  getCartItem: async (user_id, product_id) => {
    const { rows } = await pool.query(
      'SELECT * FROM cart WHERE user_id=$1 AND product_id=$2', [user_id, product_id]
    );
    return rows[0] || null;
  },

  // ── Orders ───────────────────────────────────────────────
  createOrder: async (user_id, total, shipping_address, payment_method, customer_name, customer_email, customer_phone, shipping_street, shipping_city, shipping_postal_code, shipping_sector) => {
    const { rows } = await pool.query(
      `INSERT INTO orders (user_id, total, shipping_address, payment_method,
       customer_name, customer_email, customer_phone,
       shipping_street, shipping_city, shipping_postal_code, shipping_sector)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [user_id, total, shipping_address, payment_method,
       customer_name, customer_email, customer_phone,
       shipping_street, shipping_city, shipping_postal_code, shipping_sector]
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
  addOrderItem: async (order_id, product_id, quantity, price) => {
    const { rows } = await pool.query(
      `INSERT INTO order_items (order_id, product_id, quantity, price)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [order_id, product_id, quantity, price]
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
      image: gallery_image || product_image || null
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
  // Close old pool gracefully
  if (pool) pool.end().catch(() => {});
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
