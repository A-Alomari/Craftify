/**
 * seed.js – Populate the Render PostgreSQL database with realistic data.
 *
 * Run:  node prisma/seed.js
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Craftify database…\n");

  // ── 1. USERS ──────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("Password123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@craftify.com" },
    update: {},
    create: {
      fullName: "Admin User",
      email: "admin@craftify.com",
      passwordHash,
      role: "ADMIN",
      isEmailVerified: true,
      bio: "Platform administrator for Craftify.",
    },
  });
  console.log("  ✅ Admin user:", admin.email);

  const artisan1 = await prisma.user.upsert({
    where: { email: "elena@craftify.com" },
    update: {},
    create: {
      fullName: "Elena Rossi",
      email: "elena@craftify.com",
      passwordHash,
      role: "ARTISAN",
      isEmailVerified: true,
      bio: "Ceramics artist from Florence. I craft hand-painted pottery inspired by Renaissance patterns.",
      avatarUrl: "https://randomuser.me/api/portraits/women/44.jpg",
    },
  });

  const artisan2 = await prisma.user.upsert({
    where: { email: "marcus@craftify.com" },
    update: {},
    create: {
      fullName: "Marcus Thorne",
      email: "marcus@craftify.com",
      passwordHash,
      role: "ARTISAN",
      isEmailVerified: true,
      bio: "Master weaver specialising in Highland wool textiles and handwoven home décor.",
      avatarUrl: "https://randomuser.me/api/portraits/men/32.jpg",
    },
  });

  const artisan3 = await prisma.user.upsert({
    where: { email: "sarah@craftify.com" },
    update: {},
    create: {
      fullName: "Sarah Chen",
      email: "sarah@craftify.com",
      passwordHash,
      role: "ARTISAN",
      isEmailVerified: true,
      bio: "Woodturner and furniture maker. Every piece tells the story of the tree it came from.",
      avatarUrl: "https://randomuser.me/api/portraits/women/65.jpg",
    },
  });

  const buyer = await prisma.user.upsert({
    where: { email: "buyer@craftify.com" },
    update: {},
    create: {
      fullName: "Test Buyer",
      email: "buyer@craftify.com",
      passwordHash,
      role: "BUYER",
      isEmailVerified: true,
      bio: "Avid collector of handcrafted goods.",
    },
  });
  console.log("  ✅ Artisans:", artisan1.email, artisan2.email, artisan3.email);
  console.log("  ✅ Buyer:", buyer.email);

  // ── 2. ARTISAN PROFILES ───────────────────────────────────────────
  for (const artisan of [artisan1, artisan2, artisan3]) {
    await prisma.artisanProfile.upsert({
      where: { userId: artisan.id },
      update: {},
      create: {
        userId: artisan.id,
        shopName:
          artisan.id === artisan1.id
            ? "Elena's Ceramics"
            : artisan.id === artisan2.id
              ? "Highland Weaves"
              : "Chen Woodcraft",
        location:
          artisan.id === artisan1.id
            ? "Florence, Italy"
            : artisan.id === artisan2.id
              ? "Edinburgh, UK"
              : "Portland, OR",
        verified: true,
      },
    });
  }
  console.log("  ✅ Artisan profiles created");

  // ── 3. CATEGORIES ─────────────────────────────────────────────────
  const categoryData = [
    { name: "Pottery", slug: "pottery" },
    { name: "Textiles", slug: "textiles" },
    { name: "Woodwork", slug: "woodwork" },
    { name: "Jewelry", slug: "jewelry" },
    { name: "Glassware", slug: "glassware" },
    { name: "Leather", slug: "leather" },
  ];

  const categories = {};
  for (const cat of categoryData) {
    categories[cat.slug] = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }
  console.log("  ✅ Categories:", Object.keys(categories).join(", "));

  // ── 4. PRODUCTS ───────────────────────────────────────────────────
  const products = [];

  const productData = [
    // Elena – Pottery
    {
      name: "Earth & Bloom Vase",
      description: "A hand-painted ceramic vase featuring delicate floral motifs inspired by Tuscan wildflower meadows. Each piece is kiln-fired twice for a luminous glaze finish.",
      price: 124.0,
      stock: 15,
      categorySlug: "pottery",
      artisan: artisan1,
      imageUrls: ["https://lh3.googleusercontent.com/aida-public/AB6AXuDyEfZE7Zk6sVYI8bhNu3Oo8flFfQi6C5zNFJevWprRKEMAWoYBMfi2xTL1zjdEXAxQCOE4tn8IQuLPIszcUtk1F6Rq_YsONdVUKSGfJ4_kgk9h5soOeLcEIq0u6zBinGMVQVGvUzkXezTu9GyNr7NuY5echsZZl3LF1Hydqa-HqO5tvVLCP-A6qYbtzFh1qH-N81zKTSR9azB-t5DTRExk6d02euqUuox-tGO_x7wzSx3M40JjpxWifEjcJ0bC7LsZmlFmS1N_ky8"],
    },
    {
      name: "Sunset Terracotta Bowl",
      description: "A warm, earthy terracotta serving bowl with a hand-carved rim. Perfect for rustic table settings. Food-safe and dishwasher-friendly.",
      price: 68.0,
      stock: 22,
      categorySlug: "pottery",
      artisan: artisan1,
      imageUrls: ["https://lh3.googleusercontent.com/aida-public/AB6AXuBX5pF2FtsfRdoVuSirUqNVp2si5f7TmF6pE89-VWK4MwPN7FuGeEYvBHDYj_oYz207xBEnmZy_v9RADZjyVTFjY3wAe-T3lgZ2bx7jVCRJYtszvra1rTTfr-H2O59F_zRbbgtpSmyUEI5Z8unDjRfK_cPnNACyDQb0_US7DQLpjnsBaZHqhfNnArG7iRSYoVh5PIFElldQSeeO20e9EvWztpt8HQLGKVIgg7L0t5BIX4XQEyNQx67YWc36tQ0YHu5QIUiWHk-sBkY"],
    },
    {
      name: "Midnight Blue Mug Set",
      description: "Set of four hand-thrown stoneware mugs with a deep midnight blue glaze. Ergonomic handles designed for comfortable morning coffee.",
      price: 89.0,
      stock: 30,
      categorySlug: "pottery",
      artisan: artisan1,
      imageUrls: ["https://lh3.googleusercontent.com/aida-public/AB6AXuAsLN_HztruXUkvC8LpcyYMRMiMPLSJPsIPBaHoBzlJF0Pnhz3KnEtPAms3nUl7mQpiO_R4nKhFDYFlMzGx0WijhlvLrfM_dCz3fHdEDMTxKJOtO1_4GiZlC33P8TYgN21bQ9azY1eSdO6Co5KG44yARx47x9GjVxW9KTdJvU3GulZ3wP_xXW6M1Mbdq2VJpbLCKZF0-MUnTP-crC4BP3-4ozUI7QdwLyuEUeqqdjJ0G3B5viruBFDkda4RlRM__ljXzpnQlpuj73Y"],
    },
    // Marcus – Textiles
    {
      name: "Highland Wool Throw",
      description: "A luxuriously soft handwoven wool throw blanket in earthy tones. Made from ethically sourced Scottish Highland sheep wool. Perfect for cosy evenings.",
      price: 85.0,
      stock: 18,
      categorySlug: "textiles",
      artisan: artisan2,
      imageUrls: ["https://lh3.googleusercontent.com/aida-public/AB6AXuCJfpPd36O2s-t_8DuCk8tlIZW0NSFcT50Fj-GOmVulLIvbaTZ4VTediUeRGZ_Y6I1d5lVwcHmIM0MCQFdOocSW4QEiFRrzE6rXX3ijdN7WS2oZFatfwEoNgWpee7ihdbWPW7ImJmoMnzUBk90V_zxwiMkX7hJB-TEOpNP4VxAhMxf7u8k3WRRtlU9Pq0FeoCA6frpo8ds0dOkJwdys3qanpfHIpnc915qLkP8Zcw_fGtwDF_fuDaMwZd7j0hpFTFHsco4v0K4CdkY"],
    },
    {
      name: "Woven Table Runner",
      description: "An intricate hand-loomed linen table runner with geometric patterns. Natural undyed fibres with accents of indigo. Machine washable.",
      price: 45.0,
      stock: 25,
      categorySlug: "textiles",
      artisan: artisan2,
      imageUrls: ["https://lh3.googleusercontent.com/aida-public/AB6AXuBd7E7_YlL1cVb5hX-ow4M8aEyv18n86bJUEHOtOL0IPTllIG_AiN9d1pYxPSCiuC1RbNGIFNZOy0-Lthr_U-KbF40yvpXy97_pLO0Q4LlbfhgfFtCYcKQ3ccPeEaMLG0yHlstMegh0d1P9LOpXGtCLfcCdSVcRxmJM56P8f3Z4gup9fB3QqQgTuPHEoNzvKiZeQK8EsgelRfQDV35BxBOSfrJu6e42klnellgD4EaTaRE7Gf5_7XdjufmeLYLtPfR9GNJ1hm1ovnA"],
    },
    {
      name: "Herringbone Cushion Cover",
      description: "A sophisticated herringbone-pattern cushion cover in soft merino wool. Hidden zip closure, fits standard 18×18 inch inserts.",
      price: 38.0,
      stock: 40,
      categorySlug: "textiles",
      artisan: artisan2,
      imageUrls: ["https://lh3.googleusercontent.com/aida-public/AB6AXuAsLN_HztruXUkvC8LpcyYMRMiMPLSJPsIPBaHoBzlJF0Pnhz3KnEtPAms3nUl7mQpiO_R4nKhFDYFlMzGx0WijhlvLrfM_dCz3fHdEDMTxKJOtO1_4GiZlC33P8TYgN21bQ9azY1eSdO6Co5KG44yARx47x9GjVxW9KTdJvU3GulZ3wP_xXW6M1Mbdq2VJpbLCKZF0-MUnTP-crC4BP3-4ozUI7QdwLyuEUeqqdjJ0G3B5viruBFDkda4RlRM__ljXzpnQlpuj73Y"],
    },
    // Sarah – Woodwork
    {
      name: "Solid Walnut Bowl",
      description: "A minimalist hand-turned bowl carved from a single block of black walnut. The natural grain creates a unique pattern in every piece. Food-safe finish.",
      price: 56.0,
      stock: 12,
      categorySlug: "woodwork",
      artisan: artisan3,
      imageUrls: ["https://lh3.googleusercontent.com/aida-public/AB6AXuBX5pF2FtsfRdoVuSirUqNVp2si5f7TmF6pE89-VWK4MwPN7FuGeEYvBHDYj_oYz207xBEnmZy_v9RADZjyVTFjY3wAe-T3lgZ2bx7jVCRJYtszvra1rTTfr-H2O59F_zRbbgtpSmyUEI5Z8unDjRfK_cPnNACyDQb0_US7DQLpjnsBaZHqhfNnArG7iRSYoVh5PIFElldQSeeO20e9EvWztpt8HQLGKVIgg7L0t5BIX4XQEyNQx67YWc36tQ0YHu5QIUiWHk-sBkY"],
    },
    {
      name: "Maple Cutting Board",
      description: "End-grain maple cutting board with an integrated juice groove. Exceptionally durable and gentle on knife edges. Handmade in Portland.",
      price: 78.0,
      stock: 20,
      categorySlug: "woodwork",
      artisan: artisan3,
      imageUrls: ["https://lh3.googleusercontent.com/aida-public/AB6AXuDyEfZE7Zk6sVYI8bhNu3Oo8flFfQi6C5zNFJevWprRKEMAWoYBMfi2xTL1zjdEXAxQCOE4tn8IQuLPIszcUtk1F6Rq_YsONdVUKSGfJ4_kgk9h5soOeLcEIq0u6zBinGMVQVGvUzkXezTu9GyNr7NuY5echsZZl3LF1Hydqa-HqO5tvVLCP-A6qYbtzFh1qH-N81zKTSR9azB-t5DTRExk6d02euqUuox-tGO_x7wzSx3M40JjpxWifEjcJ0bC7LsZmlFmS1N_ky8"],
    },
    {
      name: "Cherry Wood Candle Holder",
      description: "A pair of turned cherry wood candle holders with a warm honey finish. Fits standard taper candles. Balanced design that won't tip.",
      price: 42.0,
      stock: 35,
      categorySlug: "woodwork",
      artisan: artisan3,
      imageUrls: ["https://lh3.googleusercontent.com/aida-public/AB6AXuCJfpPd36O2s-t_8DuCk8tlIZW0NSFcT50Fj-GOmVulLIvbaTZ4VTediUeRGZ_Y6I1d5lVwcHmIM0MCQFdOocSW4QEiFRrzE6rXX3ijdN7WS2oZFatfwEoNgWpee7ihdbWPW7ImJmoMnzUBk90V_zxwiMkX7hJB-TEOpNP4VxAhMxf7u8k3WRRtlU9Pq0FeoCA6frpo8ds0dOkJwdys3qanpfHIpnc915qLkP8Zcw_fGtwDF_fuDaMwZd7j0hpFTFHsco4v0K4CdkY"],
    },
    // More products for variety
    {
      name: "Azure Sky Ring",
      description: "Handcrafted sterling silver ring set with a raw Arizona turquoise stone. Each ring is one-of-a-kind due to the natural variation in the gemstone.",
      price: 210.0,
      stock: 8,
      categorySlug: "jewelry",
      artisan: artisan1,
      imageUrls: ["https://lh3.googleusercontent.com/aida-public/AB6AXuBd7E7_YlL1cVb5hX-ow4M8aEyv18n86bJUEHOtOL0IPTllIG_AiN9d1pYxPSCiuC1RbNGIFNZOy0-Lthr_U-KbF40yvpXy97_pLO0Q4LlbfhgfFtCYcKQ3ccPeEaMLG0yHlstMegh0d1P9LOpXGtCLfcCdSVcRxmJM56P8f3Z4gup9fB3QqQgTuPHEoNzvKiZeQK8EsgelRfQDV35BxBOSfrJu6e42klnellgD4EaTaRE7Gf5_7XdjufmeLYLtPfR9GNJ1hm1ovnA"],
    },
    {
      name: "Blown Glass Decanter",
      description: "A stunning hand-blown glass wine decanter with an organic, flowing shape. Each piece captures light beautifully and doubles as a centrepiece.",
      price: 155.0,
      stock: 6,
      categorySlug: "glassware",
      artisan: artisan2,
      imageUrls: ["https://lh3.googleusercontent.com/aida-public/AB6AXuAsLN_HztruXUkvC8LpcyYMRMiMPLSJPsIPBaHoBzlJF0Pnhz3KnEtPAms3nUl7mQpiO_R4nKhFDYFlMzGx0WijhlvLrfM_dCz3fHdEDMTxKJOtO1_4GiZlC33P8TYgN21bQ9azY1eSdO6Co5KG44yARx47x9GjVxW9KTdJvU3GulZ3wP_xXW6M1Mbdq2VJpbLCKZF0-MUnTP-crC4BP3-4ozUI7QdwLyuEUeqqdjJ0G3B5viruBFDkda4RlRM__ljXzpnQlpuj73Y"],
    },
    {
      name: "Hand-Stitched Leather Journal",
      description: "A refillable journal bound in full-grain vegetable-tanned leather. Includes 180 pages of acid-free paper. Develops a beautiful patina with age.",
      price: 65.0,
      stock: 50,
      categorySlug: "leather",
      artisan: artisan3,
      imageUrls: ["https://lh3.googleusercontent.com/aida-public/AB6AXuDyEfZE7Zk6sVYI8bhNu3Oo8flFfQi6C5zNFJevWprRKEMAWoYBMfi2xTL1zjdEXAxQCOE4tn8IQuLPIszcUtk1F6Rq_YsONdVUKSGfJ4_kgk9h5soOeLcEIq0u6zBinGMVQVGvUzkXezTu9GyNr7NuY5echsZZl3LF1Hydqa-HqO5tvVLCP-A6qYbtzFh1qH-N81zKTSR9azB-t5DTRExk6d02euqUuox-tGO_x7wzSx3M40JjpxWifEjcJ0bC7LsZmlFmS1N_ky8"],
    },
  ];

  for (const p of productData) {
    const existing = await prisma.product.findFirst({
      where: { name: p.name, artisanId: p.artisan.id },
    });
    if (existing) {
      products.push(existing);
      continue;
    }
    const product = await prisma.product.create({
      data: {
        name: p.name,
        description: p.description,
        price: p.price,
        stock: p.stock,
        status: "ACTIVE",
        imageUrls: p.imageUrls,
        categoryId: categories[p.categorySlug].id,
        artisanId: p.artisan.id,
      },
    });
    products.push(product);
  }
  console.log("  ✅ Products:", products.length);

  // ── 5. AUCTIONS ───────────────────────────────────────────────────
  const now = new Date();
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const fiveDaysLater = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

  const auctionableProducts = products.slice(0, 3);
  for (const product of auctionableProducts) {
    const existing = await prisma.auction.findUnique({
      where: { productId: product.id },
    });
    if (existing) continue;

    await prisma.auction.create({
      data: {
        productId: product.id,
        startingBid: Math.round(product.price * 0.5),
        currentBid: Math.round(product.price * 0.5),
        bidIncrement: 5,
        startAt: now,
        endAt: product === auctionableProducts[0] ? threeDaysLater : fiveDaysLater,
        status: "LIVE",
      },
    });
  }
  console.log("  ✅ Auctions: 3 live");

  // ── 6. FAQs ───────────────────────────────────────────────────────
  const faqData = [
    { question: "How do I place an order?", answer: "Browse our marketplace, add items to your cart, and proceed to checkout. You'll need to create an account first." },
    { question: "How does bidding work on auctions?", answer: "Enter the auction detail page, type your bid amount (must exceed the current bid plus the minimum increment), and click Place Bid. You'll be notified if you're outbid." },
    { question: "What payment methods do you accept?", answer: "We accept all major credit and debit cards through our secure payment processor. Auction winners complete payment after the auction ends." },
    { question: "How do I become a seller / artisan?", answer: "Create an account, then visit your profile and start the artisan registration process. You'll provide your shop name, describe your craft, and agree to our seller terms." },
    { question: "Can I return or exchange an item?", answer: "Since all items are handcrafted, returns are handled on a case-by-case basis. Please contact the artisan directly through our messaging system within 14 days of delivery." },
    { question: "How is shipping handled?", answer: "Artisans ship items directly to buyers. Shipping times and costs vary by artisan and destination. Estimated delivery details are shown at checkout." },
    { question: "Is my personal information secure?", answer: "Yes. We use industry-standard encryption and never store your payment details on our servers. Passwords are securely hashed." },
    { question: "How do I contact an artisan?", answer: "Visit the artisan's profile page and use the messaging feature. You must be signed in to send messages." },
  ];

  const existingFaqCount = await prisma.faq.count();
  if (existingFaqCount === 0) {
    await prisma.faq.createMany({ data: faqData });
  }
  console.log("  ✅ FAQs:", faqData.length);

  // ── 7. SAMPLE REVIEWS ─────────────────────────────────────────────
  const reviewData = [
    { rating: 5, title: "Absolutely stunning", body: "This vase is even more beautiful in person. The glaze has incredible depth and the hand-painted flowers are exquisite.", productIndex: 0 },
    { rating: 4, title: "Great quality wool", body: "The throw is incredibly soft and warm. Perfect for chilly evenings. Colours are true to the photos. Minor loose thread but nothing major.", productIndex: 3 },
    { rating: 5, title: "A work of art", body: "The walnut grain in this bowl is absolutely gorgeous. It's become the centrepiece of our dining table. Superb craftsmanship.", productIndex: 6 },
  ];

  for (const r of reviewData) {
    const product = products[r.productIndex];
    if (!product) continue;
    const existing = await prisma.review.findUnique({
      where: { userId_productId: { userId: buyer.id, productId: product.id } },
    });
    if (existing) continue;

    await prisma.review.create({
      data: {
        userId: buyer.id,
        productId: product.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
      },
    });
  }
  console.log("  ✅ Reviews: 3");

  console.log("\n🎉 Seed complete!\n");
  console.log("Test accounts (all passwords: Password123):");
  console.log("  Admin:   admin@craftify.com");
  console.log("  Artisan: elena@craftify.com");
  console.log("  Artisan: marcus@craftify.com");
  console.log("  Artisan: sarah@craftify.com");
  console.log("  Buyer:   buyer@craftify.com");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
