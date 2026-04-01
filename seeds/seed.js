// Craftify - Database Seeder
const { initDatabase, getDb } = require('../config/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function seed() {
  console.log('🌱 Starting database seeding...');
  
  // Initialize database first
  await initDatabase();
  const db = getDb();

  // Clear existing data
  console.log('Clearing existing data...');
  const tables = ['bids', 'auctions', 'order_items', 'orders', 'shipments', 'cart_items', 'reviews', 
                  'wishlist', 'notifications', 'messages', 'products', 'artisan_profiles', 'users', 'categories', 'coupons'];
  tables.forEach(table => {
    try {
      db.prepare(`DELETE FROM ${table}`).run();
    } catch (e) {}
  });

// Hash password
const hashPassword = (password) => bcrypt.hashSync(password, 10);

// Insert Categories
console.log('Creating categories...');
const categories = [
  { name: 'Jewelry', slug: 'jewelry', description: 'Handcrafted jewelry including necklaces, bracelets, and rings', image: '/images/categories/jewelry.jpg' },
  { name: 'Pottery', slug: 'pottery', description: 'Beautiful handmade pottery and ceramics', image: '/images/categories/pottery.jpg' },
  { name: 'Textiles', slug: 'textiles', description: 'Handwoven fabrics, embroidery, and textile art', image: '/images/categories/textiles.jpg' },
  { name: 'Paintings', slug: 'paintings', description: 'Original paintings and artwork', image: '/images/categories/paintings.jpg' },
  { name: 'Woodwork', slug: 'woodwork', description: 'Handcrafted wooden items and furniture', image: '/images/categories/woodwork.jpg' },
  { name: 'Leather', slug: 'leather', description: 'Handmade leather goods and accessories', image: '/images/categories/leather.jpg' },
  { name: 'Home Decor', slug: 'home-decor', description: 'Unique home decoration items', image: '/images/categories/home-decor.jpg' },
  { name: 'Accessories', slug: 'accessories', description: 'Handmade bags, scarves, and accessories', image: '/images/categories/accessories.jpg' }
];

const insertCategory = db.prepare(`INSERT INTO categories (name, slug, description, image, is_active) VALUES (?, ?, ?, ?, 1)`);
categories.forEach(cat => insertCategory.run(cat.name, cat.slug, cat.description, cat.image));

// Insert Users
console.log('Creating users...');
const users = [
  { name: 'Admin User', email: 'admin@craftify.com', password: hashPassword('admin123'), role: 'admin', status: 'active' },
  { name: 'John Customer', email: 'customer@test.com', password: hashPassword('customer123'), role: 'customer', status: 'active', phone: '+973 3456 7890', shipping_address: '123 Main Street, Manama' },
  { name: 'Sara Ahmed', email: 'artisan1@test.com', password: hashPassword('artisan123'), role: 'artisan', status: 'active', phone: '+973 3333 4444' },
  { name: 'Mohammed Ali', email: 'artisan2@test.com', password: hashPassword('artisan123'), role: 'artisan', status: 'active', phone: '+973 3555 6666' },
  { name: 'Fatima Hassan', email: 'artisan3@test.com', password: hashPassword('artisan123'), role: 'artisan', status: 'active', phone: '+973 3777 8888' },
  { name: 'Test Customer', email: 'test@test.com', password: hashPassword('test123'), role: 'customer', status: 'active' }
];

const insertUser = db.prepare(`INSERT INTO users (name, email, password, role, status, phone, shipping_address) VALUES (?, ?, ?, ?, ?, ?, ?)`);
users.forEach(u => insertUser.run(u.name, u.email, u.password, u.role, u.status, u.phone || null, u.shipping_address || null));

// Get user IDs
const adminId = db.prepare(`SELECT id FROM users WHERE email = ?`).get('admin@craftify.com').id;
const customerId = db.prepare(`SELECT id FROM users WHERE email = ?`).get('customer@test.com').id;
const artisan1Id = db.prepare(`SELECT id FROM users WHERE email = ?`).get('artisan1@test.com').id;
const artisan2Id = db.prepare(`SELECT id FROM users WHERE email = ?`).get('artisan2@test.com').id;
const artisan3Id = db.prepare(`SELECT id FROM users WHERE email = ?`).get('artisan3@test.com').id;

// Insert Artisan Profiles
console.log('Creating artisan profiles...');
const artisanProfiles = [
  { user_id: artisan1Id, shop_name: 'Sara\'s Jewelry', bio: 'Creating unique handcrafted jewelry since 2015. Each piece tells a story.', location: 'Manama, Bahrain', is_approved: 1 },
  { user_id: artisan2Id, shop_name: 'Ali Pottery Studio', bio: 'Traditional Bahraini pottery with a modern twist. Every piece is made with love.', location: 'Muharraq, Bahrain', is_approved: 1 },
  { user_id: artisan3Id, shop_name: 'Fatima Textiles', bio: 'Hand-woven textiles preserving traditional Bahraini craftsmanship.', location: 'Riffa, Bahrain', is_approved: 1 }
];

const insertArtisan = db.prepare(`INSERT INTO artisan_profiles (user_id, shop_name, bio, location, is_approved) VALUES (?, ?, ?, ?, ?)`);
artisanProfiles.forEach(a => insertArtisan.run(a.user_id, a.shop_name, a.bio, a.location, a.is_approved));

// Get category IDs
const getCatId = (slug) => db.prepare(`SELECT id FROM categories WHERE slug = ?`).get(slug).id;

// Insert Products
console.log('Creating products...');
const products = [
  // Sara's Jewelry
  { artisan_id: artisan1Id, category_id: getCatId('jewelry'), name: 'Pearl Necklace', description: 'Elegant freshwater pearl necklace with gold-plated clasp. Perfect for special occasions.', price: 89.99, stock: 15, images: '["/images/products/pearl-necklace.jpg"]', status: 'approved' },
  { artisan_id: artisan1Id, category_id: getCatId('jewelry'), name: 'Silver Bracelet', description: 'Handcrafted sterling silver bracelet with traditional Bahraini patterns.', price: 45.00, stock: 20, images: '["/images/products/silver-bracelet.jpg"]', status: 'approved' },
  { artisan_id: artisan1Id, category_id: getCatId('jewelry'), name: 'Gold Earrings', description: 'Delicate gold-plated earrings inspired by Arabian designs.', price: 35.00, stock: 25, images: '["/images/products/gold-earrings.jpg"]', status: 'approved' },
  { artisan_id: artisan1Id, category_id: getCatId('jewelry'), name: 'Gemstone Ring', description: 'Beautiful handcrafted ring with natural gemstone.', price: 120.00, stock: 8, images: '["/images/products/gemstone-ring.jpg"]', status: 'approved' },
  
  // Ali Pottery
  { artisan_id: artisan2Id, category_id: getCatId('pottery'), name: 'Ceramic Vase', description: 'Hand-painted ceramic vase with traditional Arabic motifs. Each piece is unique.', price: 65.00, stock: 10, images: '["/images/products/ceramic-vase.jpg"]', status: 'approved' },
  { artisan_id: artisan2Id, category_id: getCatId('pottery'), name: 'Coffee Cup Set', description: 'Set of 6 traditional Arabic coffee cups with gold trim.', price: 55.00, stock: 12, images: '["/images/products/coffee-cups.jpg"]', status: 'approved' },
  { artisan_id: artisan2Id, category_id: getCatId('pottery'), name: 'Decorative Plate', description: 'Large decorative plate with hand-painted floral design.', price: 40.00, stock: 15, images: '["/images/products/decorative-plate.jpg"]', status: 'approved' },
  { artisan_id: artisan2Id, category_id: getCatId('home-decor'), name: 'Incense Burner', description: 'Traditional ceramic incense burner (Mabkhara) with intricate patterns.', price: 75.00, stock: 8, images: '["/images/products/incense-burner.jpg"]', status: 'approved' },
  
  // Fatima Textiles
  { artisan_id: artisan3Id, category_id: getCatId('textiles'), name: 'Embroidered Cushion', description: 'Hand-embroidered cushion cover with traditional Palestinian cross-stitch patterns.', price: 35.00, stock: 20, images: '["/images/products/cushion.jpg"]', status: 'approved' },
  { artisan_id: artisan3Id, category_id: getCatId('textiles'), name: 'Woven Table Runner', description: 'Beautiful hand-woven table runner in rich colors.', price: 48.00, stock: 15, images: '["/images/products/table-runner.jpg"]', status: 'approved' },
  { artisan_id: artisan3Id, category_id: getCatId('accessories'), name: 'Silk Scarf', description: 'Hand-dyed silk scarf with elegant patterns.', price: 60.00, stock: 18, images: '["/images/products/silk-scarf.jpg"]', status: 'approved' },
  { artisan_id: artisan3Id, category_id: getCatId('accessories'), name: 'Handwoven Bag', description: 'Traditional handwoven bag perfect for everyday use.', price: 85.00, stock: 10, images: '["/images/products/woven-bag.jpg"]', status: 'approved' },
  
  // More products
  { artisan_id: artisan1Id, category_id: getCatId('accessories'), name: 'Beaded Handbag', description: 'Stunning hand-beaded evening bag.', price: 95.00, stock: 5, images: '["/images/products/beaded-bag.jpg"]', status: 'approved' },
  { artisan_id: artisan2Id, category_id: getCatId('home-decor'), name: 'Ceramic Lamp', description: 'Hand-painted ceramic table lamp.', price: 110.00, stock: 6, images: '["/images/products/ceramic-lamp.jpg"]', status: 'approved' },
  { artisan_id: artisan3Id, category_id: getCatId('home-decor'), name: 'Wall Hanging', description: 'Macrame wall hanging with wooden beads.', price: 70.00, stock: 12, images: '["/images/products/wall-hanging.jpg"]', status: 'approved' }
];

const insertProduct = db.prepare(`INSERT INTO products (artisan_id, category_id, name, description, price, stock, images, status, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`);
products.forEach(p => insertProduct.run(p.artisan_id, p.category_id, p.name, p.description, p.price, p.stock, p.images, p.status));

// Get some product IDs for auctions and orders
const product1 = db.prepare(`SELECT id FROM products WHERE name = ?`).get('Pearl Necklace');
const product2 = db.prepare(`SELECT id FROM products WHERE name = ?`).get('Ceramic Vase');
const product3 = db.prepare(`SELECT id FROM products WHERE name = ?`).get('Gemstone Ring');
const product4 = db.prepare(`SELECT id FROM products WHERE name = ?`).get('Silk Scarf');

// Insert Auctions
console.log('Creating auctions...');
const now = new Date();
const auctions = [
  { 
    product_id: product3.id, 
    artisan_id: artisan1Id, 
    starting_price: 80.00, 
    current_highest_bid: 95.00,
    bid_increment: 5.00, 
    start_time: new Date(now - 86400000).toISOString(), // started yesterday
    end_time: new Date(now.getTime() + 172800000).toISOString(), // ends in 2 days
    status: 'active'
  },
  { 
    product_id: product4.id, 
    artisan_id: artisan3Id, 
    starting_price: 40.00, 
    current_highest_bid: 55.00,
    bid_increment: 5.00, 
    start_time: new Date(now - 43200000).toISOString(), // started 12 hours ago
    end_time: new Date(now.getTime() + 86400000).toISOString(), // ends in 1 day
    status: 'active'
  }
];

const insertAuction = db.prepare(`INSERT INTO auctions (product_id, artisan_id, starting_price, current_highest_bid, bid_increment, start_time, end_time, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
auctions.forEach(a => insertAuction.run(a.product_id, a.artisan_id, a.starting_price, a.current_highest_bid, a.bid_increment, a.start_time, a.end_time, a.status));

// Insert some bids
const auction1 = db.prepare(`SELECT id FROM auctions WHERE product_id = ?`).get(product3.id);
const insertBid = db.prepare(`INSERT INTO bids (auction_id, user_id, amount, is_winning) VALUES (?, ?, ?, ?)`);
insertBid.run(auction1.id, customerId, 85.00, 0);
insertBid.run(auction1.id, customerId, 95.00, 1);

// Insert Orders
console.log('Creating orders...');
const insertOrder = db.prepare(`
  INSERT INTO orders (user_id, subtotal, shipping_cost, discount_amount, total_amount, status, payment_method, payment_status, shipping_address, shipping_city, shipping_country)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const order1Result = insertOrder.run(customerId, 134.99, 0, 0, 134.99, 'delivered', 'card', 'paid', '123 Main Street', 'Manama', 'Bahrain');
const order2Result = insertOrder.run(customerId, 65.00, 5.00, 0, 70.00, 'shipped', 'card', 'paid', '123 Main Street', 'Manama', 'Bahrain');

// Insert Order Items
const insertOrderItem = db.prepare(`INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)`);
insertOrderItem.run(order1Result.lastInsertRowid, product1.id, 1, 89.99, 89.99);
insertOrderItem.run(order1Result.lastInsertRowid, product2.id, 1, 45.00, 45.00);
insertOrderItem.run(order2Result.lastInsertRowid, product2.id, 1, 65.00, 65.00);

// Insert Shipments
console.log('Creating shipments...');
const insertShipment = db.prepare(`INSERT INTO shipments (order_id, tracking_number, carrier, status, estimated_delivery) VALUES (?, ?, ?, ?, ?)`);
insertShipment.run(order1Result.lastInsertRowid, 'CRF' + uuidv4().substring(0, 8).toUpperCase(), 'Craftify Express', 'delivered', new Date(now - 86400000).toISOString());
insertShipment.run(order2Result.lastInsertRowid, 'CRF' + uuidv4().substring(0, 8).toUpperCase(), 'Craftify Express', 'shipped', new Date(now.getTime() + 259200000).toISOString());

// Insert Reviews
console.log('Creating reviews...');
const insertReview = db.prepare(`INSERT INTO reviews (product_id, user_id, rating, comment, is_approved) VALUES (?, ?, ?, ?, 1)`);
insertReview.run(product1.id, customerId, 5, 'Absolutely beautiful necklace! The quality is amazing and it arrived quickly. Highly recommend!');
insertReview.run(product2.id, customerId, 4, 'Very nice vase, great craftsmanship. The colors are vibrant and it looks great in my living room.');

// Insert Coupons
console.log('Creating coupons...');
const insertCoupon = db.prepare(`INSERT INTO coupons (code, type, value, min_order, max_uses, is_active, expires_at) VALUES (?, ?, ?, ?, ?, 1, ?)`);
insertCoupon.run('WELCOME10', 'percent', 10, 20, 100, new Date(now.getTime() + 30 * 86400000).toISOString());
insertCoupon.run('SAVE5', 'fixed', 5, 30, null, new Date(now.getTime() + 60 * 86400000).toISOString());

// Insert Notifications
console.log('Creating notifications...');
const insertNotification = db.prepare(`INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)`);
insertNotification.run(customerId, 'order', 'Order Delivered!', 'Your order #' + order1Result.lastInsertRowid + ' has been delivered.', '/orders/' + order1Result.lastInsertRowid);
insertNotification.run(customerId, 'auction', 'You\'re winning!', 'You\'re currently the highest bidder on Gemstone Ring', '/auctions/' + auction1.id);
insertNotification.run(artisan1Id, 'order', 'New Order!', 'You have received a new order for Pearl Necklace', '/artisan/orders');

console.log('');
console.log('✅ Database seeded successfully!');
console.log('');
console.log('📋 Demo Accounts:');
console.log('   Admin:    admin@craftify.com / admin123');
console.log('   Customer: customer@test.com / customer123');
console.log('   Artisan:  artisan1@test.com / artisan123');
console.log('');
console.log('🎨 Created:');
console.log('   - 8 Categories');
console.log('   - 6 Users (1 admin, 2 customers, 3 artisans)');
console.log('   - 3 Artisan Shops');
console.log('   - 15 Products');
console.log('   - 2 Active Auctions');
console.log('   - 2 Orders with Shipments');
console.log('   - 2 Reviews');
console.log('   - 2 Coupons (WELCOME10, SAVE5)');
console.log('');

  process.exit(0);
}

// Run seed
seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
