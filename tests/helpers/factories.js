/**
 * tests/helpers/factories.js
 *
 * Pure factory functions that build test-data objects and/or insert them
 * into the database.  Every factory accepts `db` as its first argument so
 * tests can pass in any isolated test-database instance.
 *
 * Factories never call model classes directly – they use raw SQL so they
 * remain independent of business-logic changes in the model layer.
 */

'use strict';

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Cost-4 bcrypt is intentionally fast for test environments.
const hashPassword = (pw) => bcrypt.hashSync(pw, 4);

// ── Unique value helpers ────────────────────────────────────────────────────

let _seq = 0;
function seq() { return ++_seq; }
function unique(prefix = '') { return `${prefix}_${Date.now()}_${seq()}`; }

// ── User factories ──────────────────────────────────────────────────────────

/**
 * Insert a customer user and return the full row.
 * @param {object} db  - sql.js Database instance
 * @param {object} [overrides] - optional field overrides
 * @returns {object} inserted user row
 */
function createCustomer(db, overrides = {}) {
  const email    = overrides.email    || `customer_${unique()}@test.com`;
  const password = overrides.password || 'cust123';
  const name     = overrides.name     || 'Test Customer';
  const status   = overrides.status   || 'active';

  db.prepare(
    'INSERT INTO users (name,email,password,role,status,shipping_address,city,country) VALUES (?,?,?,?,?,?,?,?)'
  ).run(name, email, hashPassword(password), 'customer', status,
        overrides.shipping_address || '123 Test St',
        overrides.city    || 'Manama',
        overrides.country || 'Bahrain');

  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

/**
 * Insert an artisan user + artisan_profile and return both.
 */
function createArtisan(db, overrides = {}) {
  const email    = overrides.email    || `artisan_${unique()}@test.com`;
  const password = overrides.password || 'art123';
  const name     = overrides.name     || 'Test Artisan';
  const approved = overrides.is_approved !== undefined ? overrides.is_approved : 1;

  db.prepare(
    'INSERT INTO users (name,email,password,role,status) VALUES (?,?,?,?,?)'
  ).run(name, email, hashPassword(password), 'artisan', 'active');

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  db.prepare(
    'INSERT INTO artisan_profiles (user_id,shop_name,bio,location,is_approved) VALUES (?,?,?,?,?)'
  ).run(user.id,
        overrides.shop_name || `${name}'s Shop`,
        overrides.bio       || 'A fine craftsperson',
        overrides.location  || 'Manama',
        approved);

  const profile = db.prepare('SELECT * FROM artisan_profiles WHERE user_id = ?').get(user.id);
  return { user, profile };
}

/**
 * Insert an admin user and return the row.
 */
function createAdmin(db, overrides = {}) {
  const email    = overrides.email    || `admin_${unique()}@test.com`;
  const password = overrides.password || 'admin123';

  db.prepare(
    'INSERT INTO users (name,email,password,role,status) VALUES (?,?,?,?,?)'
  ).run(overrides.name || 'Admin', email, hashPassword(password), 'admin', 'active');

  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

// ── Category factory ────────────────────────────────────────────────────────

function createCategory(db, overrides = {}) {
  const name = overrides.name || `Category ${unique()}`;
  const slug = overrides.slug || name.toLowerCase().replace(/\s+/g, '-');

  db.prepare(
    'INSERT INTO categories (name,slug,description,image,is_active) VALUES (?,?,?,?,?)'
  ).run(name, slug,
        overrides.description || 'A test category',
        overrides.image       || 'https://example.com/cat.jpg',
        overrides.is_active !== undefined ? overrides.is_active : 1);

  return db.prepare('SELECT * FROM categories WHERE slug = ?').get(slug);
}

// ── Product factory ─────────────────────────────────────────────────────────

/**
 * Insert a product and return the full row.
 * Requires artisan user id and category id.
 */
function createProduct(db, artisanId, categoryId, overrides = {}) {
  const name = overrides.name || `Product ${unique()}`;

  db.prepare(
    'INSERT INTO products (artisan_id,category_id,name,description,price,stock,images,status,is_active,featured) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(
    artisanId,
    categoryId,
    name,
    overrides.description || 'A fine handmade product',
    overrides.price       !== undefined ? overrides.price : 29.99,
    overrides.stock       !== undefined ? overrides.stock : 10,
    overrides.images      || '["https://example.com/product.jpg"]',
    overrides.status      || 'approved',
    overrides.is_active   !== undefined ? overrides.is_active : 1,
    overrides.featured    !== undefined ? overrides.featured  : 0
  );

  return db.prepare('SELECT * FROM products WHERE name = ? ORDER BY id DESC LIMIT 1').get(name);
}

// ── Order factory ───────────────────────────────────────────────────────────

/**
 * Insert an order (and a single order_item + shipment) and return the order row.
 */
function createOrder(db, customerId, productId, artisanId, overrides = {}) {
  const status  = overrides.status  || 'pending';
  const total   = overrides.total   || 45.00;
  const tracking = overrides.tracking || `CRF${String(Date.now()).slice(-8)}`;

  const result = db.prepare(
    'INSERT INTO orders (user_id,subtotal,shipping_cost,discount_amount,total_amount,status,payment_method,payment_status,shipping_address,shipping_city,shipping_country) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
  ).run(customerId,
        overrides.subtotal || total,
        overrides.shipping_cost || 0,
        overrides.discount || 0,
        total,
        status,
        overrides.payment_method || 'card',
        overrides.payment_status || 'paid',
        overrides.address  || '1 Order St',
        overrides.city     || 'Manama',
        overrides.country  || 'Bahrain');

  const orderId = result.lastInsertRowid;

  db.prepare(
    'INSERT INTO order_items (order_id,product_id,artisan_id,quantity,unit_price,total_price) VALUES (?,?,?,?,?,?)'
  ).run(orderId, productId, artisanId, overrides.quantity || 1, overrides.unit_price || total, total);

  db.prepare(
    'INSERT INTO shipments (order_id,tracking_number,carrier,status) VALUES (?,?,?,?)'
  ).run(orderId, tracking, 'Craftify Express', overrides.shipment_status || 'processing');

  return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
}

// ── Auction factory ─────────────────────────────────────────────────────────

function createAuction(db, productId, artisanId, overrides = {}) {
  const now    = new Date();
  const title  = overrides.title || `Auction ${unique()}`;
  const status = overrides.status || 'active';

  const startTime = overrides.start_time
    || new Date(now - 86400000).toISOString();          // 1 day ago
  const endTime   = overrides.end_time
    || new Date(now.getTime() + 172800000).toISOString(); // 2 days ahead

  const result = db.prepare(
    'INSERT INTO auctions (product_id,artisan_id,title,starting_price,current_highest_bid,bid_increment,start_time,end_time,status) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(
    productId, artisanId, title,
    overrides.starting_price      || 20.00,
    overrides.current_highest_bid || 20.00,
    overrides.bid_increment       || 5.00,
    startTime, endTime, status
  );

  return db.prepare('SELECT * FROM auctions WHERE id = ?').get(result.lastInsertRowid);
}

// ── Coupon factory ──────────────────────────────────────────────────────────

function createCoupon(db, overrides = {}) {
  const code = overrides.code || `COUPON${unique().toUpperCase().slice(-6)}`;
  const now  = new Date();

  db.prepare(
    'INSERT INTO coupons (code,type,value,min_order,is_active,expires_at) VALUES (?,?,?,?,?,?)'
  ).run(
    code,
    overrides.type      || 'percent',
    overrides.value     !== undefined ? overrides.value : 10,
    overrides.min_order !== undefined ? overrides.min_order : 0,
    overrides.is_active !== undefined ? overrides.is_active : 1,
    overrides.expires_at || new Date(now.getTime() + 30 * 86400000).toISOString()
  );

  return db.prepare('SELECT * FROM coupons WHERE code = ?').get(code);
}

// ── Review factory ──────────────────────────────────────────────────────────

function createReview(db, productId, userId, overrides = {}) {
  db.prepare(
    'INSERT INTO reviews (product_id,user_id,order_id,rating,title,comment,is_approved) VALUES (?,?,?,?,?,?,?)'
  ).run(
    productId, userId,
    overrides.order_id  || null,
    overrides.rating    || 4,
    overrides.title     || 'Good product',
    overrides.comment   || 'Really nice item.',
    overrides.is_approved !== undefined ? overrides.is_approved : 1
  );

  return db.prepare(
    'SELECT * FROM reviews WHERE product_id=? AND user_id=? ORDER BY id DESC LIMIT 1'
  ).get(productId, userId);
}

// ── Cart helper ─────────────────────────────────────────────────────────────

/**
 * Add a product to a user's cart directly via SQL (no model layer).
 */
function addToCart(db, userId, productId, quantity = 1) {
  const existing = db.prepare(
    'SELECT id FROM cart_items WHERE user_id=? AND product_id=?'
  ).get(userId, productId);

  if (existing) {
    db.prepare('UPDATE cart_items SET quantity=quantity+? WHERE id=?')
      .run(quantity, existing.id);
  } else {
    db.prepare(
      'INSERT INTO cart_items (user_id,product_id,quantity) VALUES (?,?,?)'
    ).run(userId, productId, quantity);
  }

  return db.prepare('SELECT * FROM cart_items WHERE user_id=? AND product_id=?')
           .get(userId, productId);
}

// ── Notification factory ────────────────────────────────────────────────────

function createNotification(db, userId, overrides = {}) {
  db.prepare(
    'INSERT INTO notifications (user_id,type,title,message,link) VALUES (?,?,?,?,?)'
  ).run(userId,
        overrides.type    || 'order',
        overrides.title   || 'Test Notification',
        overrides.message || 'Something happened.',
        overrides.link    || '/');

  return db.prepare(
    'SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 1'
  ).get(userId);
}

// ── Message factory ─────────────────────────────────────────────────────────

function createMessage(db, senderId, receiverId, overrides = {}) {
  db.prepare(
    'INSERT INTO messages (sender_id,receiver_id,subject,content) VALUES (?,?,?,?)'
  ).run(senderId, receiverId,
        overrides.subject || 'Test subject',
        overrides.content || 'Test message content.');

  return db.prepare(
    'SELECT * FROM messages WHERE sender_id=? AND receiver_id=? ORDER BY id DESC LIMIT 1'
  ).get(senderId, receiverId);
}

module.exports = {
  createCustomer,
  createArtisan,
  createAdmin,
  createCategory,
  createProduct,
  createOrder,
  createAuction,
  createCoupon,
  createReview,
  addToCart,
  createNotification,
  createMessage,
  hashPassword,
  unique,
};
