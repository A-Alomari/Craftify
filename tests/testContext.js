const request = require('supertest');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', `craftify.test.${process.pid}.db`);

let initialized = false;
let context = {
  app: null,
  db: null,
  ids: null
};

async function initializeTestContext() {
  if (initialized) {
    return context;
  }

  process.env.CRAFTIFY_DB_PATH = dbPath;
  try { fs.unlinkSync(dbPath); } catch (e) {}

  const { initDatabase, getDb } = require('../config/database');
  await initDatabase();
  const db = getDb();

  const bcrypt = require('bcryptjs');
  const hash = (pw) => bcrypt.hashSync(pw, 10);

  db.prepare('INSERT INTO categories (name,slug,description,image,is_active) VALUES (?,?,?,?,1)').run('Pottery','pottery','Test pottery','https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=400');
  db.prepare('INSERT INTO categories (name,slug,description,image,is_active) VALUES (?,?,?,?,1)').run('Jewelry','jewelry','Test jewelry','https://images.unsplash.com/photo-1515562141589-67f0d569b6c9?w=400');

  db.prepare('INSERT INTO users (name,email,password,role,status) VALUES (?,?,?,?,?)').run('Admin','admin@test.com',hash('admin123'),'admin','active');
  db.prepare('INSERT INTO users (name,email,password,role,status,shipping_address,city,country) VALUES (?,?,?,?,?,?,?,?)').run('Customer','customer@test.com',hash('cust123'),'customer','active','123 Main St','Manama','Bahrain');
  db.prepare('INSERT INTO users (name,email,password,role,status) VALUES (?,?,?,?,?)').run('Customer2','customer2@test.com',hash('cust123'),'customer','active');
  db.prepare('INSERT INTO users (name,email,password,role,status) VALUES (?,?,?,?,?)').run('Artisan','artisan@test.com',hash('art123'),'artisan','active');
  db.prepare('INSERT INTO users (name,email,password,role,status) VALUES (?,?,?,?,?)').run('Suspended','suspended@test.com',hash('susp123'),'customer','suspended');

  const adminId = db.prepare('SELECT id FROM users WHERE email=?').get('admin@test.com').id;
  const custId = db.prepare('SELECT id FROM users WHERE email=?').get('customer@test.com').id;
  const cust2Id = db.prepare('SELECT id FROM users WHERE email=?').get('customer2@test.com').id;
  const artId = db.prepare('SELECT id FROM users WHERE email=?').get('artisan@test.com').id;

  db.prepare('INSERT INTO artisan_profiles (user_id,shop_name,bio,location,is_approved) VALUES (?,?,?,?,1)').run(artId,'Test Shop','A test artisan bio','Manama');

  const potId = db.prepare('SELECT id FROM categories WHERE slug=?').get('pottery').id;
  const jewId = db.prepare('SELECT id FROM categories WHERE slug=?').get('jewelry').id;

  db.prepare('INSERT INTO products (artisan_id,category_id,name,description,price,stock,images,status,is_active,featured) VALUES (?,?,?,?,?,?,?,?,1,1)').run(artId,potId,'Test Vase','A beautiful test vase',45.00,10,'["https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=600"]','approved');
  db.prepare('INSERT INTO products (artisan_id,category_id,name,description,price,stock,images,status,is_active,featured) VALUES (?,?,?,?,?,?,?,?,1,0)').run(artId,jewId,'Test Ring','A test ring',85.00,5,'["https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600"]','approved');
  db.prepare('INSERT INTO products (artisan_id,category_id,name,description,price,stock,images,status,is_active,featured) VALUES (?,?,?,?,?,?,?,?,1,0)').run(artId,potId,'Out of Stock','No stock',30.00,0,'[]','approved');
  db.prepare('INSERT INTO products (artisan_id,category_id,name,description,price,stock,images,status,is_active,featured) VALUES (?,?,?,?,?,?,?,?,1,0)').run(artId,potId,'Pending Product','Pending',20.00,5,'[]','pending');

  const vaseId = db.prepare('SELECT id FROM products WHERE name=?').get('Test Vase').id;
  const ringId = db.prepare('SELECT id FROM products WHERE name=?').get('Test Ring').id;
  const outOfStockId = db.prepare('SELECT id FROM products WHERE name=?').get('Out of Stock').id;

  const o1 = db.prepare('INSERT INTO orders (user_id,subtotal,shipping_cost,discount_amount,total_amount,status,payment_method,payment_status,shipping_address,shipping_city,shipping_country) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(custId,45.00,0,0,45.00,'delivered','card','paid','123 Main St','Manama','Bahrain');
  db.prepare('INSERT INTO order_items (order_id,product_id,artisan_id,quantity,unit_price,total_price) VALUES (?,?,?,?,?,?)').run(o1.lastInsertRowid, vaseId, artId, 1, 45.00, 45.00);
  db.prepare('INSERT INTO shipments (order_id,tracking_number,carrier,status) VALUES (?,?,?,?)').run(o1.lastInsertRowid,'CRF00000001','Craftify Express','delivered');

  db.prepare('INSERT INTO reviews (product_id,user_id,order_id,rating,title,comment,is_approved) VALUES (?,?,?,?,?,?,1)').run(vaseId,custId,o1.lastInsertRowid,5,'Great','Loved it!');

  const now = new Date();
  db.prepare('INSERT INTO auctions (product_id,artisan_id,title,starting_price,current_highest_bid,bid_increment,start_time,end_time,status) VALUES (?,?,?,?,?,?,?,?,?)').run(vaseId,artId,'Test Auction',30.00,45.00,5.00,new Date(now-86400000).toISOString(),new Date(now.getTime()+172800000).toISOString(),'active');
  const aucId1 = db.prepare('SELECT id FROM auctions WHERE title = ?').get('Test Auction').id;
  db.prepare('INSERT INTO bids (auction_id,user_id,amount,is_winning) VALUES (?,?,?,?)').run(aucId1,custId,35.00,0);
  db.prepare('INSERT INTO bids (auction_id,user_id,amount,is_winning) VALUES (?,?,?,?)').run(aucId1,cust2Id,45.00,1);

  db.prepare('INSERT INTO auctions (product_id,artisan_id,title,starting_price,current_highest_bid,bid_increment,start_time,end_time,status,winner_id) VALUES (?,?,?,?,?,?,?,?,?,?)').run(ringId,artId,'Ended Auction',50.00,100.00,10.00,new Date(now-7*86400000).toISOString(),new Date(now-86400000).toISOString(),'sold',custId);

  db.prepare('INSERT INTO coupons (code,type,value,min_order,is_active,expires_at) VALUES (?,?,?,?,1,?)').run('TEST10','percent',10,20,new Date(now.getTime()+30*86400000).toISOString());

  db.prepare('INSERT INTO wishlist (user_id,product_id) VALUES (?,?)').run(custId,ringId);
  db.prepare('INSERT INTO notifications (user_id,type,title,message,link) VALUES (?,?,?,?,?)').run(custId,'order','Test','Delivered','/orders/1');
  db.prepare('INSERT INTO messages (sender_id,receiver_id,subject,content) VALUES (?,?,?,?)').run(custId,artId,'Hello','Custom order?');

  const ids = {
    adminId,
    custId,
    cust2Id,
    artId,
    vaseId,
    ringId,
    outOfStockId,
    orderId: o1.lastInsertRowid,
    auctionId: aucId1,
    potId,
    jewId
  };

  const appModule = require('../server');
  const app = appModule.app;

  context = { app, db, ids };
  initialized = true;

  return context;
}

function getTestContext() {
  if (!initialized) {
    throw new Error('Test context not initialized. Call initializeTestContext() first.');
  }
  return context;
}

async function loginAs(email, password) {
  const { app } = getTestContext();
  const agent = request.agent(app);
  await agent.post('/auth/login').send({ email, password }).expect(302);
  return agent;
}

function makeUnique(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function cleanupTestDb() {
  try { fs.unlinkSync(dbPath); } catch (e) {}
}

module.exports = {
  initializeTestContext,
  getTestContext,
  loginAs,
  makeUnique,
  cleanupTestDb
};
