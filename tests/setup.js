// Test setup helper - initializes a fresh test database
const { initDatabase, getDb } = require('../config/database');
const bcrypt = require('bcryptjs');

let db;

async function setupTestDb() {
  // Delete existing db file for clean tests
  const fs = require('fs');
  const path = require('path');
  const dbPath = path.join(__dirname, '..', `craftify.test.${process.pid}.db`);
  process.env.CRAFTIFY_DB_PATH = dbPath;
  try { fs.unlinkSync(dbPath); } catch(e) {}
  
  await initDatabase();
  db = getDb();
  return db;
}

function seedTestData() {
  const hash = (pw) => bcrypt.hashSync(pw, 10);
  
  // Categories
  db.prepare('INSERT INTO categories (name,slug,description,image,is_active) VALUES (?,?,?,?,1)').run('Pottery','pottery','Test pottery','https://example.com/pottery.jpg');
  db.prepare('INSERT INTO categories (name,slug,description,image,is_active) VALUES (?,?,?,?,1)').run('Jewelry','jewelry','Test jewelry','https://example.com/jewelry.jpg');
  db.prepare('INSERT INTO categories (name,slug,description,image,is_active) VALUES (?,?,?,?,1)').run('Woodwork','woodwork','Test woodwork','https://example.com/woodwork.jpg');

  // Users
  db.prepare('INSERT INTO users (name,email,password,role,status) VALUES (?,?,?,?,?)').run('Admin','admin@test.com',hash('admin123'),'admin','active');
  db.prepare('INSERT INTO users (name,email,password,role,status,shipping_address,city,country) VALUES (?,?,?,?,?,?,?,?)').run('Customer','customer@test.com',hash('cust123'),'customer','active','123 Main St','Manama','Bahrain');
  db.prepare('INSERT INTO users (name,email,password,role,status) VALUES (?,?,?,?,?)').run('Customer2','customer2@test.com',hash('cust123'),'customer','active');
  db.prepare('INSERT INTO users (name,email,password,role,status) VALUES (?,?,?,?,?)').run('Artisan','artisan@test.com',hash('art123'),'artisan','active');
  db.prepare('INSERT INTO users (name,email,password,role,status) VALUES (?,?,?,?,?)').run('Suspended','suspended@test.com',hash('susp123'),'customer','suspended');

  const adminId = db.prepare('SELECT id FROM users WHERE email=?').get('admin@test.com').id;
  const custId = db.prepare('SELECT id FROM users WHERE email=?').get('customer@test.com').id;
  const cust2Id = db.prepare('SELECT id FROM users WHERE email=?').get('customer2@test.com').id;
  const artId = db.prepare('SELECT id FROM users WHERE email=?').get('artisan@test.com').id;
  
  // Artisan profile
  db.prepare('INSERT INTO artisan_profiles (user_id,shop_name,bio,location,is_approved) VALUES (?,?,?,?,1)').run(artId,'Test Shop','Test bio','Manama');

  const potId = db.prepare('SELECT id FROM categories WHERE slug=?').get('pottery').id;
  const jewId = db.prepare('SELECT id FROM categories WHERE slug=?').get('jewelry').id;

  // Products
  db.prepare('INSERT INTO products (artisan_id,category_id,name,description,price,stock,images,status,is_active,featured) VALUES (?,?,?,?,?,?,?,?,1,1)').run(artId,potId,'Test Vase','A beautiful test vase',45.00,10,'["https://example.com/vase.jpg"]','approved',);
  db.prepare('INSERT INTO products (artisan_id,category_id,name,description,price,stock,images,status,is_active,featured) VALUES (?,?,?,?,?,?,?,?,1,0)').run(artId,jewId,'Test Ring','A test ring',85.00,5,'["https://example.com/ring.jpg"]','approved');
  db.prepare('INSERT INTO products (artisan_id,category_id,name,description,price,stock,images,status,is_active,featured) VALUES (?,?,?,?,?,?,?,?,1,0)').run(artId,potId,'Out of Stock Item','No stock',30.00,0,'[]','approved');
  db.prepare('INSERT INTO products (artisan_id,category_id,name,description,price,stock,images,status,is_active,featured) VALUES (?,?,?,?,?,?,?,?,1,0)').run(artId,potId,'Pending Product','Awaiting approval',20.00,5,'[]','pending');

  const vaseId = db.prepare('SELECT id FROM products WHERE name=?').get('Test Vase').id;
  const ringId = db.prepare('SELECT id FROM products WHERE name=?').get('Test Ring').id;

  // An order (delivered)
  const o1 = db.prepare('INSERT INTO orders (user_id,subtotal,shipping_cost,discount_amount,total_amount,status,payment_method,payment_status,shipping_address,shipping_city,shipping_country) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(custId,45.00,0,0,45.00,'delivered','card','paid','123 Main St','Manama','Bahrain');
  db.prepare('INSERT INTO order_items (order_id,product_id,artisan_id,quantity,unit_price,total_price) VALUES (?,?,?,?,?,?)').run(o1.lastInsertRowid, vaseId, artId, 1, 45.00, 45.00);
  db.prepare('INSERT INTO shipments (order_id,tracking_number,carrier,status) VALUES (?,?,?,?)').run(o1.lastInsertRowid,'CRFTEST001','Craftify Express','delivered');

  // Another order (pending)
  const o2 = db.prepare('INSERT INTO orders (user_id,subtotal,shipping_cost,discount_amount,total_amount,status,payment_method,payment_status,shipping_address,shipping_city,shipping_country) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(custId,85.00,5,0,90.00,'pending','card','paid','123 Main St','Manama','Bahrain');
  db.prepare('INSERT INTO order_items (order_id,product_id,artisan_id,quantity,unit_price,total_price) VALUES (?,?,?,?,?,?)').run(o2.lastInsertRowid, ringId, artId, 1, 85.00, 85.00);
  db.prepare('INSERT INTO shipments (order_id,tracking_number,carrier,status) VALUES (?,?,?,?)').run(o2.lastInsertRowid,'CRFTEST002','Craftify Express','processing');

  // Reviews
  db.prepare('INSERT INTO reviews (product_id,user_id,order_id,rating,title,comment,is_approved) VALUES (?,?,?,?,?,?,1)').run(vaseId,custId,o1.lastInsertRowid,5,'Great product','Loved this vase!');
  db.prepare('INSERT INTO reviews (product_id,user_id,rating,title,comment,is_approved) VALUES (?,?,?,?,?,1)').run(ringId,cust2Id,4,'Nice ring','Beautiful ring');

  // Auction (active)
  const now = new Date();
  const auc = db.prepare('INSERT INTO auctions (product_id,artisan_id,title,starting_price,current_highest_bid,bid_increment,start_time,end_time,status) VALUES (?,?,?,?,?,?,?,?,?)').run(vaseId,artId,'Test Auction',30.00,45.00,5.00,new Date(now-86400000).toISOString(),new Date(now.getTime()+172800000).toISOString(),'active');
  db.prepare('INSERT INTO bids (auction_id,user_id,amount,is_winning) VALUES (?,?,?,?)').run(auc.lastInsertRowid,custId,35.00,0);
  db.prepare('INSERT INTO bids (auction_id,user_id,amount,is_winning) VALUES (?,?,?,?)').run(auc.lastInsertRowid,cust2Id,45.00,1);

  // Ended auction
  db.prepare('INSERT INTO auctions (product_id,artisan_id,title,starting_price,current_highest_bid,bid_increment,start_time,end_time,status,winner_id) VALUES (?,?,?,?,?,?,?,?,?,?)').run(ringId,artId,'Ended Auction',50.00,100.00,10.00,new Date(now-7*86400000).toISOString(),new Date(now-86400000).toISOString(),'sold',custId);

  // Coupon
  db.prepare('INSERT INTO coupons (code,type,value,min_order,is_active,expires_at) VALUES (?,?,?,?,1,?)').run('TEST10','percent',10,20,new Date(now.getTime()+30*86400000).toISOString());
  db.prepare('INSERT INTO coupons (code,type,value,min_order,is_active,expires_at) VALUES (?,?,?,?,1,?)').run('EXPIRED','percent',10,20,new Date(now-86400000).toISOString());

  // Wishlist
  db.prepare('INSERT INTO wishlist (user_id,product_id) VALUES (?,?)').run(custId,ringId);

  // Notification
  db.prepare('INSERT INTO notifications (user_id,type,title,message,link) VALUES (?,?,?,?,?)').run(custId,'order','Test Notification','Order delivered!','/orders/1');

  // Message
  db.prepare('INSERT INTO messages (sender_id,receiver_id,subject,content) VALUES (?,?,?,?)').run(custId,artId,'Hello','Do you take custom orders?');

  return { adminId, custId, cust2Id, artId, vaseId, ringId, orderId: o1.lastInsertRowid, auctionId: auc.lastInsertRowid };
}

module.exports = { setupTestDb, seedTestData };
