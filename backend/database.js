const Database = require('better-sqlite3');
const path = require('path');

// Path to the database file
const dbPath = path.join(__dirname, 'data', 'app.db');

// Create database connection
const db = new Database(dbPath);

// Enable WAL mode for better performance and concurrency
db.pragma('journal_mode = WAL');

// Create tables if they don't exist
db.exec(`
  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'customer',
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  );

  -- Products table
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    category TEXT NOT NULL,
    stock INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Product images table
  CREATE TABLE IF NOT EXISTS product_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    image_path TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  -- Cart table (one-to-many: user can have multiple cart items)
  CREATE TABLE IF NOT EXISTS cart (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE(user_id, product_id)
  );

  -- Orders table
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    total REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    shipping_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Order items table (many-to-many: order can have multiple products)
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  -- Create indexes for better performance
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
  CREATE INDEX IF NOT EXISTS idx_cart_user_id ON cart(user_id);
  CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

  -- Verification codes table
  CREATE TABLE IF NOT EXISTS verification_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    purpose TEXT,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON verification_codes(email);
`);

// Migration: Add payment_method to orders if it doesn't exist
try {
  const tableInfo = db.pragma('table_info(orders)');
  const hasPaymentMethod = tableInfo.some(column => column.name === 'payment_method');
  if (!hasPaymentMethod) {
    console.log('Migrating database: Adding payment_method to orders table...');
    db.exec('ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT "cash"');
  }
} catch (error) {
  console.error('Error checking/migrating orders table:', error);
}

// Migration: Add structured address fields to orders if they don't exist
try {
  const tableInfo = db.pragma('table_info(orders)');
  const columns = tableInfo.map(col => col.name);
  
  if (!columns.includes('customer_name')) {
    console.log('Migrating database: Adding customer_name to orders table...');
    db.exec('ALTER TABLE orders ADD COLUMN customer_name TEXT');
  }
  if (!columns.includes('customer_email')) {
    console.log('Migrating database: Adding customer_email to orders table...');
    db.exec('ALTER TABLE orders ADD COLUMN customer_email TEXT');
  }
  if (!columns.includes('customer_phone')) {
    console.log('Migrating database: Adding customer_phone to orders table...');
    db.exec('ALTER TABLE orders ADD COLUMN customer_phone TEXT');
  }
  if (!columns.includes('shipping_street')) {
    console.log('Migrating database: Adding shipping_street to orders table...');
    db.exec('ALTER TABLE orders ADD COLUMN shipping_street TEXT');
  }
  if (!columns.includes('shipping_city')) {
    console.log('Migrating database: Adding shipping_city to orders table...');
    db.exec('ALTER TABLE orders ADD COLUMN shipping_city TEXT');
  }
  if (!columns.includes('shipping_postal_code')) {
    console.log('Migrating database: Adding shipping_postal_code to orders table...');
    db.exec('ALTER TABLE orders ADD COLUMN shipping_postal_code TEXT');
  }
  if (!columns.includes('shipping_sector')) {
    console.log('Migrating database: Adding shipping_sector to orders table...');
    db.exec('ALTER TABLE orders ADD COLUMN shipping_sector TEXT');
  }
  if (!columns.includes('order_number')) {
    console.log('Migrating database: Adding order_number to orders table...');
    db.exec('ALTER TABLE orders ADD COLUMN order_number TEXT');
    db.exec('CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number)');
  }
} catch (error) {
  console.error('Error migrating structured address fields:', error);
}

// Migration: Add is_guest to users table to distinguish guest checkouts from real customers
try {
  const tableInfo = db.pragma('table_info(users)');
  const hasIsGuest = tableInfo.some(column => column.name === 'is_guest');
  if (!hasIsGuest) {
    console.log('Migrating database: Adding is_guest to users table...');
    db.exec('ALTER TABLE users ADD COLUMN is_guest BOOLEAN DEFAULT 0');
  }
} catch (error) {
  console.error('Error migrating is_guest column:', error);
}

// Migration: Add profile fields to users table
try {
  const tableInfo = db.pragma('table_info(users)');
  const columns = tableInfo.map(col => col.name);

  if (!columns.includes('phone')) {
      console.log('Migrating database: Adding phone to users table...');
      db.exec('ALTER TABLE users ADD COLUMN phone TEXT');
  }
  if (!columns.includes('street')) {
      console.log('Migrating database: Adding street to users table...');
      db.exec('ALTER TABLE users ADD COLUMN street TEXT');
  }
  if (!columns.includes('sector')) {
      console.log('Migrating database: Adding sector to users table...');
      db.exec('ALTER TABLE users ADD COLUMN sector TEXT');
  }
  if (!columns.includes('city')) {
      console.log('Migrating database: Adding city to users table...');
      db.exec('ALTER TABLE users ADD COLUMN city TEXT');
  }
  if (!columns.includes('country')) {
      console.log('Migrating database: Adding country to users table...');
      db.exec('ALTER TABLE users ADD COLUMN country TEXT');
  }
} catch (error) {
  console.error('Error migrating user profile fields:', error);
}

// Migration: Allow NULL user_id in orders table so guest orders do not require user records
try {
  const ordersTableInfo = db.pragma('table_info(orders)');
  const userIdColumn = ordersTableInfo.find(column => column.name === 'user_id');
  if (userIdColumn && userIdColumn.notnull === 1) {
    console.log('Migrating database: Allowing NULL user_id in orders table...');

    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('BEGIN TRANSACTION');

    db.exec(`
      CREATE TABLE orders_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        total REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        shipping_address TEXT,
        payment_method TEXT DEFAULT 'cash',
        customer_name TEXT,
        customer_email TEXT,
        customer_phone TEXT,
        shipping_street TEXT,
        shipping_city TEXT,
        shipping_postal_code TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    db.exec(`
      INSERT INTO orders_new (
        id, user_id, total, status, shipping_address, payment_method,
        customer_name, customer_email, customer_phone,
        shipping_street, shipping_city, shipping_postal_code,
        created_at, updated_at
      )
      SELECT
        id, user_id, total, status, shipping_address, payment_method,
        customer_name, customer_email, customer_phone,
        shipping_street, shipping_city, shipping_postal_code,
        created_at, updated_at
      FROM orders
    `);

    db.exec('DROP TABLE orders');
    db.exec('ALTER TABLE orders_new RENAME TO orders');
    db.exec('COMMIT');
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)');
  }
} catch (error) {
  console.error('Error migrating nullable user_id for orders table:', error);
}

// Prepared statements for common operations
const statements = {
  // Users
  getUserById: db.prepare('SELECT id, name, email, role, phone, street, sector, city, country, is_active, is_guest, created_at, updated_at, last_login FROM users WHERE id = ?'),
  getUserByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  createUser: db.prepare('INSERT INTO users (name, email, password, role, is_guest) VALUES (?, ?, ?, ?, ?)'),
  updateUser: db.prepare('UPDATE users SET name = ?, phone = ?, street = ?, sector = ?, city = ?, country = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  updateUserPassword: db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  updateLastLogin: db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?'),

  // Products
  getAllProducts: db.prepare('SELECT * FROM products ORDER BY created_at DESC'),
  getProductById: db.prepare('SELECT * FROM products WHERE id = ?'),
  getProductsByCategory: db.prepare('SELECT * FROM products WHERE category = ? ORDER BY created_at DESC'),
  createProduct: db.prepare('INSERT INTO products (name, description, price, category, stock) VALUES (?, ?, ?, ?, ?)'),
  updateProduct: db.prepare('UPDATE products SET name = ?, description = ?, price = ?, category = ?, stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  deleteProduct: db.prepare('DELETE FROM products WHERE id = ?'),

  // Product Images
  getProductImages: db.prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY created_at ASC'),
  addProductImage: db.prepare('INSERT INTO product_images (product_id, image_path) VALUES (?, ?)'),
  deleteProductImage: db.prepare('DELETE FROM product_images WHERE id = ? AND product_id = ?'),
  deleteAllProductImages: db.prepare('DELETE FROM product_images WHERE product_id = ?'),

  // Cart
  getCartByUserId: db.prepare(`
    SELECT c.id, c.product_id, c.quantity, p.name, p.price, p.stock,
           COALESCE(
             (SELECT image_path FROM product_images WHERE product_id = p.id ORDER BY created_at ASC LIMIT 1),
             p.image
           ) as image
    FROM cart c
    JOIN products p ON c.product_id = p.id
    WHERE c.user_id = ?
    ORDER BY c.created_at DESC
  `),
  addToCart: db.prepare('INSERT OR REPLACE INTO cart (user_id, product_id, quantity, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'),
  updateCartItem: db.prepare('UPDATE cart SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND product_id = ?'),
  removeFromCart: db.prepare('DELETE FROM cart WHERE user_id = ? AND product_id = ?'),
  clearCart: db.prepare('DELETE FROM cart WHERE user_id = ?'),
  getCartItem: db.prepare('SELECT * FROM cart WHERE user_id = ? AND product_id = ?'),

  // Orders
  createOrder: db.prepare('INSERT INTO orders (user_id, total, shipping_address, payment_method, customer_name, customer_email, customer_phone, shipping_street, shipping_city, shipping_postal_code, shipping_sector) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  getOrdersByUserId: db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC'),
  getOrderById: db.prepare('SELECT * FROM orders WHERE id = ?'),
  updateOrderStatus: db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  updateOrderNumber: db.prepare('UPDATE orders SET order_number = ? WHERE id = ?'),
  deleteOrder: db.prepare('DELETE FROM orders WHERE id = ?'),

  // Order Items
  addOrderItem: db.prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)'),
  getOrderItems: db.prepare(`
    SELECT oi.*, p.name,
           COALESCE(
             (SELECT image_path FROM product_images WHERE product_id = p.id ORDER BY created_at ASC LIMIT 1),
             p.image
           ) as image
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `),

  // Verification Codes
  createVerificationCode: db.prepare('INSERT INTO verification_codes (email, code, purpose, expires_at) VALUES (?, ?, ?, ?)'),
  getVerificationCode: db.prepare('SELECT * FROM verification_codes WHERE email = ? AND code = ? AND purpose = ? AND expires_at > CURRENT_TIMESTAMP ORDER BY created_at DESC LIMIT 1'),
  deleteVerificationCodes: db.prepare('DELETE FROM verification_codes WHERE email = ? AND purpose = ?'),
  cleanupExpiredCodes: db.prepare('DELETE FROM verification_codes WHERE expires_at <= CURRENT_TIMESTAMP')
};

module.exports = { db, statements };