const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'craftify.db');

let db = null;
let SQL = null;

const schema = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'customer',
    status TEXT DEFAULT 'active',
    phone TEXT,
    avatar TEXT,
    shipping_address TEXT,
    city TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'Bahrain',
    dob TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS artisan_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    shop_name TEXT NOT NULL,
    bio TEXT,
    logo TEXT,
    banner TEXT,
    profile_image TEXT,
    banner_image TEXT,
    location TEXT,
    phone TEXT,
    instagram TEXT,
    facebook TEXT,
    twitter TEXT,
    website TEXT,
    bank_name TEXT,
    bank_account TEXT,
    shipping_methods TEXT DEFAULT '[]',
    return_policy TEXT DEFAULT '',
    is_approved INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    image TEXT,
    parent_id INTEGER,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artisan_id INTEGER NOT NULL,
    category_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    compare_price REAL,
    stock INTEGER DEFAULT 0,
    images TEXT DEFAULT '[]',
    tags TEXT,
    weight REAL,
    featured INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    is_active INTEGER DEFAULT 1,
    views INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (artisan_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    session_id TEXT,
    product_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subtotal REAL NOT NULL,
    shipping_cost REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    total_amount REAL NOT NULL,
    coupon_code TEXT,
    status TEXT DEFAULT 'pending',
    payment_method TEXT,
    payment_status TEXT DEFAULT 'pending',
    transaction_ref TEXT,
    shipping_address TEXT NOT NULL,
    shipping_city TEXT,
    shipping_postal TEXT,
    shipping_country TEXT DEFAULT 'Bahrain',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    artisan_id INTEGER,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS shipments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    tracking_number TEXT UNIQUE,
    carrier TEXT DEFAULT 'Craftify Express',
    status TEXT DEFAULT 'pending',
    estimated_delivery DATETIME,
    shipped_at DATETIME,
    delivered_at DATETIME,
    last_update DATETIME,
    history TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    order_id INTEGER,
    rating INTEGER NOT NULL,
    title TEXT,
    comment TEXT,
    helpful_count INTEGER DEFAULT 0,
    is_approved INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS auctions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    artisan_id INTEGER NOT NULL,
    title TEXT,
    description TEXT,
    starting_price REAL NOT NULL,
    starting_bid REAL,
    reserve_price REAL,
    current_highest_bid REAL,
    bid_increment REAL DEFAULT 1,
    winner_id INTEGER,
    highest_bidder_id INTEGER,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (artisan_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (highest_bidder_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS bids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    auction_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    is_winning INTEGER DEFAULT 0,
    bid_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS wishlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE(user_id, product_id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT DEFAULT 'general',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    subject TEXT,
    content TEXT NOT NULL,
    parent_id INTEGER,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    type TEXT DEFAULT 'percent',
    discount_type TEXT DEFAULT 'percent',
    value REAL NOT NULL,
    discount_value REAL,
    min_order REAL,
    min_purchase REAL DEFAULT 0,
    max_discount REAL,
    max_uses INTEGER,
    usage_limit INTEGER,
    used_count INTEGER DEFAULT 0,
    times_used INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    active INTEGER DEFAULT 1,
    valid_from DATETIME,
    valid_until DATETIME,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_products_artisan ON products(artisan_id);
  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
  CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
  CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
`;

class DatabaseWrapper {
  constructor(sqlDb) {
    this.sqlDb = sqlDb;
  }

  save() {
    const data = this.sqlDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }

  prepare(sql) {
    const self = this;
    return {
      run: function(...params) {
        try {
          self.sqlDb.run(sql, params);
          self.save();
          const lastId = self.sqlDb.exec("SELECT last_insert_rowid()")[0]?.values[0][0];
          const changes = self.sqlDb.getRowsModified();
          return { lastInsertRowid: lastId, changes };
        } catch (e) {
          console.error('SQL Error:', e.message, 'Query:', sql.substring(0, 100));
          throw e;
        }
      },
      get: function(...params) {
        try {
          const stmt = self.sqlDb.prepare(sql);
          stmt.bind(params);
          if (stmt.step()) {
            const cols = stmt.getColumnNames();
            const values = stmt.get();
            stmt.free();
            const result = {};
            cols.forEach((col, i) => result[col] = values[i]);
            return result;
          }
          stmt.free();
          return undefined;
        } catch (e) {
          console.error('SQL Error:', e.message, 'Query:', sql.substring(0, 100));
          return undefined;
        }
      },
      all: function(...params) {
        try {
          const stmt = self.sqlDb.prepare(sql);
          stmt.bind(params);
          const results = [];
          while (stmt.step()) {
            const cols = stmt.getColumnNames();
            const values = stmt.get();
            const row = {};
            cols.forEach((col, i) => row[col] = values[i]);
            results.push(row);
          }
          stmt.free();
          return results;
        } catch (e) {
          console.error('SQL Error:', e.message, 'Query:', sql.substring(0, 100));
          return [];
        }
      }
    };
  }

  exec(sql) {
    this.sqlDb.run(sql);
    this.save();
  }

  transaction(fn) {
    return (...args) => {
      this.exec('BEGIN TRANSACTION');
      try {
        const result = fn(...args);
        this.exec('COMMIT');
        return result;
      } catch (e) {
        this.exec('ROLLBACK');
        throw e;
      }
    };
  }
}

async function initDatabase() {
  SQL = await initSqlJs();
  
  let sqlDb;
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    sqlDb = new SQL.Database(buffer);
  } else {
    sqlDb = new SQL.Database();
  }
  
  db = new DatabaseWrapper(sqlDb);
  
  try {
    // Execute schema statements one by one
    const statements = schema.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      try {
        db.sqlDb.run(stmt);
      } catch (e) {
        // Ignore errors for IF NOT EXISTS statements
      }
    }
    db.save();
    console.log('Database initialized successfully');
  } catch (e) {
    console.error('Schema initialization error:', e.message);
  }
  
  return db;
}

function getDb() {
  if (db) return db;
  throw new Error('Database not initialized. Call initDatabase() first.');
}

module.exports = {
  initDatabase,
  getDb,
  get db() { return getDb(); }
};
