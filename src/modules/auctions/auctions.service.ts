import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { Auction } from '../../database/entities/auction.entity';
import { Bid } from '../../database/entities/bid.entity';
import { Product } from '../../database/entities/product.entity';
import { Category } from '../../database/entities/category.entity';
import { User } from '../../database/entities/user.entity';
import { ArtisanProfile } from '../../database/entities/artisan-profile.entity';
import { Notification } from '../../database/entities/notification.entity';

// ---------------------------------------------------------------------------
// Shape types
// ---------------------------------------------------------------------------

export interface AuctionDetail extends Auction {
  bid_count: number;
  artisan_name: string;
  shop_name: string | null;
  category_name: string | null;
  product_images: string | null;
  artisan_profile_image: string | null;
  artisan_avatar: string | null;
  highest_bidder_name: string | null;
  winner_name: string | null;
  /** Resolved display title: COALESCE(product.name, auction.title) */
  display_title: string;
  /** Resolved display images: COALESCE(product.images, auction.images) */
  display_images: string | null;
}

export interface AuctionListItem {
  id: number;
  title: string;
  display_title: string;
  display_images: string | null;
  product_images: string | null;
  images: string | null;
  status: string;
  starting_price: number;
  current_highest_bid: number | null;
  bid_increment: number;
  end_time: Date;
  start_time: Date;
  artisan_name: string;
  shop_name: string | null;
  category_name: string | null;
  bid_count: number;
}

export interface BidWithUser extends Bid {
  bidder_name: string;
}

export interface FindAllFilters {
  status?: string;
  artisan_id?: number;
  active?: boolean;
  ending_soon?: boolean;
  search?: string;
  category_id?: number;
  sort?: 'ending_soon' | 'newest' | 'most_bids' | 'highest_bid';
  page?: number;
  limit?: number;
}

export interface PlaceBidResult {
  success: boolean;
  bid?: BidWithUser;
  auction?: Auction & { bid_count: number };
  previousBidderId?: number | null;
  error?: string;
}

export interface AuctionStats {
  total: number;
  active: number;
  pending: number;
  completed: number;
  sold: number;
  cancelled: number;
}

// ---------------------------------------------------------------------------
// AuctionsService
// ---------------------------------------------------------------------------

@Injectable()
export class AuctionsService {
  private readonly logger = new Logger(AuctionsService.name);

  constructor(
    @InjectRepository(Auction)
    private readonly auctionRepo: Repository<Auction>,

    @InjectRepository(Bid)
    private readonly bidRepo: Repository<Bid>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(ArtisanProfile)
    private readonly artisanProfileRepo: Repository<ArtisanProfile>,

    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,

    private readonly dataSource: DataSource,
  ) {}

  // -------------------------------------------------------------------------
  // findById
  // -------------------------------------------------------------------------

  async findById(id: number): Promise<AuctionDetail | null> {
    const rows = await this.dataSource.query<AuctionDetail[]>(
      `
      SELECT
        a.*,
        COALESCE(p.name, a.title)                         AS display_title,
        COALESCE(p.images, a.images)                      AS display_images,
        p.name                                             AS product_name,
        p.images                                           AS product_images,
        p.description                                      AS product_description,
        c.name                                             AS category_name,
        u.name                                             AS artisan_name,
        u.avatar                                           AS artisan_avatar,
        ap.shop_name,
        ap.profile_image                                   AS artisan_profile_image,
        hu.name                                            AS highest_bidder_name,
        wu.name                                            AS winner_name,
        (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) AS bid_count
      FROM auctions a
      LEFT JOIN products      p  ON a.product_id = p.id
      LEFT JOIN categories    c  ON p.category_id = c.id
      JOIN      users         u  ON a.artisan_id  = u.id
      LEFT JOIN artisan_profiles ap ON u.id        = ap.user_id
      LEFT JOIN users         hu ON a.highest_bidder_id = hu.id
      LEFT JOIN users         wu ON a.winner_id         = wu.id
      WHERE a.id = ?
      `,
      [id],
    );

    return rows[0] ?? null;
  }

  // -------------------------------------------------------------------------
  // findAll
  // -------------------------------------------------------------------------

  async findAll(filters: FindAllFilters = {}): Promise<{
    auctions: AuctionListItem[];
    total: number;
    pagination: { current: number; total: number; hasNext: boolean; hasPrev: boolean };
  }> {
    const {
      status,
      artisan_id,
      active,
      ending_soon,
      search,
      category_id,
      sort = 'ending_soon',
      page = 1,
      limit = 12,
    } = filters;

    // ---- WHERE clause ----
    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];

    if (active) {
      conditions.push("a.status = 'active' AND a.end_time > datetime('now')");
    } else if (ending_soon) {
      conditions.push("a.status = 'active' AND a.end_time <= datetime('now', '+24 hours') AND a.end_time > datetime('now')");
    } else if (status) {
      conditions.push('a.status = ?');
      params.push(status);
    }

    if (artisan_id) {
      conditions.push('a.artisan_id = ?');
      params.push(artisan_id);
    }

    if (search) {
      conditions.push('(COALESCE(p.name, a.title) LIKE ? OR a.title LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category_id) {
      conditions.push('p.category_id = ?');
      params.push(category_id);
    }

    const whereClause = conditions.join(' AND ');

    // ---- ORDER BY ----
    const sortMap: Record<string, string> = {
      ending_soon: 'a.end_time ASC',
      newest:      'a.created_at DESC',
      most_bids:   'bid_count DESC',
      highest_bid: 'a.current_highest_bid DESC',
    };
    const orderBy = sortMap[sort] ?? 'a.end_time ASC';

    // ---- Count ----
    const countQuery = `
      SELECT COUNT(*) AS cnt
      FROM auctions a
      LEFT JOIN products       p  ON a.product_id  = p.id
      LEFT JOIN categories     c  ON p.category_id = c.id
      JOIN      users          u  ON a.artisan_id  = u.id
      LEFT JOIN artisan_profiles ap ON u.id         = ap.user_id
      WHERE ${whereClause}
    `;
    const countRows = await this.dataSource.query<{ cnt: number }[]>(countQuery, params);
    const total = Number(countRows[0]?.cnt ?? 0);

    // ---- Data ----
    const offset = (page - 1) * limit;
    const dataParams = [...params, limit, offset];

    const dataQuery = `
      SELECT
        a.*,
        COALESCE(p.name,   a.title)  AS display_title,
        COALESCE(p.images, a.images) AS display_images,
        p.images                     AS product_images,
        c.name                       AS category_name,
        u.name                       AS artisan_name,
        ap.shop_name,
        (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) AS bid_count
      FROM auctions a
      LEFT JOIN products       p  ON a.product_id  = p.id
      LEFT JOIN categories     c  ON p.category_id = c.id
      JOIN      users          u  ON a.artisan_id  = u.id
      LEFT JOIN artisan_profiles ap ON u.id         = ap.user_id
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const auctions = await this.dataSource.query<AuctionListItem[]>(dataQuery, dataParams);
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      auctions,
      total,
      pagination: {
        current:  page,
        total:    totalPages,
        hasNext:  page < totalPages,
        hasPrev:  page > 1,
      },
    };
  }

  // -------------------------------------------------------------------------
  // getEndingSoon — active auctions ending in the next 24 h
  // -------------------------------------------------------------------------

  async getEndingSoon(limit = 6): Promise<AuctionListItem[]> {
    const rows = await this.dataSource.query<AuctionListItem[]>(
      `
      SELECT
        a.*,
        COALESCE(p.name,   a.title)  AS display_title,
        COALESCE(p.images, a.images) AS display_images,
        p.images                     AS product_images,
        c.name                       AS category_name,
        u.name                       AS artisan_name,
        ap.shop_name,
        (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) AS bid_count
      FROM auctions a
      LEFT JOIN products       p  ON a.product_id  = p.id
      LEFT JOIN categories     c  ON p.category_id = c.id
      JOIN      users          u  ON a.artisan_id  = u.id
      LEFT JOIN artisan_profiles ap ON u.id         = ap.user_id
      WHERE a.status = 'active'
        AND a.end_time > datetime('now')
        AND a.end_time <= datetime('now', '+24 hours')
      ORDER BY a.end_time ASC
      LIMIT ?
      `,
      [limit],
    );
    return rows;
  }

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  async create(data: {
    artisan_id: number;
    product_id?: number | null;
    title?: string;
    description?: string;
    images?: string;
    starting_price: number;
    starting_bid?: number;
    reserve_price?: number | null;
    bid_increment?: number;
    start_time: string;
    end_time: string;
  }): Promise<AuctionDetail> {
    const {
      artisan_id,
      product_id = null,
      description = '',
      images = '[]',
      reserve_price = null,
      bid_increment = 1,
    } = data;

    // BUG FIX: Normalize datetime-local values to full ISO strings.
    // Without this, "2024-03-15T10:00" (no timezone suffix) stores
    // inconsistently and causes wrong string comparisons in background tasks.
    const normalizeDateTime = (dt: string): string => {
      const d = new Date(dt);
      return Number.isNaN(d.getTime()) ? dt : d.toISOString();
    };

    const normalizedStartTime = normalizeDateTime(data.start_time);
    const normalizedEndTime   = normalizeDateTime(data.end_time);

    // Auto-resolve status: 'active' if start_time is now or past, else 'pending'
    const now    = new Date();
    const status = new Date(normalizedStartTime) <= now ? 'active' : 'pending';

    // Resolve title: explicit title OR linked product's name OR fallback
    let resolvedTitle = data.title ?? '';
    if (!resolvedTitle && product_id) {
      const product = await this.productRepo.findOneBy({ id: product_id });
      resolvedTitle = product?.name ?? 'Auction';
    }
    if (!resolvedTitle) {
      resolvedTitle = 'Auction';
    }

    const actualStartingPrice = data.starting_price || data.starting_bid || 0;

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(
        `
        INSERT INTO auctions (
          product_id, artisan_id, title, description, images,
          starting_price, starting_bid, reserve_price, bid_increment,
          start_time, end_time, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          product_id,
          artisan_id,
          resolvedTitle,
          description,
          images,
          actualStartingPrice,
          actualStartingPrice,
          reserve_price,
          bid_increment,
          normalizedStartTime,
          normalizedEndTime,
          status,
        ],
      );

      const rowidRows = await qr.query(
        'SELECT last_insert_rowid() AS id',
      );
      const newId = Number(rowidRows[0]?.id);
      const created = await this.findById(newId);
      if (!created) {
        throw new Error('Failed to retrieve created auction');
      }
      return created;
    } finally {
      await qr.release();
    }
  }

  // -------------------------------------------------------------------------
  // placeBid
  // -------------------------------------------------------------------------

  async placeBid(
    auctionId: number,
    userId: number,
    amount: number,
  ): Promise<PlaceBidResult> {
    // ---- Basic validation ----
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return { success: false, error: 'Invalid bid amount' };
    }
    if (parsedAmount > 1_000_000) {
      return { success: false, error: 'Bid amount cannot exceed $1,000,000' };
    }

    // Pre-check outside transaction (cheap fail-fast)
    const preCheck = await this.dataSource.query<Auction[]>(
      'SELECT * FROM auctions WHERE id = ?',
      [auctionId],
    );
    const preAuction = preCheck[0];
    if (!preAuction) return { success: false, error: 'Auction not found' };
    if (preAuction.status !== 'active')  return { success: false, error: 'Auction is not active' };
    if (new Date(preAuction.end_time) <= new Date()) return { success: false, error: 'Auction has ended' };
    if (Number(preAuction.artisan_id) === Number(userId)) return { success: false, error: 'You cannot bid on your own auction' };

    const getMinimumBid = (auc: any): number => {
      const increment    = Number(auc.bid_increment) || 0;
      const hasCurrentBid =
        auc.current_highest_bid !== null &&
        auc.current_highest_bid !== undefined;
      const baseBid = hasCurrentBid
        ? Number(auc.current_highest_bid)
        : Number(auc.starting_price || 0);
      return baseBid + increment;
    };

    const minBid = getMinimumBid(preAuction);
    if (parsedAmount < minBid) {
      return { success: false, error: `Minimum bid is $${minBid.toFixed(2)}` };
    }

    // ---- Transactional bid insertion ----
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // Re-validate inside the transaction to avoid race-condition bid acceptance
      const freshRows = await qr.query(
        'SELECT * FROM auctions WHERE id = ?',
        [auctionId],
      );
      const freshAuction = freshRows[0];
      if (!freshAuction) throw new Error('Auction not found');
      if (freshAuction.status !== 'active')  throw new Error('Auction is not active');
      if (new Date(freshAuction.end_time) <= new Date()) throw new Error('Auction has ended');
      if (Number(freshAuction.artisan_id) === Number(userId)) throw new Error('You cannot bid on your own auction');

      const freshMin = getMinimumBid(freshAuction);
      if (parsedAmount < freshMin) {
        throw new Error(`Minimum bid is $${freshMin.toFixed(2)}`);
      }

      // Store the previous highest bidder for outbid notification
      const previousBidderId = freshAuction.highest_bidder_id
        ? Number(freshAuction.highest_bidder_id)
        : null;

      // Insert bid record
      await qr.query(
        `INSERT INTO bids (auction_id, user_id, amount, bid_time) VALUES (?, ?, ?, datetime('now'))`,
        [auctionId, userId, parsedAmount],
      );

      // Clear previous winning flag
      await qr.query(
        `UPDATE bids SET is_winning = 0 WHERE auction_id = ? AND is_winning = 1`,
        [auctionId],
      );

      // Mark new bid as winning
      await qr.query(
        `UPDATE bids SET is_winning = 1
         WHERE id = (SELECT id FROM bids WHERE auction_id = ? ORDER BY id DESC LIMIT 1)`,
        [auctionId],
      );

      // Update auction summary
      await qr.query(
        `UPDATE auctions SET current_highest_bid = ?, highest_bidder_id = ?, winner_id = ? WHERE id = ?`,
        [parsedAmount, userId, userId, auctionId],
      );

      await qr.commitTransaction();

      // ---- Fetch updated data (outside transaction) ----
      const [bidCountRow] = await this.dataSource.query<{ count: number }[]>(
        'SELECT COUNT(*) AS count FROM bids WHERE auction_id = ?',
        [auctionId],
      );
      const bidCount = Number(bidCountRow?.count ?? 0);

      const latestBidRows = await this.dataSource.query<(Bid & { bidder_name: string })[]>(
        `SELECT b.*, u.name AS bidder_name
         FROM bids b
         JOIN users u ON b.user_id = u.id
         WHERE b.auction_id = ?
         ORDER BY b.id DESC
         LIMIT 1`,
        [auctionId],
      );
      const latestBid = latestBidRows[0];

      const updatedAucRows = await this.dataSource.query<Auction[]>(
        'SELECT * FROM auctions WHERE id = ?',
        [auctionId],
      );
      const updatedAuction = updatedAucRows[0] as Auction & { bid_count: number };
      if (updatedAuction) updatedAuction.bid_count = bidCount;

      // Outbid notification (fire-and-forget — do not await)
      if (previousBidderId && previousBidderId !== Number(userId)) {
        const auctionLabel = (preAuction as any).title || (preAuction as any).product_name || 'the auction';
        this.createNotification({
          user_id: previousBidderId,
          type:    'auction',
          title:   "You've been outbid!",
          message: `Someone placed a higher bid on "${auctionLabel}"`,
          link:    `/auctions/${auctionId}`,
        }).catch(() => { /* suppress */ });
      }

      return {
        success: true,
        bid:     latestBid,
        auction: updatedAuction,
        previousBidderId,
      };
    } catch (err) {
      await qr.rollbackTransaction().catch(() => { /* noop */ });
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    } finally {
      await qr.release();
    }
  }

  // -------------------------------------------------------------------------
  // getBids
  // -------------------------------------------------------------------------

  async getBids(
    auctionId: number,
    limit = 20,
    offset = 0,
  ): Promise<{ bids: BidWithUser[]; total: number }> {
    const [countRows, bids] = await Promise.all([
      this.dataSource.query<{ cnt: number }[]>(
        'SELECT COUNT(*) AS cnt FROM bids WHERE auction_id = ?',
        [auctionId],
      ),
      this.dataSource.query<BidWithUser[]>(
        `SELECT b.*, u.name AS bidder_name
         FROM bids b
         JOIN users u ON b.user_id = u.id
         WHERE b.auction_id = ?
         ORDER BY b.created_at DESC
         LIMIT ? OFFSET ?`,
        [auctionId, limit, offset],
      ),
    ]);

    return { bids, total: Number(countRows[0]?.cnt ?? 0) };
  }

  // -------------------------------------------------------------------------
  // getUserBid — single highest bid for a specific user on a specific auction
  // -------------------------------------------------------------------------

  async getUserBid(auctionId: number, userId: number): Promise<BidWithUser | null> {
    const rows = await this.dataSource.query<BidWithUser[]>(
      `SELECT b.*, u.name AS bidder_name
       FROM bids b
       JOIN users u ON b.user_id = u.id
       WHERE b.auction_id = ? AND b.user_id = ?
       ORDER BY b.amount DESC
       LIMIT 1`,
      [auctionId, userId],
    );
    return rows[0] ?? null;
  }

  // -------------------------------------------------------------------------
  // getUserBids — all auctions the user has bid on (deduplicated)
  // -------------------------------------------------------------------------

  async getUserBids(userId: number, limit?: number): Promise<any[]> {
    let sql = `
      SELECT b.id, b.auction_id, b.user_id, b.amount, b.is_winning, b.created_at,
        a.title, a.images AS auction_images, a.end_time, a.status AS auction_status,
        a.current_highest_bid, a.winner_id, a.highest_bidder_id,
        p.images AS product_images, p.name AS product_name,
        cat.name AS category_name
      FROM bids b
      JOIN auctions a ON b.auction_id = a.id
      LEFT JOIN products p ON a.product_id = p.id
      LEFT JOIN categories cat ON p.category_id = cat.id
      WHERE b.user_id = ?
        AND b.id = (
          SELECT id FROM bids b2
          WHERE b2.user_id = ? AND b2.auction_id = b.auction_id
          ORDER BY b2.amount DESC, b2.id DESC
          LIMIT 1
        )
      ORDER BY b.created_at DESC
    `;
    const params: unknown[] = [userId, userId];

    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    return this.dataSource.query(sql, params);
  }

  // -------------------------------------------------------------------------
  // endExpiredAndActivatePending — background task core
  // -------------------------------------------------------------------------

  async endExpiredAndActivatePending(io?: any): Promise<void> {
    // BUG FIX: Use Date.now() + new Date() for numeric comparisons, not raw
    // string comparison, to avoid timezone-sensitive mismatches.
    const now = new Date().toISOString();

    try {
      // ---- End expired active auctions ----
      const expiredAuctions = await this.dataSource.query<any[]>(
        `SELECT a.*, COALESCE(p.name, a.title) AS product_name
         FROM auctions a
         LEFT JOIN products p ON a.product_id = p.id
         WHERE a.status = 'active' AND a.end_time <= ?`,
        [now],
      );

      for (const auction of expiredAuctions) {
        const auctionLabel = auction.product_name || auction.title || 'the item';

        if (auction.winner_id) {
          // There is a winning bidder → mark as sold
          await this.dataSource.query(
            `UPDATE auctions SET status = 'sold' WHERE id = ?`,
            [auction.id],
          );

          // Notify winner
          await this.createNotification({
            user_id: Number(auction.winner_id),
            type:    'auction',
            title:   'Congratulations! You won!',
            message: `You won the auction for "${auctionLabel}" with a bid of $${auction.current_highest_bid}`,
            link:    `/auctions/${auction.id}`,
          });
        } else {
          // No bids received → mark as completed (not sold)
          await this.dataSource.query(
            `UPDATE auctions SET status = 'completed' WHERE id = ?`,
            [auction.id],
          );
        }

        // Notify artisan in both cases
        const hasBids = !!auction.winner_id;
        const amount  = hasBids ? auction.current_highest_bid : null;
        const artisanMsg = hasBids && amount != null
          ? `Your auction for "${auctionLabel}" ended with winning bid of $${amount}`
          : hasBids
          ? `Your auction "${auctionLabel}" has ended with a winning bid`
          : `Your auction for "${auctionLabel}" ended with no bids`;

        await this.createNotification({
          user_id: Number(auction.artisan_id),
          type:    'auction',
          title:   'Auction Ended',
          message: artisanMsg,
          link:    `/artisan/auctions/${auction.id}`,
        });

        // Emit Socket.io event if io is provided
        if (io) {
          io.to(`auction-${auction.id}`).emit('auctionEnded', {
            auctionId:  auction.id,
            winnerId:   auction.winner_id,
            winningBid: auction.current_highest_bid,
          });
        }
      }

      // ---- Activate pending auctions whose start_time has arrived ----
      await this.dataSource.query(
        `UPDATE auctions
         SET status = 'active'
         WHERE status = 'pending' AND start_time <= ? AND end_time > ?`,
        [now, now],
      );

      if (expiredAuctions.length > 0) {
        this.logger.log(
          `Background task: ended ${expiredAuctions.length} auction(s).`,
        );
      }
    } catch (err) {
      this.logger.error(
        `endExpiredAndActivatePending error: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  // -------------------------------------------------------------------------
  // cancelAuction
  // -------------------------------------------------------------------------

  async cancelAuction(id: number, artisanId?: number): Promise<void> {
    const auction = await this.auctionRepo.findOneBy({ id });
    if (!auction) {
      throw new NotFoundException(`Auction #${id} not found`);
    }

    if (artisanId !== undefined && Number(auction.artisan_id) !== Number(artisanId)) {
      throw new ForbiddenException('You do not own this auction');
    }

    if (!['pending', 'active'].includes(auction.status)) {
      throw new BadRequestException(`Cannot cancel auction with status "${auction.status}"`);
    }

    await this.dataSource.query(
      `UPDATE auctions SET status = 'cancelled' WHERE id = ?`,
      [id],
    );
  }

  // -------------------------------------------------------------------------
  // approveAuction
  // -------------------------------------------------------------------------

  async approveAuction(id: number): Promise<void> {
    const auction = await this.auctionRepo.findOneBy({ id });
    if (!auction) throw new NotFoundException(`Auction #${id} not found`);

    const now       = new Date();
    const startDate = new Date(auction.start_time);
    const newStatus = startDate <= now ? 'active' : 'pending';

    await this.dataSource.query(
      `UPDATE auctions SET status = ? WHERE id = ?`,
      [newStatus, id],
    );
  }

  // -------------------------------------------------------------------------
  // setStatus
  // -------------------------------------------------------------------------

  async setStatus(id: number, status: string): Promise<void> {
    const auction = await this.auctionRepo.findOneBy({ id });
    if (!auction) throw new NotFoundException(`Auction #${id} not found`);

    await this.dataSource.query(
      `UPDATE auctions SET status = ? WHERE id = ?`,
      [status, id],
    );
  }

  // -------------------------------------------------------------------------
  // getStats
  // -------------------------------------------------------------------------

  async getStats(): Promise<AuctionStats> {
    const rows = await this.dataSource.query<{ status: string; cnt: number }[]>(
      `SELECT status, COUNT(*) AS cnt FROM auctions GROUP BY status`,
    );

    const map: Record<string, number> = {};
    for (const row of rows) {
      map[row.status] = Number(row.cnt);
    }

    const total = Object.values(map).reduce((a, b) => a + b, 0);

    return {
      total,
      active:    map['active']    ?? 0,
      pending:   map['pending']   ?? 0,
      completed: map['completed'] ?? 0,
      sold:      map['sold']      ?? 0,
      cancelled: map['cancelled'] ?? 0,
    };
  }

  // -------------------------------------------------------------------------
  // count
  // -------------------------------------------------------------------------

  async count(filters: { status?: string; artisan_id?: number } = {}): Promise<number> {
    const conditions: string[] = ['1=1'];
    const params: unknown[]    = [];

    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters.artisan_id) {
      conditions.push('artisan_id = ?');
      params.push(filters.artisan_id);
    }

    const rows = await this.dataSource.query<{ cnt: number }[]>(
      `SELECT COUNT(*) AS cnt FROM auctions WHERE ${conditions.join(' AND ')}`,
      params,
    );
    return Number(rows[0]?.cnt ?? 0);
  }

  // -------------------------------------------------------------------------
  // getByArtisan — paginated auction list scoped to one artisan
  // -------------------------------------------------------------------------

  async getByArtisan(
    artisanId: number,
    filters: FindAllFilters = {},
  ): Promise<{
    auctions: AuctionListItem[];
    total: number;
    pagination: { current: number; total: number; hasNext: boolean; hasPrev: boolean };
  }> {
    return this.findAll({ ...filters, artisan_id: artisanId });
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async createNotification(data: {
    user_id: number;
    type: string;
    title: string;
    message: string;
    link?: string;
  }): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO notifications (user_id, type, title, message, link, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, 0, datetime('now'))`,
      [data.user_id, data.type, data.title, data.message, data.link ?? null],
    );
  }
}
