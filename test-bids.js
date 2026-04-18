const { initDatabase, getDb } = require('./config/database');
initDatabase().then(() => {
  const db = getDb();
  const Auction = require('./models/Auction');
  const userId = db.prepare("SELECT id FROM users WHERE email='customer@test.com'").get().id;
  const bids = Auction.getUserBids(userId);
  console.log('Bids found:', bids.length);
  bids.forEach(b => {
    const isWinning = b.winner_id === userId || b.highest_bidder_id === userId;
    console.log(' -', (b.product_name || b.title).substring(0, 30).padEnd(30), '| amount:', String(b.amount).padEnd(6), '| isWinning:', String(isWinning).padEnd(5), '| status:', b.auction_status, '| category:', b.category_name || 'n/a');
  });
  process.exit(0);
});
