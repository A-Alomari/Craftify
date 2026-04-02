// Craftify - Comprehensive Database Seeder
const { initDatabase, getDb } = require('../config/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function seed() {
  console.log('🌱 Starting database seeding...');
  
  await initDatabase();
  const db = getDb();

  // Clear existing data
  console.log('Clearing existing data...');
  const tables = ['bids','auctions','order_items','orders','shipments','cart_items','reviews',
                  'wishlist','notifications','messages','products','artisan_profiles','users','categories','coupons','newsletter_subscriptions','password_resets'];
  tables.forEach(table => { try { db.prepare(`DELETE FROM ${table}`).run(); } catch(e){} });

  const hash = (pw) => bcrypt.hashSync(pw, 10);

  // ── Categories ──
  console.log('Creating categories...');
  const cats = [
    { name:'Pottery', slug:'pottery', description:'Handcrafted ceramic and clay pieces including vases, bowls, and decorative items.', image:'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=400&q=80' },
    { name:'Textiles', slug:'textiles', description:'Hand-woven fabrics, embroidery, tapestries, and textile art pieces.', image:'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&q=80' },
    { name:'Woodwork', slug:'woodwork', description:'Handcrafted wooden furniture, utensils, and decorative carvings.', image:'https://images.unsplash.com/photo-1611486212557-88be5ff027dc?w=400&q=80' },
    { name:'Jewelry', slug:'jewelry', description:'Handmade necklaces, bracelets, rings, and earrings using precious metals and stones.', image:'https://images.unsplash.com/photo-1515562141589-67f0d569b6c9?w=400&q=80' },
    { name:'Glassware', slug:'glassware', description:'Hand-blown glass vases, drinking glasses, and artistic glass sculptures.', image:'https://images.unsplash.com/photo-1577401239170-897942555fb3?w=400&q=80' },
    { name:'Leather', slug:'leather', description:'Handcrafted leather bags, wallets, belts, and accessories.', image:'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&q=80' },
    { name:'Paintings', slug:'paintings', description:'Original paintings and fine art from talented independent artists.', image:'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&q=80' },
    { name:'Home Decor', slug:'home-decor', description:'Unique home decoration items including candles, wall art, and more.', image:'https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=400&q=80' }
  ];
  const insCat = db.prepare('INSERT INTO categories (name,slug,description,image,is_active) VALUES (?,?,?,?,1)');
  cats.forEach(c => insCat.run(c.name, c.slug, c.description, c.image));

  // ── Users ──
  console.log('Creating users...');
  const users = [
    { name:'Admin User', email:'admin@craftify.com', password:hash('admin123'), role:'admin', status:'active', phone:'+973 1700 0001', avatar:'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&q=80' },
    { name:'John Doe', email:'customer@test.com', password:hash('customer123'), role:'customer', status:'active', phone:'+973 3456 7890', shipping_address:'123 Main Street', city:'Manama', country:'Bahrain', avatar:'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&q=80' },
    { name:'Sarah Miller', email:'sarah@test.com', password:hash('customer123'), role:'customer', status:'active', phone:'+973 3456 1111', shipping_address:'45 Pearl Road', city:'Riffa', country:'Bahrain', avatar:'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80' },
    { name:'Omar Hassan', email:'omar@test.com', password:hash('customer123'), role:'customer', status:'active', phone:'+973 3456 2222', shipping_address:'78 Harbour Lane', city:'Muharraq', country:'Bahrain', avatar:'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&q=80' },
    { name:'Elena Rodriguez', email:'artisan1@test.com', password:hash('artisan123'), role:'artisan', status:'active', phone:'+973 3333 4444', avatar:'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&q=80' },
    { name:'Marcus Thorne', email:'artisan2@test.com', password:hash('artisan123'), role:'artisan', status:'active', phone:'+973 3555 6666', avatar:'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&q=80' },
    { name:'Yuki Tanaka', email:'artisan3@test.com', password:hash('artisan123'), role:'artisan', status:'active', phone:'+973 3777 8888', avatar:'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&q=80' },
    { name:'Sofia Chen', email:'artisan4@test.com', password:hash('artisan123'), role:'artisan', status:'active', phone:'+973 3999 0000', avatar:'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&q=80' },
    { name:'David Okafor', email:'artisan5@test.com', password:hash('artisan123'), role:'artisan', status:'active', phone:'+973 3111 2222', avatar:'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&q=80' }
  ];
  const insUser = db.prepare('INSERT INTO users (name,email,password,role,status,phone,avatar,shipping_address,city,country) VALUES (?,?,?,?,?,?,?,?,?,?)');
  users.forEach(u => insUser.run(u.name, u.email, u.password, u.role, u.status, u.phone||null, u.avatar||null, u.shipping_address||null, u.city||null, u.country||null));

  // Get IDs
  const getId = (email) => db.prepare('SELECT id FROM users WHERE email=?').get(email).id;
  const adminId = getId('admin@craftify.com');
  const cust1 = getId('customer@test.com');
  const cust2 = getId('sarah@test.com');
  const cust3 = getId('omar@test.com');
  const art1 = getId('artisan1@test.com');
  const art2 = getId('artisan2@test.com');
  const art3 = getId('artisan3@test.com');
  const art4 = getId('artisan4@test.com');
  const art5 = getId('artisan5@test.com');

  // ── Artisan Profiles ──
  console.log('Creating artisan profiles...');
  const profiles = [
    { user_id:art1, shop_name:"Elena's Ceramics", bio:'Master ceramicist with 15 years of wood-firing experience. Every piece tells a story of fire and earth. Based in Madrid, trained in traditional Japanese Raku techniques.', location:'Manama, Bahrain', is_approved:1, profile_image:'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&q=80', instagram:'@elena_ceramics' },
    { user_id:art2, shop_name:"Thorne Woodcraft", bio:'Fourth-generation woodworker specializing in hand-joined furniture and sculptural pieces. Every cut is guided by the grain. Sustainably sourced hardwoods only.', location:'Muharraq, Bahrain', is_approved:1, profile_image:'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&q=80', instagram:'@thorne_wood' },
    { user_id:art3, shop_name:"Yuki Glass Studio", bio:'Contemporary glass artist blending traditional Japanese aesthetics with modern blown-glass techniques. Each piece captures light in a unique way.', location:'Riffa, Bahrain', is_approved:1, profile_image:'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300&q=80', instagram:'@yuki_glass' },
    { user_id:art4, shop_name:"Sofia Jewelry Atelier", bio:'Fine jeweler working with recycled precious metals and ethically sourced gemstones. Minimalist designs inspired by nature and architecture.', location:'Isa Town, Bahrain', is_approved:1, profile_image:'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&q=80', instagram:'@sofia_jewels' },
    { user_id:art5, shop_name:"Okafor Leather Co.", bio:'Hand-stitched leather goods made with vegetable-tanned hides. From portfolio bags to artisan wallets, built to last a lifetime.', location:'Hamad Town, Bahrain', is_approved:1, profile_image:'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&q=80', instagram:'@okafor_leather' }
  ];
  const insArt = db.prepare('INSERT INTO artisan_profiles (user_id,shop_name,bio,location,is_approved,profile_image,instagram) VALUES (?,?,?,?,?,?,?)');
  profiles.forEach(a => insArt.run(a.user_id, a.shop_name, a.bio, a.location, a.is_approved, a.profile_image, a.instagram||null));

  // ── Category ID helper ──
  const catId = (slug) => db.prepare('SELECT id FROM categories WHERE slug=?').get(slug).id;

  // ── Products (30+) ──
  console.log('Creating products...');
  const products = [
    // Elena's Ceramics (Pottery)
    { artisan_id:art1, category_id:catId('pottery'), name:'Vintage Kiln-Fired Vase', description:'Hand-thrown stoneware vase with unique ash glaze patterns created during a 72-hour wood firing. Inspired by 18th century agrarian vessels with a modern minimalist form. Height: 12 inches.', price:145.00, stock:8, images:'["https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=600&q=80","https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=600&q=80"]', featured:1, status:'approved' },
    { artisan_id:art1, category_id:catId('pottery'), name:'Rustic Breakfast Bowl Set', description:'Set of 4 stoneware breakfast bowls with organic edges and reactive glaze. Microwave and dishwasher safe. Each bowl 6" diameter.', price:68.00, stock:15, images:'["https://images.unsplash.com/photo-1610701596061-2ecf227e85b2?w=600&q=80"]', featured:1, status:'approved' },
    { artisan_id:art1, category_id:catId('pottery'), name:'Speckled Coffee Mug', description:'Handcrafted 12oz coffee mug with comfortable handle and speckled cream glaze. Perfect for your morning ritual.', price:32.00, stock:25, images:'["https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600&q=80"]', featured:0, status:'approved' },
    { artisan_id:art1, category_id:catId('pottery'), name:'Ceramic Incense Holder', description:'Minimalist ceramic tray for stick incense with collected ash channel. Matte black finish.', price:28.00, stock:30, images:'["https://images.unsplash.com/photo-1603561596112-0a132b757442?w=600&q=80"]', featured:0, status:'approved' },
    { artisan_id:art1, category_id:catId('home-decor'), name:'Hand-Painted Decorative Plate', description:'Large 14" wall plate with hand-painted floral motifs in cobalt blue. Includes wall mounting hardware.', price:95.00, stock:5, images:'["https://images.unsplash.com/photo-1610701596061-2ecf227e85b2?w=600&q=80"]', featured:1, status:'approved' },
    { artisan_id:art1, category_id:catId('pottery'), name:'Terra Cotta Planter', description:'Unglazed terra cotta planter with drainage hole. Natural earthy tones that develop beautiful patina over time. 8" diameter.', price:42.00, stock:20, images:'["https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=600&q=80"]', featured:0, status:'approved' },

    // Thorne Woodcraft (Woodwork)
    { artisan_id:art2, category_id:catId('woodwork'), name:'Walnut Joinery Stool', description:'Solid black walnut stool with hand-cut dovetail joinery. No screws or nails - traditional Japanese-inspired construction. Seat height: 18".', price:320.00, stock:4, images:'["https://images.unsplash.com/photo-1503602642458-232111445657?w=600&q=80"]', featured:1, status:'approved' },
    { artisan_id:art2, category_id:catId('woodwork'), name:'Oak Cutting Board', description:'End-grain red oak cutting board with juice groove. handcrafted and finished with food-safe mineral oil. 16"x12"x1.5".', price:85.00, stock:12, images:'["https://images.unsplash.com/photo-1588165171080-c89acfa5ee83?w=600&q=80"]', featured:0, status:'approved' },
    { artisan_id:art2, category_id:catId('woodwork'), name:'Cherry Wood Serving Tray', description:'Elegant serving tray handmade from solid cherry hardwood with hand-carved handles. 20"x14".', price:110.00, stock:7, images:'["https://images.unsplash.com/photo-1605433246452-3292ea0c1a09?w=600&q=80"]', featured:1, status:'approved' },
    { artisan_id:art2, category_id:catId('woodwork'), name:'Maple Salad Tongs', description:'Handcarved maple wood salad tongs, sanded silky smooth and sealed with beeswax. Length: 12".', price:38.00, stock:20, images:'["https://images.unsplash.com/photo-1615484477778-ca3b77940c25?w=600&q=80"]', featured:0, status:'approved' },
    { artisan_id:art2, category_id:catId('home-decor'), name:'Driftwood Wall Shelf', description:'Floating wall shelf made from reclaimed driftwood. Each piece uniquely shaped by nature. Approx 24" wide.', price:75.00, stock:6, images:'["https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=600&q=80"]', featured:0, status:'approved' },
    { artisan_id:art2, category_id:catId('woodwork'), name:'Wooden Spoon Set', description:'Set of 3 hand-carved cooking spoons in walnut, cherry, and maple. Finished with food-safe oil.', price:55.00, stock:15, images:'["https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=80"]', featured:0, status:'approved' },

    // Yuki Glass Studio (Glassware)
    { artisan_id:art3, category_id:catId('glassware'), name:'Blown Glass Bud Vase', description:'Delicate hand-blown glass bud vase with iridescent finish. Each piece unique due to the freeform blowing process. Height: 8".', price:65.00, stock:10, images:'["https://images.unsplash.com/photo-1481349518771-20055b2a7b24?w=600&q=80"]', featured:1, status:'approved' },
    { artisan_id:art3, category_id:catId('glassware'), name:'Art Glass Paperweight', description:'Solid glass paperweight with swirling colors trapped inside. Makes a stunning desk accessory. 3" diameter.', price:48.00, stock:18, images:'["https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?w=600&q=80"]', featured:0, status:'approved' },
    { artisan_id:art3, category_id:catId('glassware'), name:'Fused Glass Wall Art', description:'Abstract wall art piece made by fusing multiple layers of colored glass. Frame included. 12"x12".', price:180.00, stock:4, images:'["https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&q=80"]', featured:1, status:'approved' },
    { artisan_id:art3, category_id:catId('glassware'), name:'Glass Drinking Set', description:'Set of 4 hand-blown tumblers with subtle blue tint. Each glass approximately 10oz capacity.', price:92.00, stock:8, images:'["https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=80"]', featured:0, status:'approved' },
    { artisan_id:art3, category_id:catId('home-decor'), name:'Glass Wind Chime', description:'Delicate wind chime made from hand-cut stained glass pieces. Produces gentle tinkling sounds.', price:55.00, stock:12, images:'["https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80"]', featured:0, status:'approved' },

    // Sofia Jewelry Atelier (Jewelry)
    { artisan_id:art4, category_id:catId('jewelry'), name:'Raw Silver Signet Ring', description:'Rough-hewn solid sterling silver signet ring with an embedded raw turquoise stone. Adjustable fit.', price:85.00, stock:12, images:'["https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600&q=80"]', featured:1, status:'approved' },
    { artisan_id:art4, category_id:catId('jewelry'), name:'Gold Leaf Pendant', description:'Delicate 14k gold-filled pendant with hand-hammered leaf shape on 18" chain.', price:120.00, stock:10, images:'["https://images.unsplash.com/photo-1515562141589-67f0d569b6c9?w=600&q=80"]', featured:1, status:'approved' },
    { artisan_id:art4, category_id:catId('jewelry'), name:'Pearl Drop Earrings', description:'Freshwater pearl drops on sterling silver ear wires. Elegant and lightweight.', price:65.00, stock:15, images:'["https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600&q=80"]', featured:0, status:'approved' },
    { artisan_id:art4, category_id:catId('jewelry'), name:'Woven Copper Bracelet', description:'Hand-woven copper wire bracelet with patina finish. Adjustable fit for most wrist sizes.', price:45.00, stock:20, images:'["https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=600&q=80"]', featured:0, status:'approved' },
    { artisan_id:art4, category_id:catId('jewelry'), name:'Moonstone Stacker Rings', description:'Set of 3 thin sterling silver stacking rings, one set with a genuine moonstone cabochon.', price:98.00, stock:8, images:'["https://images.unsplash.com/photo-1603561591411-07134e71a2a9?w=600&q=80"]', featured:0, status:'approved' },

    // Okafor Leather Co. (Leather)
    { artisan_id:art5, category_id:catId('leather'), name:'Artisan Satchel Bag', description:'Full-grain vegetable-tanned leather messenger bag with copper rivets and heavy saddle stitching. Develops rich patina over time.', price:450.00, stock:3, images:'["https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80","https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80"]', featured:1, status:'approved' },
    { artisan_id:art5, category_id:catId('leather'), name:'Leather Card Wallet', description:'Slim card wallet hand-stitched from Horween leather. Holds 6 cards and has a center cash slot.', price:65.00, stock:20, images:'["https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&q=80"]', featured:0, status:'approved' },
    { artisan_id:art5, category_id:catId('leather'), name:'Leather Journal Cover', description:'Refillable leather journal cover for A5 notebooks. Closure strap with brass snap button.', price:78.00, stock:12, images:'["https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&q=80"]', featured:1, status:'approved' },
    { artisan_id:art5, category_id:catId('leather'), name:'Leather Belt', description:'Hand-cut full-grain leather belt with solid brass roller buckle. Width: 1.5". Custom sizing available.', price:95.00, stock:10, images:'["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80"]', featured:0, status:'approved' },
    { artisan_id:art5, category_id:catId('leather'), name:'Leather Key Fob', description:'Simple leather key fob with brass hardware. Perfect small gift item.', price:22.00, stock:30, images:'["https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600&q=80"]', featured:0, status:'approved' },

    // Cross-category items
    { artisan_id:art3, category_id:catId('textiles'), name:'Indigo Woven Wall Hanging', description:'Hand-woven indigo-dyed wool wall hanging with abstract geometric patterns and long tassels. 24"x36".', price:210.00, stock:5, images:'["https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&q=80"]', featured:1, status:'approved' },
    { artisan_id:art1, category_id:catId('paintings'), name:'Abstract Ceramic Tile Art', description:'Set of 9 hand-painted ceramic tiles that form an abstract landscape. Can be wall-mounted.', price:275.00, stock:3, images:'["https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600&q=80"]', featured:0, status:'approved' },
    { artisan_id:art2, category_id:catId('home-decor'), name:'Wooden Candle Holders', description:'Set of 3 turned wooden candle holders in graduated heights. Made from reclaimed teak.', price:58.00, stock:10, images:'["https://images.unsplash.com/photo-1602028915047-37269d1a73f7?w=600&q=80"]', featured:0, status:'approved' },
    { artisan_id:art4, category_id:catId('home-decor'), name:'Wire Sculpture', description:'Abstract wire sculpture handmade from copper and brass wire. A stunning conversation piece. 10" tall.', price:135.00, stock:6, images:'["https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&q=80"]', featured:0, status:'approved' }
  ];

  const insProd = db.prepare('INSERT INTO products (artisan_id,category_id,name,description,price,stock,images,featured,status,is_active) VALUES (?,?,?,?,?,?,?,?,?,1)');
  products.forEach(p => insProd.run(p.artisan_id, p.category_id, p.name, p.description, p.price, p.stock, p.images, p.featured, p.status));

  // Get product IDs
  const pid = (name) => db.prepare('SELECT id FROM products WHERE name=?').get(name).id;

  // ── Orders ──
  console.log('Creating orders...');
  const insOrder = db.prepare('INSERT INTO orders (user_id,subtotal,shipping_cost,discount_amount,total_amount,status,payment_method,payment_status,shipping_address,shipping_city,shipping_country,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
  const insItem = db.prepare('INSERT INTO order_items (order_id,product_id,artisan_id,quantity,unit_price,total_price) VALUES (?,?,?,?,?,?)');

  const now = new Date();
  const dayMs = 86400000;

  // Order 1 - Delivered
  const o1 = insOrder.run(cust1, 213.00, 0, 0, 213.00, 'delivered', 'card', 'paid', '123 Main Street', 'Manama', 'Bahrain', new Date(now - 14*dayMs).toISOString());
  insItem.run(o1.lastInsertRowid, pid('Vintage Kiln-Fired Vase'), art1, 1, 145.00, 145.00);
  insItem.run(o1.lastInsertRowid, pid('Rustic Breakfast Bowl Set'), art1, 1, 68.00, 68.00);

  // Order 2 - Shipped
  const o2 = insOrder.run(cust1, 320.00, 0, 0, 320.00, 'shipped', 'card', 'paid', '123 Main Street', 'Manama', 'Bahrain', new Date(now - 5*dayMs).toISOString());
  insItem.run(o2.lastInsertRowid, pid('Walnut Joinery Stool'), art2, 1, 320.00, 320.00);

  // Order 3 - Pending
  const o3 = insOrder.run(cust2, 175.00, 0, 10.00, 165.00, 'pending', 'card', 'paid', '45 Pearl Road', 'Riffa', 'Bahrain', new Date(now - 1*dayMs).toISOString());
  insItem.run(o3.lastInsertRowid, pid('Artisan Satchel Bag'), art5, 0, 0, 0); // placeholder — let's fix
  // Actually let's make it correct:
  db.prepare('DELETE FROM order_items WHERE order_id=?').run(o3.lastInsertRowid);
  insItem.run(o3.lastInsertRowid, pid('Cherry Wood Serving Tray'), art2, 1, 110.00, 110.00);
  insItem.run(o3.lastInsertRowid, pid('Pearl Drop Earrings'), art4, 1, 65.00, 65.00);

  // Order 4 - Delivered (different customer)
  const o4 = insOrder.run(cust3, 150.00, 0, 0, 150.00, 'delivered', 'card', 'paid', '78 Harbour Lane', 'Muharraq', 'Bahrain', new Date(now - 20*dayMs).toISOString());
  insItem.run(o4.lastInsertRowid, pid('Raw Silver Signet Ring'), art4, 1, 85.00, 85.00);
  insItem.run(o4.lastInsertRowid, pid('Blown Glass Bud Vase'), art3, 1, 65.00, 65.00);

  // Order 5 - Shipped
  const o5 = insOrder.run(cust2, 450.00, 0, 0, 450.00, 'shipped', 'card', 'paid', '45 Pearl Road', 'Riffa', 'Bahrain', new Date(now - 3*dayMs).toISOString());
  insItem.run(o5.lastInsertRowid, pid('Artisan Satchel Bag'), art5, 1, 450.00, 450.00);

  // ── Shipments ──
  console.log('Creating shipments...');
  const insShip = db.prepare('INSERT INTO shipments (order_id,tracking_number,carrier,status,estimated_delivery,history) VALUES (?,?,?,?,?,?)');
  insShip.run(o1.lastInsertRowid, 'CRF'+uuidv4().substring(0,8).toUpperCase(), 'Craftify Express', 'delivered', new Date(now - 10*dayMs).toISOString(), JSON.stringify([{status:'delivered',timestamp:new Date(now-10*dayMs).toISOString(),location:'Manama Sorting Center'}]));
  insShip.run(o2.lastInsertRowid, 'CRF'+uuidv4().substring(0,8).toUpperCase(), 'Craftify Express', 'in_transit', new Date(now + 2*dayMs).toISOString(), JSON.stringify([{status:'shipped',timestamp:new Date(now-3*dayMs).toISOString(),location:'Muharraq Warehouse'},{status:'in_transit',timestamp:new Date(now-1*dayMs).toISOString(),location:'Riffa Distribution Hub'}]));
  insShip.run(o3.lastInsertRowid, 'CRF'+uuidv4().substring(0,8).toUpperCase(), 'Craftify Express', 'processing', new Date(now + 5*dayMs).toISOString(), JSON.stringify([{status:'processing',timestamp:new Date(now-1*dayMs).toISOString(),location:'Isa Town Depot'}]));
  insShip.run(o4.lastInsertRowid, 'CRF'+uuidv4().substring(0,8).toUpperCase(), 'Craftify Express', 'delivered', new Date(now - 16*dayMs).toISOString(), JSON.stringify([{status:'delivered',timestamp:new Date(now-16*dayMs).toISOString(),location:'Muharraq Warehouse'}]));
  insShip.run(o5.lastInsertRowid, 'CRF'+uuidv4().substring(0,8).toUpperCase(), 'Craftify Express', 'shipped', new Date(now + 4*dayMs).toISOString(), JSON.stringify([{status:'shipped',timestamp:new Date(now-2*dayMs).toISOString(),location:'Hamad Town Facility'}]));

  // ── Auctions ──
  console.log('Creating auctions...');
  const insAuc = db.prepare('INSERT INTO auctions (product_id,artisan_id,title,description,starting_price,current_highest_bid,bid_increment,start_time,end_time,status,winner_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)');

  // Active auction 1 - ending in 2 days
  const auc1Res = insAuc.run(pid('Vintage Kiln-Fired Vase'), art1, 'Vintage Kiln-Fired Vase', 'Rare kiln-fired vase from the master ceramicist Elena Rodriguez. One-of-a-kind piece.', 80.00, 145.00, 5.00, new Date(now - 3*dayMs).toISOString(), new Date(now + 2*dayMs).toISOString(), 'active', null);
  // Active auction 2 - ending soon (6 hours)
  const auc2Res = insAuc.run(pid('Indigo Woven Wall Hanging'), art3, 'Indigo Woven Wall Hanging', 'Stunning hand-woven indigo piece. Bidding ending soon!', 120.00, 210.00, 10.00, new Date(now - 2*dayMs).toISOString(), new Date(now + 0.25*dayMs).toISOString(), 'active', null);
  // Active auction 3 - ending in 4 days
  const auc3Res = insAuc.run(pid('Raw Silver Signet Ring'), art4, 'Raw Silver Signet Ring', 'Handcrafted signet ring with raw turquoise. A collector piece.', 50.00, 85.00, 5.00, new Date(now - 1*dayMs).toISOString(), new Date(now + 4*dayMs).toISOString(), 'active', null);
  // Ended auction
  const auc4Res = insAuc.run(pid('Fused Glass Wall Art'), art3, 'Fused Glass Wall Art', 'Beautiful abstract glass art piece.', 100.00, 220.00, 10.00, new Date(now - 10*dayMs).toISOString(), new Date(now - 3*dayMs).toISOString(), 'sold', cust1);

  // ── Bids ──
  console.log('Creating bids...');
  const insBid = db.prepare('INSERT INTO bids (auction_id,user_id,amount,is_winning,created_at) VALUES (?,?,?,?,?)');

  // Bids on auction 1
  insBid.run(auc1Res.lastInsertRowid, cust1, 85.00, 0, new Date(now - 2.5*dayMs).toISOString());
  insBid.run(auc1Res.lastInsertRowid, cust2, 95.00, 0, new Date(now - 2*dayMs).toISOString());
  insBid.run(auc1Res.lastInsertRowid, cust3, 110.00, 0, new Date(now - 1.5*dayMs).toISOString());
  insBid.run(auc1Res.lastInsertRowid, cust1, 120.00, 0, new Date(now - 1*dayMs).toISOString());
  insBid.run(auc1Res.lastInsertRowid, cust2, 135.00, 0, new Date(now - 0.5*dayMs).toISOString());
  insBid.run(auc1Res.lastInsertRowid, cust1, 145.00, 1, new Date(now - 0.2*dayMs).toISOString());

  // Bids on auction 2
  insBid.run(auc2Res.lastInsertRowid, cust3, 130.00, 0, new Date(now - 1.5*dayMs).toISOString());
  insBid.run(auc2Res.lastInsertRowid, cust1, 150.00, 0, new Date(now - 1*dayMs).toISOString());
  insBid.run(auc2Res.lastInsertRowid, cust2, 180.00, 0, new Date(now - 0.5*dayMs).toISOString());
  insBid.run(auc2Res.lastInsertRowid, cust3, 210.00, 1, new Date(now - 0.1*dayMs).toISOString());

  // Bids on auction 3
  insBid.run(auc3Res.lastInsertRowid, cust2, 55.00, 0, new Date(now - 0.8*dayMs).toISOString());
  insBid.run(auc3Res.lastInsertRowid, cust1, 65.00, 0, new Date(now - 0.6*dayMs).toISOString());
  insBid.run(auc3Res.lastInsertRowid, cust3, 75.00, 0, new Date(now - 0.3*dayMs).toISOString());
  insBid.run(auc3Res.lastInsertRowid, cust2, 85.00, 1, new Date(now - 0.1*dayMs).toISOString());

  // Bids on ended auction
  insBid.run(auc4Res.lastInsertRowid, cust2, 120.00, 0, new Date(now - 8*dayMs).toISOString());
  insBid.run(auc4Res.lastInsertRowid, cust1, 160.00, 0, new Date(now - 6*dayMs).toISOString());
  insBid.run(auc4Res.lastInsertRowid, cust3, 200.00, 0, new Date(now - 5*dayMs).toISOString());
  insBid.run(auc4Res.lastInsertRowid, cust1, 220.00, 1, new Date(now - 4*dayMs).toISOString());

  // ── Reviews ──
  console.log('Creating reviews...');
  const insRev = db.prepare('INSERT INTO reviews (product_id,user_id,order_id,rating,title,comment,is_approved,created_at) VALUES (?,?,?,?,?,?,1,?)');
  insRev.run(pid('Vintage Kiln-Fired Vase'), cust1, o1.lastInsertRowid, 5, 'Absolutely Stunning', 'This vase is even more beautiful in person. The glaze patterns are truly unique. You can see the marks from the wood firing. A masterpiece of ceramic art.', new Date(now - 8*dayMs).toISOString());
  insRev.run(pid('Rustic Breakfast Bowl Set'), cust1, o1.lastInsertRowid, 4, 'Great quality bowls', 'Beautiful bowls with an organic feel. They are slightly different from one another which I love. Docking one star because the sizing is slightly smaller than expected.', new Date(now - 7*dayMs).toISOString());
  insRev.run(pid('Walnut Joinery Stool'), cust1, o2.lastInsertRowid, 5, 'Heirloom quality', 'This stool is a work of art. The joinery is flawless and the walnut grain is gorgeous. This will last generations. Worth every penny.', new Date(now - 2*dayMs).toISOString());
  insRev.run(pid('Raw Silver Signet Ring'), cust3, o4.lastInsertRowid, 5, 'My new favourite ring', 'The turquoise stone is beautiful and the raw silver has a wonderful tactile quality. Fits perfectly.', new Date(now - 15*dayMs).toISOString());
  insRev.run(pid('Blown Glass Bud Vase'), cust3, o4.lastInsertRowid, 4, 'Delicate and gorgeous', 'The iridescent finish catches light in a magical way. Only concern is how fragile it feels. Packed well for shipping though.', new Date(now - 14*dayMs).toISOString());
  insRev.run(pid('Cherry Wood Serving Tray'), cust2, o3.lastInsertRowid, 5, 'Perfect dinner party piece', 'Received so many compliments when I used this to serve cheese. The cherry wood is warm and inviting. Beautifully finished.', new Date(now - 0.5*dayMs).toISOString());
  insRev.run(pid('Pearl Drop Earrings'), cust2, o3.lastInsertRowid, 4, 'Elegant and lightweight', 'These earrings are lovely for everyday wear. The pearls have a nice lustre. Wish the ear wires were a bit thicker for durability.', new Date(now - 0.3*dayMs).toISOString());
  insRev.run(pid('Speckled Coffee Mug'), cust3, null, 5, 'My morning essential', "I've bought 3 of these now as gifts. Everyone loves them. The handle is perfectly shaped and the speckles give it character.", new Date(now - 10*dayMs).toISOString());
  insRev.run(pid('Gold Leaf Pendant'), cust1, null, 5, 'Delicate perfection', 'This pendant is exactly what I was looking for. Not too bold, not too subtle. The hammered texture catches light beautifully.', new Date(now - 6*dayMs).toISOString());
  insRev.run(pid('Leather Card Wallet'), cust2, null, 4, 'Slim and functional', 'Great leather quality and stitching is tight. Could use one more card slot but otherwise perfect.', new Date(now - 4*dayMs).toISOString());

  // ── Wishlist ──
  console.log('Creating wishlist items...');
  const insWish = db.prepare('INSERT INTO wishlist (user_id,product_id) VALUES (?,?)');
  insWish.run(cust1, pid('Artisan Satchel Bag'));
  insWish.run(cust1, pid('Fused Glass Wall Art'));
  insWish.run(cust1, pid('Moonstone Stacker Rings'));
  insWish.run(cust2, pid('Vintage Kiln-Fired Vase'));
  insWish.run(cust2, pid('Walnut Joinery Stool'));
  insWish.run(cust3, pid('Gold Leaf Pendant'));

  // ── Messages ──
  console.log('Creating messages...');
  const insMsg = db.prepare('INSERT INTO messages (sender_id,receiver_id,subject,content,is_read,created_at) VALUES (?,?,?,?,?,?)');
  insMsg.run(cust1, art1, 'Custom vase inquiry', 'Hi Elena! I love your kiln-fired vase. Do you take custom orders? I would love a similar piece in a taller form for my hallway.', 1, new Date(now - 5*dayMs).toISOString());
  insMsg.run(art1, cust1, 'Re: Custom vase inquiry', "Thank you for reaching out! I'd be happy to create a custom piece. Taller forms work beautifully with wood firing. Let's discuss dimensions and timeline. A custom piece would be around $200-250.", 1, new Date(now - 4.5*dayMs).toISOString());
  insMsg.run(cust2, art5, 'Leather color options', 'Do you offer the satchel bag in a lighter tan color? The dark brown is gorgeous but I prefer something lighter.', 0, new Date(now - 2*dayMs).toISOString());
  insMsg.run(cust3, art4, 'Ring sizing question', 'What sizes do you carry for the Moonstone Stacker Rings? My ring size is 7.', 0, new Date(now - 1*dayMs).toISOString());

  // ── Coupons ──
  console.log('Creating coupons...');
  const insCoup = db.prepare('INSERT INTO coupons (code,description,type,value,min_order,max_uses,used_count,is_active,expires_at) VALUES (?,?,?,?,?,?,?,1,?)');
  insCoup.run('WELCOME10', 'Welcome discount - 10% off your first order', 'percent', 10, 20, 100, 3, new Date(now + 90*dayMs).toISOString());
  insCoup.run('SAVE5', '$5 off orders over $30', 'fixed', 5, 30, null, 8, new Date(now + 60*dayMs).toISOString());
  insCoup.run('ARTISAN20', '20% off for artisan appreciation week', 'percent', 20, 50, 50, 0, new Date(now + 14*dayMs).toISOString());
  insCoup.run('FREESHIP', 'Free shipping on orders over $100', 'fixed', 5, 100, 200, 12, new Date(now + 30*dayMs).toISOString());

  // ── Notifications ──
  console.log('Creating notifications...');
  const insNotif = db.prepare('INSERT INTO notifications (user_id,type,title,message,link,is_read,created_at) VALUES (?,?,?,?,?,?,?)');
  insNotif.run(cust1, 'order', 'Order Delivered!', `Your order #${o1.lastInsertRowid} has been delivered successfully.`, `/orders/${o1.lastInsertRowid}`, 1, new Date(now - 10*dayMs).toISOString());
  insNotif.run(cust1, 'order', 'Order Shipped!', `Your order #${o2.lastInsertRowid} has been shipped and is on its way.`, `/orders/${o2.lastInsertRowid}`, 0, new Date(now - 3*dayMs).toISOString());
  insNotif.run(cust1, 'auction', "You're the highest bidder!", 'You are currently the highest bidder on Vintage Kiln-Fired Vase auction.', `/auctions/${auc1Res.lastInsertRowid}`, 0, new Date(now - 0.2*dayMs).toISOString());
  insNotif.run(cust2, 'order', 'Order Confirmed', `Your order #${o3.lastInsertRowid} has been confirmed and is being processed.`, `/orders/${o3.lastInsertRowid}`, 0, new Date(now - 1*dayMs).toISOString());
  insNotif.run(cust3, 'auction', 'Auction ending soon!', 'The Indigo Woven Wall Hanging auction ends in less than 24 hours!', `/auctions/${auc2Res.lastInsertRowid}`, 0, new Date(now - 0.5*dayMs).toISOString());
  insNotif.run(art1, 'order', 'New Order Received!', 'You have a new order for Vintage Kiln-Fired Vase and Rustic Breakfast Bowl Set.', '/artisan/orders', 1, new Date(now - 14*dayMs).toISOString());
  insNotif.run(art1, 'auction', 'Auction Activity', 'Your Vintage Kiln-Fired Vase auction has received 6 bids!', `/artisan/auctions`, 0, new Date(now - 0.3*dayMs).toISOString());
  insNotif.run(art2, 'order', 'New Order!', 'You received a new order for Walnut Joinery Stool.', '/artisan/orders', 0, new Date(now - 5*dayMs).toISOString());

  console.log('');
  console.log('✅ Database seeded successfully!');
  console.log('');
  console.log('📋 Demo Accounts:');
  console.log('   Admin:      admin@craftify.com / admin123');
  console.log('   Customer 1: customer@test.com / customer123');
  console.log('   Customer 2: sarah@test.com / customer123');
  console.log('   Customer 3: omar@test.com / customer123');
  console.log('   Artisan 1:  artisan1@test.com / artisan123 (Elena\'s Ceramics)');
  console.log('   Artisan 2:  artisan2@test.com / artisan123 (Thorne Woodcraft)');
  console.log('   Artisan 3:  artisan3@test.com / artisan123 (Yuki Glass Studio)');
  console.log('   Artisan 4:  artisan4@test.com / artisan123 (Sofia Jewelry Atelier)');
  console.log('   Artisan 5:  artisan5@test.com / artisan123 (Okafor Leather Co.)');
  console.log('');
  console.log('🎨 Created:');
  console.log('   - 8 Categories');
  console.log('   - 9 Users (1 admin, 3 customers, 5 artisans)');
  console.log('   - 5 Artisan Shops with bios');
  console.log('   - 32 Products with real Unsplash images');
  console.log('   - 5 Orders with shipments');
  console.log('   - 4 Auctions (3 active, 1 ended) with 18 bids');
  console.log('   - 10 Reviews');
  console.log('   - 6 Wishlist items');
  console.log('   - 4 Messages');
  console.log('   - 4 Coupons (WELCOME10, SAVE5, ARTISAN20, FREESHIP)');
  console.log('   - 8 Notifications');
  console.log('');

  process.exit(0);
}

seed().catch(err => { console.error('Seed error:', err); process.exit(1); });
