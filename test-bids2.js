const { initDatabase, getDb } = require('./config/database');
initDatabase().then(() => {
  const db = getDb();
  const Auction = require('./models/Auction');
  const userId = db.prepare("SELECT id FROM users WHERE email='customer@test.com'").get().id;
  const bids = Auction.getUserBids(userId);
  console.log('Bids found:', bids.length);
  bids.forEach(b => {
    const isWinning = b.winner_id === userId || b.highest_bidder_id === userId;
    const status = b.auction_status;
    const isActive = status === 'active';
    console.log(
      (b.product_name || b.title).substring(0, 28).padEnd(28),
      '| $' + String(b.amount).padEnd(7),
      '| current: $' + String(b.current_highest_bid).padEnd(7),
      '| winning:', String(isWinning).padEnd(5),
      '| status:', status,
      '| cat:', b.category_name || 'n/a'
    );
  });
  const now = new Date();
  const active = bids.filter(b => b.auction_status === 'active' && new Date(b.end_time) > now);
  const past = bids.filter(b => b.auction_status !== 'active' || new Date(b.end_time) <= now);
  console.log('\nActive bids:', active.length, '| Past bids:', past.length);
  process.exit(0);
});
