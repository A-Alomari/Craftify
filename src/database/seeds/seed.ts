/**
 * seed.ts — Craftify Database Seed
 *
 * Populates a fresh SQLite database with realistic demo data.
 * Run via:  npm run seed  (ts-node src/database/seeds/seed.ts)
 *
 * NEVER run in production — guarded at start.
 *
 * BUG FIX (seed date arithmetic): use Date.now() for numeric offsets.
 * Using `new Date() + number` produces string concatenation, not math.
 */

import * as dotenv from 'dotenv';
dotenv.config();

if (process.env.NODE_ENV === 'production') {
  throw new Error('seed.ts must NOT run in production');
}

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as path from 'path';

// ── Entity imports ──────────────────────────────────────────────────────────
import { User } from '../entities/user.entity';
import { ArtisanProfile } from '../entities/artisan-profile.entity';
import { Category } from '../entities/category.entity';
import { Product } from '../entities/product.entity';
import { CartItem } from '../entities/cart-item.entity';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Shipment } from '../entities/shipment.entity';
import { Auction } from '../entities/auction.entity';
import { Bid } from '../entities/bid.entity';
import { Review } from '../entities/review.entity';
import { Wishlist } from '../entities/wishlist.entity';
import { Coupon } from '../entities/coupon.entity';
import { Notification } from '../entities/notification.entity';
import { Message } from '../entities/message.entity';
import { PasswordReset } from '../entities/password-reset.entity';
import { NewsletterSubscription } from '../entities/newsletter-subscription.entity';

// ── Data source ──────────────────────────────────────────────────────────────
const AppDataSource = new DataSource({
  type: 'sqljs' as any,
  location: process.env.CRAFTIFY_DB_PATH ?? path.join(process.cwd(), 'craftify.db'),
  autoSave: true,
  entities: [
    User, ArtisanProfile, Category, Product, CartItem,
    Order, OrderItem, Shipment, Auction, Bid, Review,
    Wishlist, Coupon, Notification, Message, PasswordReset,
    NewsletterSubscription,
  ],
  synchronize: true,
  logging: false,
});

// ── Time helpers (BUG FIX: use Date.now() numeric) ──────────────────────────
const now = Date.now();
const iso = (offsetMs: number = 0) => new Date(now + offsetMs).toISOString();
const days = (n: number) => n * 24 * 60 * 60 * 1000;

// ── Bcrypt helper ────────────────────────────────────────────────────────────
async function hash(pw: string) {
  return bcrypt.hash(pw, 12);
}

// ── Clear tables (reverse FK order) ─────────────────────────────────────────
async function clearTables(ds: DataSource) {
  const tables = [
    'bids', 'auctions', 'order_items', 'shipments', 'orders',
    'cart_items', 'reviews', 'wishlist', 'notifications', 'messages',
    'products', 'artisan_profiles', 'newsletter_subscriptions',
    'password_resets', 'coupons', 'users', 'categories',
  ];
  await ds.query('PRAGMA foreign_keys = OFF');
  for (const t of tables) {
    await ds.query(`DELETE FROM ${t}`);
    await ds.query(`DELETE FROM sqlite_sequence WHERE name='${t}'`).catch(() => {});
  }
  await ds.query('PRAGMA foreign_keys = ON');
  console.log('  ✓ tables cleared');
}

// ── Seed categories ──────────────────────────────────────────────────────────
async function seedCategories(ds: DataSource) {
  const cats = [
    { name: 'Pottery',    slug: 'pottery',    description: 'Handcrafted ceramic and pottery items' },
    { name: 'Textiles',   slug: 'textiles',   description: 'Woven, knitted and embroidered textiles' },
    { name: 'Woodwork',   slug: 'woodwork',   description: 'Carved and crafted wood pieces' },
    { name: 'Jewelry',    slug: 'jewelry',    description: 'Handmade jewelry and accessories' },
    { name: 'Glassware',  slug: 'glassware',  description: 'Blown and crafted glass art' },
    { name: 'Leather',    slug: 'leather',    description: 'Handcrafted leather goods' },
    { name: 'Paintings',  slug: 'paintings',  description: 'Original paintings and canvas art' },
    { name: 'Home Decor', slug: 'home-decor', description: 'Decorative pieces for the home' },
  ];
  const repo = ds.getRepository(Category);
  const rows = repo.create(cats.map(c => ({ ...c, is_active: 1 })));
  await repo.save(rows);
  console.log(`  ✓ ${rows.length} categories`);
  return rows;
}

// ── Seed users ───────────────────────────────────────────────────────────────
async function seedUsers(ds: DataSource) {
  const repo = ds.getRepository(User);

  const users = repo.create([
    // Admin
    { name: 'Admin',          email: 'admin@craftify.com', password: await hash('admin123'),    role: 'admin',    status: 'active', country: 'Bahrain' },
    // Customers
    { name: 'Customer',       email: 'customer@test.com',  password: await hash('customer123'), role: 'customer', status: 'active', country: 'Bahrain', shipping_address: '123 Main St', city: 'Manama' },
    { name: 'Sarah Al-Rashid',email: 'sarah@test.com',     password: await hash('customer123'), role: 'customer', status: 'active', country: 'Bahrain', shipping_address: '45 Pearl Rd',  city: 'Riffa'   },
    { name: 'Omar Hassan',    email: 'omar@test.com',      password: await hash('customer123'), role: 'customer', status: 'active', country: 'Bahrain', shipping_address: '78 Gulf Ave',  city: 'Muharraq'},
    { name: 'Liam Chen',      email: 'liam@test.com',      password: await hash('customer123'), role: 'customer', status: 'active', country: 'Bahrain' },
    { name: 'Aisha Karimi',   email: 'aisha@test.com',     password: await hash('customer123'), role: 'customer', status: 'active', country: 'Bahrain' },
    // Artisans
    { name: 'Elena Vasquez',  email: 'artisan1@test.com',  password: await hash('artisan123'),  role: 'artisan',  status: 'active', country: 'Bahrain' },
    { name: 'Thorne Baker',   email: 'artisan2@test.com',  password: await hash('artisan123'),  role: 'artisan',  status: 'active', country: 'Bahrain' },
    { name: 'Leila Nasser',   email: 'artisan3@test.com',  password: await hash('artisan123'),  role: 'artisan',  status: 'active', country: 'Bahrain' },
    { name: 'Rami Karimi',    email: 'artisan4@test.com',  password: await hash('artisan123'),  role: 'artisan',  status: 'active', country: 'Bahrain' },
    { name: 'Noor Al-Amin',   email: 'artisan5@test.com',  password: await hash('artisan123'),  role: 'artisan',  status: 'active', country: 'Bahrain' },
  ]);

  await repo.save(users);
  console.log(`  ✓ ${users.length} users`);
  return users;
}

// ── Seed artisan profiles ────────────────────────────────────────────────────
async function seedArtisanProfiles(ds: DataSource, users: User[]) {
  const artisans = users.filter(u => u.role === 'artisan');
  const repo = ds.getRepository(ArtisanProfile);

  const profiles = [
    {
      user_id: artisans[0].id, shop_name: "Elena's Ceramics",
      bio: "Master ceramic artist with over 15 years of experience. Each piece is hand-thrown on the wheel and kiln-fired to perfection.",
      location: 'Manama, Bahrain', instagram: '@elenaceramics',
      return_policy: 'Returns accepted within 14 days for unused items.',
      shipping_methods: JSON.stringify(['Standard (3-5 days)', 'Express (1-2 days)']),
    },
    {
      user_id: artisans[1].id, shop_name: 'Thorne Woodcraft',
      bio: "Specialising in reclaimed and sustainably sourced timber. Every piece tells the story of the wood it came from.",
      location: 'Riffa, Bahrain', instagram: '@thornewoodcraft',
      return_policy: 'Custom orders are final. Stock items returnable within 7 days.',
      shipping_methods: JSON.stringify(['Standard (5-7 days)']),
    },
    {
      user_id: artisans[2].id, shop_name: "Leila's Textiles",
      bio: "Vibrant textile art inspired by traditional Bahraini weaving patterns, reimagined for contemporary homes.",
      location: 'Muharraq, Bahrain', instagram: '@leilatextiles',
      return_policy: 'Full refund within 10 days of delivery.',
      shipping_methods: JSON.stringify(['Standard (3-5 days)', 'Express (1-2 days)']),
    },
    {
      user_id: artisans[3].id, shop_name: 'Karimi Jewelry',
      bio: "Precious metalwork and gemstone jewelry crafted with traditional Middle Eastern design sensibilities.",
      location: 'Isa Town, Bahrain', instagram: '@karimijewelry',
      return_policy: 'No returns on custom pieces. Stock items within 7 days.',
      shipping_methods: JSON.stringify(['Standard (3-5 days)', 'Express Next Day']),
    },
    {
      user_id: artisans[4].id, shop_name: 'Noor Glassware',
      bio: "Hand-blown glass art that captures light and colour in breathtaking ways.",
      location: 'Hidd, Bahrain', instagram: '@noorglassware',
      return_policy: 'Returns accepted for undamaged items within 14 days.',
      shipping_methods: JSON.stringify(['Standard (5-7 days)']),
    },
  ];

  const rows = repo.create(profiles.map(p => ({ ...p, is_approved: 1 })));
  await repo.save(rows);
  console.log(`  ✓ ${rows.length} artisan profiles`);
  return rows;
}

// ── Seed products ────────────────────────────────────────────────────────────
async function seedProducts(ds: DataSource, users: User[], categories: Category[]) {
  const artisans = users.filter(u => u.role === 'artisan');
  const repo = ds.getRepository(Product);

  const catBySlug = (slug: string) => categories.find(c => c.slug === slug)!;

  const unsplash = (id: string, w = 600) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

  const products = [
    // ── Elena's Ceramics ────────────────────────────────────────────────────
    { artisan_id: artisans[0].id, category_id: catBySlug('pottery').id, name: 'Artisan Ceramic Bowl', description: 'Hand-thrown stoneware bowl glazed in matte ash. Food-safe and dishwasher-safe. Perfect for salads, fruit, or as a centrepiece.', price: 45.00, compare_price: 60.00, stock: 12, images: JSON.stringify([unsplash('1493564738392-99b2e5e39ae6'), unsplash('1565193566173-7a0ee3dbe261')]), tags: 'handmade,ceramic,stoneware,bowl', weight: 480, status: 'approved', featured: 1, is_active: 1 },
    { artisan_id: artisans[0].id, category_id: catBySlug('pottery').id, name: 'Handmade Pottery Vase', description: 'Elegant wheel-thrown vase with a rich teal glaze. Waterproof interior makes it suitable for fresh flowers.', price: 68.00, stock: 8, images: JSON.stringify([unsplash('1578749557441-ca2c9dcb3e56')]), tags: 'handmade,vase,ceramic,teal', weight: 620, status: 'approved', featured: 0, is_active: 1 },
    { artisan_id: artisans[0].id, category_id: catBySlug('pottery').id, name: 'Rustic Tea Set (4 Cups)', description: 'A complete tea set for four — teapot and four cups — in warm ochre stoneware with speckled glaze.', price: 120.00, compare_price: 150.00, stock: 6, images: JSON.stringify([unsplash('1519748851451-b5a0621e0408')]), tags: 'handmade,tea,stoneware,set', weight: 1200, status: 'approved', featured: 1, is_active: 1 },
    { artisan_id: artisans[0].id, category_id: catBySlug('pottery').id, name: 'Decorative Plate Set', description: 'Set of 4 decorative side plates with hand-painted geometric patterns inspired by Islamic tile art.', price: 85.00, stock: 10, images: JSON.stringify([unsplash('1534452203293-494d7ddbf7e0')]), tags: 'handmade,plate,ceramic,geometric', weight: 900, status: 'approved', featured: 0, is_active: 1 },
    // ── Leila's Textiles ────────────────────────────────────────────────────
    { artisan_id: artisans[2].id, category_id: catBySlug('textiles').id, name: 'Hand-Woven Throw Blanket', description: 'Luxuriously soft merino wool throw blanket woven on a traditional loom. 150 × 200 cm. Each blanket is unique.', price: 165.00, compare_price: 200.00, stock: 5, images: JSON.stringify([unsplash('1572635196237-14b3f281503f')]), tags: 'handwoven,wool,blanket,merino', weight: 850, status: 'approved', featured: 1, is_active: 1 },
    { artisan_id: artisans[2].id, category_id: catBySlug('textiles').id, name: 'Silk Embroidery Cushion', description: 'Hand-embroidered silk cushion cover with traditional Bahraini floral motifs. 50 × 50 cm. Cover only.', price: 78.00, stock: 15, images: JSON.stringify([unsplash('1558618666-fcd25c85cd64')]), tags: 'silk,embroidery,cushion,handmade', weight: 220, status: 'approved', featured: 0, is_active: 1 },
    { artisan_id: artisans[2].id, category_id: catBySlug('textiles').id, name: 'Traditional Wall Tapestry', description: 'Large woven wall tapestry (80 × 120 cm) depicting an abstract dhow sailing scene. Cotton and linen blend.', price: 230.00, compare_price: 280.00, stock: 4, images: JSON.stringify([unsplash('1579783902614-a3fb3927b6a5')]), tags: 'tapestry,woven,wall art,cotton', weight: 600, status: 'approved', featured: 1, is_active: 1 },
    { artisan_id: artisans[2].id, category_id: catBySlug('textiles').id, name: 'Linen Table Runner', description: 'Naturally dyed linen table runner (40 × 180 cm). Fringe ends, machine washable.', price: 42.00, stock: 20, images: JSON.stringify([unsplash('1540189549338-e775cc89b31c')]), tags: 'linen,table runner,natural dye', weight: 180, status: 'approved', featured: 0, is_active: 1 },
    // ── Thorne Woodcraft ────────────────────────────────────────────────────
    { artisan_id: artisans[1].id, category_id: catBySlug('woodwork').id, name: 'Carved Wooden Jewelry Box', description: 'Handcarved cedar jewelry box with brass hinges. Velvet-lined interior with ring roll and three compartments.', price: 135.00, compare_price: 160.00, stock: 7, images: JSON.stringify([unsplash('1544254873-07aea27cee3c')]), tags: 'cedar,jewelry box,handcarved,brass', weight: 750, status: 'approved', featured: 1, is_active: 1 },
    { artisan_id: artisans[1].id, category_id: catBySlug('woodwork').id, name: 'Reclaimed Wood Floating Shelf', description: 'Set of 2 reclaimed pine shelves (60 cm) with handmade iron brackets. Each shelf has unique grain and character.', price: 98.00, stock: 9, images: JSON.stringify([unsplash('1558618047-3c8c75e38b50')]), tags: 'reclaimed,pine,shelf,iron', weight: 1800, status: 'approved', featured: 0, is_active: 1 },
    { artisan_id: artisans[1].id, category_id: catBySlug('woodwork').id, name: 'Oak End-Grain Cutting Board', description: 'Thick end-grain oak cutting board (35 × 25 × 4 cm) with juice groove and hanging loop. Food-safe oil finish.', price: 75.00, stock: 12, images: JSON.stringify([unsplash('1586201375761-83865001e31c')]), tags: 'oak,cutting board,end-grain,kitchen', weight: 1400, status: 'approved', featured: 0, is_active: 1 },
    { artisan_id: artisans[1].id, category_id: catBySlug('woodwork').id, name: 'Walnut Picture Frame Set', description: 'Set of 3 walnut picture frames (10×15, 15×20, 20×25 cm) with stand and wall-mount hardware.', price: 89.00, compare_price: 110.00, stock: 6, images: JSON.stringify([unsplash('1621951753015-740c699ab970')]), tags: 'walnut,picture frame,set,handmade', weight: 560, status: 'approved', featured: 0, is_active: 1 },
    // ── Karimi Jewelry ───────────────────────────────────────────────────────
    { artisan_id: artisans[3].id, category_id: catBySlug('jewelry').id, name: 'Sterling Silver Pendant Necklace', description: 'Hand-forged sterling silver pendant with a crescent moon motif. 925 silver, 45 cm chain included.', price: 95.00, compare_price: 120.00, stock: 18, images: JSON.stringify([unsplash('1535556116002-6281ff3e9f36')]), tags: '925 silver,pendant,crescent,handforged', weight: 12, status: 'approved', featured: 1, is_active: 1 },
    { artisan_id: artisans[3].id, category_id: catBySlug('jewelry').id, name: 'Gold-Plated Drop Earrings', description: '18K gold-plated teardrop earrings with freshwater pearl drops. Hypoallergenic posts.', price: 68.00, stock: 25, images: JSON.stringify([unsplash('1509941943818-9a592d4a897e')]), tags: 'gold-plated,earrings,pearl,teardrop', weight: 8, status: 'approved', featured: 0, is_active: 1 },
    { artisan_id: artisans[3].id, category_id: catBySlug('jewelry').id, name: 'Gemstone Wrap Bracelet', description: 'Multi-strand bracelet with hand-knotted labradorite, amethyst and turquoise beads on silk cord.', price: 112.00, compare_price: 140.00, stock: 14, images: JSON.stringify([unsplash('1602173574767-37ac01994b2a')]), tags: 'gemstone,bracelet,labradorite,amethyst', weight: 35, status: 'approved', featured: 1, is_active: 1 },
    { artisan_id: artisans[3].id, category_id: catBySlug('jewelry').id, name: 'Handcrafted Signet Ring', description: 'Solid sterling silver signet ring with hand-engraved traditional arabesque pattern. Available in sizes 6–12.', price: 148.00, compare_price: 180.00, stock: 10, images: JSON.stringify([unsplash('1539303894066-e15e5d4d2078')]), tags: 'sterling silver,signet ring,arabesque,engraved', weight: 18, status: 'approved', featured: 0, is_active: 1 },
    // ── Noor Glassware ───────────────────────────────────────────────────────
    { artisan_id: artisans[4].id, category_id: catBySlug('glassware').id, name: 'Hand-Blown Coloured Bowl', description: 'Stunning hand-blown borosilicate bowl in deep cobalt blue with gold swirl. 22 cm diameter. Each unique.', price: 185.00, compare_price: 220.00, stock: 4, images: JSON.stringify([unsplash('1576186526114-6f4a85d92ed5')]), tags: 'hand-blown,glass,cobalt,borosilicate', weight: 380, status: 'approved', featured: 1, is_active: 1 },
    { artisan_id: artisans[4].id, category_id: catBySlug('glassware').id, name: 'Decorative Glass Vase Set', description: 'Set of 3 complementary hand-blown vases (S/M/L) in amber tones. Each piece slightly different.', price: 245.00, compare_price: 290.00, stock: 3, images: JSON.stringify([unsplash('1574623452334-1e0ac2b3ccb4')]), tags: 'glass,vase set,amber,hand-blown', weight: 1100, status: 'approved', featured: 0, is_active: 1 },
    { artisan_id: artisans[4].id, category_id: catBySlug('glassware').id, name: 'Stained Glass Panel', description: 'Small stained glass panel (20 × 30 cm) with geometric desert rose design. Copper foil construction, ready to hang.', price: 320.00, stock: 3, images: JSON.stringify([unsplash('1519681393784-d120267933ba')]), tags: 'stained glass,panel,geometric,copper foil', weight: 850, status: 'approved', featured: 1, is_active: 1 },
    // ── Home Decor (multiple artisans) ───────────────────────────────────────
    { artisan_id: artisans[0].id, category_id: catBySlug('home-decor').id, name: 'Terracotta Plant Pot (Set of 3)', description: 'Hand-thrown terracotta pots with drainage holes (10 cm, 15 cm, 20 cm). Sealed interior, suitable for indoor plants.', price: 58.00, stock: 16, images: JSON.stringify([unsplash('1416879595882-3373a0480b5b')]), tags: 'terracotta,plant pot,set,indoor', weight: 700, status: 'approved', featured: 0, is_active: 1 },
    { artisan_id: artisans[2].id, category_id: catBySlug('home-decor').id, name: 'Macramé Wall Hanging', description: 'Large bohemian macramé wall hanging (60 × 90 cm) in natural cotton cord. Hand-knotted, with driftwood rod.', price: 125.00, compare_price: 150.00, stock: 8, images: JSON.stringify([unsplash('1501927023129-3e674dce8e45')]), tags: 'macrame,wall hanging,cotton,boho', weight: 420, status: 'approved', featured: 0, is_active: 1 },
    { artisan_id: artisans[1].id, category_id: catBySlug('home-decor').id, name: 'Woven Storage Basket', description: 'Handwoven seagrass storage basket with leather handles (30 cm diameter × 25 cm tall). Ideal for blankets or toys.', price: 72.00, stock: 11, images: JSON.stringify([unsplash('1619461867571-2af39e07f3f4')]), tags: 'seagrass,basket,storage,leather handles', weight: 380, status: 'approved', featured: 0, is_active: 1 },
    // ── Paintings ────────────────────────────────────────────────────────────
    { artisan_id: artisans[2].id, category_id: catBySlug('paintings').id, name: 'Abstract Acrylic Canvas', description: 'Original abstract acrylic painting on stretched canvas (50 × 70 cm). Warm desert palette, bold texture.', price: 280.00, compare_price: 350.00, stock: 2, images: JSON.stringify([unsplash('1579783901314-3b110c9c62e8')]), tags: 'acrylic,abstract,canvas,original', weight: 450, status: 'approved', featured: 1, is_active: 1 },
    { artisan_id: artisans[3].id, category_id: catBySlug('paintings').id, name: 'Watercolour Pearl Tower Print', description: 'Limited-edition watercolour print of the Bahrain Pearl Roundabout (40 × 50 cm). Giclée on archival paper. Signed.', price: 155.00, stock: 12, images: JSON.stringify([unsplash('1525547719571-a2d4ac8945e2')]), tags: 'watercolour,print,Bahrain,Pearl Tower', weight: 200, status: 'approved', featured: 0, is_active: 1 },
    // ── Pending product (not visible to public) ──────────────────────────────
    { artisan_id: artisans[0].id, category_id: catBySlug('pottery').id, name: 'Experimental Raku Piece', description: 'New experimental piece — pending review before listing.', price: 210.00, stock: 1, images: JSON.stringify([]), tags: 'raku,experimental', weight: 300, status: 'pending', featured: 0, is_active: 1 },
  ];

  const rows = repo.create(products as any);
  await repo.save(rows);
  console.log(`  ✓ ${rows.length} products`);
  return rows;
}

// ── Seed coupons ─────────────────────────────────────────────────────────────
async function seedCoupons(ds: DataSource, artisans: User[], admin: User) {
  const repo = ds.getRepository(Coupon);
  const coupons = [
    { code: 'WELCOME10', description: '10% off your first order', discount_type: 'percent', discount_value: 10, min_purchase: 0, usage_limit: 1000, is_active: 1, scope: 'global', created_by: admin.id, valid_from: iso(-days(1)), valid_until: iso(days(60)) },
    { code: 'SAVE20',    description: '$20 off orders over $100',  discount_type: 'fixed',   discount_value: 20, min_purchase: 100, max_discount: null, usage_limit: 500, is_active: 1, scope: 'global', created_by: admin.id, valid_from: iso(-days(1)), valid_until: iso(days(90)) },
    { code: 'BIGSPEND',  description: '15% off orders over $200',  discount_type: 'percent', discount_value: 15, min_purchase: 200, max_discount: 50, usage_limit: 100, is_active: 1, scope: 'global', created_by: admin.id, valid_from: iso(-days(1)), valid_until: iso(days(30)) },
    { code: 'EXPIRED',   description: 'Expired test coupon',       discount_type: 'percent', discount_value: 15, min_purchase: 0, usage_limit: null, is_active: 1, scope: 'global', created_by: admin.id, valid_from: iso(-days(30)), valid_until: iso(-days(1)) },
    { code: 'BUGVALID',  description: 'Bug-fix validation coupon (should work)', discount_type: 'percent', discount_value: 5, min_purchase: 0, usage_limit: null, is_active: 1, scope: 'global', created_by: admin.id, valid_from: iso(-days(7)), valid_until: iso(days(7)) },
    { code: 'ARTISAN15', description: '15% off Elena\'s Ceramics', discount_type: 'percent', discount_value: 15, min_purchase: 50, max_discount: 30, usage_limit: 200, is_active: 1, scope: 'artisan', artisan_id: artisans[0].id, created_by: artisans[0].id, valid_from: iso(-days(1)), valid_until: iso(days(45)) },
  ];
  const rows = repo.create(coupons as any);
  await repo.save(rows);
  console.log(`  ✓ ${rows.length} coupons`);
  return rows;
}

// ── Seed orders ───────────────────────────────────────────────────────────────
async function seedOrders(ds: DataSource, users: User[], products: Product[]) {
  const customers = users.filter(u => u.role === 'customer');
  const orderRepo = ds.getRepository(Order);
  const itemRepo  = ds.getRepository(OrderItem);
  const shipRepo  = ds.getRepository(Shipment);

  const createShipment = (orderId: number, status: string) => {
    const tracking = 'CRF' + Math.random().toString(36).substr(2, 9).toUpperCase();
    const history: any[] = [{ status: 'pending', timestamp: iso(-days(14)), location: 'Warehouse' }];
    if (status !== 'pending') {
      history.push({ status: 'shipped', timestamp: iso(-days(10)), location: 'Manama Hub' });
    }
    if (status === 'delivered') {
      history.push({ status: 'in_transit', timestamp: iso(-days(7)), location: 'Local Depot' });
      history.push({ status: 'delivered', timestamp: iso(-days(5)), location: 'Customer Address' });
    }
    return { order_id: orderId, tracking_number: tracking, carrier: 'Craftify Express', status, estimated_delivery: iso(days(3)), history: JSON.stringify(history) };
  };

  const orders: any[] = [
    { user_id: customers[0].id, subtotal: 89.99, shipping_cost: 0, discount_amount: 0, total_amount: 89.99, status: 'delivered', payment_method: 'card', payment_status: 'paid', shipping_address: '123 Main St', shipping_city: 'Manama', shipping_country: 'Bahrain', created_at: iso(-days(14)) },
    { user_id: customers[1].id, subtotal: 165.00, shipping_cost: 5, discount_amount: 0, total_amount: 170.00, status: 'shipped', payment_method: 'cash', payment_status: 'paid', shipping_address: '45 Pearl Rd', shipping_city: 'Riffa', shipping_country: 'Bahrain', created_at: iso(-days(7)) },
    { user_id: customers[0].id, subtotal: 120.00, shipping_cost: 0, discount_amount: 12.00, total_amount: 108.00, coupon_code: 'WELCOME10', status: 'confirmed', payment_method: 'card', payment_status: 'paid', shipping_address: '123 Main St', shipping_city: 'Manama', shipping_country: 'Bahrain', created_at: iso(-days(3)) },
    { user_id: customers[2].id, subtotal: 48.00, shipping_cost: 5, discount_amount: 0, total_amount: 53.00, status: 'pending', payment_method: 'card', payment_status: 'paid', shipping_address: '78 Gulf Ave', shipping_city: 'Muharraq', shipping_country: 'Bahrain', created_at: iso(-days(1)) },
  ];

  for (const orderData of orders) {
    const order = orderRepo.create(orderData);
    const saved = await orderRepo.save(order) as unknown as Order;

    // Pick some products for items
    const prod1 = products[0];
    const prod2 = products[Math.floor(Math.random() * 5) + 1];
    const item1 = itemRepo.create({ order_id: saved.id, product_id: prod1.id, artisan_id: prod1.artisan_id, quantity: 1, unit_price: prod1.price, total_price: prod1.price });
    const item2 = itemRepo.create({ order_id: saved.id, product_id: prod2.id, artisan_id: prod2.artisan_id, quantity: 1, unit_price: prod2.price, total_price: prod2.price });
    await itemRepo.save([item1, item2]);

    // Shipment
    const shipStatus = orderData.status === 'delivered' ? 'delivered' : orderData.status === 'shipped' ? 'shipped' : 'pending';
    const shipment = shipRepo.create(createShipment(saved.id, shipStatus));
    await shipRepo.save(shipment);
  }

  console.log(`  ✓ ${orders.length} orders with items and shipments`);
}

// ── Seed auctions ─────────────────────────────────────────────────────────────
async function seedAuctions(ds: DataSource, users: User[], products: Product[]) {
  const artisans = users.filter(u => u.role === 'artisan');
  const customers = users.filter(u => u.role === 'customer');
  const auctionRepo = ds.getRepository(Auction);
  const bidRepo = ds.getRepository(Bid);

  const auctions = [
    {
      artisan_id: artisans[0].id, product_id: products[0].id,
      title: products[0].name, description: 'Exclusive auction for this unique piece.',
      starting_price: 50, current_highest_bid: 85, bid_increment: 5,
      // BUG FIX: use iso() for datetime, not string concat
      start_time: iso(-days(2)), end_time: iso(days(7)), status: 'active',
      highest_bidder_id: customers[0].id,
    },
    {
      artisan_id: artisans[1].id, product_id: null,
      title: 'Custom Hand-Carved Oak Cabinet', description: 'A one-of-a-kind piece with hand-carved details, bidding starts at $300.',
      images: JSON.stringify(['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600']),
      starting_price: 300, current_highest_bid: 420, bid_increment: 10,
      start_time: iso(-days(3)), end_time: iso(days(5)), status: 'active',
      highest_bidder_id: customers[1].id,
    },
    {
      artisan_id: artisans[2].id, product_id: products[4].id,
      title: 'Premium Hand-Woven Blanket Auction', description: 'Reserve of $120 — first time at auction.',
      starting_price: 100, starting_bid: 100, reserve_price: 120, current_highest_bid: 145, bid_increment: 5,
      start_time: iso(-days(5)), end_time: iso(days(3)), status: 'active',
      highest_bidder_id: customers[0].id,
    },
    {
      artisan_id: artisans[3].id, product_id: null,
      title: 'One-of-a-Kind Diamond Inlay Brooch', description: 'Unique brooch with vintage diamond chips set in sterling silver.',
      images: JSON.stringify(['https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600']),
      starting_price: 500, starting_bid: 500, current_highest_bid: null, bid_increment: 25,
      start_time: iso(days(1)), end_time: iso(days(8)), status: 'pending',
    },
    {
      artisan_id: artisans[0].id, product_id: products[1].id,
      title: 'Vintage Teal Vase', description: 'This unique teal vase sold at auction.',
      starting_price: 60, current_highest_bid: 110, bid_increment: 5,
      start_time: iso(-days(14)), end_time: iso(-days(3)), status: 'sold',
      winner_id: customers[1].id, highest_bidder_id: customers[1].id,
    },
  ];

  for (const auctionData of auctions) {
    const auction = auctionRepo.create(auctionData as any);
    const saved = await auctionRepo.save(auction) as unknown as Auction;

    // Add bids to active auctions
    if (auctionData.status === 'active' || auctionData.status === 'sold') {
      const bidAmounts = [
        auctionData.starting_price + (auctionData.bid_increment || 5),
        auctionData.starting_price + (auctionData.bid_increment || 5) * 2,
        auctionData.current_highest_bid!,
      ].filter((a, i, arr) => arr.indexOf(a) === i && a > 0);

      for (let i = 0; i < bidAmounts.length; i++) {
        const bidder = customers[i % customers.length];
        const isWinning = i === bidAmounts.length - 1;
        const bid = bidRepo.create({
          auction_id: saved.id,
          user_id: bidder.id,
          amount: bidAmounts[i],
          is_winning: isWinning ? 1 : 0,
          bid_time: iso(-days(bidAmounts.length - i)),
        } as any);
        await bidRepo.save(bid);
      }
    }
  }

  console.log(`  ✓ ${auctions.length} auctions with bids`);
}

// ── Seed reviews ──────────────────────────────────────────────────────────────
async function seedReviews(ds: DataSource, users: User[], products: Product[]) {
  const customers = users.filter(u => u.role === 'customer');
  const repo = ds.getRepository(Review);

  const reviews = [
    { product_id: products[0].id, user_id: customers[0].id, rating: 5, title: 'Absolutely beautiful!', comment: 'The bowl arrived perfectly packed. The glaze is stunning and it feels incredibly solid. Would buy again.', is_approved: 1 },
    { product_id: products[0].id, user_id: customers[1].id, rating: 4, title: 'Great quality', comment: 'Really well made. Slightly smaller than expected but the craftsmanship is excellent.', is_approved: 1 },
    { product_id: products[1].id, user_id: customers[0].id, rating: 5, title: 'Gorgeous vase', comment: 'The teal colour is even more vibrant in person. Very happy!', is_approved: 1 },
    { product_id: products[4].id, user_id: customers[1].id, rating: 5, title: 'Super cosy blanket', comment: 'Incredibly soft and the colours are just right for our living room.', is_approved: 1 },
    { product_id: products[8].id, user_id: customers[0].id, rating: 5, title: 'Perfect jewellery box', comment: 'The cedar smell is lovely and the brass hinges work smoothly. Great gift.', is_approved: 1 },
    { product_id: products[12].id, user_id: customers[2].id, rating: 4, title: 'Beautiful necklace', comment: 'Very delicate and well made. The chain could be a bit longer but overall happy.', is_approved: 1 },
  ];

  const rows = repo.create(reviews as any);
  await repo.save(rows);
  console.log(`  ✓ ${rows.length} reviews`);
}

// ── Seed notifications ────────────────────────────────────────────────────────
async function seedNotifications(ds: DataSource, users: User[]) {
  const repo = ds.getRepository(Notification);
  const customers = users.filter(u => u.role === 'customer');
  const artisans  = users.filter(u => u.role === 'artisan');

  const notifs = [
    { user_id: customers[0].id, type: 'order',   title: 'Order Delivered',    message: 'Your order has been delivered!',          link: '/orders/1', is_read: 0 },
    { user_id: customers[0].id, type: 'auction',  title: 'You have been outbid', message: 'Someone placed a higher bid.',           link: '/auctions/1', is_read: 0 },
    { user_id: artisans[0].id,  type: 'order',   title: 'New Order Received', message: 'You have a new order to fulfil.',         link: '/artisan/orders', is_read: 0 },
    { user_id: customers[1].id, type: 'message', title: 'New Message',        message: 'You have a new message from Elena.',      link: '/user/messages', is_read: 0 },
  ];

  const rows = repo.create(notifs as any);
  await repo.save(rows);
  console.log(`  ✓ ${rows.length} notifications`);
}

// ── Seed messages ─────────────────────────────────────────────────────────────
async function seedMessages(ds: DataSource, users: User[]) {
  const repo = ds.getRepository(Message);
  const customers = users.filter(u => u.role === 'customer');
  const artisans  = users.filter(u => u.role === 'artisan');

  const msgs = [
    { sender_id: customers[0].id, receiver_id: artisans[0].id, content: 'Hi Elena! Do you take custom orders for the ceramic bowl? I would love one in a deep blue glaze.', is_read: 1 },
    { sender_id: artisans[0].id, receiver_id: customers[0].id, content: 'Hello! Yes, absolutely. I can do a deep cobalt blue glaze. It would take about 3 weeks. Would you like a quote?', is_read: 1 },
    { sender_id: customers[0].id, receiver_id: artisans[0].id, content: 'That would be wonderful! Please send me a quote.', is_read: 0 },
    { sender_id: customers[1].id, receiver_id: artisans[1].id, content: 'Hello Thorne, I am interested in a custom bookshelf. Is that something you make?', is_read: 1 },
    { sender_id: artisans[1].id, receiver_id: customers[1].id, content: 'Absolutely! I build custom furniture. Send me your dimensions and style preferences.', is_read: 0 },
  ];

  const rows = repo.create(msgs as any);
  await repo.save(rows);
  console.log(`  ✓ ${rows.length} messages`);
}

// ── Verify expected counts ───────────────────────────────────────────────────
async function verifyCounts(ds: DataSource) {
  const checks: [string, number][] = [
    ['categories', 8],
    ['users', 11],
    ['artisan_profiles', 5],
    ['products', 25],
    ['coupons', 6],
  ];

  let allOk = true;
  for (const [table, expected] of checks) {
    const [row] = await ds.query(`SELECT COUNT(*) as count FROM ${table}`);
    const actual = parseInt(row.count, 10);
    if (actual < expected) {
      console.warn(`  ⚠ ${table}: expected >= ${expected}, got ${actual}`);
      allOk = false;
    } else {
      console.log(`  ✓ ${table}: ${actual}`);
    }
  }

  if (!allOk) {
    console.warn('\nSome expected counts were not met. Check seed data above.');
  } else {
    console.log('\n✅ All seed verification checks passed!');
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🌱 Craftify NestJS Seed');
  console.log('═'.repeat(40));
  console.log(`  DB: ${process.env.CRAFTIFY_DB_PATH ?? 'craftify.db'}`);
  console.log('');

  await AppDataSource.initialize();
  console.log('  ✓ database connected');

  await clearTables(AppDataSource);

  const categories = await seedCategories(AppDataSource);
  const users      = await seedUsers(AppDataSource);
  const admin      = users.find(u => u.role === 'admin')!;
  const artisans   = users.filter(u => u.role === 'artisan');

  await seedArtisanProfiles(AppDataSource, users);
  const products = await seedProducts(AppDataSource, users, categories);
  await seedCoupons(AppDataSource, artisans, admin);
  await seedOrders(AppDataSource, users, products);
  await seedAuctions(AppDataSource, users, products);
  await seedReviews(AppDataSource, users, products);
  await seedNotifications(AppDataSource, users);
  await seedMessages(AppDataSource, users);

  console.log('\n📊 Verification:');
  await verifyCounts(AppDataSource);

  await AppDataSource.destroy();
  console.log('\n✅ Seeding complete!\n');
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
