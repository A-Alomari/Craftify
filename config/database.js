const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.CRAFTIFY_DB_PATH || path.join(__dirname, '..', 'craftify.db');

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
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
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
    scope TEXT DEFAULT 'global',
    artisan_id INTEGER,
    created_by INTEGER,
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
  CREATE INDEX IF NOT EXISTS idx_orders_payment_created ON orders(payment_status, created_at);
  CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at);
  CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
  CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
  CREATE INDEX IF NOT EXISTS idx_shipments_order ON shipments(order_id);
  CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
  CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id);
  CREATE INDEX IF NOT EXISTS idx_cart_session ON cart_items(session_id);
  CREATE INDEX IF NOT EXISTS idx_cart_user_product ON cart_items(user_id, product_id);
  CREATE INDEX IF NOT EXISTS idx_cart_session_product ON cart_items(session_id, product_id);
  CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status);
  CREATE INDEX IF NOT EXISTS idx_auctions_status_start ON auctions(status, start_time);
  CREATE INDEX IF NOT EXISTS idx_auctions_end_time ON auctions(end_time);
  CREATE INDEX IF NOT EXISTS idx_auctions_status_end_time ON auctions(status, end_time);
  CREATE INDEX IF NOT EXISTS idx_auctions_artisan_status ON auctions(artisan_id, status);
  CREATE INDEX IF NOT EXISTS idx_bids_auction ON bids(auction_id);
  CREATE INDEX IF NOT EXISTS idx_bids_auction_winning ON bids(auction_id, is_winning);
  CREATE INDEX IF NOT EXISTS idx_bids_user ON bids(user_id);
  CREATE INDEX IF NOT EXISTS idx_reviews_product_approved_created ON reviews(product_id, is_approved, created_at);
  CREATE INDEX IF NOT EXISTS idx_reviews_user_created ON reviews(user_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
  CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_messages_receiver_read_created ON messages(receiver_id, is_read, created_at);
  CREATE INDEX IF NOT EXISTS idx_messages_sender_created ON messages(sender_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver_created ON messages(sender_id, receiver_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_coupons_scope ON coupons(scope);
  CREATE INDEX IF NOT EXISTS idx_coupons_artisan ON coupons(artisan_id);
  CREATE INDEX IF NOT EXISTS idx_password_resets_token_used_expires ON password_resets(token, used, expires_at);
`;

class DatabaseWrapper {
  constructor(sqlDb) {
    this.sqlDb = sqlDb;
    this.persistTimer = null;
    this.pendingPersist = false;
    this.persistIntervalMs = parseInt(process.env.DB_PERSIST_INTERVAL_MS || '100', 10);
    this.inTransaction = false;
  }

  flushToDisk(sync = false) {
    const data = this.sqlDb.export();
    const buffer = Buffer.from(data);

    if (sync) {
      fs.writeFileSync(dbPath, buffer);
      return;
    }

    fs.writeFile(dbPath, buffer, (err) => {
      if (err) {
        console.error('Database persist error:', err.message);
      }
    });
  }

  save(immediate = false) {
    if (dbPath === ':memory:') {
      return;
    }

    if (process.env.NODE_ENV === 'test') {
      immediate = true;
    }

    if (immediate) {
      this.pendingPersist = false;
      if (this.persistTimer) {
        clearTimeout(this.persistTimer);
        this.persistTimer = null;
      }
      this.flushToDisk(true);
      return;
    }

    this.pendingPersist = true;
    if (this.persistTimer) {
      return;
    }

    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      if (this.pendingPersist) {
        this.pendingPersist = false;
        this.flushToDisk();
      }
    }, this.persistIntervalMs);
  }

  prepare(sql) {
    const self = this;
    return {
      run: function(...params) {
        try {
          const safeParams = params.map(p => p === undefined ? null : p);
          self.sqlDb.run(sql, safeParams);
          const lastId = self.sqlDb.exec("SELECT last_insert_rowid()")[0]?.values[0][0];
          const changes = self.sqlDb.getRowsModified();
          if (!self.inTransaction) {
            self.save();
          }
          return { lastInsertRowid: lastId, changes };
        } catch (e) {
          console.error('SQL Error:', e, 'Query:', sql.substring(0, 100));
          throw e;
        }
      },
      get: function(...params) {
        try {
          const safeParams = params.map(p => p === undefined ? null : p);
          const stmt = self.sqlDb.prepare(sql);
          stmt.bind(safeParams);
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
          console.error('SQL Error:', e, 'Query:', sql.substring(0, 100));
          throw e;
        }
      },
      all: function(...params) {
        try {
          const safeParams = params.map(p => p === undefined ? null : p);
          const stmt = self.sqlDb.prepare(sql);
          stmt.bind(safeParams);
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
          console.error('SQL Error:', e, 'Query:', sql.substring(0, 100));
          throw e;
        }
      }
    };
  }

  exec(sql) {
    this.sqlDb.run(sql);

    const upperSql = String(sql).trim().toUpperCase();
    if (upperSql.startsWith('BEGIN')) {
      this.inTransaction = true;
      return;
    }

    if (upperSql.startsWith('COMMIT') || upperSql.startsWith('ROLLBACK')) {
      this.inTransaction = false;
      this.save();
      return;
    }

    if (!this.inTransaction) {
      this.save();
    }
  }

  transaction(fn) {
    return (...args) => {
      this.exec('BEGIN TRANSACTION');
      try {
        const result = fn(...args);

        if (result && typeof result.then === 'function') {
          return result
            .then((value) => {
              this.exec('COMMIT');
              return value;
            })
            .catch((err) => {
              this.exec('ROLLBACK');
              throw err;
            });
        }

        this.exec('COMMIT');
        return result;
      } catch (e) {
        this.exec('ROLLBACK');
        throw e;
      }
    };
  }
}

function getForeignKeys(sqlDb, tableName) {
  const result = sqlDb.exec(`PRAGMA foreign_key_list(${tableName})`);
  if (!result || result.length === 0) {
    return [];
  }

  const { columns, values } = result[0];
  return values.map((row) => {
    const mapped = {};
    columns.forEach((column, idx) => {
      mapped[column] = row[idx];
    });
    return mapped;
  });
}

function needsOrderItemsForeignKeyMigration(sqlDb) {
  const foreignKeys = getForeignKeys(sqlDb, 'order_items');
  if (foreignKeys.length === 0) {
    return false;
  }

  return foreignKeys.some((foreignKey) => {
    return foreignKey.table === 'products' && String(foreignKey.on_delete).toUpperCase() === 'SET NULL';
  });
}

function migrateOrderItemsForeignKey(sqlDb) {
  console.log('Applying order_items foreign key migration...');

  sqlDb.run('PRAGMA foreign_keys = OFF;');
  try {
    sqlDb.run(`
      CREATE TABLE IF NOT EXISTS order_items__new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        artisan_id INTEGER,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        total_price REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
      );
    `);

    sqlDb.run(`
      INSERT INTO order_items__new (id, order_id, product_id, artisan_id, quantity, unit_price, total_price, created_at)
      SELECT id, order_id, product_id, artisan_id, quantity, unit_price, total_price, created_at
      FROM order_items;
    `);

    sqlDb.run('DROP TABLE order_items;');
    sqlDb.run('ALTER TABLE order_items__new RENAME TO order_items;');

    sqlDb.run('CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);');
    sqlDb.run('CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);');
  } finally {
    sqlDb.run('PRAGMA foreign_keys = ON;');
  }
}

function ensureCartItemUniqueness(sqlDb) {
  const tableCheck = sqlDb.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'cart_items';");
  const tableExists = Array.isArray(tableCheck)
    && tableCheck.length > 0
    && Array.isArray(tableCheck[0].values)
    && tableCheck[0].values.length > 0;

  if (!tableExists) {
    return;
  }

  const duplicateCountResult = sqlDb.exec(`
    SELECT
      (
        SELECT COUNT(*)
        FROM (
          SELECT user_id, product_id
          FROM cart_items
          WHERE user_id IS NOT NULL
          GROUP BY user_id, product_id
          HAVING COUNT(*) > 1
        )
      ) AS user_duplicates,
      (
        SELECT COUNT(*)
        FROM (
          SELECT session_id, product_id
          FROM cart_items
          WHERE user_id IS NULL AND session_id IS NOT NULL
          GROUP BY session_id, product_id
          HAVING COUNT(*) > 1
        )
      ) AS session_duplicates
  `);

  const duplicateRow = duplicateCountResult?.[0]?.values?.[0] || [0, 0];
  const userDuplicates = Number(duplicateRow[0]) || 0;
  const sessionDuplicates = Number(duplicateRow[1]) || 0;

  if (userDuplicates > 0 || sessionDuplicates > 0) {
    console.log('Compacting duplicate cart_items rows before enabling uniqueness indexes...');

    sqlDb.run('DROP TABLE IF EXISTS cart_items_compacted;');
    sqlDb.run(`
      CREATE TEMP TABLE cart_items_compacted (
        user_id INTEGER,
        session_id TEXT,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        created_at DATETIME
      );
    `);

    sqlDb.run(`
      INSERT INTO cart_items_compacted (user_id, session_id, product_id, quantity, created_at)
      SELECT user_id, NULL, product_id, SUM(quantity) AS quantity, MIN(created_at) AS created_at
      FROM cart_items
      WHERE user_id IS NOT NULL
      GROUP BY user_id, product_id;
    `);

    sqlDb.run(`
      INSERT INTO cart_items_compacted (user_id, session_id, product_id, quantity, created_at)
      SELECT NULL, session_id, product_id, SUM(quantity) AS quantity, MIN(created_at) AS created_at
      FROM cart_items
      WHERE user_id IS NULL AND session_id IS NOT NULL
      GROUP BY session_id, product_id;
    `);

    sqlDb.run('DELETE FROM cart_items;');

    sqlDb.run(`
      INSERT INTO cart_items (user_id, session_id, product_id, quantity, created_at)
      SELECT user_id, session_id, product_id, quantity, COALESCE(created_at, CURRENT_TIMESTAMP)
      FROM cart_items_compacted;
    `);

    sqlDb.run('DROP TABLE cart_items_compacted;');
  }

  sqlDb.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_user_product
    ON cart_items(user_id, product_id)
    WHERE user_id IS NOT NULL;
  `);

  sqlDb.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_session_product
    ON cart_items(session_id, product_id)
    WHERE user_id IS NULL AND session_id IS NOT NULL;
  `);
}

function getTableColumns(sqlDb, tableName) {
  const result = sqlDb.exec(`PRAGMA table_info(${tableName})`);
  if (!result || result.length === 0) {
    return [];
  }

  const { columns, values } = result[0];
  const nameIndex = columns.indexOf('name');
  if (nameIndex < 0) {
    return [];
  }

  return values.map((row) => String(row[nameIndex]));
}

function ensureCouponScopeColumns(sqlDb) {
  const tableCheck = sqlDb.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'coupons';");
  const couponsExists = Array.isArray(tableCheck)
    && tableCheck.length > 0
    && Array.isArray(tableCheck[0].values)
    && tableCheck[0].values.length > 0;

  if (!couponsExists) {
    return;
  }

  const columns = new Set(getTableColumns(sqlDb, 'coupons'));

  if (!columns.has('scope')) {
    sqlDb.run("ALTER TABLE coupons ADD COLUMN scope TEXT DEFAULT 'global';");
  }
  if (!columns.has('artisan_id')) {
    sqlDb.run('ALTER TABLE coupons ADD COLUMN artisan_id INTEGER;');
  }
  if (!columns.has('created_by')) {
    sqlDb.run('ALTER TABLE coupons ADD COLUMN created_by INTEGER;');
  }

  sqlDb.run("UPDATE coupons SET scope = 'global' WHERE scope IS NULL OR trim(scope) = '';");
  sqlDb.run('CREATE INDEX IF NOT EXISTS idx_coupons_scope ON coupons(scope);');
  sqlDb.run('CREATE INDEX IF NOT EXISTS idx_coupons_artisan ON coupons(artisan_id);');
}

async function initDatabase() {
  SQL = await initSqlJs();
  
  let sqlDb;
  if (dbPath !== ':memory:' && fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    sqlDb = new SQL.Database(buffer);
  } else {
    sqlDb = new SQL.Database();
  }

  sqlDb.run('PRAGMA foreign_keys = ON;');
  
  db = new DatabaseWrapper(sqlDb);
  
  try {
    // Execute schema statements one by one
    const statements = schema.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      db.sqlDb.run(stmt);
    }

    if (needsOrderItemsForeignKeyMigration(db.sqlDb)) {
      migrateOrderItemsForeignKey(db.sqlDb);
    }

    ensureCartItemUniqueness(db.sqlDb);
    ensureCouponScopeColumns(db.sqlDb);

    db.save(true);
    console.log('Database initialized successfully');
  } catch (e) {
    console.error('Schema initialization error:', e.message);
    throw e;
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
