module.exports = ({ getTestContext }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Auction Model', () => {
    const Auction = require('../../models/Auction');

    test('findById returns auction with details', () => {
      const aId = db.prepare('SELECT id FROM auctions WHERE title = ?').get('Test Auction').id;
      const aucInfo = Auction.findById(aId);
      expect(aucInfo).toBeTruthy();
      expect(aucInfo.title).toBe('Test Auction');
      expect(aucInfo.status).toBe('active');
    });

    test('findAll returns auctions', () => {
      const auctions = Auction.findAll({ active: true });
      expect(auctions.length).toBeGreaterThanOrEqual(1);
    });

    test('getBids returns bid history', () => {
      const bids = Auction.getBids(ids.auctionId, 10);
      expect(bids.length).toBeGreaterThanOrEqual(2);
    });

    test('placeBid validates bid amount', () => {
      expect(() => {
        Auction.placeBid(ids.auctionId, ids.custId, 1.00); // Too low
      }).toThrow();
    });

    test('placeBid accepts valid bid', () => {
      const now = new Date();
      db.prepare('INSERT INTO auctions (product_id,artisan_id,title,starting_price,current_highest_bid,bid_increment,start_time,end_time,status) VALUES (?,?,?,?,?,?,?,?,?)').run(ids.vaseId,ids.artId,'Bid Test Unique',30.00,45.00,5.00,new Date(now-86400000).toISOString(),new Date(now.getTime()+172800000).toISOString(),'active');
      const aucId = db.prepare('SELECT id FROM auctions WHERE title = ?').get('Bid Test Unique').id;

      const result = Auction.placeBid(aucId, ids.custId, 55.00);
      expect(result).toBeTruthy();
    });
  });

  // ── Coupon Model ──
};


