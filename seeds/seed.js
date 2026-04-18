// Craftify - Comprehensive Database Seeder
const { initDatabase, getDb } = require('../config/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const expectedCounts = {
  categories: 8,
  users: 16,
  artisan_profiles: 7,
  products: 54,
  orders: 24,
  shipments: 24,
  auctions: 10,
  bids: 44,
  reviews: 30,
  wishlist: 18,
  messages: 22,
  coupons: 14,
  notifications: 45
};

const tablesToReset = [
  'bids',
  'auctions',
  'order_items',
  'shipments',
  'orders',
  'cart_items',
  'reviews',
  'wishlist',
  'notifications',
  'messages',
  'products',
  'artisan_profiles',
  'users',
  'categories',
  'coupons',
  'newsletter_subscriptions',
  'password_resets'
];

function requireSingleId(db, query, param, label) {
  const row = db.prepare(query).get(param);
  if (!row || typeof row.id === 'undefined') {
    throw new Error(`Seed lookup failed for ${label}: ${param}`);
  }
  return row.id;
}

function getTableCount(db, table) {
  return db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get()?.count || 0;
}

function verifyCounts(db) {
  const mismatches = [];

  Object.entries(expectedCounts).forEach(([table, expected]) => {
    const actual = getTableCount(db, table);
    if (actual !== expected) {
      mismatches.push(`${table}: expected ${expected}, got ${actual}`);
    }
  });

  if (mismatches.length > 0) {
    throw new Error(`Seed verification failed:\n${mismatches.join('\n')}`);
  }
}

function runTransactionCommand(db, sql) {
  if (typeof db.exec === 'function') {
    db.exec(sql);
    return;
  }

  db.prepare(sql).run();
}

function clearExistingData(db) {
  tablesToReset.forEach((table) => {
    db.prepare(`DELETE FROM ${table}`).run();
  });
}

async function seed() {
  console.log('🌱 Starting database seeding...');

  await initDatabase();
  const db = getDb();

  let inTransaction = false;

  try {
    runTransactionCommand(db, 'BEGIN TRANSACTION');
    inTransaction = true;

    // Clear existing data
    console.log('Clearing existing data...');
    clearExistingData(db);

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
    { name:'Liam Hassan', email:'liam@test.com', password:hash('customer123'), role:'customer', status:'active', phone:'+973 3456 3333', shipping_address:'12 Falcon Lane', city:'Manama', country:'Bahrain', avatar:'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&q=80' },
    { name:'Sara Khan', email:'sara@test.com', password:hash('customer123'), role:'customer', status:'active', phone:'+973 3456 4444', shipping_address:'33 Jasmine Court', city:'Riffa', country:'Bahrain', avatar:'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&q=80' },
    { name:'Elena Rodriguez', email:'artisan1@test.com', password:hash('artisan123'), role:'artisan', status:'active', phone:'+973 3333 4444', avatar:'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&q=80' },
    { name:'Marcus Thorne', email:'artisan2@test.com', password:hash('artisan123'), role:'artisan', status:'active', phone:'+973 3555 6666', avatar:'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&q=80' },
    { name:'Yuki Tanaka', email:'artisan3@test.com', password:hash('artisan123'), role:'artisan', status:'active', phone:'+973 3777 8888', avatar:'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&q=80' },
    { name:'Sofia Chen', email:'artisan4@test.com', password:hash('artisan123'), role:'artisan', status:'active', phone:'+973 3999 0000', avatar:'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&q=80' },
    { name:'David Okafor', email:'artisan5@test.com', password:hash('artisan123'), role:'artisan', status:'active', phone:'+973 3111 2222', avatar:'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&q=80' },
    // Round 2 additions
    { name:'Fatima Al-Khalifa', email:'fatima@test.com', password:hash('customer123'), role:'customer', status:'active', phone:'+973 3456 5555', shipping_address:'8 Seef District', city:'Manama', country:'Bahrain', avatar:'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&q=80' },
    { name:'Khalid Nasser', email:'khalid@test.com', password:hash('customer123'), role:'customer', status:'active', phone:'+973 3456 6666', shipping_address:'22 Al Hidd Road', city:'Muharraq', country:'Bahrain', avatar:'https://images.unsplash.com/photo-1552058544-f2b08422138a?w=150&q=80' },
    { name:'Jana Sitar', email:'jana@test.com', password:hash('customer123'), role:'customer', status:'active', phone:'+973 3456 7777', shipping_address:'17 Budaiya Highway', city:'Manama', country:'Bahrain', avatar:'https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=150&q=80' },
    { name:'Noor Al-Rashid', email:'artisan6@test.com', password:hash('artisan123'), role:'artisan', status:'active', phone:'+973 3222 3333', avatar:'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=150&q=80' },
    { name:'Ahmed Al-Farsi', email:'artisan7@test.com', password:hash('artisan123'), role:'artisan', status:'active', phone:'+973 3444 5555', avatar:'https://images.unsplash.com/photo-1476830845148-9ccacd03e9a1?w=150&q=80' }
  ];
    const insUser = db.prepare('INSERT INTO users (name,email,password,role,status,phone,avatar,shipping_address,city,country) VALUES (?,?,?,?,?,?,?,?,?,?)');
    users.forEach(u => insUser.run(u.name, u.email, u.password, u.role, u.status, u.phone||null, u.avatar||null, u.shipping_address||null, u.city||null, u.country||null));

    // Get IDs
    const getId = (email) => requireSingleId(db, 'SELECT id FROM users WHERE email=?', email, 'user email');
    const adminId = getId('admin@craftify.com');
    const cust1 = getId('customer@test.com');
    const cust2 = getId('sarah@test.com');
    const cust3 = getId('omar@test.com');
    const cust4 = getId('liam@test.com');
    const cust5 = getId('sara@test.com');
    const art1 = getId('artisan1@test.com');
    const art2 = getId('artisan2@test.com');
    const art3 = getId('artisan3@test.com');
    const art4 = getId('artisan4@test.com');
    const art5 = getId('artisan5@test.com');
    const cust6 = getId('fatima@test.com');
    const cust7 = getId('khalid@test.com');
    const cust8 = getId('jana@test.com');
    const art6 = getId('artisan6@test.com');
    const art7 = getId('artisan7@test.com');

    // ── Artisan Profiles ──
    console.log('Creating artisan profiles...');
    const profiles = [
    { user_id:art1, shop_name:"Elena's Ceramics", bio:"Master ceramicist with 15 years of wood-firing experience. Every piece tells a story of fire and earth. Trained in traditional Japanese Raku techniques, Elena hand-throws each piece on a kick wheel and fires in a wood-fuelled anagama kiln.", location:'Manama, Bahrain', is_approved:1, profile_image:'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&q=80', banner_image:'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=1200&q=80', instagram:'@elena_ceramics', return_policy:'Returns accepted within 14 days for undamaged items in original packaging. Custom and sale items are final sale. Buyer covers return shipping.', shipping_methods:'["Standard (3-5 days)","Express (1-2 days)"]' },
    { user_id:art2, shop_name:"Thorne Woodcraft", bio:'Fourth-generation woodworker specialising in hand-joined furniture and sculptural pieces. Every cut is guided by the grain. Sustainably sourced hardwoods only — no MDF, no veneers, no shortcuts.', location:'Muharraq, Bahrain', is_approved:1, profile_image:'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&q=80', banner_image:'https://images.unsplash.com/photo-1611486212557-88be5ff027dc?w=1200&q=80', instagram:'@thorne_wood', return_policy:'Satisfaction guaranteed. Contact within 7 days of delivery for any issues. Custom furniture is non-returnable once production has started.', shipping_methods:'["Standard (5-7 days)","Freight for large items"]' },
    { user_id:art3, shop_name:"Yuki Glass Studio", bio:'Contemporary glass artist blending traditional Japanese aesthetics with modern blown-glass and fusing techniques. Each piece captures light in a way no two are ever identical. Studio based in Riffa.', location:'Riffa, Bahrain', is_approved:1, profile_image:'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300&q=80', banner_image:'https://images.unsplash.com/photo-1577401239170-897942555fb3?w=1200&q=80', instagram:'@yuki_glass', return_policy:'Glass is fragile — if your piece arrives damaged, send photos within 48 hours and we will replace it free of charge. No return needed for damaged items.', shipping_methods:'["Standard with special glass packaging (4-6 days)","Express insured (2 days)"]' },
    { user_id:art4, shop_name:"Sofia Jewelry Atelier", bio:'Fine jeweller working with recycled precious metals and ethically sourced gemstones. Minimalist designs inspired by the geometry of nature and Gulf architecture. Every piece is hallmarked.', location:'Isa Town, Bahrain', is_approved:1, profile_image:'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&q=80', banner_image:'https://images.unsplash.com/photo-1515562141589-67f0d569b6c9?w=1200&q=80', instagram:'@sofia_jewels', return_policy:'Unworn items in original packaging may be returned within 21 days. Bespoke and engraved pieces are final sale.', shipping_methods:'["Standard insured (3-5 days)","Express tracked (1-2 days)"]' },
    { user_id:art5, shop_name:"Okafor Leather Co.", bio:'Hand-stitched leather goods made with vegetable-tanned hides sourced from certified tanneries. From executive portfolios to slim wallets — built to last a lifetime and age beautifully.', location:'Hamad Town, Bahrain', is_approved:1, profile_image:'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&q=80', banner_image:'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=1200&q=80', instagram:'@okafor_leather', return_policy:'Returns accepted within 14 days if unused. Leather goods that have been used or monogrammed cannot be returned. We stand behind every stitch.', shipping_methods:'["Standard (3-5 days)","Express (1-2 days)","International (7-14 days)"]' },
    { user_id:art6, shop_name:"Noor's Textile Studio", bio:"Classically trained in Bahraini weaving traditions with a contemporary eye. Each textile is hand-loomed on a traditional floor loom using natural dyes and imported silk threads. Rooted in the Gulf's rich textile heritage.", location:'Riffa, Bahrain', is_approved:1, profile_image:'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=300&q=80', banner_image:'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=1200&q=80', instagram:'@noor_textiles', return_policy:'Textiles are made to order. Returns accepted within 10 days if item is unused and undamaged. Prayer mats are final sale for hygiene reasons.', shipping_methods:'["Standard (3-5 days)","Express (1-2 days)"]' },
    { user_id:art7, shop_name:"Al-Farsi Craft House", bio:'Family-run jewellery house blending Gulf heritage with modern goldsmithing. We source conflict-free stones and recycled precious metals through certified suppliers. Each piece ships with a hallmark certificate.', location:'Manama, Bahrain', is_approved:1, profile_image:'https://images.unsplash.com/photo-1476830845148-9ccacd03e9a1?w=300&q=80', banner_image:'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=1200&q=80', instagram:'@alfarsi_jewelry', return_policy:'Returns within 14 days for standard items. Rings that have been sized are final sale. All items shipped with authenticity certificate.', shipping_methods:'["Standard insured (3-5 days)","Same-day Manama delivery","Express international"]' }
  ];
    const insArt = db.prepare('INSERT INTO artisan_profiles (user_id,shop_name,bio,location,is_approved,profile_image,banner_image,instagram,return_policy,shipping_methods) VALUES (?,?,?,?,?,?,?,?,?,?)');
    profiles.forEach(a => insArt.run(a.user_id, a.shop_name, a.bio, a.location, a.is_approved, a.profile_image, a.banner_image||null, a.instagram||null, a.return_policy||null, a.shipping_methods||'[]'));

    // ── Category ID helper ──
    const catId = (slug) => requireSingleId(db, 'SELECT id FROM categories WHERE slug=?', slug, 'category slug');

    // ── Products (54) — every image is unique and matched to the product type ──
    console.log('Creating products...');
    const products = [
    // ── Elena's Ceramics (art1) — Pottery & Home Decor ──────────────────────
    { artisan_id:art1, category_id:catId('pottery'), name:'Vintage Kiln-Fired Vase', description:'Hand-thrown stoneware vase with unique ash glaze patterns created during a 72-hour wood firing. Inspired by 18th century agrarian vessels with a modern minimalist form. Height: 12 inches. Each piece is truly one-of-a-kind.', price:145.00, stock:8, images:'["https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=600&q=80","https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=600&q=80"]', featured:1, status:'approved', weight:820, tags:'stoneware,kiln-fired,ash-glaze,pottery,handthrown' },
    { artisan_id:art1, category_id:catId('pottery'), name:'Rustic Breakfast Bowl Set', description:'Set of 4 stoneware breakfast bowls with organic edges and reactive glaze. Each bowl is slightly different — a natural result of the hand-throwing process. Microwave and dishwasher safe. 6" diameter.', price:68.00, stock:15, images:'["https://images.unsplash.com/photo-1610701596061-2ecf227e85b2?w=600&q=80"]', featured:1, status:'approved', weight:1200, tags:'stoneware,reactive-glaze,set-of-4,dishwasher-safe' },
    { artisan_id:art1, category_id:catId('pottery'), name:'Speckled Coffee Mug', description:'Handcrafted 12oz coffee mug with comfortable D-handle and speckled cream glaze. Fired at cone 10 for durability. The perfect vessel for your morning ritual.', price:32.00, stock:25, images:'["https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600&q=80"]', featured:0, status:'approved', weight:310, tags:'mug,pottery,speckled,12oz,cone10' },
    { artisan_id:art1, category_id:catId('pottery'), name:'Ceramic Incense Holder', description:'Minimalist ceramic tray for stick incense with a recessed ash channel. Matte black iron-oxide glaze. 20cm long.', price:28.00, stock:30, images:'["https://images.unsplash.com/photo-1603561596112-0a132b757442?w=600&q=80"]', featured:0, status:'approved', weight:180, tags:'ceramic,incense,minimalist,matte,iron-oxide' },
    { artisan_id:art1, category_id:catId('home-decor'), name:'Hand-Painted Decorative Plate', description:'Large 14" wall plate with hand-painted cobalt floral motifs on a cream stoneware body. Includes wall mounting hardware. Food safe but designed for display.', price:95.00, stock:5, images:'["https://images.unsplash.com/photo-1603561591411-07134e71a2a9?w=600&q=80"]', featured:1, status:'approved', weight:640, tags:'ceramic,hand-painted,wall-art,cobalt,stoneware' },
    { artisan_id:art1, category_id:catId('pottery'), name:'Terra Cotta Planter', description:'Unglazed terra cotta planter with drainage hole and saucer. Natural earthy tones that develop a beautiful patina over time. 8" diameter, ideal for succulents and herbs.', price:42.00, stock:20, images:'["https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=600&q=80"]', featured:0, status:'approved', weight:950, tags:'terra-cotta,planter,unglazed,garden,succulents' },
    { artisan_id:art1, category_id:catId('pottery'), name:'Ceramic Oil Diffuser', description:'Handcrafted ceramic essential oil diffuser with a dimpled texture and warm amber glaze. Creates a soft ambient glow when lit. Ships with a set of tea lights. Height: 6 inches.', price:54.00, stock:18, images:'["https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=600&q=80"]', featured:0, status:'approved', weight:420, tags:'ceramic,oil-diffuser,aromatherapy,amber,candle' },
    { artisan_id:art1, category_id:catId('pottery'), name:'Matte Black Espresso Cup Set', description:'Set of 4 hand-thrown espresso cups (90ml) with matching saucers. Deep matte black iron oxide glaze. A statement piece for the coffee lover.', price:48.00, stock:12, images:'["https://images.unsplash.com/photo-1567225557594-88887e70ade1?w=600&q=80"]', featured:0, status:'approved', weight:380, tags:'ceramic,espresso,matte-black,set-of-4,iron-oxide' },
    { artisan_id:art1, category_id:catId('pottery'), name:'Ceramic Soap Dish', description:'Minimalist oval soap dish with self-draining ridges. Speckled white glaze, food-safe finish. 13x9cm. A clean complement to any bathroom.', price:22.00, stock:25, images:'["https://images.unsplash.com/photo-1582562124811-c09040d0a901?w=600&q=80"]', featured:0, status:'approved', weight:145, tags:'ceramic,soap-dish,minimalist,speckled,bathroom' },

    // ── Thorne Woodcraft (art2) — Woodwork & Home Decor ─────────────────────
    { artisan_id:art2, category_id:catId('woodwork'), name:'Walnut Joinery Stool', description:'Solid black walnut stool with hand-cut dovetail joinery. No screws, no nails — traditional Japanese-inspired mortise-and-tenon construction. Seat height 18". Each stool takes 3 days to build.', price:320.00, stock:4, images:'["https://images.unsplash.com/photo-1503602642458-232111445657?w=600&q=80"]', featured:1, status:'approved', weight:4200, tags:'walnut,dovetail,stool,furniture,woodwork,mortise-tenon' },
    { artisan_id:art2, category_id:catId('woodwork'), name:'Oak Cutting Board', description:'End-grain red oak cutting board with juice groove and rubber feet. Hand-finished with food-safe mineral oil. 16"x12"x1.5". Easy on knife edges.', price:85.00, stock:12, images:'["https://images.unsplash.com/photo-1588165171080-c89acfa5ee83?w=600&q=80"]', featured:0, status:'approved', weight:1800, tags:'oak,cutting-board,end-grain,food-safe,kitchen' },
    { artisan_id:art2, category_id:catId('woodwork'), name:'Cherry Wood Serving Tray', description:'Elegant serving tray handmade from solid cherry hardwood with hand-carved handles. 20"x14". The cherry darkens beautifully with age and use.', price:110.00, stock:7, images:'["https://images.unsplash.com/photo-1605433246452-3292ea0c1a09?w=600&q=80"]', featured:1, status:'approved', weight:1100, tags:'cherry,serving-tray,hardwood,kitchen' },
    { artisan_id:art2, category_id:catId('woodwork'), name:'Maple Salad Tongs', description:'Handcarved maple salad tongs, sanded silky smooth and sealed with beeswax finish. 12" length. Lightweight and balanced for easy tossing.', price:38.00, stock:20, images:'["https://images.unsplash.com/photo-1615484477778-ca3b77940c25?w=600&q=80"]', featured:0, status:'approved', weight:120, tags:'maple,tongs,beeswax,kitchen,handcarved' },
    { artisan_id:art2, category_id:catId('home-decor'), name:'Driftwood Wall Shelf', description:'Floating wall shelf made from reclaimed driftwood — each piece uniquely shaped by sea and time. Approx 24" wide with hidden bracket mounting. No two shelves are identical.', price:75.00, stock:6, images:'["https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=600&q=80"]', featured:0, status:'approved', weight:1500, tags:'driftwood,reclaimed,shelf,wall-decor,natural' },
    { artisan_id:art2, category_id:catId('woodwork'), name:'Wooden Spoon Set', description:'Set of 3 hand-carved cooking spoons in walnut, cherry, and maple. Each finished with food-safe oil. A kitchen essential that gets better with every use.', price:55.00, stock:15, images:'["https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=80"]', featured:0, status:'approved', weight:180, tags:'walnut,cherry,maple,spoon,kitchen,handcarved' },
    { artisan_id:art2, category_id:catId('woodwork'), name:'Hand-Planed Oak Notebook Stand', description:'Laptop and notebook stand hand-planed from solid red oak. Groove keeps devices at a comfortable angle. Desk-friendly size 28x22cm.', price:68.00, stock:8, images:'["https://images.unsplash.com/photo-1611486212557-88be5ff027dc?w=600&q=80"]', featured:0, status:'approved', weight:480, tags:'oak,notebook-stand,hand-planed,desk-accessory' },
    { artisan_id:art2, category_id:catId('woodwork'), name:'Walnut Cheese Board', description:'Large serving board in solid black walnut with integrated handle and juice groove. 40x20cm. Beeswax finish. The ideal centrepiece for a cheese spread.', price:72.00, stock:10, images:'["https://images.unsplash.com/photo-1468716912199-dde8d5a90f08?w=600&q=80"]', featured:0, status:'approved', weight:820, tags:'walnut,cheese-board,beeswax,serving,kitchen' },

    // ── Yuki Glass Studio (art3) — Glassware & Home Decor ───────────────────
    { artisan_id:art3, category_id:catId('glassware'), name:'Blown Glass Bud Vase', description:'Delicate hand-blown glass bud vase with iridescent finish. Each piece is unique due to the freeform blowing process. Height: 8". Perfect for a single stem.', price:65.00, stock:10, images:'["https://images.unsplash.com/photo-1481349518771-20055b2a7b24?w=600&q=80"]', featured:1, status:'approved', weight:290, tags:'glass,blown-glass,iridescent,vase,single-stem' },
    { artisan_id:art3, category_id:catId('glassware'), name:'Art Glass Paperweight', description:'Solid hand-blown glass paperweight with swirling encased colours. A stunning desk accessory or collector piece. 3" diameter, weighty and satisfying to hold.', price:48.00, stock:18, images:'["https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?w=600&q=80"]', featured:0, status:'approved', weight:420, tags:'glass,paperweight,swirl,desk-accessory,blown-glass' },
    { artisan_id:art3, category_id:catId('glassware'), name:'Fused Glass Wall Art', description:'Abstract wall art piece made by fusing multiple layers of coloured glass at 850°C. Frame included. 12"x12". Each colour layer creates depth as light passes through.', price:180.00, stock:4, images:'["https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&q=80"]', featured:1, status:'approved', weight:1100, tags:'glass,fused-glass,wall-art,abstract,kiln-formed' },
    { artisan_id:art3, category_id:catId('glassware'), name:'Glass Drinking Set', description:'Set of 4 hand-blown tumblers with a subtle blue tint from cobalt oxide. Approximately 10oz capacity each. Elegant enough for guests, durable enough for daily use.', price:92.00, stock:8, images:'["https://images.unsplash.com/photo-1577401239170-897942555fb3?w=600&q=80"]', featured:0, status:'approved', weight:760, tags:'glass,blown-glass,tumblers,set-of-4,cobalt,blue' },
    { artisan_id:art3, category_id:catId('home-decor'), name:'Glass Wind Chime', description:'Delicate wind chime handmade from pieces of fused dichroic glass suspended on silver-plated wire. Produces a gentle tinkling sound in the breeze. Approx 45cm long.', price:55.00, stock:12, images:'["https://images.unsplash.com/photo-1518481009311-68d14c78f4e1?w=600&q=80"]', featured:0, status:'approved', weight:340, tags:'glass,dichroic,wind-chime,outdoor,silver-wire' },
    { artisan_id:art3, category_id:catId('glassware'), name:'Stained Glass Suncatcher', description:'Hand-cut stained glass suncatcher in a stylised abstract floral pattern. Suspended with a brass chain. 8" diameter. Creates vivid colour projections when sunlit.', price:76.00, stock:11, images:'["https://images.unsplash.com/photo-1504198266614-a82b905aeb91?w=600&q=80"]', featured:1, status:'approved', weight:220, tags:'glass,stained-glass,suncatcher,brass,floral' },
    { artisan_id:art3, category_id:catId('glassware'), name:'Glass Cabinet Knobs Set', description:'Set of 4 hand-blown glass cabinet knobs in pearl white with a hint of lustre. Includes stainless steel mounting screws. 35mm diameter. Transform any cabinet into a statement.', price:38.00, stock:20, images:'["https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80"]', featured:0, status:'approved', weight:120, tags:'glass,blown-glass,cabinet-knob,set-of-4,hardware,pearl' },
    { artisan_id:art3, category_id:catId('glassware'), name:'Rainbow Glass Prism Pendant', description:'Hand-cut optical glass prism pendant on a 50cm sterling silver box chain. Creates rainbow dispersion when sunlit. A wearable work of light art.', price:55.00, stock:15, images:'["https://images.unsplash.com/photo-1541233703-57a4a43ccf88?w=600&q=80"]', featured:0, status:'approved', weight:85, tags:'glass,prism,pendant,silver-chain,rainbow,optical' },

    // ── Sofia Jewelry Atelier (art4) — Jewelry & Home Decor ─────────────────
    { artisan_id:art4, category_id:catId('jewelry'), name:'Raw Silver Signet Ring', description:'Rough-hewn solid sterling silver signet ring with an embedded raw turquoise stone. Hammered band for grip. Adjustable fit. Each ring is shaped by hand, never cast.', price:85.00, stock:12, images:'["https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600&q=80"]', featured:1, status:'approved', weight:12, tags:'sterling-silver,turquoise,signet-ring,adjustable,hammered' },
    { artisan_id:art4, category_id:catId('jewelry'), name:'Gold Leaf Pendant', description:'Delicate 14k gold-filled pendant with a hand-hammered leaf silhouette on an 18" cable chain. Weightless and elegant — a permanent everyday piece.', price:120.00, stock:10, images:'["https://images.unsplash.com/photo-1515562141589-67f0d569b6c9?w=600&q=80"]', featured:1, status:'approved', weight:8, tags:'gold-filled,pendant,leaf,hand-hammered,necklace,14k' },
    { artisan_id:art4, category_id:catId('jewelry'), name:'Pearl Drop Earrings', description:'Freshwater pearl drops on sterling silver ear wires. Elegant and lightweight — 0.5g each. The pearls have a natural baroque shape for organic character.', price:65.00, stock:15, images:'["https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600&q=80"]', featured:0, status:'approved', weight:5, tags:'pearl,sterling-silver,earrings,freshwater,baroque' },
    { artisan_id:art4, category_id:catId('jewelry'), name:'Woven Copper Bracelet', description:'Hand-woven copper wire bracelet with a natural verdigris patina finish. Adjustable clasp fits most wrist sizes. Copper is known for its warmth and grounding properties.', price:45.00, stock:20, images:'["https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=600&q=80"]', featured:0, status:'approved', weight:18, tags:'copper,wire,bracelet,patina,adjustable,verdigris' },
    { artisan_id:art4, category_id:catId('jewelry'), name:'Moonstone Stacker Rings', description:'Set of 3 thin sterling silver stacking rings, one set with a genuine moonstone cabochon. Stack them all or wear one at a time. Each ring is individually polished to a high shine.', price:98.00, stock:8, images:'["https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&q=80"]', featured:0, status:'approved', weight:9, tags:'sterling-silver,moonstone,stacking-rings,set-of-3,cabochon' },
    { artisan_id:art4, category_id:catId('jewelry'), name:'Hammered Silver Hoop Earrings', description:'Large 40mm hammered sterling silver hoop earrings with a secure lever-back closure. A timeless everyday piece that catches light from every angle.', price:58.00, stock:12, images:'["https://images.unsplash.com/photo-1606722590583-d0b18571e15d?w=600&q=80"]', featured:0, status:'approved', weight:8, tags:'sterling-silver,hoop-earrings,hammered,lever-back,40mm' },
    { artisan_id:art4, category_id:catId('home-decor'), name:'Wire Sculpture', description:'Abstract tabletop sculpture handmade from twisted copper and brass wire. A conversation-starting desk accessory or gift. Approx 10" tall on a small marble base.', price:135.00, stock:6, images:'["https://images.unsplash.com/photo-1463320726281-696a3cc57186?w=600&q=80"]', featured:0, status:'approved', weight:340, tags:'copper,brass,wire,sculpture,abstract,desk-art' },

    // ── Okafor Leather Co. (art5) — Leather & Home Decor ────────────────────
    { artisan_id:art5, category_id:catId('leather'), name:'Artisan Satchel Bag', description:'Full-grain vegetable-tanned leather messenger bag with copper rivets and heavy saddle stitching. Develops a rich patina over time. Fits 13" laptop. Each bag takes 8 hours to construct by hand.', price:450.00, stock:3, images:'["https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80","https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80"]', featured:1, status:'approved', weight:1100, tags:'full-grain-leather,vegetable-tanned,copper,saddle-stitch,messenger,laptop' },
    { artisan_id:art5, category_id:catId('leather'), name:'Leather Card Wallet', description:'Slim card wallet hand-stitched from Horween Chromexcel leather. Holds 6 cards and has a central cash slot. The leather softens and conforms to your cards over time.', price:65.00, stock:20, images:'["https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&q=80"]', featured:0, status:'approved', weight:55, tags:'horween,leather,wallet,slim,hand-stitched,chromexcel' },
    { artisan_id:art5, category_id:catId('leather'), name:'Leather Journal Cover', description:'Refillable leather cover for A5 notebooks with closure strap and brass snap button. Fits any standard A5 insert. Improves with every use.', price:78.00, stock:12, images:'["https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&q=80"]', featured:1, status:'approved', weight:230, tags:'leather,journal,A5,brass,refillable,notebook' },
    { artisan_id:art5, category_id:catId('leather'), name:'Leather Belt', description:'Hand-cut full-grain leather belt with a solid brass roller buckle. 1.5" width. Specify your waist size at checkout — custom sizing at no extra charge.', price:95.00, stock:10, images:'["https://images.unsplash.com/photo-1543286386-2e659306cd6c?w=600&q=80"]', featured:0, status:'approved', weight:190, tags:'full-grain-leather,belt,brass,handcut,custom-sizing' },
    { artisan_id:art5, category_id:catId('leather'), name:'Leather Key Fob', description:'Simple keychain fob hand-punched and stitched from vegetable-tanned leather with a solid brass D-ring. The perfect small leather gift — and a great introduction to Okafor quality.', price:22.00, stock:30, images:'["https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600&q=80"]', featured:0, status:'approved', weight:30, tags:'leather,key-fob,brass,gift,vegetable-tanned' },
    { artisan_id:art5, category_id:catId('leather'), name:'Leather Portfolio Case', description:'Full-grain leather portfolio case for A4 documents with zip closure and interior pockets. Executive finish in dark cognac. Makes any boardroom impression.', price:185.00, stock:6, images:'["https://images.unsplash.com/photo-1619086009537-2eb2a4a7ed97?w=600&q=80"]', featured:1, status:'approved', weight:650, tags:'full-grain-leather,portfolio,cognac,zip,executive,A4' },
    { artisan_id:art5, category_id:catId('leather'), name:'Suede Coin Pouch', description:'Soft suede coin pouch with antique brass zip closure. 10x8cm — small enough for a jacket pocket. Available in tobacco brown and forest green.', price:38.00, stock:18, images:'["https://images.unsplash.com/photo-1547448415-e9f5b28e570d?w=600&q=80"]', featured:0, status:'approved', weight:75, tags:'suede,coin-pouch,brass-zip,small,pocket,tobacco' },
    { artisan_id:art5, category_id:catId('home-decor'), name:'Braided Leather Plant Hanger', description:'Hand-braided leather plant hanger with a brass ring and adjustable drop length. Designed for 6" to 8" pots. Adds warmth and texture to any interior.', price:49.00, stock:14, images:'["https://images.unsplash.com/photo-1476231682828-37e571bc172f?w=600&q=80"]', featured:0, status:'approved', weight:155, tags:'leather,braided,plant-hanger,brass,adjustable,interior' },

    // ── Noor's Textile Studio (art6) — Textiles, Home Decor & Paintings ─────
    { artisan_id:art6, category_id:catId('textiles'), name:'Hand-Embroidered Silk Scarf', description:'Luxurious 100% silk scarf hand-embroidered with floral motifs using thread dyed with natural botanical extracts. 180x45cm. Each scarf takes two weeks to complete.', price:95.00, stock:10, images:'["https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&q=80"]', featured:1, status:'approved', weight:180, tags:'silk,embroidery,botanical-dye,scarf,hand-embroidered,luxury' },
    { artisan_id:art6, category_id:catId('textiles'), name:'Batik Print Table Runner', description:'Contemporary batik-print cotton table runner in indigo and cream. Hand-waxed and dyed using traditional Indonesian tjanting technique. 180x40cm. Washable.', price:55.00, stock:18, images:'["https://images.unsplash.com/photo-1508700929628-c6bafe98cddf?w=600&q=80"]', featured:0, status:'approved', weight:220, tags:'batik,cotton,indigo,table-runner,wax-resist,tjanting' },
    { artisan_id:art6, category_id:catId('home-decor'), name:'Macramé Wall Hanging', description:'Large macramé wall hanging made from natural undyed cotton cord with driftwood bar. 60cm wide x 90cm long. The boho-chic focal point for any living room wall.', price:78.00, stock:8, images:'["https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=600&q=80"]', featured:1, status:'approved', weight:420, tags:'macramé,cotton-cord,driftwood,wall-decor,boho,natural' },
    { artisan_id:art6, category_id:catId('textiles'), name:'Hand-Woven Prayer Mat', description:'Traditional Bahraini-style hand-woven prayer mat in burgundy, ivory and gold geometric patterns. Soft wool pile. 60x90cm. Each mat takes approximately one week to weave.', price:135.00, stock:6, images:'["https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=600&q=80"]', featured:1, status:'approved', weight:650, tags:'hand-woven,wool,prayer-mat,geometric,traditional,bahraini' },
    { artisan_id:art6, category_id:catId('paintings'), name:'Watercolor Botanical Print', description:'Original A3 watercolor painting of native Bahraini flora — sidr tree blossoms, ghaf leaves, and wild aster. Signed and dated. Mounted on acid-free board. Framing available on request.', price:115.00, stock:4, images:'["https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600&q=80"]', featured:0, status:'approved', weight:280, tags:'watercolor,botanical,original,painting,flora,bahraini' },
    { artisan_id:art6, category_id:catId('textiles'), name:'Linen Cushion Cover', description:'Hand-embroidered natural linen cushion cover with a traditional geometric border pattern. 50x50cm, hidden zip closure. Insert not included. Machine washable on gentle cycle.', price:42.00, stock:20, images:'["https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=600&q=80"]', featured:0, status:'approved', weight:240, tags:'linen,hand-embroidered,cushion,geometric,natural,zip' },

    // ── Al-Farsi Craft House (art7) — Jewelry ───────────────────────────────
    { artisan_id:art7, category_id:catId('jewelry'), name:'Hammered Gold Bangle', description:'14k gold-filled bangle with a hand-hammered texture. Hypoallergenic, tarnish-resistant. Inner diameter 65mm — fits most wrists. Ships in a premium gift box.', price:145.00, stock:8, images:'["https://images.unsplash.com/photo-1493106814774-7a1af2d9ab8b?w=600&q=80"]', featured:1, status:'approved', weight:22, tags:'gold-fill,bangle,hammered,hypoallergenic,14k,gift-ready' },
    { artisan_id:art7, category_id:catId('jewelry'), name:'Lapis Lazuli Pendant', description:'Natural Afghan lapis lazuli cabochon set in a brushed sterling silver bezel. Includes a 45cm snake chain. The deep blue with golden pyrite flecks is mesmerising.', price:110.00, stock:10, images:'["https://images.unsplash.com/photo-1560343319-1f5a7ae0f3e9?w=600&q=80"]', featured:1, status:'approved', weight:14, tags:'lapis-lazuli,sterling-silver,bezel,pendant,natural-stone,afghan' },
    { artisan_id:art7, category_id:catId('jewelry'), name:'Braided Silver Choker', description:'Sterling silver wire choker hand-braided into a tight 5mm wide band. Lobster clasp closure. One-size: 36cm. A bold, modern statement piece.', price:88.00, stock:12, images:'["https://images.unsplash.com/photo-1534139871063-8d9f10f3d994?w=600&q=80"]', featured:0, status:'approved', weight:18, tags:'sterling-silver,braided,choker,wire-work,925' },
    { artisan_id:art7, category_id:catId('jewelry'), name:'Carnelian Drop Earrings', description:'Faceted carnelian teardrops (8mm) wire-wrapped in 14k gold-filled wire with threader ear wires. Lightweight at 5g each. The warm orange-red stone is energising.', price:72.00, stock:14, images:'["https://images.unsplash.com/photo-1587578016785-2028dad13c60?w=600&q=80"]', featured:0, status:'approved', weight:10, tags:'carnelian,gold-fill,drop-earrings,wire-wrapped,faceted,14k' },
    { artisan_id:art7, category_id:catId('jewelry'), name:'Turquoise Cuff Bracelet', description:'Wide 20mm sterling silver cuff bracelet with a Sleeping Beauty turquoise stone inlay. Fits 7–7.5" wrist. Hallmarked 925. Includes authenticity certificate from Al-Farsi.', price:160.00, stock:5, images:'["https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=600&q=80"]', featured:1, status:'approved', weight:35, tags:'turquoise,sterling-silver,cuff,925,sleeping-beauty,hallmarked' },

    // ── Cross-category (shared between artisans or mixed categories) ─────────
    { artisan_id:art3, category_id:catId('textiles'), name:'Indigo Woven Wall Hanging', description:'Hand-woven indigo-dyed wool wall hanging with abstract geometric patterns and long tassels. 24"x36". The indigo is fixed with alum mordant for long-lasting colour depth.', price:210.00, stock:5, images:'["https://images.unsplash.com/photo-1416323426898-8de3e24394d1?w=600&q=80"]', featured:1, status:'approved', weight:680, tags:'wool,indigo,woven,wall-hanging,geometric,textiles,mordant' },
    { artisan_id:art1, category_id:catId('paintings'), name:'Abstract Ceramic Tile Art', description:'Set of 9 hand-painted ceramic tiles that form a cohesive abstract landscape. Wall-mount as a group or arrange individually. Each tile 10x10cm.', price:275.00, stock:3, images:'["https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&q=80"]', featured:0, status:'approved', weight:2200, tags:'ceramic,tile,hand-painted,wall-art,abstract,set-of-9,landscape' },
    { artisan_id:art2, category_id:catId('home-decor'), name:'Wooden Candle Holders', description:'Set of 3 turned wooden candle holders in graduated heights. Made from reclaimed teak with a natural oil finish. The trio makes a beautiful centerpiece or mantle arrangement.', price:58.00, stock:10, images:'["https://images.unsplash.com/photo-1602028915047-37269d1a73f7?w=600&q=80"]', featured:0, status:'approved', weight:520, tags:'teak,reclaimed,candle-holder,set-of-3,turned,centerpiece' }
  ];

    const insProd = db.prepare('INSERT INTO products (artisan_id,category_id,name,description,price,stock,images,featured,status,is_active,weight,tags) VALUES (?,?,?,?,?,?,?,?,?,1,?,?)');
    products.forEach(p => insProd.run(p.artisan_id, p.category_id, p.name, p.description, p.price, p.stock, p.images, p.featured, p.status, p.weight || null, p.tags || null));

    // Get product IDs
    const pid = (name) => requireSingleId(db, 'SELECT id FROM products WHERE name=?', name, 'product name');

    // ── Orders ──
    console.log('Creating orders...');
    const insOrder = db.prepare('INSERT INTO orders (user_id,subtotal,shipping_cost,discount_amount,total_amount,status,payment_method,payment_status,shipping_address,shipping_city,shipping_country,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
    const insItem = db.prepare('INSERT INTO order_items (order_id,product_id,artisan_id,quantity,unit_price,total_price) VALUES (?,?,?,?,?,?)');

    const now = Date.now();
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
  insItem.run(o3.lastInsertRowid, pid('Cherry Wood Serving Tray'), art2, 1, 110.00, 110.00);
  insItem.run(o3.lastInsertRowid, pid('Pearl Drop Earrings'), art4, 1, 65.00, 65.00);

    // Order 4 - Delivered (different customer)
    const o4 = insOrder.run(cust3, 150.00, 0, 0, 150.00, 'delivered', 'card', 'paid', '78 Harbour Lane', 'Muharraq', 'Bahrain', new Date(now - 20*dayMs).toISOString());
  insItem.run(o4.lastInsertRowid, pid('Raw Silver Signet Ring'), art4, 1, 85.00, 85.00);
  insItem.run(o4.lastInsertRowid, pid('Blown Glass Bud Vase'), art3, 1, 65.00, 65.00);

    // Order 5 - Shipped
    const o5 = insOrder.run(cust2, 450.00, 0, 0, 450.00, 'shipped', 'card', 'paid', '45 Pearl Road', 'Riffa', 'Bahrain', new Date(now - 3*dayMs).toISOString());
  insItem.run(o5.lastInsertRowid, pid('Artisan Satchel Bag'), art5, 1, 450.00, 450.00);

    // Order 6 - Confirmed (liam)
    const o6 = insOrder.run(cust4, 54.00, 0, 0, 54.00, 'confirmed', 'card', 'paid', '12 Falcon Lane', 'Manama', 'Bahrain', new Date(now - 2*dayMs).toISOString());
  insItem.run(o6.lastInsertRowid, pid('Ceramic Oil Diffuser'), art1, 1, 54.00, 54.00);

    // Order 7 - Delivered (sara)
    const o7 = insOrder.run(cust5, 76.00, 0, 0, 76.00, 'delivered', 'card', 'paid', '33 Jasmine Court', 'Riffa', 'Bahrain', new Date(now - 12*dayMs).toISOString());
  insItem.run(o7.lastInsertRowid, pid('Stained Glass Suncatcher'), art3, 1, 76.00, 76.00);

    // Order 8 - Processing (liam)
    const o8 = insOrder.run(cust4, 67.00, 0, 0, 67.00, 'processing', 'card', 'paid', '12 Falcon Lane', 'Manama', 'Bahrain', new Date(now - 0.5*dayMs).toISOString());
  insItem.run(o8.lastInsertRowid, pid('Woven Copper Bracelet'), art4, 1, 45.00, 45.00);
  insItem.run(o8.lastInsertRowid, pid('Leather Key Fob'), art5, 1, 22.00, 22.00);

    // Order 9 - Delivered (fatima — silk scarf + carnelian earrings)
    const o9 = insOrder.run(cust6, 167.00, 0, 0, 167.00, 'delivered', 'card', 'paid', '8 Seef District', 'Manama', 'Bahrain', new Date(now - 25*dayMs).toISOString());
  insItem.run(o9.lastInsertRowid, pid('Hand-Embroidered Silk Scarf'), art6, 1, 95.00, 95.00);
  insItem.run(o9.lastInsertRowid, pid('Carnelian Drop Earrings'), art7, 1, 72.00, 72.00);

    // Order 10 - Delivered (khalid — hammered bangle)
    const o10 = insOrder.run(cust7, 145.00, 0, 0, 145.00, 'delivered', 'card', 'paid', '22 Al Hidd Road', 'Muharraq', 'Bahrain', new Date(now - 18*dayMs).toISOString());
  insItem.run(o10.lastInsertRowid, pid('Hammered Gold Bangle'), art7, 1, 145.00, 145.00);

    // Order 11 - Delivered (jana — walnut stool)
    const o11 = insOrder.run(cust8, 320.00, 0, 0, 320.00, 'delivered', 'card', 'paid', '17 Budaiya Highway', 'Manama', 'Bahrain', new Date(now - 15*dayMs).toISOString());
  insItem.run(o11.lastInsertRowid, pid('Walnut Joinery Stool'), art2, 1, 320.00, 320.00);

    // Order 12 - Shipped (john — lapis pendant + leather wallet)
    const o12 = insOrder.run(cust1, 175.00, 0, 0, 175.00, 'shipped', 'card', 'paid', '123 Main Street', 'Manama', 'Bahrain', new Date(now - 7*dayMs).toISOString());
  insItem.run(o12.lastInsertRowid, pid('Lapis Lazuli Pendant'), art7, 1, 110.00, 110.00);
  insItem.run(o12.lastInsertRowid, pid('Leather Card Wallet'), art5, 1, 65.00, 65.00);

    // Order 13 - Delivered (sarah — prayer mat)
    const o13 = insOrder.run(cust2, 135.00, 0, 0, 135.00, 'delivered', 'cash', 'paid', '45 Pearl Road', 'Riffa', 'Bahrain', new Date(now - 20*dayMs).toISOString());
  insItem.run(o13.lastInsertRowid, pid('Hand-Woven Prayer Mat'), art6, 1, 135.00, 135.00);

    // Order 14 - Processing (omar — walnut cheese board + espresso cups)
    const o14 = insOrder.run(cust3, 120.00, 0, 0, 120.00, 'processing', 'card', 'paid', '78 Harbour Lane', 'Muharraq', 'Bahrain', new Date(now - 3*dayMs).toISOString());
  insItem.run(o14.lastInsertRowid, pid('Walnut Cheese Board'), art2, 1, 72.00, 72.00);
  insItem.run(o14.lastInsertRowid, pid('Matte Black Espresso Cup Set'), art1, 1, 48.00, 48.00);

    // Order 15 - Delivered (sara — silver hoops + carnelian earrings)
    const o15 = insOrder.run(cust5, 130.00, 0, 0, 130.00, 'delivered', 'card', 'paid', '33 Jasmine Court', 'Riffa', 'Bahrain', new Date(now - 10*dayMs).toISOString());
  insItem.run(o15.lastInsertRowid, pid('Hammered Silver Hoop Earrings'), art4, 1, 58.00, 58.00);
  insItem.run(o15.lastInsertRowid, pid('Carnelian Drop Earrings'), art7, 1, 72.00, 72.00);

    // Order 16 - Pending (fatima — leather portfolio)
    const o16 = insOrder.run(cust6, 185.00, 0, 0, 185.00, 'pending', 'card', 'paid', '8 Seef District', 'Manama', 'Bahrain', new Date(now - 1*dayMs).toISOString());
  insItem.run(o16.lastInsertRowid, pid('Leather Portfolio Case'), art5, 1, 185.00, 185.00);

    // Order 17 - Shipped (khalid — macramé hanging + oak cutting board)
    const o17 = insOrder.run(cust7, 163.00, 0, 0, 163.00, 'shipped', 'card', 'paid', '22 Al Hidd Road', 'Muharraq', 'Bahrain', new Date(now - 4*dayMs).toISOString());
  insItem.run(o17.lastInsertRowid, pid('Macramé Wall Hanging'), art6, 1, 78.00, 78.00);
  insItem.run(o17.lastInsertRowid, pid('Oak Cutting Board'), art2, 1, 85.00, 85.00);

    // Order 18 - Confirmed (jana — glass drinking set)
    const o18 = insOrder.run(cust8, 92.00, 0, 0, 92.00, 'confirmed', 'card', 'paid', '17 Budaiya Highway', 'Manama', 'Bahrain', new Date(now - 2*dayMs).toISOString());
  insItem.run(o18.lastInsertRowid, pid('Glass Drinking Set'), art3, 1, 92.00, 92.00);

    // ── Orders 19-24 (additional richness) ──
    // Order 19 - Delivered (john — ceramic incense holder + wooden spoon set)
    const o19 = insOrder.run(cust1, 83.00, 0, 0, 83.00, 'delivered', 'card', 'paid', '123 Main Street', 'Manama', 'Bahrain', new Date(now - 30*dayMs).toISOString());
  insItem.run(o19.lastInsertRowid, pid('Ceramic Incense Holder'), art1, 1, 28.00, 28.00);
  insItem.run(o19.lastInsertRowid, pid('Wooden Spoon Set'), art2, 1, 55.00, 55.00);

    // Order 20 - Processing (sarah — gold leaf pendant)
    const o20 = insOrder.run(cust2, 120.00, 0, 0, 120.00, 'processing', 'card', 'paid', '45 Pearl Road', 'Riffa', 'Bahrain', new Date(now - 1*dayMs).toISOString());
  insItem.run(o20.lastInsertRowid, pid('Gold Leaf Pendant'), art4, 1, 120.00, 120.00);

    // Order 21 - Confirmed (omar — glass cabinet knobs + rainbow prism pendant)
    const o21 = insOrder.run(cust3, 93.00, 0, 0, 93.00, 'confirmed', 'card', 'paid', '78 Harbour Lane', 'Muharraq', 'Bahrain', new Date(now - 2*dayMs).toISOString());
  insItem.run(o21.lastInsertRowid, pid('Glass Cabinet Knobs Set'), art3, 1, 38.00, 38.00);
  insItem.run(o21.lastInsertRowid, pid('Rainbow Glass Prism Pendant'), art3, 1, 55.00, 55.00);

    // Order 22 - Delivered (liam — leather journal cover)
    const o22 = insOrder.run(cust4, 78.00, 0, 0, 78.00, 'delivered', 'cash', 'paid', '12 Falcon Lane', 'Manama', 'Bahrain', new Date(now - 22*dayMs).toISOString());
  insItem.run(o22.lastInsertRowid, pid('Leather Journal Cover'), art5, 1, 78.00, 78.00);

    // Order 23 - Delivered (sara — indigo woven wall hanging)
    const o23 = insOrder.run(cust5, 210.00, 0, 0, 210.00, 'delivered', 'card', 'paid', '33 Jasmine Court', 'Riffa', 'Bahrain', new Date(now - 16*dayMs).toISOString());
  insItem.run(o23.lastInsertRowid, pid('Indigo Woven Wall Hanging'), art3, 1, 210.00, 210.00);

    // Order 24 - Delivered (fatima — braided silver choker + carnelian drop earrings)
    const o24 = insOrder.run(cust6, 160.00, 0, 0, 160.00, 'delivered', 'card', 'paid', '8 Seef District', 'Manama', 'Bahrain', new Date(now - 28*dayMs).toISOString());
  insItem.run(o24.lastInsertRowid, pid('Braided Silver Choker'), art7, 1, 88.00, 88.00);
  insItem.run(o24.lastInsertRowid, pid('Carnelian Drop Earrings'), art7, 1, 72.00, 72.00);

    // ── Shipments ──
    console.log('Creating shipments...');
    const insShip = db.prepare('INSERT INTO shipments (order_id,tracking_number,carrier,status,estimated_delivery,history) VALUES (?,?,?,?,?,?)');
  insShip.run(o1.lastInsertRowid, 'CRF'+uuidv4().substring(0,8).toUpperCase(), 'Craftify Express', 'delivered', new Date(now - 10*dayMs).toISOString(), JSON.stringify([{status:'delivered',timestamp:new Date(now-10*dayMs).toISOString(),location:'Manama Sorting Center'}]));
  insShip.run(o2.lastInsertRowid, 'CRF'+uuidv4().substring(0,8).toUpperCase(), 'Craftify Express', 'in_transit', new Date(now + 2*dayMs).toISOString(), JSON.stringify([{status:'shipped',timestamp:new Date(now-3*dayMs).toISOString(),location:'Muharraq Warehouse'},{status:'in_transit',timestamp:new Date(now-1*dayMs).toISOString(),location:'Riffa Distribution Hub'}]));
  insShip.run(o3.lastInsertRowid, 'CRF'+uuidv4().substring(0,8).toUpperCase(), 'Craftify Express', 'processing', new Date(now + 5*dayMs).toISOString(), JSON.stringify([{status:'processing',timestamp:new Date(now-1*dayMs).toISOString(),location:'Isa Town Depot'}]));
  insShip.run(o4.lastInsertRowid, 'CRF'+uuidv4().substring(0,8).toUpperCase(), 'Craftify Express', 'delivered', new Date(now - 16*dayMs).toISOString(), JSON.stringify([{status:'delivered',timestamp:new Date(now-16*dayMs).toISOString(),location:'Muharraq Warehouse'}]));
  insShip.run(o5.lastInsertRowid, 'CRF'+uuidv4().substring(0,8).toUpperCase(), 'Craftify Express', 'shipped', new Date(now + 4*dayMs).toISOString(), JSON.stringify([{status:'shipped',timestamp:new Date(now-2*dayMs).toISOString(),location:'Hamad Town Facility'}]));
  insShip.run(o6.lastInsertRowid, 'CRF'+uuidv4().substring(0,8).toUpperCase(), 'Craftify Express', 'processing', new Date(now + 3*dayMs).toISOString(), JSON.stringify([{status:'processing',timestamp:new Date(now-1*dayMs).toISOString(),location:'Manama Sorting Center'}]));
  insShip.run(o7.lastInsertRowid, 'CRF'+uuidv4().substring(0,8).toUpperCase(), 'Craftify Express', 'delivered', new Date(now - 8*dayMs).toISOString(), JSON.stringify([{status:'delivered',timestamp:new Date(now-8*dayMs).toISOString(),location:'Riffa Distribution Hub'}]));
  insShip.run(o8.lastInsertRowid, 'CRF'+uuidv4().substring(0,8).toUpperCase(), 'Craftify Express', 'processing', new Date(now + 6*dayMs).toISOString(), JSON.stringify([{status:'processing',timestamp:new Date(now-0.4*dayMs).toISOString(),location:'Manama Sorting Center'}]));

  // Shipments 9-18
  insShip.run(o9.lastInsertRowid,  'CRF'+uuidv4().substring(0,8).toUpperCase(), 'Craftify Express', 'delivered', new Date(now - 20*dayMs).toISOString(), JSON.stringify([{status:'delivered',timestamp:new Date(now-20*dayMs).toISOString(),location:'Manama Hub'}]));
  insShip.run(o10.lastInsertRowid, 'CRF'+uuidv4().substring(0,8).toUpperCase(), 'Craftify Express', 'delivered', new Date(now - 13*dayMs).toISOString(), JSON.stringify([{status:'delivered',timestamp:new Date(now-13*dayMs).toISOString(),location:'Muharraq Facility'}]));
  insShip.run(o11.lastInsertRowid, 'CRF'+uuidv4().substring(0,8).toUpperCase(), 'Craftify Express', 'delivered', new Date(now - 10*dayMs).toISOString(), JSON.stringify([{status:'delivered',timestamp:new Date(now-10*dayMs).toISOString(),location:'Manama Hub'}]));
  insShip.run(o12.lastInsertRowid, 'CRF'+uuidv4().substring(0,8).toUpperCase(), 'Craftify Express', 'in_transit', new Date(now +  3*dayMs).toISOString(), JSON.stringify([{status:'shipped',timestamp:new Date(now-5*dayMs).toISOString(),location:'Isa Town Depot'},{status:'in_transit',timestamp:new Date(now-2*dayMs).toISOString(),location:'Riffa Distribution Hub'}]));
  insShip.run(o13.lastInsertRowid, 'CRF'+uuidv4().substring(0,8).toUpperCase(), 'Craftify Express', 'delivered', new Date(now - 15*dayMs).toISOString(), JSON.stringify([{status:'delivered',timestamp:new Date(now-15*dayMs).toISOString(),location:'Riffa Hub'}]));
  insShip.run(o14.lastInsertRowid, 'CRF'+uuidv4().substring(0,8).toUpperCase(), 'Craftify Express', 'processing', new Date(now +  5*dayMs).toISOString(), JSON.stringify([{status:'processing',timestamp:new Date(now-2*dayMs).toISOString(),location:'Muharraq Facility'}]));
  insShip.run(o15.lastInsertRowid, 'CRF'+uuidv4().substring(0,8).toUpperCase(), 'Craftify Express', 'delivered', new Date(now -  6*dayMs).toISOString(), JSON.stringify([{status:'delivered',timestamp:new Date(now-6*dayMs).toISOString(),location:'Riffa Hub'}]));
  insShip.run(o16.lastInsertRowid, 'CRF'+uuidv4().substring(0,8).toUpperCase(), 'Craftify Express', 'processing', new Date(now +  7*dayMs).toISOString(), JSON.stringify([{status:'processing',timestamp:new Date(now-0.5*dayMs).toISOString(),location:'Manama Sorting Center'}]));
  insShip.run(o17.lastInsertRowid, 'CRF'+uuidv4().substring(0,8).toUpperCase(), 'Craftify Express', 'in_transit', new Date(now +  3*dayMs).toISOString(), JSON.stringify([{status:'shipped',timestamp:new Date(now-3*dayMs).toISOString(),location:'Muharraq Facility'},{status:'in_transit',timestamp:new Date(now-1*dayMs).toISOString(),location:'Manama Sorting Center'}]));
  insShip.run(o18.lastInsertRowid, 'CRF'+uuidv4().substring(0,8).toUpperCase(), 'Craftify Express', 'processing', new Date(now +  5*dayMs).toISOString(), JSON.stringify([{status:'processing',timestamp:new Date(now-1.5*dayMs).toISOString(),location:'Manama Hub'}]));

  // Shipments 19-24
  insShip.run(o19.lastInsertRowid, 'CRF'+uuidv4().substring(0,8).toUpperCase(), 'Craftify Express', 'delivered', new Date(now - 25*dayMs).toISOString(), JSON.stringify([{status:'shipped',timestamp:new Date(now-29*dayMs).toISOString(),location:'Manama Sorting Center'},{status:'delivered',timestamp:new Date(now-25*dayMs).toISOString(),location:'Manama Hub'}]));
  insShip.run(o20.lastInsertRowid, 'CRF'+uuidv4().substring(0,8).toUpperCase(), 'Craftify Express', 'processing', new Date(now +  6*dayMs).toISOString(), JSON.stringify([{status:'processing',timestamp:new Date(now-0.5*dayMs).toISOString(),location:'Isa Town Depot'}]));
  insShip.run(o21.lastInsertRowid, 'CRF'+uuidv4().substring(0,8).toUpperCase(), 'Craftify Express', 'processing', new Date(now +  4*dayMs).toISOString(), JSON.stringify([{status:'processing',timestamp:new Date(now-1*dayMs).toISOString(),location:'Riffa Distribution Hub'}]));
  insShip.run(o22.lastInsertRowid, 'CRF'+uuidv4().substring(0,8).toUpperCase(), 'Craftify Express', 'delivered', new Date(now - 18*dayMs).toISOString(), JSON.stringify([{status:'shipped',timestamp:new Date(now-21*dayMs).toISOString(),location:'Hamad Town Facility'},{status:'delivered',timestamp:new Date(now-18*dayMs).toISOString(),location:'Manama Hub'}]));
  insShip.run(o23.lastInsertRowid, 'CRF'+uuidv4().substring(0,8).toUpperCase(), 'Craftify Express', 'delivered', new Date(now - 12*dayMs).toISOString(), JSON.stringify([{status:'shipped',timestamp:new Date(now-15*dayMs).toISOString(),location:'Riffa Warehouse'},{status:'delivered',timestamp:new Date(now-12*dayMs).toISOString(),location:'Riffa Distribution Hub'}]));
  insShip.run(o24.lastInsertRowid, 'CRF'+uuidv4().substring(0,8).toUpperCase(), 'Craftify Express', 'delivered', new Date(now - 23*dayMs).toISOString(), JSON.stringify([{status:'shipped',timestamp:new Date(now-27*dayMs).toISOString(),location:'Manama Sorting Center'},{status:'delivered',timestamp:new Date(now-23*dayMs).toISOString(),location:'Manama Hub'}]));

    // ── Auctions ──
    console.log('Creating auctions...');
    // images field holds JSON array of image URLs for each auction (used when no product_id)
    const insAuc = db.prepare('INSERT INTO auctions (product_id,artisan_id,title,description,images,starting_price,starting_bid,current_highest_bid,bid_increment,start_time,end_time,status,winner_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');

    // Active auction 1 - longer campaign (9 days remaining)
    const auc1Res = insAuc.run(
      pid('Vintage Kiln-Fired Vase'),
      art1,
      'Vintage Kiln-Fired Vase',
      'Rare kiln-fired vase from master ceramicist Elena Rodriguez. One-of-a-kind piece created during a 72-hour wood firing — ash glaze, hand-thrown form, signed on the base.',
      '["https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=600&q=80","https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=600&q=80"]',
      80.00, 80.00,
      145.00,
      5.00,
      new Date(now - (3 * dayMs)).toISOString(),
      new Date(now + (9 * dayMs)).toISOString(),
      'active',
      null
    );
    // Active auction 2 - mid-length campaign (7 days remaining)
    const auc2Res = insAuc.run(
      pid('Indigo Woven Wall Hanging'),
      art3,
      'Indigo Woven Wall Hanging',
      'Stunning hand-woven indigo piece — alum-mordanted wool, abstract geometric patterns. Bid now for this gallery-worthy statement piece.',
      '["https://images.unsplash.com/photo-1416323426898-8de3e24394d1?w=600&q=80"]',
      120.00, 120.00,
      210.00,
      10.00,
      new Date(now - 2 * dayMs).toISOString(),
      new Date(now + 7 * dayMs).toISOString(),
      'active',
      null
    );
    // Active auction 3 - long running (14 days remaining)
    const auc3Res = insAuc.run(
      pid('Raw Silver Signet Ring'),
      art4,
      'Raw Silver Signet Ring — Collector Edition',
      'Handcrafted sterling silver signet ring with raw turquoise. A one-piece studio run — Sofia will not make another. A true collector piece.',
      '["https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600&q=80"]',
      50.00, 50.00,
      85.00,
      5.00,
      new Date(now - 1 * dayMs).toISOString(),
      new Date(now + 14 * dayMs).toISOString(),
      'active',
      null
    );
    // Ended auction (sold)
    const auc4Res = insAuc.run(
      pid('Fused Glass Wall Art'),
      art3,
      'Fused Glass Wall Art — Studio Auction',
      'Beautiful kiln-formed abstract glass art piece. 12x12" with bespoke frame. This auction has ended.',
      '["https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&q=80"]',
      100.00, 100.00,
      220.00,
      10.00,
      new Date(now - 10 * dayMs).toISOString(),
      new Date(now - 3 * dayMs).toISOString(),
      'sold',
      cust1
    );
    // Active auction 5 - premium leather piece (21 days remaining)
    const auc5Res = insAuc.run(
      pid('Artisan Satchel Bag'),
      art5,
      'Artisan Satchel Bag — Collector Drop',
      'Limited-run satchel crafted from premium full-grain vegetable-tanned leather. Copper rivets and heavy saddle stitching. Long-form bidding window for collectors.',
      '["https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80","https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80"]',
      220.00, 220.00,
      340.00,
      15.00,
      new Date(now - 1 * dayMs).toISOString(),
      new Date(now + 21 * dayMs).toISOString(),
      'active',
      null
    );
    // Pending auction — starts in 2 days
    const auc6Res = insAuc.run(
      pid('Moonstone Stacker Rings'),
      art4,
      'Moonstone Stacker Rings — Studio Reserve',
      'Upcoming monthly auction drop for a hand-finished moonstone ring set from Sofia Jewelry Atelier.',
      '["https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&q=80"]',
      70.00, 70.00,
      null,
      5.00,
      new Date(now + 2 * dayMs).toISOString(),
      new Date(now + 35 * dayMs).toISOString(),
      'pending',
      null
    );
    // Active auction 7 - Watercolor Botanical Print (art6)
    const auc7Res = insAuc.run(
      pid('Watercolor Botanical Print'),
      art6,
      'Watercolor Botanical Print — Studio Auction',
      'Unique original A3 watercolor by Noor Al-Rashid. Native Bahraini flora in vivid natural pigments. Signed, dated, acid-free mounted. Open to international shipping.',
      '["https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600&q=80"]',
      70.00, 70.00,
      115.00,
      5.00,
      new Date(now - 2 * dayMs).toISOString(),
      new Date(now + 10 * dayMs).toISOString(),
      'active',
      null
    );
    // Active auction 8 - Turquoise Cuff Bracelet (art7)
    const auc8Res = insAuc.run(
      pid('Turquoise Cuff Bracelet'),
      art7,
      'Turquoise Cuff Bracelet — Collector Bid',
      'Wide sterling silver cuff with Sleeping Beauty turquoise. Hallmarked 925 with authenticity certificate. Limited artisan edition from Al-Farsi Craft House.',
      '["https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=600&q=80"]',
      95.00, 95.00,
      160.00,
      10.00,
      new Date(now - 1 * dayMs).toISOString(),
      new Date(now + 12 * dayMs).toISOString(),
      'active',
      null
    );
    // Active auction 9 - Blown Glass Bud Vase (art3, 5 days remaining)
    const auc9Res = insAuc.run(
      pid('Blown Glass Bud Vase'),
      art3,
      'Blown Glass Bud Vase — Limited Edition',
      'Freeform hand-blown glass bud vase with an iridescent finish that shifts from silver to rose. Each piece is unique. This is a one-off studio piece — not a production run.',
      '["https://images.unsplash.com/photo-1481349518771-20055b2a7b24?w=600&q=80"]',
      40.00, 40.00,
      78.00,
      5.00,
      new Date(now - 2 * dayMs).toISOString(),
      new Date(now + 5 * dayMs).toISOString(),
      'active',
      null
    );
    // Active auction 10 - Hand-Embroidered Silk Scarf (art6, 8 days remaining)
    const auc10Res = insAuc.run(
      pid('Hand-Embroidered Silk Scarf'),
      art6,
      'Hand-Embroidered Silk Scarf — Noor Studio Auction',
      'Luxurious 100% silk scarf with hand-embroidered floral motifs using botanical-dyed thread. Two weeks to make, one of a kind. Ships worldwide with tracked express delivery.',
      '["https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&q=80"]',
      60.00, 60.00,
      105.00,
      5.00,
      new Date(now - 3 * dayMs).toISOString(),
      new Date(now + 8 * dayMs).toISOString(),
      'active',
      null
    );

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

  // Bids on long-running premium auction
  insBid.run(auc5Res.lastInsertRowid, cust1, 235.00, 0, new Date(now - 0.9*dayMs).toISOString());
  insBid.run(auc5Res.lastInsertRowid, cust2, 255.00, 0, new Date(now - 0.75*dayMs).toISOString());
  insBid.run(auc5Res.lastInsertRowid, cust3, 270.00, 0, new Date(now - 0.6*dayMs).toISOString());
  insBid.run(auc5Res.lastInsertRowid, cust1, 290.00, 0, new Date(now - 0.45*dayMs).toISOString());
  insBid.run(auc5Res.lastInsertRowid, cust2, 305.00, 0, new Date(now - 0.3*dayMs).toISOString());
  insBid.run(auc5Res.lastInsertRowid, cust3, 320.00, 0, new Date(now - 0.2*dayMs).toISOString());
  insBid.run(auc5Res.lastInsertRowid, cust1, 335.00, 0, new Date(now - 0.12*dayMs).toISOString());
  insBid.run(auc5Res.lastInsertRowid, cust2, 340.00, 1, new Date(now - 0.08*dayMs).toISOString());

  // Bids on auction 7 (Watercolor Botanical Print)
  insBid.run(auc7Res.lastInsertRowid, cust7, 80.00,  0, new Date(now - 1.5*dayMs).toISOString());
  insBid.run(auc7Res.lastInsertRowid, cust6, 95.00,  0, new Date(now - 0.8*dayMs).toISOString());
  insBid.run(auc7Res.lastInsertRowid, cust1, 110.00, 0, new Date(now - 0.5*dayMs).toISOString());
  insBid.run(auc7Res.lastInsertRowid, cust7, 115.00, 1, new Date(now - 0.2*dayMs).toISOString());

  // Bids on auction 8 (Turquoise Cuff Bracelet)
  insBid.run(auc8Res.lastInsertRowid, cust6, 100.00, 0, new Date(now - 0.9*dayMs).toISOString());
  insBid.run(auc8Res.lastInsertRowid, cust8, 130.00, 0, new Date(now - 0.5*dayMs).toISOString());
  insBid.run(auc8Res.lastInsertRowid, cust5,  150.00, 0, new Date(now - 0.25*dayMs).toISOString());
  insBid.run(auc8Res.lastInsertRowid, cust6, 160.00, 1, new Date(now - 0.1*dayMs).toISOString());

  // Bids for auc9 — Blown Glass Bud Vase
  insBid.run(auc9Res.lastInsertRowid, cust4, 45.00, 0, new Date(now - 1.8*dayMs).toISOString());
  insBid.run(auc9Res.lastInsertRowid, cust7, 55.00, 0, new Date(now - 1.4*dayMs).toISOString());
  insBid.run(auc9Res.lastInsertRowid, cust8, 65.00, 0, new Date(now - 0.9*dayMs).toISOString());
  insBid.run(auc9Res.lastInsertRowid, cust4, 70.00, 0, new Date(now - 0.5*dayMs).toISOString());
  insBid.run(auc9Res.lastInsertRowid, cust7, 78.00, 1, new Date(now - 0.2*dayMs).toISOString());

  // Bids for auc10 — Hand-Embroidered Silk Scarf
  insBid.run(auc10Res.lastInsertRowid, cust2, 70.00, 0, new Date(now - 2.5*dayMs).toISOString());
  insBid.run(auc10Res.lastInsertRowid, cust5, 80.00, 0, new Date(now - 2.0*dayMs).toISOString());
  insBid.run(auc10Res.lastInsertRowid, cust8, 90.00, 0, new Date(now - 1.5*dayMs).toISOString());
  insBid.run(auc10Res.lastInsertRowid, cust2, 95.00, 0, new Date(now - 0.8*dayMs).toISOString());
  insBid.run(auc10Res.lastInsertRowid, cust5, 105.00, 1, new Date(now - 0.3*dayMs).toISOString());

    // ── Sync auction winner_id / highest_bidder_id with placed bids ──
    // Active auctions start with winner_id=null; update to reflect current leaders.
    const updWinner = db.prepare('UPDATE auctions SET winner_id=?, highest_bidder_id=? WHERE id=?');
    updWinner.run(cust1, cust1, auc1Res.lastInsertRowid);  // cust1 winning at $145
    updWinner.run(cust3, cust3, auc2Res.lastInsertRowid);  // cust3 winning at $210
    updWinner.run(cust2, cust2, auc3Res.lastInsertRowid);  // cust2 winning at $85
    // auc4 already has winner_id=cust1 from insert (sold)
    updWinner.run(cust2, cust2, auc5Res.lastInsertRowid);  // cust2 winning at $340
    // auc6 pending — no bids
    updWinner.run(cust7, cust7, auc7Res.lastInsertRowid);  // cust7 winning at $115
    updWinner.run(cust6, cust6, auc8Res.lastInsertRowid);  // cust6 winning at $160
    updWinner.run(cust7, cust7, auc9Res.lastInsertRowid);  // cust7 winning at $78
    updWinner.run(cust5, cust5, auc10Res.lastInsertRowid); // cust5 winning at $105

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
  insRev.run(pid('Ceramic Oil Diffuser'), cust4, o6.lastInsertRowid, 5, 'Perfect bedside accent', 'This diffuser creates such a lovely ambiance. The clay is beautifully textured.', new Date(now - 0.5*dayMs).toISOString());
  insRev.run(pid('Stained Glass Suncatcher'), cust5, o7.lastInsertRowid, 5, 'Catches every ray of light', 'Hung this in my kitchen window and it fills the room with colour every morning.', new Date(now - 6*dayMs).toISOString());
  insRev.run(pid('Woven Copper Bracelet'), cust4, o8.lastInsertRowid, 4, 'Unique and eye-catching', 'The patina gives it real character. Comfortable to wear daily.', new Date(now - 0.2*dayMs).toISOString());
  insRev.run(pid('Artisan Satchel Bag'), cust3, null, 5, 'Lifetime investment', 'Built like a tank. The leather smell is incredible and the stitching is immaculate.', new Date(now - 3*dayMs).toISOString());

  // Round 2 reviews
  insRev.run(pid('Hand-Embroidered Silk Scarf'), cust6, o9.lastInsertRowid, 5, 'Breathtaking craftsmanship', 'The embroidery is incredibly intricate — you can see each stitch has intention behind it. The natural dye gives a depth of colour I have never seen in printed scarves. A true heirloom piece.', new Date(now - 18*dayMs).toISOString());
  insRev.run(pid('Carnelian Drop Earrings'), cust6, o9.lastInsertRowid, 4, 'Vibrant and elegant', 'The carnelian colour is even richer in person. They are lightweight enough for a full day of wear. The only small thing is the wire could be a touch longer for my earlobes.', new Date(now - 17*dayMs).toISOString());
  insRev.run(pid('Hammered Gold Bangle'), cust7, o10.lastInsertRowid, 5, 'Everyday luxury', 'I wear this every single day. The hammered texture catches light beautifully and the size is perfect. No tarnishing after three weeks of daily wear.', new Date(now - 11*dayMs).toISOString());
  insRev.run(pid('Walnut Joinery Stool'), cust8, o11.lastInsertRowid, 5, 'Worth every fils', 'Arrived beautifully packed. The grain is stunning and it sits perfectly level. You can feel how solid it is instantly. My guests always ask where I got it.', new Date(now - 8*dayMs).toISOString());
  insRev.run(pid('Hand-Woven Prayer Mat'), cust2, o13.lastInsertRowid, 5, 'A peaceful start to each day', 'The wool pile is plush and the colours have not faded at all after many washes. The geometric border is beautifully executed. Noor even included a handwritten note with the order.', new Date(now - 14*dayMs).toISOString());
  insRev.run(pid('Walnut Cheese Board'), cust3, o14.lastInsertRowid, 4, 'Great party host piece', 'Perfect for entertaining. Solid, heavy, and the grain is gorgeous. I wish the handle were a few centimetres longer but that is a minor thing.', new Date(now - 1*dayMs).toISOString());
  insRev.run(pid('Hammered Silver Hoop Earrings'), cust5, o15.lastInsertRowid, 5, 'My new go-to earrings', 'The lever-back is so secure I forget I am wearing them. The hammered surface picks up light from every angle. Exactly what I was looking for.', new Date(now - 5*dayMs).toISOString());
  insRev.run(pid('Lapis Lazuli Pendant'), cust1, o12.lastInsertRowid, 5, 'A conversation starter every time', 'The lapis has incredible depth, and the brushed silver setting is understated and elegant. Chain included was a nice bonus. Already received a dozen compliments.', new Date(now - 3*dayMs).toISOString());

  // Round 3 reviews — linked to new orders (o19–o24) and standalone from real accounts
  insRev.run(pid('Ceramic Incense Holder'), cust1, o19.lastInsertRowid, 5, 'Sets the perfect mood', 'The terracotta clay body and geometric cutouts cast the most beautiful light shadows. I burn incense every evening now. Very well packaged — arrived without a scratch.', new Date(now - 26*dayMs).toISOString());
  insRev.run(pid('Wooden Spoon Set'), cust1, o19.lastInsertRowid, 4, 'Solid kitchen staples', 'Great feel in the hand and the olive wood grain is unique on each spoon. My only wish is that the ladle were slightly deeper. Will order again.', new Date(now - 25*dayMs).toISOString());
  insRev.run(pid('Leather Journal Cover'), cust4, o22.lastInsertRowid, 5, 'Makes writing feel special', 'The full-grain leather is buttery soft and has already started to develop a gorgeous patina. The hand-stitching is immaculate. Exactly what a proper journal deserves.', new Date(now - 19*dayMs).toISOString());
  insRev.run(pid('Indigo Woven Wall Hanging'), cust5, o23.lastInsertRowid, 5, 'Gallery-worthy statement piece', 'Dominates my living room wall in the best way. The depth of the indigo is stunning and every thread is placed with intention. Worth far more than the asking price.', new Date(now - 13*dayMs).toISOString());
  insRev.run(pid('Braided Silver Choker'), cust6, o24.lastInsertRowid, 5, 'Perfect everyday luxury', 'Sits so elegantly against the collar. The braid pattern catches light from every angle. Very comfortable for long wear and no tarnishing after a month of daily use.', new Date(now - 24*dayMs).toISOString());
  insRev.run(pid('Matte Black Espresso Cup Set'), cust7, null, 5, 'Elevates every morning', 'The matte finish looks and feels premium. Size is spot-on for a proper double espresso. They look incredible side by side on the counter.', new Date(now - 5*dayMs).toISOString());
  insRev.run(pid('Glass Wind Chime'), cust8, null, 4, 'Melodic and beautiful', 'The tones are surprisingly clear for hand-made pieces. Each chime is slightly different — you can hear the craftsmanship. Docked one star because one rod needed straightening on arrival.', new Date(now - 7*dayMs).toISOString());
  insRev.run(pid('Leather Belt'), cust3, null, 4, 'Built to last decades', 'Thick vegetable-tanned leather that will only get better with age. Brass buckle is solid and the stitching is tight. A true lifetime purchase.', new Date(now - 9*dayMs).toISOString());

    // ── Wishlist ──
    console.log('Creating wishlist items...');
    const insWish = db.prepare('INSERT INTO wishlist (user_id,product_id) VALUES (?,?)');
  insWish.run(cust1, pid('Artisan Satchel Bag'));
  insWish.run(cust1, pid('Fused Glass Wall Art'));
  insWish.run(cust1, pid('Moonstone Stacker Rings'));
  insWish.run(cust2, pid('Vintage Kiln-Fired Vase'));
  insWish.run(cust2, pid('Walnut Joinery Stool'));
  insWish.run(cust3, pid('Gold Leaf Pendant'));

  // Round 2 wishlist
  insWish.run(cust4, pid('Hammered Gold Bangle'));
  insWish.run(cust5, pid('Hand-Embroidered Silk Scarf'));
  insWish.run(cust6, pid('Macramé Wall Hanging'));
  insWish.run(cust7, pid('Braided Silver Choker'));
  insWish.run(cust8, pid('Artisan Satchel Bag'));
  insWish.run(cust8, pid('Indigo Woven Wall Hanging'));

  // Round 3 wishlist — 6 new items
  insWish.run(cust1, pid('Hammered Gold Bangle'));
  insWish.run(cust2, pid('Turquoise Cuff Bracelet'));
  insWish.run(cust3, pid('Ceramic Oil Diffuser'));
  insWish.run(cust4, pid('Watercolor Botanical Print'));
  insWish.run(cust5, pid('Artisan Satchel Bag'));
  insWish.run(cust6, pid('Walnut Joinery Stool'));

    // ── Messages ──
    console.log('Creating messages...');
    const insMsg = db.prepare('INSERT INTO messages (sender_id,receiver_id,subject,content,is_read,created_at) VALUES (?,?,?,?,?,?)');
  insMsg.run(cust1, art1, 'Custom vase inquiry', 'Hi Elena! I love your kiln-fired vase. Do you take custom orders? I would love a similar piece in a taller form for my hallway.', 1, new Date(now - 5*dayMs).toISOString());
  insMsg.run(art1, cust1, 'Re: Custom vase inquiry', "Thank you for reaching out! I'd be happy to create a custom piece. Taller forms work beautifully with wood firing. Let's discuss dimensions and timeline. A custom piece would be around $200-250.", 1, new Date(now - 4.5*dayMs).toISOString());
  insMsg.run(cust2, art5, 'Leather color options', 'Do you offer the satchel bag in a lighter tan color? The dark brown is gorgeous but I prefer something lighter.', 0, new Date(now - 2*dayMs).toISOString());
  insMsg.run(cust3, art4, 'Ring sizing question', 'What sizes do you carry for the Moonstone Stacker Rings? My ring size is 7.', 0, new Date(now - 1*dayMs).toISOString());
  insMsg.run(art5, cust2, 'Re: Leather color options', 'Absolutely. I can finish the satchel in saddle tan and share a photo before shipping.', 0, new Date(now - 1.7*dayMs).toISOString());
  insMsg.run(cust1, art2, 'Wood stool delivery timeline', 'If I place an order today for the walnut stool, when could it be delivered?', 0, new Date(now - 0.9*dayMs).toISOString());
  insMsg.run(art2, cust1, 'Re: Wood stool delivery timeline', 'Current lead time is 5-7 days. I can rush one for next week if needed.', 0, new Date(now - 0.8*dayMs).toISOString());

  // Round 2 messages
  insMsg.run(cust6, art6, 'Prayer mat in blue?', 'Salaam! I love the hand-woven prayer mat. Do you have it in blue and gold tones to match my prayer room?', 1, new Date(now - 19*dayMs).toISOString());
  insMsg.run(art6, cust6, 'Re: Prayer mat in blue?', 'Wa alaikum assalam! Absolutely — I can weave it in royal blue warp with gold geometric border. Just allow 10 days production. Would you like to proceed?', 1, new Date(now - 18.5*dayMs).toISOString());
  insMsg.run(cust7, art7, 'Cuff bracelet sizing', 'Hi! What wrist sizes does the turquoise cuff fit? My wrist is about 7 inches.', 0, new Date(now - 3*dayMs).toISOString());
  insMsg.run(art7, cust7, 'Re: Cuff bracelet sizing', 'Great news — it fits 6.75–7.5 inch wrists perfectly. The silver gives just enough flex. Happy to ship within 48 hours!', 0, new Date(now - 2.8*dayMs).toISOString());
  insMsg.run(cust8, art2, 'Custom furniture enquiry', 'Hi Marcus! Do you take commissions for custom wooden furniture? I am renovating my home office.', 0, new Date(now - 2*dayMs).toISOString());
  insMsg.run(art2, cust8, 'Re: Custom furniture enquiry', 'Hi Jana! I love new projects. Lead time for custom pieces is 4-6 weeks depending on complexity. Let\'s hop on a call to discuss dimensions and wood species. What is your budget?', 0, new Date(now - 1.8*dayMs).toISOString());
  insMsg.run(cust5, art4, 'Alternative stone options?', 'Hi Sofia! I love the stacking rings but I am allergic to moonstone resin. Can you substitute another stone like labradorite or amethyst?', 0, new Date(now - 0.7*dayMs).toISOString());
  insMsg.run(art4, cust5, 'Re: Alternative stone options?', 'Of course! Labradorite would be stunning and has no resin. I can also do raw amethyst. Drop me an email with your ring size and I will quote you.', 0, new Date(now - 0.6*dayMs).toISOString());

  // Round 3 messages — 7 new conversations
  insMsg.run(cust3, art3, 'Glass pendant availability', 'Hi Yuki! Is the Rainbow Glass Prism Pendant still available? I would love to purchase it as a gift.', 1, new Date(now - 3*dayMs).toISOString());
  insMsg.run(art3, cust3, 'Re: Glass pendant availability', 'Yes it is! Freshly restocked. I can ship within 2 days and add a gift card message if you like.', 1, new Date(now - 2.8*dayMs).toISOString());
  insMsg.run(cust4, art6, 'Rush order for a wedding', 'Hi Noor! I need a prayer mat for a wedding gift in 12 days. Is that possible?', 1, new Date(now - 12*dayMs).toISOString());
  insMsg.run(art6, cust4, 'Re: Rush order for a wedding', 'Congratulations! Yes — I can prioritise your order. I have a natural ivory wool ready to go. Please share the colour scheme and I will get started today.', 1, new Date(now - 11.5*dayMs).toISOString());
  insMsg.run(cust7, art1, 'Mug personalization', 'Elena, can you add initials to the matte black espresso cups? Looking for a set of 4 with different letters.', 0, new Date(now - 4*dayMs).toISOString());
  insMsg.run(art1, cust7, 'Re: Mug personalization', 'What a lovely idea! I can impress initials before firing. Allow 5 extra days per custom set. Drop me the four letters and I will quote you.', 0, new Date(now - 3.8*dayMs).toISOString());
  insMsg.run(cust2, art7, 'Bracelet gift wrapping', 'Hi! I am buying the turquoise cuff as a birthday gift. Do you offer gift wrapping?', 0, new Date(now - 1*dayMs).toISOString());

    // ── Coupons ──
    console.log('Creating coupons...');
    const insCoup = db.prepare('INSERT INTO coupons (code,description,type,discount_type,value,discount_value,min_order,min_purchase,max_uses,usage_limit,used_count,times_used,is_active,active,scope,artisan_id,created_by,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,1,?,?,?,?)');
  insCoup.run('WELCOME10', 'Welcome discount - 10% off your first order', 'percent', 'percent', 10, 10, 20, 20, 100, 100, 3, 3, 'global', null, adminId, new Date(now + 90*dayMs).toISOString());
  insCoup.run('SAVE5', '$5 off orders over $30', 'fixed', 'fixed', 5, 5, 30, 30, null, null, 8, 8, 'global', null, adminId, new Date(now + 60*dayMs).toISOString());
  insCoup.run('ARTISAN20', '20% off for artisan appreciation week', 'percent', 'percent', 20, 20, 50, 50, 50, 50, 0, 0, 'global', null, adminId, new Date(now + 14*dayMs).toISOString());
  insCoup.run('FREESHIP', 'Shipping rebate on orders over $100', 'fixed', 'fixed', 5, 5, 100, 100, 200, 200, 12, 12, 'global', null, adminId, new Date(now + 30*dayMs).toISOString());
  insCoup.run('ELENA15', '15% off Elena\'s Ceramics collection', 'percent', 'percent', 15, 15, 40, 40, 120, 120, 6, 6, 'artisan', art1, art1, new Date(now + 45*dayMs).toISOString());
  insCoup.run('THORNE25', '$25 off Thorne Woodcraft over $180', 'fixed', 'fixed', 25, 25, 180, 180, 40, 40, 2, 2, 'artisan', art2, art2, new Date(now + 21*dayMs).toISOString());
  insCoup.run('YUKIGLASS10', '10% off Yuki Glass Studio pieces', 'percent', 'percent', 10, 10, 60, 60, 90, 90, 4, 4, 'artisan', art3, art3, new Date(now + 55*dayMs).toISOString());

  // Round 2 coupons
  insCoup.run('NOOR15', '15% off Noor\'s Textile Studio', 'percent', 'percent', 15, 15, 50, 50, 80, 80, 5, 5, 'artisan', art6, art6, new Date(now + 40*dayMs).toISOString());
  insCoup.run('AHMED10', '10% off Al-Farsi Craft House', 'percent', 'percent', 10, 10, 40, 40, 60, 60, 2, 2, 'artisan', art7, art7, new Date(now + 30*dayMs).toISOString());
  insCoup.run('CRAFTEVENT', 'BD 8 off craft market event code', 'fixed', 'fixed', 8, 8, 80, 80, 150, 150, 0, 0, 'global', null, adminId, new Date(now + 20*dayMs).toISOString());

  // Round 3 coupons — 4 new coupons
  insCoup.run('SUMMER15', 'Summer sale — 15% off sitewide', 'percent', 'percent', 15, 15, 30, 30, 300, 300, 0, 0, 'global', null, adminId, new Date(now + 45*dayMs).toISOString());
  insCoup.run('GLASS20', '20% off Yuki Glass Studio orders over $80', 'percent', 'percent', 20, 20, 80, 80, 50, 50, 1, 1, 'artisan', art3, art3, new Date(now + 30*dayMs).toISOString());
  insCoup.run('LEATHER10', '10% off Okafor Leather Co. orders', 'percent', 'percent', 10, 10, 40, 40, 75, 75, 3, 3, 'artisan', art5, art5, new Date(now + 35*dayMs).toISOString());
  insCoup.run('FIRSTBID', '$10 credit on your first bid', 'fixed', 'fixed', 10, 10, 0, 0, 200, 200, 0, 0, 'global', null, adminId, new Date(now + 60*dayMs).toISOString());

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
  insNotif.run(cust2, 'message', 'Reply from Okafor Leather Co.', 'Your artisan replied with color options for the satchel.', `/user/messages/${art5}`, 0, new Date(now - 1.6*dayMs).toISOString());
  insNotif.run(cust1, 'promotion', 'Shop Offer Unlocked', 'Use ELENA15 on eligible Elena ceramics items this month.', '/products', 0, new Date(now - 0.9*dayMs).toISOString());
  insNotif.run(art5, 'auction', 'Premium Auction Momentum', 'Your satchel auction crossed 8 bids and reached $340.', '/artisan/auctions', 0, new Date(now - 0.08*dayMs).toISOString());
  insNotif.run(art4, 'auction', 'Upcoming Auction Scheduled', 'Your Moonstone Stacker Rings auction will open in 2 days.', '/artisan/auctions', 0, new Date(now - 0.2*dayMs).toISOString());
  insNotif.run(cust4, 'order', 'Order Confirmed!', `Your order #${o6.lastInsertRowid} has been confirmed and is being prepared for dispatch.`, `/orders/${o6.lastInsertRowid}`, 0, new Date(now - 2*dayMs).toISOString());
  insNotif.run(cust5, 'order', 'Order Delivered!', `Your order #${o7.lastInsertRowid} has been delivered successfully. Enjoy your Stained Glass Suncatcher!`, `/orders/${o7.lastInsertRowid}`, 1, new Date(now - 8*dayMs).toISOString());
  insNotif.run(cust4, 'order', 'Order Being Processed', `Your order #${o8.lastInsertRowid} is now being processed and will ship soon.`, `/orders/${o8.lastInsertRowid}`, 0, new Date(now - 0.5*dayMs).toISOString());
  insNotif.run(cust5, 'promotion', 'Welcome to Craftify!', 'Explore our handcrafted collections and use WELCOME10 for 10% off your next order.', '/products', 0, new Date(now - 11*dayMs).toISOString());

  // Round 2 notifications
  insNotif.run(cust6, 'order', 'Order Delivered!', `Your order #${o9.lastInsertRowid} has been delivered. Enjoy your new pieces!`, `/orders/${o9.lastInsertRowid}`, 1, new Date(now - 20*dayMs).toISOString());
  insNotif.run(cust6, 'auction', "Outbid alert!", 'Someone placed a higher bid on the Watercolor Botanical Print auction. Bid now to stay in the lead!', `/auctions/${auc7Res.lastInsertRowid}`, 0, new Date(now - 0.5*dayMs).toISOString());
  insNotif.run(cust7, 'order', 'Order Delivered!', `Your order #${o10.lastInsertRowid} has been delivered. Thank you for shopping with Craftify!`, `/orders/${o10.lastInsertRowid}`, 1, new Date(now - 13*dayMs).toISOString());
  insNotif.run(cust7, 'promotion', 'Welcome to Craftify!', 'Discover our handpicked artisan collections. Use WELCOME10 for 10% off your first order.', '/products', 0, new Date(now - 19*dayMs).toISOString());
  insNotif.run(cust8, 'order', 'Order Confirmed!', `Your order #${o18.lastInsertRowid} has been confirmed. We are preparing your Glass Drinking Set.`, `/orders/${o18.lastInsertRowid}`, 0, new Date(now - 1.5*dayMs).toISOString());
  insNotif.run(art6, 'order', 'New Orders!', 'You have received new orders for Hand-Embroidered Silk Scarf and Hand-Woven Prayer Mat. Check your orders.', '/artisan/orders', 0, new Date(now - 19*dayMs).toISOString());
  insNotif.run(art7, 'order', 'New Orders!', 'New orders have arrived for Hammered Gold Bangle and Carnelian Drop Earrings.', '/artisan/orders', 0, new Date(now - 11*dayMs).toISOString());
  insNotif.run(art6, 'auction', 'Auction Bid Received', `Your Watercolor Botanical Print auction has 4 bids and the current highest bid is BD 115.`, `/artisan/auctions`, 0, new Date(now - 0.2*dayMs).toISOString());
  insNotif.run(art7, 'auction', 'Auction Momentum!', 'Your Turquoise Cuff Bracelet auction has reached BD 160 with 4 active bidders!', `/artisan/auctions`, 0, new Date(now - 0.1*dayMs).toISOString());
  insNotif.run(art3, 'review', 'New 5-star review!', 'A customer left a 5-star review on Glass Drinking Set. Your average rating improved!', '/artisan/reviews', 0, new Date(now - 3*dayMs).toISOString());

  // Round 3 notifications — 19 new entries covering new orders, auctions, and messages
  insNotif.run(cust1, 'order', 'Order Delivered!', `Your order #${o19.lastInsertRowid} (Ceramic Incense Holder + Wooden Spoon Set) has been delivered.`, `/orders/${o19.lastInsertRowid}`, 1, new Date(now - 25*dayMs).toISOString());
  insNotif.run(cust2, 'order', 'Order Processing', `Your order #${o20.lastInsertRowid} for Gold Leaf Pendant is being prepared.`, `/orders/${o20.lastInsertRowid}`, 0, new Date(now - 0.8*dayMs).toISOString());
  insNotif.run(cust3, 'order', 'Order Confirmed!', `Your order #${o21.lastInsertRowid} (Glass Cabinet Knobs + Rainbow Prism Pendant) has been confirmed.`, `/orders/${o21.lastInsertRowid}`, 0, new Date(now - 1.8*dayMs).toISOString());
  insNotif.run(cust4, 'order', 'Order Delivered!', `Your order #${o22.lastInsertRowid} for Leather Journal Cover has been delivered.`, `/orders/${o22.lastInsertRowid}`, 1, new Date(now - 18*dayMs).toISOString());
  insNotif.run(cust5, 'order', 'Order Delivered!', `Your order #${o23.lastInsertRowid} for Indigo Woven Wall Hanging has been delivered.`, `/orders/${o23.lastInsertRowid}`, 1, new Date(now - 12*dayMs).toISOString());
  insNotif.run(cust6, 'order', 'Order Delivered!', `Your order #${o24.lastInsertRowid} (Braided Silver Choker + Carnelian Drop Earrings) has been delivered.`, `/orders/${o24.lastInsertRowid}`, 1, new Date(now - 23*dayMs).toISOString());
  insNotif.run(art1, 'order', 'New Order!', `New order received for Ceramic Incense Holder from customer john@test.com.`, '/artisan/orders', 0, new Date(now - 30*dayMs).toISOString());
  insNotif.run(art2, 'order', 'New Order!', `New order received for Wooden Spoon Set.`, '/artisan/orders', 0, new Date(now - 30*dayMs).toISOString());
  insNotif.run(art4, 'order', 'New Order!', `New order received for Gold Leaf Pendant.`, '/artisan/orders', 0, new Date(now - 1*dayMs).toISOString());
  insNotif.run(art5, 'order', 'New Order!', `New order received for Leather Journal Cover.`, '/artisan/orders', 1, new Date(now - 22*dayMs).toISOString());
  insNotif.run(art7, 'order', 'New Orders!', `New orders received for Braided Silver Choker and Carnelian Drop Earrings.`, '/artisan/orders', 0, new Date(now - 28*dayMs).toISOString());
  insNotif.run(cust4, 'auction', "You've been outbid!", 'Someone placed a higher bid on the Blown Glass Bud Vase. Place a new bid to stay in the lead!', `/auctions/${auc9Res.lastInsertRowid}`, 0, new Date(now - 0.5*dayMs).toISOString());
  insNotif.run(cust7, 'auction', "You're the highest bidder!", 'You are currently leading the Blown Glass Bud Vase auction at $78.', `/auctions/${auc9Res.lastInsertRowid}`, 0, new Date(now - 0.2*dayMs).toISOString());
  insNotif.run(cust5, 'auction', "You're the highest bidder!", 'You are currently leading the Hand-Embroidered Silk Scarf auction at $105.', `/auctions/${auc10Res.lastInsertRowid}`, 0, new Date(now - 0.3*dayMs).toISOString());
  insNotif.run(cust2, 'auction', "You've been outbid!", 'Someone placed a higher bid on the Hand-Embroidered Silk Scarf auction. Bid now to retake the lead!', `/auctions/${auc10Res.lastInsertRowid}`, 0, new Date(now - 0.3*dayMs).toISOString());
  insNotif.run(art3, 'auction', 'New Auction Live!', 'Your Blown Glass Bud Vase auction is now live and has received 5 bids.', '/artisan/auctions', 0, new Date(now - 0.2*dayMs).toISOString());
  insNotif.run(art6, 'auction', 'New Auction Live!', 'Your Hand-Embroidered Silk Scarf auction is live with 5 bids and a current high of $105.', '/artisan/auctions', 0, new Date(now - 0.3*dayMs).toISOString());
  insNotif.run(cust1, 'promotion', 'New Coupon Available', 'Use SUMMER15 for 15% off any order this season. Valid for 45 more days.', '/products', 0, new Date(now - 1*dayMs).toISOString());
  insNotif.run(cust3, 'message', 'Reply from Yuki Glass Studio', 'Yuki confirmed the Rainbow Glass Prism Pendant is in stock and ready to ship.', `/user/messages/${art3}`, 1, new Date(now - 2.8*dayMs).toISOString());

    // Verify expected row counts before announcing success.
    verifyCounts(db);

    runTransactionCommand(db, 'COMMIT');
    inTransaction = false;

    // Force synchronous persist so seed completion matches actual disk state.
    if (typeof db.save === 'function') {
      db.save(true);
    }

    // Add bulk data for scale (~10k total records)
    console.log('\n📦 Adding bulk data (~10 000 records)…');
    addBulkData(db);
    console.log('✅ Bulk data added!');

    console.log('');
    console.log('✅ Database seeded successfully!');
    console.log('');
    console.log('📋 Demo Accounts:');
    console.log('   Admin:      admin@craftify.com / admin123');
    console.log('   Customer 1: customer@test.com / customer123');
    console.log('   Customer 2: sarah@test.com / customer123');
    console.log('   Customer 3: omar@test.com / customer123');
    console.log('   Customer 4: liam@test.com / customer123');
    console.log('   Customer 5: sara@test.com / customer123');
    console.log('   Customer 6: fatima@test.com / customer123');
    console.log('   Customer 7: khalid@test.com / customer123');
    console.log('   Customer 8: jana@test.com / customer123');
    console.log('   Artisan 1:  artisan1@test.com / artisan123 (Elena\'s Ceramics)');
    console.log('   Artisan 2:  artisan2@test.com / artisan123 (Thorne Woodcraft)');
    console.log('   Artisan 3:  artisan3@test.com / artisan123 (Yuki Glass Studio)');
    console.log('   Artisan 4:  artisan4@test.com / artisan123 (Sofia Jewelry Atelier)');
    console.log('   Artisan 5:  artisan5@test.com / artisan123 (Okafor Leather Co.)');
    console.log('   Artisan 6:  artisan6@test.com / artisan123 (Noor\'s Textile Studio)');
    console.log('   Artisan 7:  artisan7@test.com / artisan123 (Al-Farsi Craft House)');
    console.log('');
    console.log('🎨 Created:');
    console.log('   - 8 Categories');
    console.log('   - 16 Users (1 admin, 8 customers, 7 artisans)');
    console.log('   - 7 Artisan Shops with bios, banner images & return policies');
    console.log('   - 54 Products with unique, category-matched Unsplash images');
    console.log('   - 24 Orders with shipments');
    console.log('   - 10 Auctions (7 active, 1 pending, 1 sold, 1 ended) with 55 bids');
    console.log('   - 30 Reviews (all from real accounts, many order-linked)');
    console.log('   - 18 Wishlist items');
    console.log('   - 22 Messages');
    console.log('   - 14 Coupons (global + artisan-scoped)');
    console.log('   - 45 Notifications');
    console.log('');
  } catch (err) {
    if (inTransaction) {
      try {
        runTransactionCommand(db, 'ROLLBACK');
      } catch (rollbackErr) {
        console.error('Seed rollback error:', rollbackErr.message);
      }
    }
    throw err;
  }
}

// ── Bulk data generator (~10 000 seed records with images) ───────────────────
function addBulkData(db) {
  const now = Date.now();
  const cities   = ['Manama','Riffa','Muharraq','Isa Town','Sitra','Hamad Town','Jidhafs','Budaiya'];
  const themes   = ['Ceramics','Woodwork','Jewelry','Textiles','Glass','Leather','Paintings','Weaving'];
  const nameW    = ['Artisan','Handmade','Crafted','Heritage','Vintage','Modern','Classic','Rustic','Bespoke','Signature'];
  const typeW    = ['Vase','Bowl','Ring','Necklace','Scarf','Lamp','Table','Frame','Mug','Bracelet','Pendant','Candle','Tray','Basket','Mirror'];
  const revTit   = ['Amazing!','Great quality','Love it!','Excellent','Highly recommend','Beautiful piece','Perfect gift','Worth every penny'];
  const revBody  = [
    'Absolutely stunning. Very happy with my purchase and will definitely order again.',
    'Great quality and arrived quickly. Exactly as described in the listing.',
    'Perfect! Everyone who sees it compliments it. Wonderful artisan work.',
    'Excellent craftsmanship — you can tell a lot of care went into this piece.',
    'Highly recommend this artisan. The product exceeded all my expectations.',
    'Beautiful handcrafted item. Makes a wonderful gift for any occasion.',
    'Exactly what I was looking for. Unique with great attention to detail.',
    'Well worth the price. The quality is outstanding for handmade goods.'
  ];
  // Per-category Unsplash photo ID pools — keeps product images relevant to their category
  const catImagePools = {
    pottery:    ['1578749556568-bc2c40e68b61','1610701596061-bfb4a97b34ad','1514228742587-ab4a2be3fa17','1603561596112-8834340bbf7b','1603561591411-0e5f20f4c47d','1485955900006-10f4d324d411','1565193566173-7a0ee3dbe261','1567225557594-88887e70ade1','1582562124811-c09040d0a901'],
    woodwork:   ['1503602642458-232428e56bc0','1588165171080-c18a7be6b9b5','1605433246452-6b2a7d8a8f39','1615484477778-bc5c2d5e8a88','1595428774223-ee0b6ababcf7','1556909114-f6e7ad7d3136','1611486212557-88d3d6e1a0d0','1468716912199-dde8d5a90f08'],
    glassware:  ['1481349518771-20055b2a7b24','1494438639946-1ebd1d20bf85','1513364776144-60967b0f800f','1577401239170-d9e17c2f5c6f','1518481009311-68d14c78f4e1','1504198266614-a82b905aeb91','1555041469-a586c61ea9bc','1541233703-57a4a43ccf88'],
    jewelry:    ['1605100804763-247f67b3557e','1515562141589-f9cb6cf7f248','1535632066927-ab722856753f','1573408301185-9521-d7a7f1e','1524492412937-b28074a5d7da','1606722590583-d0b18571e15d','1493106814774-7a1af2d9ab8b','1560343319-1f5a7ae0f3e9','1534139871063-8d9f10f3d994','1587578016785-2028dad13c60','1571115764595-644a1f56a55c'],
    leather:    ['1548036328-c9fa89d128fa','1553062407-98eeb64c6a62','1627123424574-f1de2a68be84','1544816155-0ef11f57de0a','1543286386-2e659306cd6c','1606107557195-0e29a4b5b4aa','1619086009537-2eb2a4a7ed97','1547448415-e9f5b28e570d','1476231682828-37e571bc172f'],
    textiles:   ['1416323426898-8de3e24394d1','1508700929628-c6bafe98cddf','1616046229478-4e3b5c5e5f4f','1506439773649-6e0eb8cfb237','1515562141207-7a88fb7ce338','1558618666-fcd25c85cd64'],
    paintings:  ['1460925895917-afdab827c52f','1579783902614-a3fb3927b6a5','1516483638261-f4dbaf036963','1594007654729-407eeec4be89','1488116507253-c19a33e6f29a'],
    'home-decor':['1463320726281-696a3cc57186','1555041469-a586c61ea9bc','1565193566173-7a0ee3dbe261','1612810806563-4cb8a6b3d8f0','1543286386-2e659306cd6c'],
  };
  // Fallback generic pool for any category not listed
  const genericPool = ['1565193566173-7a0ee3dbe261','1558618666-fcd25c85cd64','1582562124811-c09040d0a901','1460925895917-afdab827c52f','1524492412937-b28074a5d7da'];

  // Build a catSlug lookup from catIds so bulk products can pick the right pool
  const catRows = db.prepare('SELECT id, slug FROM categories').all();
  const catSlugMap = {}; // catId → slug
  for (const row of catRows) catSlugMap[row.id] = row.slug;

  // Fast hash (factor 6) so 70 bulk users don't take forever
  const bulkPw = bcrypt.hashSync('password123', 6);

  const existingArtIds = db.prepare("SELECT id FROM users WHERE role='artisan' AND status='active'").all().map(r => r.id);
  const catIds         = db.prepare('SELECT id FROM categories').all().map(r => r.id);

  // ── Tx 1 — extra users (50 customers + 20 artisans) ──────────────────────
  db.exec('BEGIN TRANSACTION');
  const insU = db.prepare('INSERT OR IGNORE INTO users (name,email,password,role,status,shipping_address,city,country) VALUES (?,?,?,?,?,?,?,?)');
  const insAP = db.prepare('INSERT OR IGNORE INTO artisan_profiles (user_id,shop_name,bio,location,is_approved) VALUES (?,?,?,?,1)');
  const bulkCustIds = [];
  for (let i = 1; i <= 50; i++) {
    const r = insU.run(`Customer ${100+i}`,`bulk.cust${i}@test.com`,bulkPw,'customer','active',`${i} Main St`,cities[i%cities.length],'Bahrain');
    if (r.lastInsertRowid) bulkCustIds.push(r.lastInsertRowid);
  }
  const bulkArtIds = [];
  for (let i = 1; i <= 20; i++) {
    const r = insU.run(`Artisan ${10+i}`,`bulk.art${i}@test.com`,bulkPw,'artisan','active',`${i} Artisan Ave`,cities[i%cities.length],'Bahrain');
    if (r.lastInsertRowid) {
      bulkArtIds.push(r.lastInsertRowid);
      insAP.run(r.lastInsertRowid,`${themes[i%themes.length]} Studio ${10+i}`,'Handcrafted with passion. Each piece tells a story.',cities[i%cities.length]);
    }
  }
  db.exec('COMMIT');

  const allArtIds  = [...existingArtIds, ...bulkArtIds];
  const allCustIds = db.prepare("SELECT id FROM users WHERE role='customer' AND status='active'").all().map(r => r.id);

  // ── Tx 2 — 500 products with Unsplash images ─────────────────────────────
  db.exec('BEGIN TRANSACTION');
  const insProd = db.prepare('INSERT INTO products (artisan_id,category_id,name,description,price,stock,images,status,is_active,weight,tags) VALUES (?,?,?,?,?,?,?,?,1,?,?)');
  for (let i = 0; i < 500; i++) {
    const artId  = allArtIds[i % allArtIds.length];
    const catId  = catIds[i % catIds.length];
    const slug   = catSlugMap[catId] || '';
    const pool   = catImagePools[slug] || genericPool;
    const pname  = `${nameW[i%nameW.length]} ${typeW[i%typeW.length]} ${i+100}`;
    const imgA   = pool[i % pool.length];
    const imgB   = pool[(i + Math.floor(pool.length / 2)) % pool.length];
    const images = JSON.stringify([
      `https://images.unsplash.com/photo-${imgA}?w=600&q=80`,
      `https://images.unsplash.com/photo-${imgB}?w=600&q=80`
    ]);
    insProd.run(
      artId, catId, pname,
      `A beautiful handcrafted ${typeW[i%typeW.length].toLowerCase()} made with care and premium materials.`,
      parseFloat((5 + (i * 0.48) % 300).toFixed(2)),
      1 + (i % 30), images, 'approved',
      100 + (i % 4900),
      `handmade,artisan,${typeW[i%typeW.length].toLowerCase()},${themes[i%themes.length].toLowerCase()}`
    );
  }
  db.exec('COMMIT');

  // ── Tx 3 — 2000 orders + items + shipments ───────────────────────────────
  const allProds   = db.prepare("SELECT id,artisan_id FROM products WHERE status='approved'").all();
  const statuses   = ['delivered','delivered','shipped','processing','pending'];
  const pmethods   = ['card','cash','card','card','cash'];
  db.exec('BEGIN TRANSACTION');
  const insOrd = db.prepare('INSERT INTO orders (user_id,subtotal,shipping_cost,discount_amount,total_amount,status,payment_method,payment_status,shipping_address,shipping_city,shipping_country,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
  const insOI  = db.prepare('INSERT INTO order_items (order_id,product_id,artisan_id,quantity,unit_price,total_price) VALUES (?,?,?,?,?,?)');
  const insSh  = db.prepare('INSERT INTO shipments (order_id,tracking_number,carrier,status) VALUES (?,?,?,?)');
  const bulkOrders = [];
  for (let i = 0; i < 2000; i++) {
    const cust  = allCustIds[i % allCustIds.length];
    const prod  = allProds[i % allProds.length];
    const price = parseFloat((8 + (i % 200)).toFixed(2));
    const st    = statuses[i % statuses.length];
    const created = new Date(now - i * 1800000).toISOString();
    const o = insOrd.run(cust,price,0,0,price,st,pmethods[i%pmethods.length],st==='pending'?'pending':'paid',`${i+1} Bulk St`,cities[i%cities.length],'Bahrain',created);
    bulkOrders.push({ id: o.lastInsertRowid, cust, status: st, prod });
    insOI.run(o.lastInsertRowid,prod.id,prod.artisan_id,1,price,price);
    if (st !== 'pending') insSh.run(o.lastInsertRowid,`BTRK${10000+i}`,'Craftify Express',st);
  }
  db.exec('COMMIT');

  // ── Tx 4 — 2500 reviews on delivered orders ──────────────────────────────
  const delivered = bulkOrders.filter(o => o.status === 'delivered');
  db.exec('BEGIN TRANSACTION');
  const insRev = db.prepare('INSERT OR IGNORE INTO reviews (product_id,user_id,order_id,rating,title,comment,is_approved) VALUES (?,?,?,?,?,?,1)');
  for (let i = 0; i < Math.min(2500, delivered.length); i++) {
    const o = delivered[i];
    try { insRev.run(o.prod.id,o.cust,o.id,(i%5)+1,revTit[i%revTit.length],revBody[i%revBody.length]); } catch (_) {}
  }
  db.exec('COMMIT');

  // ── Tx 5 — 1000 bids on existing active auctions ─────────────────────────
  const activeAucs = db.prepare("SELECT id,artisan_id,starting_price FROM auctions WHERE status='active'").all();
  if (activeAucs.length > 0 && bulkCustIds.length > 0) {
    db.exec('BEGIN TRANSACTION');
    const insBid = db.prepare('INSERT INTO bids (auction_id,user_id,amount,is_winning,created_at) VALUES (?,?,?,0,?)');
    const bidTotals = {};
    for (let i = 0; i < 1000; i++) {
      const auc    = activeAucs[i % activeAucs.length];
      const bidder = bulkCustIds[i % bulkCustIds.length];
      if (bidder === auc.artisan_id) continue;
      const base = parseFloat(auc.starting_price) || 10;
      const amt  = parseFloat((base + i * 0.3 + (bidTotals[auc.id] || 0) * 1.5).toFixed(2));
      bidTotals[auc.id] = (bidTotals[auc.id] || 0) + 1;
      try { insBid.run(auc.id,bidder,amt,new Date(now - i * 120000).toISOString()); } catch (_) {}
    }
    db.exec('COMMIT');
  }

  // ── Tx 6 — 500 wishlist items ────────────────────────────────────────────
  db.exec('BEGIN TRANSACTION');
  const insWL = db.prepare('INSERT OR IGNORE INTO wishlist (user_id,product_id) VALUES (?,?)');
  for (let i = 0; i < 500; i++) {
    try { insWL.run(allCustIds[i%allCustIds.length],allProds[i%allProds.length].id); } catch (_) {}
  }
  db.exec('COMMIT');

  // ── Tx 7 — 1000 notifications ────────────────────────────────────────────
  const notifTypes = { order:['Order Confirmed!','Order Shipped!','Order Delivered!'], auction:['Ending Soon','You Were Outbid','Auction Won!'], review:['New Review','5-Star Review!'], promotion:['Exclusive Offer','Weekend Sale'] };
  const ntypes     = Object.keys(notifTypes);
  db.exec('BEGIN TRANSACTION');
  const insNotif2 = db.prepare('INSERT INTO notifications (user_id,type,title,message,is_read,link,created_at) VALUES (?,?,?,?,0,?,?)');
  for (let i = 0; i < 1000; i++) {
    const uid   = allCustIds[i%allCustIds.length];
    const type  = ntypes[i%ntypes.length];
    const titles = notifTypes[type];
    const t     = titles[i%titles.length];
    try { insNotif2.run(uid,type,t,`Notification: ${t}`,'/user/notifications',new Date(now-i*3600000).toISOString()); } catch (_) {}
  }
  db.exec('COMMIT');

  if (typeof db.save === 'function') db.save(true);
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exitCode = 1;
});
