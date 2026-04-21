import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Req,
  Res,
  UseGuards,
  ParseIntPipe,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

import { AuctionsService } from './auctions.service';
import { AuthGuard }   from '../../common/guards/auth.guard';
import { ActiveGuard } from '../../common/guards/roles.guard';
import { CustomerGuard } from '../../common/guards/roles.guard';
import { DataSource }  from 'typeorm';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isTest =
  process.env.NODE_ENV === 'test' ||
  Boolean(process.env.JEST_WORKER_ID) ||
  process.argv.some((a) => a.includes('jest'));

type MiddlewareFn = (req: any, res: any, next: () => void) => void;
const passThrough: MiddlewareFn = (_req, _res, next) => next();

/**
 * 20 requests per 60 s per IP for POST /auctions/:id/bid.
 * Disabled in test mode.
 */
const bidLimiter: MiddlewareFn = isTest
  ? passThrough
  : rateLimit({
      windowMs: 60_000,
      max: 20,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many bid attempts, please try again later.' },
    });

/**
 * Parse and JSON-encode images for all auctions in a list.
 * Falls back to product_images → auction images → placeholder.
 */
function resolveAuctionImages(auction: any): void {
  const raw = auction.display_images || auction.product_images || auction.images || '[]';
  let images: string[];
  try {
    images = JSON.parse(raw);
  } catch {
    images = [];
  }
  auction.image      = images[0] || '/images/placeholder-product.svg';
  auction.imageArray = images.length > 0 ? images : ['/images/placeholder-product.svg'];
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

@Controller('auctions')
export class AuctionsController {
  private readonly logger = new Logger(AuctionsController.name);

  constructor(
    private readonly auctionsService: AuctionsService,
    private readonly dataSource: DataSource,
  ) {}

  // -------------------------------------------------------------------------
  // GET /auctions — public listing
  // -------------------------------------------------------------------------

  @Get()
  async index(
    @Query('status')   statusQ  = 'active',
    @Query('sort')     sort     = 'ending_soon',
    @Query('category') categoryQ: string | undefined,
    @Query('search')   search: string | undefined,
    @Query('page')     pageQ    = '1',
    @Req()  req: Request & { session: any },
    @Res()  res: Response,
  ): Promise<void> {
    try {
      const page   = Math.max(1, parseInt(pageQ, 10) || 1);
      const limit  = 12;
      const catId  = categoryQ ? parseInt(categoryQ, 10) : undefined;
      const user   = req.session?.user ?? null;

      const filters: Parameters<AuctionsService['findAll']>[0] = {
        sort: sort as any,
        page,
        limit,
      };

      if (statusQ === 'active') {
        filters.active = true;
      } else if (statusQ !== 'all') {
        filters.status = statusQ;
      }

      if (catId && !Number.isNaN(catId)) filters.category_id = catId;
      if (search?.trim()) filters.search = search.trim();

      const [{ auctions, total, pagination }, categories] = await Promise.all([
        this.auctionsService.findAll(filters),
        this.dataSource.query<{ id: number; name: string }[]>(
          `SELECT id, name FROM categories WHERE is_active = 1 ORDER BY name ASC`,
        ),
      ]);

      // Resolve display image for each auction
      auctions.forEach(resolveAuctionImages);

      const totalAuctions = total;

      res.render('auctions/index', {
        title:      'Live Auctions - Craftify',
        auctions,
        categories,
        filters:    {
          status:   statusQ,
          sort,
          category: catId ?? null,
          search:   search ?? '',
        },
        pagination,
        totalAuctions,
        user,
        csrfToken:  res.locals.csrfToken ?? '',
      });
    } catch (err) {
      this.logger.error('Auctions index error', (err as Error).stack);
      (req as any).flash?.('error_msg', 'Error loading auctions');
      res.redirect('/');
    }
  }

  // -------------------------------------------------------------------------
  // GET /auctions/my-bids — customer's bid history
  // -------------------------------------------------------------------------

  @Get('my-bids')
  @UseGuards(AuthGuard, ActiveGuard, CustomerGuard)
  async myBids(
    @Query('tab')  tab  = 'active',
    @Query('page') pageQ = '1',
    @Req()  req: Request & { session: any },
    @Res()  res: Response,
  ): Promise<void> {
    try {
      const userId = req.session.user.id as number;
      const page   = Math.max(1, parseInt(pageQ, 10) || 1);
      const perPage = 8;
      const now    = new Date();

      const bids = await this.auctionsService.getUserBids(userId);

      // Enrich each bid with computed fields
      bids.forEach((b: any) => {
        const images = (() => {
          try { return JSON.parse(b.product_images || b.auction_images || '[]'); }
          catch { return []; }
        })();
        b.image = images[0] || '/images/placeholder-product.svg';

        b.isWinning = b.winner_id === userId || b.highest_bidder_id === userId;

        const endTime   = new Date(b.end_time);
        const timeLeftMs = endTime.getTime() - now.getTime();
        b.timeLeftMs = timeLeftMs;

        if (timeLeftMs <= 0) {
          b.timeLeftDisplay = 'Ended';
          b.isEndingSoon    = false;
          b.timeLeftIcon    = 'event_busy';
        } else {
          const totalHours = Math.floor(timeLeftMs / (1000 * 60 * 60));
          const minutes    = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
          const days       = Math.floor(timeLeftMs / (1000 * 60 * 60 * 24));

          if (totalHours < 24) {
            b.timeLeftDisplay = totalHours > 0 ? `${totalHours}h ${minutes}m left` : `${minutes}m left`;
            b.isEndingSoon    = true;
            b.timeLeftIcon    = 'timer';
          } else if (days === 1) {
            b.timeLeftDisplay = 'Ends Tomorrow';
            b.isEndingSoon    = false;
            b.timeLeftIcon    = 'calendar_today';
          } else {
            b.timeLeftDisplay = `${days} days left`;
            b.isEndingSoon    = false;
            b.timeLeftIcon    = 'calendar_today';
          }
        }
      });

      const allActiveBids = bids.filter(
        (b: any) => b.auction_status === 'active' && b.timeLeftMs > 0,
      );
      const allPastBids   = bids.filter(
        (b: any) => b.auction_status !== 'active' || b.timeLeftMs <= 0,
      );

      const activeBidsCount = allActiveBids.length;
      const totalWon = bids.filter(
        (b: any) =>
          (b.auction_status === 'sold' || b.auction_status === 'ended') &&
          b.winner_id === userId,
      ).length;

      const sourceBids  = tab === 'past' ? allPastBids : allActiveBids;
      const totalItems  = sourceBids.length;
      const totalPages  = Math.ceil(totalItems / perPage) || 1;
      const offset      = (page - 1) * perPage;

      const activeBids = tab === 'past' ? allActiveBids : sourceBids.slice(offset, offset + perPage);
      const pastBids   = tab === 'past' ? sourceBids.slice(offset, offset + perPage) : allPastBids;

      const pagination = {
        current: page,
        total:   totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };

      res.render('auctions/my-bids', {
        title:          'My Bids - Craftify',
        bids,
        activeBids,
        pastBids,
        activeBidsCount,
        totalWon,
        activeTab:  tab,
        pagination,
        user:       req.session.user,
        csrfToken:  res.locals.csrfToken ?? '',
      });
    } catch (err) {
      this.logger.error('My bids error', (err as Error).stack);
      (req as any).flash?.('error_msg', 'Error loading bids');
      res.redirect('/');
    }
  }

  // -------------------------------------------------------------------------
  // GET /auctions/:id — single auction page
  // -------------------------------------------------------------------------

  @Get(':id')
  async show(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { session: any },
    @Res() res: Response,
  ): Promise<void> {
    try {
      const user    = req.session?.user ?? null;
      const auction = await this.auctionsService.findById(id);

      if (!auction) {
        (req as any).flash?.('error_msg', 'Auction not found');
        res.redirect('/auctions');
        return;
      }

      const { bids } = await this.auctionsService.getBids(id, 20, 0);

      const userBid = user
        ? await this.auctionsService.getUserBid(id, user.id)
        : null;

      // Resolve image array
      const rawImages = auction.product_images || auction.images || '[]';
      let imageArray: string[];
      try {
        imageArray = JSON.parse(rawImages);
      } catch {
        imageArray = [];
      }
      (auction as any).imageArray =
        imageArray.length > 0 ? imageArray : ['/images/placeholder-product.svg'];

      const endTime      = new Date(auction.end_time);
      const timeRemaining = Math.max(0, endTime.getTime() - Date.now());
      const isActive     = auction.status === 'active' && timeRemaining > 0;

      const displayTitle =
        (auction as any).display_title ||
        (auction as any).product_name  ||
        auction.title ||
        'Auction';

      res.render('auctions/show', {
        title:        `${displayTitle} - Craftify`,
        auction,
        bids,
        userBid,
        timeRemaining,
        isActive,
        user,
        csrfToken:    res.locals.csrfToken ?? '',
      });
    } catch (err) {
      this.logger.error('Auction show error', (err as Error).stack);
      res.redirect('/auctions');
    }
  }

  // -------------------------------------------------------------------------
  // POST /auctions/:id/bid — place a bid (rate-limited)
  // -------------------------------------------------------------------------

  @Post(':id/bid')
  @UseGuards(AuthGuard, ActiveGuard, CustomerGuard)
  async placeBid(
    @Param('id', ParseIntPipe) id: number,
    @Body('amount') amountStr: string,
    @Req() req: Request & { session: any; xhr?: boolean },
    @Res() res: Response,
  ): Promise<void> {
    // Apply rate limiter imperatively (NestJS guards run before this)
    await new Promise<void>((resolve, reject) => {
      bidLimiter(req, res, (err?: any) => (err ? reject(err) : resolve()));
    });

    try {
      const amount = parseFloat(amountStr);
      const userId = req.session.user.id as number;
      const io     = (req.app as any).get?.('io');

      const result = await this.auctionsService.placeBid(id, userId, amount);

      if (!result.success) {
        if (
          req.xhr ||
          String(req.headers['x-requested-with'] || '').toLowerCase() === 'xmlhttprequest'
        ) {
          res.status(400).json({ success: false, message: result.error });
          return;
        }
        (req as any).flash?.('error_msg', result.error);
        res.redirect(`/auctions/${id}`);
        return;
      }

      // Emit Socket.io events
      if (io && result.bid && result.auction) {
        const normalizedId  = Number(id);
        const bidUpdatePayload = {
          auctionId:  normalizedId,
          amount:     result.bid.amount,
          currentBid: result.auction.current_highest_bid,
          bidCount:   (result.auction as any).bid_count,
          bidderId:   userId,
          bidderName: req.session.user.name,
          bidIncrement: result.auction.bid_increment,
          bidTime:    (result.bid as any).bid_time || result.bid.created_at,
        };

        io.to(`auction-${id}`).emit('bidUpdate', bidUpdatePayload);
        // Legacy event for backward-compatible clients
        io.to(`auction-${id}`).emit('new-bid', {
          auctionId:  normalizedId,
          amount:     result.bid.amount,
          bidderId:   userId,
          bidderName: req.session.user.name,
          bidTime:    (result.bid as any).bid_time || result.bid.created_at,
          totalBids:  (result.auction as any).bid_count,
        });

        // Notify previous highest bidder via their personal room
        if (
          result.previousBidderId &&
          result.previousBidderId !== userId
        ) {
          io.to(`user-${result.previousBidderId}`).emit('outbid', {
            auctionId: normalizedId,
            newBid:    result.bid.amount,
          });
        }
      }

      if (
        req.xhr ||
        String(req.headers['x-requested-with'] || '').toLowerCase() === 'xmlhttprequest'
      ) {
        res.json({
          success: true,
          message: 'Bid placed successfully!',
          bid:     result.bid,
          auction: result.auction,
        });
        return;
      }

      (req as any).flash?.('success_msg', 'Bid placed successfully!');
      res.redirect(`/auctions/${id}`);
    } catch (err) {
      this.logger.error('Place bid error', (err as Error).stack);
      if (
        req.xhr ||
        String(req.headers['x-requested-with'] || '').toLowerCase() === 'xmlhttprequest'
      ) {
        res.status(500).json({ success: false, message: 'Server error' });
        return;
      }
      (req as any).flash?.('error_msg', 'An error occurred while placing your bid');
      res.redirect(`/auctions/${id}`);
    }
  }

  // -------------------------------------------------------------------------
  // GET /auctions/:id/data — JSON polling endpoint for AJAX
  // -------------------------------------------------------------------------

  @Get(':id/data')
  async getAuctionData(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const auction = await this.auctionsService.findById(id);

      if (!auction) {
        res.status(404).json({ error: 'Auction not found' });
        return;
      }

      const { bids } = await this.auctionsService.getBids(id, 10, 0);

      res.json({
        auction: {
          id:                   auction.id,
          current_highest_bid:  auction.current_highest_bid,
          winner_id:            auction.winner_id,
          highest_bidder_name:  auction.highest_bidder_name,
          end_time:             auction.end_time,
          status:               auction.status,
          bid_count:            (auction as any).bid_count,
        },
        bids: bids.map((b) => ({
          amount:      b.amount,
          bidder_name: (b as any).bidder_name,
          bid_time:    (b as any).bid_time || b.created_at,
        })),
      });
    } catch (err) {
      this.logger.error('Get auction data error', (err as Error).stack);
      res.status(500).json({ error: 'Server error' });
    }
  }
}
