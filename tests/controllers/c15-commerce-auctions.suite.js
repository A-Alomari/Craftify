const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Product, Auction, and Order Controller Additional Coverage', () => {
    test('Auction routes cover status filtering, my bids, data API, and bid JSON success/error branches', async () => {
      const customerAgent = await loginAs('customer@test.com', 'cust123');
      const customer2Agent = await loginAs('customer2@test.com', 'cust123');

      const soldAuctions = await request(app).get('/auctions?status=sold&sort=newest');
      expect(soldAuctions.statusCode).toBe(200);

      const allAuctions = await request(app).get('/auctions?status=all&sort=most_bids');
      expect(allAuctions.statusCode).toBe(200);

      const myBids = await customerAgent.get('/auctions/my-bids');
      expect(myBids.statusCode).toBe(200);

      const auctionData = await request(app).get(`/auctions/${ids.auctionId}/data`);
      expect(auctionData.statusCode).toBe(200);
      expect(auctionData.body).toHaveProperty('auction');

      const missingAuctionData = await request(app).get('/auctions/999999/data');
      expect(missingAuctionData.statusCode).toBe(404);

      const missingAuctionPage = await request(app).get('/auctions/999999');
      expect(missingAuctionPage.statusCode).toBe(302);
      expect(missingAuctionPage.headers.location).toContain('/auctions');

      const lowBid = await customerAgent
        .post(`/auctions/${ids.auctionId}/bid`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ amount: 0.01 });
      expect(lowBid.statusCode).toBe(400);
      expect(lowBid.body.success).toBe(false);

      const currentAuction = db.prepare('SELECT current_highest_bid, bid_increment FROM auctions WHERE id = ?').get(ids.auctionId);
      const validAmount1 = (currentAuction.current_highest_bid || 0) + (currentAuction.bid_increment || 1) + 5;
      const validBid1 = await customerAgent
        .post(`/auctions/${ids.auctionId}/bid`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ amount: validAmount1 });
      expect(validBid1.statusCode).toBe(200);
      expect(validBid1.body.success).toBe(true);

      const nextAuction = db.prepare('SELECT current_highest_bid, bid_increment FROM auctions WHERE id = ?').get(ids.auctionId);
      const validAmount2 = (nextAuction.current_highest_bid || 0) + (nextAuction.bid_increment || 1) + 5;
      const validBid2 = await customer2Agent
        .post(`/auctions/${ids.auctionId}/bid`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ amount: validAmount2 });
      expect(validBid2.statusCode).toBe(200);
      expect(validBid2.body.success).toBe(true);
    });

  });
};
