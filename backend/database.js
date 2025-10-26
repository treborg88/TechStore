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
    image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    user_id INTEGER NOT NULL,
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
`);

// Prepared statements for common operations
const statements = {
  // Users
  getUserById: db.prepare('SELECT id, name, email, role, is_active, created_at, updated_at, last_login FROM users WHERE id = ?'),
  getUserByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  createUser: db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'),
  updateUser: db.prepare('UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  updateUserPassword: db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  updateLastLogin: db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?'),

  // Products
  getAllProducts: db.prepare('SELECT * FROM products ORDER BY created_at DESC'),
  getProductById: db.prepare('SELECT * FROM products WHERE id = ?'),
  getProductsByCategory: db.prepare('SELECT * FROM products WHERE category = ? ORDER BY created_at DESC'),
  createProduct: db.prepare('INSERT INTO products (name, description, price, category, stock, image) VALUES (?, ?, ?, ?, ?, ?)'),
  updateProduct: db.prepare('UPDATE products SET name = ?, description = ?, price = ?, category = ?, stock = ?, image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  deleteProduct: db.prepare('DELETE FROM products WHERE id = ?'),

  // Cart
  getCartByUserId: db.prepare(`
    SELECT c.id, c.product_id, c.quantity, p.name, p.price, p.image, p.stock
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
  createOrder: db.prepare('INSERT INTO orders (user_id, total, shipping_address) VALUES (?, ?, ?)'),
  getOrdersByUserId: db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC'),
  getOrderById: db.prepare('SELECT * FROM orders WHERE id = ?'),
  updateOrderStatus: db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),

  // Order Items
  addOrderItem: db.prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)'),
  getOrderItems: db.prepare('SELECT oi.*, p.name, p.image FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?')
};

module.exports = { db, statements };