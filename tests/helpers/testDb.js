/**
 * tests/helpers/testDb.js
 *
 * Creates an isolated, per-process SQLite database for each test file.
 * Every file that imports this module gets its own DB file so suites
 * running in parallel via Jest workers never share state.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// ── Unique DB path per worker ────────────────────────────────────────────────
function buildDbPath() {
  return path.join(
    __dirname, '..', '..',
    `craftify.test.${process.pid}.${Date.now()}.db`
  );
}

/**
 * Initialise a fresh database.
 * Sets CRAFTIFY_DB_PATH so that every require('../config/database') in the
 * same process sees the test DB.
 *
 * @returns {{ db: import('sql.js').Database, dbPath: string }}
 */
async function createTestDb() {
  const dbPath = buildDbPath();
  process.env.CRAFTIFY_DB_PATH = dbPath;
  process.env.NODE_ENV = 'test';

  // Wipe any leftover file from a previous aborted run.
  try { fs.unlinkSync(dbPath); } catch (_) {}

  // Re-initialise (handles first call AND subsequent calls in the same
  // process via the module-level singleton in database.js).
  const { initDatabase, getDb } = require('../../config/database');
  await initDatabase();
  const db = getDb();

  return { db, dbPath };
}

/**
 * Remove the test DB file from disk.
 * Safe to call even if the file no longer exists.
 */
function destroyTestDb() {
  const dbPath = process.env.CRAFTIFY_DB_PATH;
  if (dbPath) {
    try { fs.unlinkSync(dbPath); } catch (_) {}
  }
}

// ── Seed helpers ─────────────────────────────────────────────────────────────

const HASH = (pw) => bcrypt.hashSync(pw, 4); // cost-4 is fast for tests

/**
 * Seed a minimal, consistent dataset into `db`.
 * Returns an object with all seeded IDs so tests can reference them
 * without running their own SELECT queries.
 *
 * @param {import('sql.js').Database} db
 * @returns {object} ids
 */
function seedTestData(db) {
  // ── Categories ──────────────────────────────────────────────────────────
  db.prepare(
    'INSERT INTO categories (name,slug,description,image,is_active) VALUES (?,?,?,?,1)'
  ).run('Pottery', 'pottery', 'Handmade pottery', 'https://example.com/pottery.jpg');

  db.prepare(
    'INSERT INTO categories (name,slug,description,image,is_active) VALUES (?,?,?,?,1)'
  ).run('Jewelry', 'jewelry', 'Handmade jewelry', 'https://example.com/jewelry.jpg');

  const potId = db.prepare("SELECT id FROM categories WHERE slug='pottery'").get().id;
  const jewId = db.prepare("SELECT id FROM categories WHERE slug='jewelry'").get().id;

  // ── Users ────────────────────────────────────────────────────────────────
  db.prepare(
    'INSERT INTO users (name,email,password,role,status) VALUES (?,?,?,?,?)'
  ).run('Admin User',    'admin@test.com',     HASH('admin123'),  'admin',    'active');

  db.prepare(
    'INSERT INTO users (name,email,password,role,status,shipping_address,city,country) VALUES (?,?,?,?,?,?,?,?)'
  ).run('Customer One',  'customer@test.com',  HASH('cust123'),   'customer', 'active',
        '123 Main St', 'Manama', 'Bahrain');

  db.prepare(
    'INSERT INTO users (name,email,password,role,status) VALUES (?,?,?,?,?)'
  ).run('Customer Two',  'customer2@test.com', HASH('cust123'),   'customer', 'active');

  db.prepare(
    'INSERT INTO users (name,email,password,role,status) VALUES (?,?,?,?,?)'
  ).run('Artisan User',  'artisan@test.com',   HASH('art123'),    'artisan',  'active');

  db.prepare(
    'INSERT INTO users (name,email,password,role,status) VALUES (?,?,?,?,?)'
  ).run('Suspended',     'suspended@test.com', HASH('susp123'),   'customer', 'suspended');

  const adminId  = db.prepare("SELECT id FROM users WHERE email='admin@test.com'").get().id;
  const custId   = db.prepare("SELECT id FROM users WHERE email='customer@test.com'").get().id;
  const cust2Id  = db.prepare("SELECT id FROM users WHERE email='customer2@test.com'").get().id;
  const artId    = db.prepare("SELECT id FROM users WHERE email='artisan@test.com'").get().id;
  const suspId   = db.prepare("SELECT id FROM users WHERE email='suspended@test.com'").get().id;

  // ── Artisan profile ──────────────────────────────────────────────────────
  db.prepare(
    'INSERT INTO artisan_profiles (user_id,shop_name,bio,location,is_approved) VALUES (?,?,?,?,1)'
  ).run(artId, 'Test Shop', 'We make fine things', 'Manama');

  const profileId = db.prepare('SELECT id FROM artisan_profiles WHERE user_id=?').get(artId).id;

  // ── Products ─────────────────────────────────────────────────────────────
  db.prepare(
    'INSERT INTO products (artisan_id,category_id,name,description,price,stock,images,status,is_active,featured) VALUES (?,?,?,?,?,?,?,?,1,1)'
  ).run(artId, potId, 'Test Vase',    'A beautiful vase',  45.00, 10, '["https://example.com/vase.jpg"]',  'approved');

  db.prepare(
    'INSERT INTO products (artisan_id,category_id,name,description,price,stock,images,status,is_active,featured) VALUES (?,?,?,?,?,?,?,?,1,0)'
  ).run(artId, jewId, 'Test Ring',    'A lovely ring',     85.00,  5, '["https://example.com/ring.jpg"]',  'approved');

  db.prepare(
    'INSERT INTO products (artisan_id,category_id,name,description,price,stock,images,status,is_active,featured) VALUES (?,?,?,?,?,?,?,?,1,0)'
  ).run(artId, potId, 'Out of Stock', 'No inventory',      30.00,  0, '[]',                                'approved');

  db.prepare(
    'INSERT INTO products (artisan_id,category_id,name,description,price,stock,images,status,is_active,featured) VALUES (?,?,?,?,?,?,?,?,1,0)'
  ).run(artId, potId, 'Pending Prod', 'Awaiting approval', 20.00,  5, '[]',                                'pending');

  const vaseId       = db.prepare("SELECT id FROM products WHERE name='Test Vase'").get().id;
  const ringId       = db.prepare("SELECT id FROM products WHERE name='Test Ring'").get().id;
  const outOfStockId = db.prepare("SELECT id FROM products WHERE name='Out of Stock'").get().id;
  const pendingProdId = db.prepare("SELECT id FROM products WHERE name='Pending Prod'").get().id;

  // ── Delivered order ───────────────────────────────────────────────────────
  const o1 = db.prepare(
    'INSERT INTO orders (user_id,subtotal,shipping_cost,discount_amount,total_amount,status,payment_method,payment_status,shipping_address,shipping_city,shipping_country) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
  ).run(custId, 45.00, 0, 0, 45.00, 'delivered', 'card', 'paid', '123 Main St', 'Manama', 'Bahrain');
  const orderId = o1.lastInsertRowid;

  db.prepare(
    'INSERT INTO order_items (order_id,product_id,artisan_id,quantity,unit_price,total_price) VALUES (?,?,?,?,?,?)'
  ).run(orderId, vaseId, artId, 1, 45.00, 45.00);

  db.prepare(
    'INSERT INTO shipments (order_id,tracking_number,carrier,status) VALUES (?,?,?,?)'
  ).run(orderId, 'CRF00000001', 'Craftify Express', 'delivered');

  // ── Pending order ────────────────────────────────────────────────────────
  const o2 = db.prepare(
    'INSERT INTO orders (user_id,subtotal,shipping_cost,discount_amount,total_amount,status,payment_method,payment_status,shipping_address,shipping_city,shipping_country) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
  ).run(custId, 85.00, 5, 0, 90.00, 'pending', 'card', 'paid', '123 Main St', 'Manama', 'Bahrain');
  const order2Id = o2.lastInsertRowid;

  db.prepare(
    'INSERT INTO order_items (order_id,product_id,artisan_id,quantity,unit_price,total_price) VALUES (?,?,?,?,?,?)'
  ).run(order2Id, ringId, artId, 1, 85.00, 85.00);

  db.prepare(
    'INSERT INTO shipments (order_id,tracking_number,carrier,status) VALUES (?,?,?,?)'
  ).run(order2Id, 'CRF00000002', 'Craftify Express', 'processing');

  // ── Review ───────────────────────────────────────────────────────────────
  db.prepare(
    'INSERT INTO reviews (product_id,user_id,order_id,rating,title,comment,is_approved) VALUES (?,?,?,?,?,?,1)'
  ).run(vaseId, custId, orderId, 5, 'Great!', 'Loved the vase.');

  // ── Active auction ────────────────────────────────────────────────────────
  const now = new Date();
  const auc = db.prepare(
    'INSERT INTO auctions (product_id,artisan_id,title,starting_price,current_highest_bid,bid_increment,start_time,end_time,status) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(
    vaseId, artId, 'Test Auction', 30.00, 45.00, 5.00,
    new Date(now - 86400000).toISOString(),
    new Date(now.getTime() + 172800000).toISOString(),
    'active'
  );
  const auctionId = auc.lastInsertRowid;

  db.prepare('INSERT INTO bids (auction_id,user_id,amount,is_winning) VALUES (?,?,?,?)').run(auctionId, custId,  35.00, 0);
  db.prepare('INSERT INTO bids (auction_id,user_id,amount,is_winning) VALUES (?,?,?,?)').run(auctionId, cust2Id, 45.00, 1);

  // ── Ended (sold) auction ─────────────────────────────────────────────────
  db.prepare(
    'INSERT INTO auctions (product_id,artisan_id,title,starting_price,current_highest_bid,bid_increment,start_time,end_time,status,winner_id) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(
    ringId, artId, 'Ended Auction', 50.00, 100.00, 10.00,
    new Date(now - 7 * 86400000).toISOString(),
    new Date(now - 86400000).toISOString(),
    'sold', custId
  );

  // ── Coupons ───────────────────────────────────────────────────────────────
  db.prepare(
    'INSERT INTO coupons (code,type,value,min_order,is_active,expires_at) VALUES (?,?,?,?,1,?)'
  ).run('TEST10', 'percent', 10, 20, new Date(now.getTime() + 30 * 86400000).toISOString());

  db.prepare(
    'INSERT INTO coupons (code,type,value,min_order,is_active,expires_at) VALUES (?,?,?,?,1,?)'
  ).run('EXPIRED', 'percent', 10, 20, new Date(now - 86400000).toISOString());

  db.prepare(
    'INSERT INTO coupons (code,type,value,min_order,is_active,expires_at) VALUES (?,?,?,?,1,?)'
  ).run('FLAT5', 'fixed', 5, 0, new Date(now.getTime() + 30 * 86400000).toISOString());

  // ── Wishlist ──────────────────────────────────────────────────────────────
  db.prepare('INSERT INTO wishlist (user_id,product_id) VALUES (?,?)').run(custId, ringId);

  // ── Notification ─────────────────────────────────────────────────────────
  db.prepare(
    'INSERT INTO notifications (user_id,type,title,message,link) VALUES (?,?,?,?,?)'
  ).run(custId, 'order', 'Order Delivered', 'Your order has been delivered.', `/orders/${orderId}`);

  // ── Message ───────────────────────────────────────────────────────────────
  db.prepare(
    'INSERT INTO messages (sender_id,receiver_id,subject,content) VALUES (?,?,?,?)'
  ).run(custId, artId, 'Hello', 'Do you take custom orders?');

  return {
    adminId, custId, cust2Id, artId, suspId,
    potId, jewId,
    profileId,
    vaseId, ringId, outOfStockId, pendingProdId,
    orderId, order2Id,
    auctionId
  };
}

module.exports = { createTestDb, destroyTestDb, seedTestData };
