/**
 * test/models/auctions.service.spec.ts
 *
 * Unit tests for AuctionsService — validates the auction timing BUG FIX.
 * The original code compared datetime strings, causing inconsistent expiry.
 * Fixed: use Date.now() numeric comparisons + ISO string normalisation on create.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';

process.env.NODE_ENV         = 'test';
process.env.CRAFTIFY_DB_PATH = ':memory:';

import { Auction }      from '../../src/database/entities/auction.entity';
import { Bid }          from '../../src/database/entities/bid.entity';
import { User }         from '../../src/database/entities/user.entity';
import { Product }      from '../../src/database/entities/product.entity';
import { Category }     from '../../src/database/entities/category.entity';
import { Notification } from '../../src/database/entities/notification.entity';
import { ArtisanProfile } from '../../src/database/entities/artisan-profile.entity';
import { CartItem }     from '../../src/database/entities/cart-item.entity';
import { Wishlist }     from '../../src/database/entities/wishlist.entity';
import { Review }       from '../../src/database/entities/review.entity';
import { Message }      from '../../src/database/entities/message.entity';
import { Order }        from '../../src/database/entities/order.entity';
import { OrderItem }    from '../../src/database/entities/order-item.entity';
import { Shipment }     from '../../src/database/entities/shipment.entity';
import { Coupon }       from '../../src/database/entities/coupon.entity';
import { PasswordReset } from '../../src/database/entities/password-reset.entity';
import { NewsletterSubscription } from '../../src/database/entities/newsletter-subscription.entity';

const ALL_ENTITIES = [Auction, Bid, User, Product, Category, Notification, ArtisanProfile,
  CartItem, Wishlist, Review, Message, Order, OrderItem, Shipment, Coupon, PasswordReset, NewsletterSubscription];

describe('AuctionsService', () => {
  let module: TestingModule;
  let service: any;
  let dataSource: any;

  let artisanId: number;
  let customerId: number;
  let activeAuctionId: number;
  let pendingAuctionId: number;
  let expiredAuctionId: number;

  beforeAll(async () => {
    const { AuctionsModule } = await import('../../src/modules/auctions/auctions.module');
    const { AuctionsService } = await import('../../src/modules/auctions/auctions.service');

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqljs' as any,
          synchronize: true,
          dropSchema: true,
          logging: false,
          entities: ALL_ENTITIES,
        }),
        AuctionsModule,
      ],
    }).compile();

    service    = module.get(AuctionsService);
    const { DataSource } = await import('typeorm');
    dataSource = module.get(DataSource);

    // Seed minimal users
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const iso = (ms: number) => new Date(ms).toISOString();

    await dataSource.query(`
      INSERT INTO users (name, email, password, role, status, country)
      VALUES
        ('Artisan', 'artisan.auction@test.com', 'hashed', 'artisan', 'active', 'Bahrain'),
        ('Customer', 'customer.auction@test.com', 'hashed', 'customer', 'active', 'Bahrain')
    `);

    const [ar] = await dataSource.query(`SELECT id FROM users WHERE email='artisan.auction@test.com'`);
    const [cu] = await dataSource.query(`SELECT id FROM users WHERE email='customer.auction@test.com'`);
    artisanId  = ar.id;
    customerId = cu.id;

    await dataSource.query(`
      INSERT INTO artisan_profiles (user_id, shop_name, is_approved)
      VALUES (${artisanId}, 'Test Shop', 1)
    `);

    // Active auction (already started, ends in 7 days)
    await dataSource.query(`
      INSERT INTO auctions (artisan_id, title, starting_price, bid_increment, start_time, end_time, status)
      VALUES (${artisanId}, 'Active Auction', 100, 5, '${iso(now - day)}', '${iso(now + 7 * day)}', 'active')
    `);
    const [a1] = await dataSource.query(`SELECT id FROM auctions WHERE title='Active Auction'`);
    activeAuctionId = a1.id;

    // Pending auction (starts in future)
    await dataSource.query(`
      INSERT INTO auctions (artisan_id, title, starting_price, bid_increment, start_time, end_time, status)
      VALUES (${artisanId}, 'Pending Auction', 50, 5, '${iso(now + day)}', '${iso(now + 8 * day)}', 'pending')
    `);
    const [a2] = await dataSource.query(`SELECT id FROM auctions WHERE title='Pending Auction'`);
    pendingAuctionId = a2.id;

    // Expired auction (should be ended by background task)
    await dataSource.query(`
      INSERT INTO auctions (artisan_id, title, starting_price, bid_increment, start_time, end_time, status)
      VALUES (${artisanId}, 'Expired Auction', 80, 5, '${iso(now - 3 * day)}', '${iso(now - day)}', 'active')
    `);
    const [a3] = await dataSource.query(`SELECT id FROM auctions WHERE title='Expired Auction'`);
    expiredAuctionId = a3.id;

    // Add a bid to expired auction
    await dataSource.query(`
      INSERT INTO bids (auction_id, user_id, amount, is_winning, bid_time)
      VALUES (${expiredAuctionId}, ${customerId}, 95, 1, '${iso(now - 2 * day)}')
    `);
    await dataSource.query(`
      UPDATE auctions SET current_highest_bid=95, highest_bidder_id=${customerId}, winner_id=${customerId}
      WHERE id=${expiredAuctionId}
    `);
  }, 30000);

  afterAll(async () => {
    await module.close();
  });

  // ── findById ────────────────────────────────────────────────────────────────
  describe('findById()', () => {
    it('returns auction with artisan info', async () => {
      const a = await service.findById(activeAuctionId);
      expect(a).not.toBeNull();
      expect(a.id).toBe(activeAuctionId);
    });

    it('returns null for non-existent id', async () => {
      const a = await service.findById(999999);
      expect(a).toBeNull();
    });
  });

  // ── create() — BUG FIX: ISO string normalisation ───────────────────────────
  describe('create() — BUG FIX datetime normalisation', () => {
    it('stores end_time as ISO string regardless of input format', async () => {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;

      const auction = await service.create({
        artisan_id:     artisanId,
        title:         'Test Create Auction',
        starting_price: 50,
        bid_increment:  5,
        start_time:    new Date(now - day).toISOString(),
        end_time:      new Date(now + 5 * day).toISOString(),
      });

      expect(auction).toBeDefined();
      expect(auction.id).toBeGreaterThan(0);

      // end_time must be a valid ISO string (BUG FIX: was stored as datetime-local without tz)
      const parsed = new Date(auction.end_time);
      expect(isNaN(parsed.getTime())).toBe(false);
      expect(auction.end_time).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('auto-sets status to active when start_time is in the past', async () => {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      const auction = await service.create({
        artisan_id:     artisanId,
        title:         'Auto-Active Auction',
        starting_price: 30,
        bid_increment:  5,
        start_time:    new Date(now - 2 * day).toISOString(),
        end_time:      new Date(now + 5 * day).toISOString(),
      });
      expect(auction.status).toBe('active');
    });

    it('auto-sets status to pending when start_time is in the future', async () => {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      const auction = await service.create({
        artisan_id:     artisanId,
        title:         'Future Auction',
        starting_price: 30,
        bid_increment:  5,
        start_time:    new Date(now + 2 * day).toISOString(),
        end_time:      new Date(now + 9 * day).toISOString(),
      });
      expect(auction.status).toBe('pending');
    });
  });

  // ── placeBid() ──────────────────────────────────────────────────────────────
  describe('placeBid()', () => {
    it('accepts a valid bid above starting_price', async () => {
      const result = await service.placeBid(activeAuctionId, customerId, 110);
      expect(result.success).toBe(true);
    });

    it('rejects bid below current highest + increment', async () => {
      // After placing $110, next bid must be >= $115
      const result = await service.placeBid(activeAuctionId, customerId, 112);
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('rejects bid by auction owner (artisan)', async () => {
      const result = await service.placeBid(activeAuctionId, artisanId, 200);
      expect(result.success).toBe(false);
    });

    it('rejects bid on non-active auction', async () => {
      const result = await service.placeBid(pendingAuctionId, customerId, 60);
      expect(result.success).toBe(false);
    });

    it('updates current_highest_bid after accepted bid', async () => {
      const before = await service.findById(activeAuctionId);
      const newBid = (before.current_highest_bid ?? before.starting_price) + (before.bid_increment ?? 5) + 1;
      await service.placeBid(activeAuctionId, customerId, newBid);
      const after = await service.findById(activeAuctionId);
      expect(Number(after.current_highest_bid)).toBeGreaterThanOrEqual(newBid);
    });
  });

  // ── endExpiredAndActivatePending() — BUG FIX ───────────────────────────────
  describe('endExpiredAndActivatePending() — BUG FIX date comparison', () => {
    it('marks expired active auctions as sold (when winner exists)', async () => {
      // Run the background task
      await service.endExpiredAndActivatePending(null);

      const [row] = await dataSource.query(
        `SELECT status, winner_id FROM auctions WHERE id=${expiredAuctionId}`,
      );
      expect(row.status).toBe('sold');
      expect(row.winner_id).toBe(customerId);
    });

    it('does NOT end active auctions that are still running', async () => {
      await service.endExpiredAndActivatePending(null);
      const [row] = await dataSource.query(`SELECT status FROM auctions WHERE id=${activeAuctionId}`);
      expect(row.status).toBe('active');
    });

    it('activates pending auctions whose start_time has passed', async () => {
      // Fast-forward: update start_time to past
      const day = 24 * 60 * 60 * 1000;
      await dataSource.query(`
        UPDATE auctions SET start_time=datetime('now','-1 hour')
        WHERE id=${pendingAuctionId}
      `);
      await service.endExpiredAndActivatePending(null);
      const [row] = await dataSource.query(`SELECT status FROM auctions WHERE id=${pendingAuctionId}`);
      expect(row.status).toBe('active');
    });
  });

  // ── findAll() ───────────────────────────────────────────────────────────────
  describe('findAll()', () => {
    it('returns auctions with pagination', async () => {
      const result = await service.findAll({ page: 1, limit: 10 });
      expect(result).toHaveProperty('auctions');
      expect(result).toHaveProperty('pagination');
      expect(Array.isArray(result.auctions)).toBe(true);
    });

    it('filters by status=active', async () => {
      const result = await service.findAll({ status: 'active' });
      for (const a of result.auctions) {
        expect(a.status).toBe('active');
      }
    });
  });
});
