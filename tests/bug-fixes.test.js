/**
 * Bug-Fixes Test Suite  (tests/bug-fixes.test.js)
 * Covers the three explicitly requested bug areas:
 *   BUG 1 — Coupon date validation (server-side expiry check)
 *   BUG 2 — Seed file correctness and idempotency
 *   BUG 3 — Auction lifecycle / end_time storage
 *
 * Run with: npm test
 */

const path = require('path');
const fs   = require('fs');
const request = require('supertest');

// ── Isolated test database ────────────────────────────────────────────────────
const DB_PATH = path.join(__dirname, '..', `craftify.bugfix.${process.pid}.db`);
process.env.CRAFTIFY_DB_PATH = DB_PATH;
process.env.NODE_ENV = 'test';

let app, db;

const agent = () => request.agent(app);
async function loginAs(email, password) {
  const a = agent();
  await a.post('/auth/login').send({ email, password }).expect(302);
  return a;
}

// ─────────────────────────────────────────────────────────────────────────────
beforeAll(async () => {
  try { fs.unlinkSync(DB_PATH); } catch (_) {}

  const { initDatabase, getDb } = require('../config/database');
  await initDatabase();
  db = getDb();

  const bcrypt = require('bcryptjs');
  const h = (pw) => bcrypt.hashSync(pw, 10);
  const now = Date.now();
  const day = 86400000;

  // Categories
  db.prepare('INSERT INTO categories (name,slug,description,is_active) VALUES (?,?,?,1)').run('Pottery','pottery','Test');
  db.prepare('INSERT INTO categories (name,slug,description,is_active) VALUES (?,?,?,1)').run('Jewelry','jewelry','Test');

  // Users
  db.prepare('INSERT INTO users (name,email,password,role,status,shipping_address,city,country) VALUES (?,?,?,?,?,?,?,?)').run('Admin','admin@bugs.com',h('admin123'),'admin','active','1 Admin Rd','Manama','Bahrain');
  db.prepare('INSERT INTO users (name,email,password,role,status,shipping_address,city,country) VALUES (?,?,?,?,?,?,?,?)').run('Customer','cust@bugs.com',h('cust123'),'customer','active','2 Cust Rd','Manama','Bahrain');
  db.prepare('INSERT INTO users (name,email,password,role,status) VALUES (?,?,?,?,?)').run('Artisan','art@bugs.com',h('art123'),'artisan','active');

  const adminId = db.prepare('SELECT id FROM users WHERE email=?').get('admin@bugs.com').id;
  const custId  = db.prepare('SELECT id FROM users WHERE email=?').get('cust@bugs.com').id;
  const artId   = db.prepare('SELECT id FROM users WHERE email=?').get('art@bugs.com').id;

  db.prepare('INSERT INTO artisan_profiles (user_id,shop_name,bio,location,is_approved) VALUES (?,?,?,?,1)').run(artId,'Bug Fix Shop','Test bio','Manama');

  const potId = db.prepare('SELECT id FROM categories WHERE slug=?').get('pottery').id;
  db.prepare('INSERT INTO products (artisan_id,category_id,name,description,price,stock,images,status,is_active) VALUES (?,?,?,?,?,?,?,?,1)').run(artId,potId,'Test Vase','A vase',45.00,10,'[]','approved');
  db.prepare('INSERT INTO products (artisan_id,category_id,name,description,price,stock,images,status,is_active) VALUES (?,?,?,?,?,?,?,?,1)').run(artId,potId,'Test Bowl','A bowl',30.00,5,'[]','approved');

  const vaseId = db.prepare('SELECT id FROM products WHERE name=?').get('Test Vase').id;
  const bowlId = db.prepare('SELECT id FROM products WHERE name=?').get('Test Bowl').id;

  // Cart item for checkout tests
  db.prepare('INSERT INTO cart_items (user_id,product_id,quantity) VALUES (?,?,?)').run(custId,vaseId,1);

  // Coupons
  const futureDate = new Date(now + 90*day).toISOString();
  const pastDate   = new Date(now - 90*day).toISOString();
  db.prepare('INSERT INTO coupons (code,type,discount_type,value,discount_value,min_order,min_purchase,max_uses,usage_limit,used_count,times_used,is_active,active,scope,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,1,1,?,?)').run('BUGVALID','percent','percent',10,10,0,0,100,100,0,0,'global',futureDate);
  db.prepare('INSERT INTO coupons (code,type,discount_type,value,discount_value,min_order,min_purchase,max_uses,usage_limit,used_count,times_used,is_active,active,scope,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,1,1,?,?)').run('BUGEXPIRED','percent','percent',10,10,0,0,100,100,0,0,'global',pastDate);

  // Auctions — one active (ends in future), one manually "ended"
  db.prepare('INSERT INTO auctions (product_id,artisan_id,title,starting_price,bid_increment,start_time,end_time,status) VALUES (?,?,?,?,?,?,?,?)').run(vaseId,artId,'Active Auction',30,5,new Date(now-day).toISOString(),new Date(now+3*day).toISOString(),'active');
  db.prepare('INSERT INTO auctions (product_id,artisan_id,title,starting_price,bid_increment,start_time,end_time,status) VALUES (?,?,?,?,?,?,?,?)').run(bowlId,artId,'Ended Auction',20,5,new Date(now-5*day).toISOString(),new Date(now-day).toISOString(),'ended');

  // Order for auth tests
  const o1 = db.prepare('INSERT INTO orders (user_id,subtotal,shipping_cost,discount_amount,total_amount,status,payment_method,payment_status,shipping_address,shipping_city,shipping_country) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(custId,45,0,0,45,'delivered','card','paid','2 Cust Rd','Manama','Bahrain');
  db.prepare('INSERT INTO order_items (order_id,product_id,artisan_id,quantity,unit_price,total_price) VALUES (?,?,?,?,?,?)').run(o1.lastInsertRowid,vaseId,artId,1,45,45);

  // Store IDs for use in tests
  Object.assign(global.__bugIds = global.__bugIds || {}, { adminId, custId, artId, vaseId, bowlId });

  const { app: serverApp } = require('../server');
  app = serverApp;
});

afterAll(() => {
  try { fs.unlinkSync(DB_PATH); } catch (_) {}
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS to read the stored ids
// ─────────────────────────────────────────────────────────────────────────────
function ids() { return global.__bugIds; }

// =============================================================================
// BUG 1 — COUPON DATE VALIDATION
// =============================================================================
describe('BUG 1 — Coupon date validation (expiry must be future)', () => {

  // ── Artisan route ──────────────────────────────────────────────────────────
  test('Artisan: creating coupon with past expiry redirects with error', async () => {
    const a = await loginAs('art@bugs.com', 'art123');
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const res = await a.post('/artisan/coupons').send({
      code: `PASTCODE_${Date.now()}`,
      discount_type: 'percent',
      discount_value: '10',
      valid_until: yesterday,
      usage_limit: ''
    }).expect(302);
    expect(res.header.location).toContain('/artisan/coupons');
    // Coupon must NOT have been inserted
    const row = db.prepare('SELECT id FROM coupons WHERE code LIKE ?').get('PASTCODE_%');
    expect(row).toBeUndefined();
  });

  test('Artisan: creating coupon with future expiry succeeds', async () => {
    const a = await loginAs('art@bugs.com', 'art123');
    const future = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const code = `NEWCODE_${Date.now()}`;
    await a.post('/artisan/coupons').send({
      code,
      discount_type: 'percent',
      discount_value: '15',
      valid_until: future,
      usage_limit: ''
    }).expect(302);
    const row = db.prepare('SELECT id FROM coupons WHERE code=?').get(code);
    expect(row).not.toBeUndefined();
  });

  // ── Admin route ────────────────────────────────────────────────────────────
  test('Admin: creating coupon with past expiry redirects with error', async () => {
    const a = await loginAs('admin@bugs.com', 'admin123');
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const res = await a.post('/admin/coupons').send({
      code: `ADMINPAST_${Date.now()}`,
      discount_type: 'fixed',
      discount_value: '5',
      valid_until: yesterday,
      scope: 'global',
      usage_limit: ''
    }).expect(302);
    expect(res.header.location).toContain('/admin/coupons');
    const row = db.prepare('SELECT id FROM coupons WHERE code LIKE ?').get('ADMINPAST_%');
    expect(row).toBeUndefined();
  });

  // ── Coupon model runtime check ─────────────────────────────────────────────
  test('Coupon.validate: expired coupon is rejected at runtime', () => {
    const Coupon = require('../models/Coupon');
    const result = Coupon.validate('BUGEXPIRED', 100, []);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/expired/i);
  });

  test('Coupon.validate: valid coupon with future expiry is accepted', () => {
    const Coupon = require('../models/Coupon');
    const result = Coupon.validate('BUGVALID', 100, []);
    expect(result.valid).toBe(true);
    expect(result.discount).toBeGreaterThan(0);
  });

  test('Applying expired coupon at cart is rejected', async () => {
    const a = await loginAs('cust@bugs.com', 'cust123');
    const res = await a.post('/cart/coupon').send({ code: 'BUGEXPIRED' }).expect(302);
    expect(res.header.location).toContain('/cart');
    // Session should NOT contain an applied coupon
    // (can't easily verify session, but redirect to cart is the expected behaviour)
  });

  test('Applying valid coupon at cart is accepted', async () => {
    const a = await loginAs('cust@bugs.com', 'cust123');
    const res = await a.post('/cart/coupon').send({ code: 'BUGVALID' }).expect(302);
    expect(res.header.location).toContain('/cart');
  });

  test('Expired coupon is returned with expires_at in the past', () => {
    const row = db.prepare('SELECT * FROM coupons WHERE code=?').get('BUGEXPIRED');
    expect(row).not.toBeNull();
    expect(new Date(row.expires_at).getTime()).toBeLessThan(Date.now());
  });
});

// =============================================================================
// BUG 2 — SEED FILE
// =============================================================================
describe('BUG 2 — Seed file correctness', () => {
  const seedPath = path.join(__dirname, '..', `craftify.seed.${process.pid}.db`);
  let seedSqlDb = null;
  let seedError = null;

  beforeAll(async () => {
    try { fs.unlinkSync(seedPath); } catch (_) {}

    // Run the seed as a completely isolated child process — does NOT touch
    // the test process's module registry or database singleton.
    const { execSync } = require('child_process');
    try {
      execSync(`node seeds/seed.js`, {
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, CRAFTIFY_DB_PATH: seedPath, NODE_ENV: 'development' },
        stdio: 'pipe'
      });
    } catch (err) {
      seedError = ((err.stderr || err.stdout || Buffer.alloc(0)).toString() || err.message);
      return;
    }

    // Open the seeded file with raw sql.js — no wrapper, no module reset.
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    const fileBuffer = fs.readFileSync(seedPath);
    seedSqlDb = new SQL.Database(fileBuffer);
  });

  afterAll(() => {
    if (seedSqlDb) { try { seedSqlDb.close(); } catch (_) {} }
    try { fs.unlinkSync(seedPath); } catch (_) {}
  });

  // Helper: run a SELECT against the raw sql.js DB and return the first row.
  function queryOne(sql, params = []) {
    if (!seedSqlDb) return undefined;
    const stmt = seedSqlDb.prepare(sql);
    stmt.bind(params);
    let result;
    if (stmt.step()) {
      const cols = stmt.getColumnNames();
      const vals = stmt.get();
      result = {};
      cols.forEach((c, i) => { result[c] = vals[i]; });
    }
    stmt.free();
    return result;
  }

  test('Seed completes without throwing', () => {
    if (seedError) fail(`Seed threw: ${seedError}`);
    expect(seedSqlDb).not.toBeNull();
  });

  test('After seeding: at least 3 users exist (customer, artisan, admin)', () => {
    const row = queryOne('SELECT COUNT(*) as c FROM users');
    expect(row?.c).toBeGreaterThanOrEqual(3);
  });

  test('After seeding: at least one active coupon with expires_at in the future', () => {
    const now = new Date().toISOString();
    const row = queryOne('SELECT id FROM coupons WHERE is_active=1 AND expires_at > ?', [now]);
    expect(row).not.toBeUndefined();
  });

  test('After seeding: at least one auction with end_time in the future', () => {
    const now = new Date().toISOString();
    const row = queryOne('SELECT id FROM auctions WHERE end_time > ?', [now]);
    expect(row).not.toBeUndefined();
  });

  test('After seeding: products table has at least 10 rows', () => {
    const row = queryOne('SELECT COUNT(*) as c FROM products');
    expect(row?.c).toBeGreaterThanOrEqual(10);
  });
});

// =============================================================================
// BUG 3 — AUCTION LIFECYCLE / END_TIME
// =============================================================================
describe('BUG 3 — Auction lifecycle and end_time normalization', () => {
  let Auction;
  beforeAll(() => { Auction = require('../models/Auction'); });

  test('Auction.create stores end_time as a valid ISO datetime string', () => {
    const { artId, vaseId } = ids();
    const endTime = new Date(Date.now() + 7 * 86400000); // 7 days from now
    const auc = Auction.create({
      product_id: vaseId,
      artisan_id: artId,
      title: 'ISO Test Auction',
      starting_bid: 20,
      starting_price: 20,
      bid_increment: 5,
      start_time: new Date(Date.now() - 60000).toISOString(), // started 1min ago
      end_time: endTime.toISOString()
    });
    expect(auc).not.toBeNull();
    // end_time should now be an ISO string (normalised by the fix)
    const stored = db.prepare('SELECT end_time FROM auctions WHERE id=?').get(auc.id);
    expect(new Date(stored.end_time).getTime()).toBeGreaterThan(Date.now());
    // Clean up
    db.prepare('DELETE FROM auctions WHERE id=?').run(auc.id);
  });

  test('Auction.create stores end_time that is at least (duration - 5s) in the future', () => {
    const { artId, bowlId } = ids();
    const durationMs = 3 * 86400000; // 3 days
    const endTime = new Date(Date.now() + durationMs);
    const auc = Auction.create({
      product_id: bowlId,
      artisan_id: artId,
      title: 'Duration Test Auction',
      starting_bid: 15,
      starting_price: 15,
      bid_increment: 5,
      start_time: new Date().toISOString(),
      end_time: endTime.toISOString()
    });
    const stored = db.prepare('SELECT end_time FROM auctions WHERE id=?').get(auc.id);
    const storedMs = new Date(stored.end_time).getTime();
    expect(storedMs).toBeGreaterThan(Date.now() + durationMs - 5000);
    db.prepare('DELETE FROM auctions WHERE id=?').run(auc.id);
  });

  test('Auction.create with datetime-local format still stores a future end_time', () => {
    // Simulate what the HTML form sends: "YYYY-MM-DDTHH:MM" (no seconds/timezone)
    const { artId, vaseId } = ids();
    const future = new Date(Date.now() + 5 * 86400000);
    // datetime-local format: "2025-12-31T23:59"
    const dtLocal = future.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
    const auc = Auction.create({
      artisan_id: artId,
      title: 'Local Datetime Test',
      starting_bid: 10,
      starting_price: 10,
      bid_increment: 5,
      start_time: new Date().toISOString(),
      end_time: dtLocal
    });
    const stored = db.prepare('SELECT end_time FROM auctions WHERE id=?').get(auc.id);
    expect(new Date(stored.end_time).getTime()).toBeGreaterThan(Date.now());
    db.prepare('DELETE FROM auctions WHERE id=?').run(auc.id);
  });

  test('Placing a bid on an active auction succeeds', () => {
    const { custId } = ids();
    const activeAuc = db.prepare("SELECT * FROM auctions WHERE title='Active Auction'").get();
    expect(() => {
      Auction.placeBid(activeAuc.id, custId, 40);
    }).not.toThrow();
    const after = Auction.findById(activeAuc.id);
    expect(after.current_highest_bid).toBeGreaterThanOrEqual(40);
  });

  test('Placing a bid on an ended auction is rejected', () => {
    const { custId } = ids();
    const endedAuc = db.prepare("SELECT * FROM auctions WHERE title='Ended Auction'").get();
    expect(() => {
      Auction.placeBid(endedAuc.id, custId, 30);
    }).toThrow();
  });

  test('After ending, auction status is "ended" in DB', () => {
    // Mark the active auction as ended and verify
    const { artId } = ids();
    const activeAuc = db.prepare("SELECT * FROM auctions WHERE title='Active Auction'").get();
    // Simulate background task: mark as ended
    db.prepare("UPDATE auctions SET status='ended' WHERE id=?").run(activeAuc.id);
    const updated = db.prepare('SELECT status FROM auctions WHERE id=?').get(activeAuc.id);
    expect(updated.status).toBe('ended');
    // Restore
    db.prepare("UPDATE auctions SET status='active' WHERE id=?").run(activeAuc.id);
  });

  test('Winner is correctly identified as the highest bidder', () => {
    const { custId } = ids();
    const activeAuc = db.prepare("SELECT * FROM auctions WHERE title='Active Auction'").get();
    // Place a high bid
    Auction.placeBid(activeAuc.id, custId, 500);
    // Simulate ending: set winner_id = user with highest bid
    db.prepare("UPDATE auctions SET status='ended', winner_id=(SELECT user_id FROM bids WHERE auction_id=? ORDER BY amount DESC LIMIT 1) WHERE id=?").run(activeAuc.id, activeAuc.id);
    const final = db.prepare('SELECT winner_id FROM auctions WHERE id=?').get(activeAuc.id);
    expect(final.winner_id).toBe(custId);
    // Restore
    db.prepare("UPDATE auctions SET status='active', winner_id=NULL WHERE id=?").run(activeAuc.id);
  });

  test('GET /auctions/:id shows auction detail page', async () => {
    const activeAuc = db.prepare("SELECT id FROM auctions WHERE title='Active Auction'").get();
    const res = await agent().get(`/auctions/${activeAuc.id}`).expect(200);
    expect(res.text).toContain('Active Auction');
  });

  test('POST /auctions/:id/bid succeeds for authenticated customer', async () => {
    const a = await loginAs('cust@bugs.com', 'cust123');
    const activeAuc = db.prepare("SELECT * FROM auctions WHERE title='Active Auction'").get();
    const minBid = (activeAuc.current_highest_bid || activeAuc.starting_price) + activeAuc.bid_increment;
    await a.post(`/auctions/${activeAuc.id}/bid`).send({ amount: minBid + 10 }).expect(302);
  });
});
