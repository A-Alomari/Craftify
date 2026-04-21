import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  Res,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request, Response } from 'express';

import { Product } from '../../database/entities/product.entity';
import { CartItem } from '../../database/entities/cart-item.entity';
import { Notification } from '../../database/entities/notification.entity';
import { Wishlist } from '../../database/entities/wishlist.entity';
import { Auction } from '../../database/entities/auction.entity';
import { Coupon } from '../../database/entities/coupon.entity';

// ---------------------------------------------------------------------------
// Session-aware request type
// ---------------------------------------------------------------------------
type CraftifyRequest = Request & {
  session: Record<string, any> & {
    user?: { id: number; role: string };
    cart?: Record<string, number>;
  };
};

// ---------------------------------------------------------------------------
// ApiController
//
// Handles all /api/* JSON endpoints consumed by AJAX and mobile clients.
// GET endpoints are CSRF-exempt.  POST endpoints that mutate data rely on
// the global CSRF middleware unless the client supplies a valid token header.
// ---------------------------------------------------------------------------
@Controller('api')
export class ApiController {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(CartItem)
    private readonly cartItemRepo: Repository<CartItem>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(Wishlist)
    private readonly wishlistRepo: Repository<Wishlist>,
    @InjectRepository(Auction)
    private readonly auctionRepo: Repository<Auction>,
    @InjectRepository(Coupon)
    private readonly couponRepo: Repository<Coupon>,
  ) {}

  // -------------------------------------------------------------------------
  // Helper — extract session user (null if unauthenticated)
  // -------------------------------------------------------------------------
  private sessionUser(req: CraftifyRequest) {
    return req.session?.user ?? null;
  }

  // =========================================================================
  // GET /api/products
  //
  // Returns a JSON array of approved, active products.
  // Accepts optional query params: category, search, page, limit.
  // =========================================================================
  @Get('products')
  async getProducts(@Req() req: CraftifyRequest): Promise<object> {
    const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10));
    const limit = Math.min(50, parseInt((req.query.limit as string) ?? '20', 10));
    const search = (req.query.search as string) ?? '';
    const category = req.query.category as string | undefined;

    const qb = this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.category', 'c')
      .where('p.status = :status', { status: 'approved' })
      .andWhere('p.is_active = 1');

    if (search) {
      qb.andWhere('(p.name LIKE :s OR p.description LIKE :s)', { s: `%${search}%` });
    }

    if (category) {
      const catIds = Array.isArray(category) ? category : [category];
      qb.andWhere('p.category_id IN (:...catIds)', { catIds });
    }

    const [products, total] = await qb
      .orderBy('p.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      products: products.map((p) => ({
        ...p,
        imageList: this.parseImages(p.images),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // =========================================================================
  // GET /api/cart/count
  //
  // Returns the total number of distinct items in the current user's cart.
  // Authenticated users → DB cart; guests → session cart.
  // =========================================================================
  @Get('cart/count')
  async getCartCount(@Req() req: CraftifyRequest): Promise<{ count: number }> {
    const user = this.sessionUser(req);

    if (user) {
      const count = await this.cartItemRepo.count({ where: { user_id: user.id } });
      return { count };
    }

    // Guest — count session cart keys
    const sessionCart = (req.session?.cart ?? {}) as Record<string, number>;
    const count = Object.keys(sessionCart).length;
    return { count };
  }

  // =========================================================================
  // GET /api/notifications
  //
  // Returns unread notifications for the logged-in user.
  // Returns { notifications: [], count: 0 } for guests.
  // =========================================================================
  @Get('notifications')
  async getNotifications(@Req() req: CraftifyRequest): Promise<{
    notifications: Notification[];
    count: number;
  }> {
    const user = this.sessionUser(req);

    if (!user) {
      return { notifications: [], count: 0 };
    }

    const notifications = await this.notificationRepo.find({
      where: { user_id: user.id, is_read: 0 },
      order: { created_at: 'DESC' },
      take: 20,
    });

    return { notifications, count: notifications.length };
  }

  // =========================================================================
  // GET /api/wishlist/check/:productId
  //
  // Returns whether the current user has the given product in their wishlist.
  // =========================================================================
  @Get('wishlist/check/:productId')
  async checkWishlist(
    @Param('productId', ParseIntPipe) productId: number,
    @Req() req: CraftifyRequest,
  ): Promise<{ inWishlist: boolean }> {
    const user = this.sessionUser(req);

    if (!user) {
      return { inWishlist: false };
    }

    const item = await this.wishlistRepo.findOne({
      where: { user_id: user.id, product_id: productId },
    });

    return { inWishlist: !!item };
  }

  // =========================================================================
  // GET /api/auctions/:id/updates
  //
  // Returns the current live state of an auction (for polling fallback).
  // =========================================================================
  @Get('auctions/:id/updates')
  async getAuctionUpdates(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<object> {
    const auction = await this.auctionRepo.findOne({
      where: { id },
      relations: ['product'],
    });

    if (!auction) {
      return { error: 'Auction not found' };
    }

    return {
      id: auction.id,
      status: auction.status,
      currentHighestBid: auction.current_highest_bid,
      startingPrice: auction.starting_price,
      bidIncrement: auction.bid_increment,
      endTime: auction.end_time,
      winnerId: auction.winner_id,
      highestBidderId: auction.highest_bidder_id,
    };
  }

  // =========================================================================
  // POST /api/coupons/validate
  //
  // Validates a coupon code and returns discount details.
  // Body: { code: string, subtotal: number, artisanId?: number }
  // =========================================================================
  @Post('coupons/validate')
  @HttpCode(HttpStatus.OK)
  async validateCoupon(
    @Body('code') code: string,
    @Body('subtotal') subtotalRaw: number,
    @Body('artisanId') artisanIdRaw?: number,
  ): Promise<{
    valid: boolean;
    discount?: number;
    discountType?: string;
    error?: string;
  }> {
    if (!code?.trim()) {
      return { valid: false, error: 'No coupon code provided.' };
    }

    const subtotal = parseFloat(String(subtotalRaw)) || 0;
    const coupon = await this.couponRepo.findOne({
      where: { code: code.trim().toUpperCase() },
    });

    if (!coupon || !coupon.is_active) {
      return { valid: false, error: 'Invalid or inactive coupon.' };
    }

    const now = new Date();

    // valid_from check
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      return { valid: false, error: 'This coupon is not yet active.' };
    }

    // valid_until check
    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      return { valid: false, error: 'This coupon has expired.' };
    }

    // usage limit
    if (coupon.usage_limit && coupon.times_used >= coupon.usage_limit) {
      return { valid: false, error: 'This coupon has reached its usage limit.' };
    }

    // min purchase
    if (coupon.min_purchase && subtotal < coupon.min_purchase) {
      return {
        valid: false,
        error: `Minimum purchase of $${coupon.min_purchase.toFixed(2)} required.`,
      };
    }

    // artisan scope check
    if (coupon.scope === 'artisan' && artisanIdRaw) {
      if (coupon.artisan_id !== parseInt(String(artisanIdRaw), 10)) {
        return { valid: false, error: 'This coupon is not valid for this artisan.' };
      }
    }

    // Calculate discount
    const discountType =
      coupon.discount_type === 'percentage' || coupon.discount_type === 'percent'
        ? 'percent'
        : 'fixed';

    let discount = 0;
    if (discountType === 'percent') {
      discount = (subtotal * coupon.discount_value) / 100;
      if (coupon.max_discount) {
        discount = Math.min(discount, coupon.max_discount);
      }
    } else {
      discount = coupon.discount_value;
    }

    discount = Math.min(discount, subtotal);

    return {
      valid: true,
      discount: parseFloat(discount.toFixed(2)),
      discountType,
    };
  }

  // =========================================================================
  // GET /api/search/suggestions
  // GET /api/search
  //
  // Returns autocomplete suggestions: products + categories.
  // Query param: q
  // =========================================================================
  @Get('search/suggestions')
  async searchSuggestions(@Req() req: CraftifyRequest): Promise<{
    suggestions: { id: number; name: string; type: string; url: string }[];
  }> {
    return this.doSearch(req);
  }

  @Get('search')
  async search(@Req() req: CraftifyRequest): Promise<{
    suggestions: { id: number; name: string; type: string; url: string }[];
  }> {
    return this.doSearch(req);
  }

  private async doSearch(req: CraftifyRequest): Promise<{
    suggestions: { id: number; name: string; type: string; url: string }[];
  }> {
    const q = ((req.query.q as string) ?? '').trim();

    if (q.length < 2) {
      return { suggestions: [] };
    }

    const term = `%${q}%`;
    const manager = this.productRepo.manager;

    const [productRows, categoryRows] = await Promise.all([
      manager.query(
        `SELECT id, name FROM products WHERE status='approved' AND is_active=1 AND name LIKE ? LIMIT 8`,
        [term],
      ) as Promise<{ id: number; name: string }[]>,

      manager.query(
        `SELECT id, name FROM categories WHERE is_active=1 AND name LIKE ? LIMIT 4`,
        [term],
      ) as Promise<{ id: number; name: string }[]>,
    ]);

    const suggestions: { id: number; name: string; type: string; url: string }[] = [
      ...productRows.map((r) => ({
        id: r.id,
        name: r.name,
        type: 'product',
        url: `/products/${r.id}`,
      })),
      ...categoryRows.map((r) => ({
        id: r.id,
        name: r.name,
        type: 'category',
        url: `/products?category=${r.id}`,
      })),
    ];

    return { suggestions };
  }

  // -------------------------------------------------------------------------
  // Utility: parse product image JSON
  // -------------------------------------------------------------------------
  private parseImages(raw: string | null): string[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [raw];
    } catch {
      return [raw];
    }
  }
}
