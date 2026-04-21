import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as path from 'path';

import { Product } from '../../database/entities/product.entity';
import { Order } from '../../database/entities/order.entity';
import { OrderItem } from '../../database/entities/order-item.entity';
import { Auction } from '../../database/entities/auction.entity';
import { Review } from '../../database/entities/review.entity';
import { Coupon } from '../../database/entities/coupon.entity';
import { Notification } from '../../database/entities/notification.entity';
import { ArtisanProfile } from '../../database/entities/artisan-profile.entity';

// ---------------------------------------------------------------------------
// Pagination helper
// ---------------------------------------------------------------------------
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

function buildPagination(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

// ---------------------------------------------------------------------------
// ArtisanService
//
// Handles all artisan-specific business logic: dashboard, products, orders,
// auctions, coupons, reviews, and analytics.
// ---------------------------------------------------------------------------
@Injectable()
export class ArtisanService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(Auction)
    private readonly auctionRepo: Repository<Auction>,
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Coupon)
    private readonly couponRepo: Repository<Coupon>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(ArtisanProfile)
    private readonly profileRepo: Repository<ArtisanProfile>,
  ) {}

  // =========================================================================
  // PROFILE LOOKUP
  // =========================================================================

  async getArtisanProfileByUserId(userId: number): Promise<ArtisanProfile | null> {
    return this.profileRepo.findOne({ where: { user_id: userId } }) ?? null;
  }

  // =========================================================================
  // DASHBOARD
  // =========================================================================

  async getDashboardData(artisanId: number): Promise<{
    profile: ArtisanProfile | null;
    stats: {
      totalRevenue: number;
      totalOrders: number;
      totalProducts: number;
      avgRating: number;
    };
    recentOrders: Order[];
    activeAuctions: Auction[];
    monthlyRevenue: { month: string; revenue: number }[];
  }> {
    const manager = this.productRepo.manager;

    const [profile, statsRows, recentOrders, activeAuctions, monthlyRows] = await Promise.all([
      this.profileRepo.findOne({ where: { user_id: artisanId } }),

      manager.query(
        `SELECT
           COUNT(DISTINCT o.id)               AS total_orders,
           COALESCE(SUM(oi.total_price), 0)   AS total_revenue,
           COUNT(DISTINCT p.id)               AS total_products,
           COALESCE(AVG(r.rating), 0)         AS avg_rating
         FROM users u
         LEFT JOIN products p ON p.artisan_id = u.id AND p.status = 'approved'
         LEFT JOIN order_items oi ON oi.artisan_id = u.id
         LEFT JOIN orders o ON o.id = oi.order_id AND o.status NOT IN ('cancelled','refunded')
         LEFT JOIN reviews r ON r.product_id = p.id
         WHERE u.id = ?`,
        [artisanId],
      ) as Promise<any[]>,

      // Recent 5 orders
      manager.query(
        `SELECT DISTINCT o.*, u.name AS customer_name
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
         JOIN users u ON u.id = o.user_id
         WHERE oi.artisan_id = ?
         ORDER BY o.created_at DESC
         LIMIT 5`,
        [artisanId],
      ) as Promise<Order[]>,

      this.auctionRepo.find({
        where: { artisan_id: artisanId, status: 'active' },
        order: { end_time: 'ASC' },
        take: 5,
      }),

      manager.query(
        `SELECT strftime('%Y-%m', o.created_at) AS month,
                COALESCE(SUM(oi.total_price), 0) AS revenue
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE oi.artisan_id = ?
           AND o.status NOT IN ('cancelled','refunded')
           AND o.created_at >= date('now', '-6 months')
         GROUP BY month
         ORDER BY month ASC`,
        [artisanId],
      ) as Promise<{ month: string; revenue: string }[]>,
    ]);

    const raw = statsRows[0] ?? {};
    return {
      profile,
      stats: {
        totalRevenue: parseFloat(raw.total_revenue ?? '0'),
        totalOrders: parseInt(raw.total_orders ?? '0', 10),
        totalProducts: parseInt(raw.total_products ?? '0', 10),
        avgRating: parseFloat(raw.avg_rating ?? '0'),
      },
      recentOrders,
      activeAuctions,
      monthlyRevenue: monthlyRows.map((r) => ({
        month: r.month,
        revenue: parseFloat(r.revenue),
      })),
    };
  }

  // =========================================================================
  // PRODUCTS
  // =========================================================================

  async getProductsList(
    artisanId: number,
    filters: { page?: number; limit?: number; status?: string; search?: string },
  ): Promise<{ products: Product[]; pagination: PaginationMeta }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(50, filters.limit ?? 20);

    const qb = this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.category', 'c')
      .where('p.artisan_id = :aid', { aid: artisanId });

    if (filters.status) {
      qb.andWhere('p.status = :status', { status: filters.status });
    }

    if (filters.search) {
      qb.andWhere('(p.name LIKE :s OR p.description LIKE :s)', {
        s: `%${filters.search}%`,
      });
    }

    const [products, total] = await qb
      .orderBy('p.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { products, pagination: buildPagination(page, limit, total) };
  }

  async createProduct(
    artisanId: number,
    data: Partial<Product>,
    files: Express.Multer.File[],
  ): Promise<Product> {
    const imagePaths = (files ?? []).map(
      (f) => '/uploads/' + path.basename(f.path ?? f.filename ?? ''),
    );

    const product = this.productRepo.create({
      ...data,
      artisan_id: artisanId,
      status: 'pending',
      images: imagePaths.length ? JSON.stringify(imagePaths) : null,
    });

    return this.productRepo.save(product);
  }

  async updateProduct(
    id: number,
    artisanId: number,
    data: Partial<Product>,
    files?: Express.Multer.File[],
  ): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { id, artisan_id: artisanId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    let images = product.images;
    if (files && files.length > 0) {
      const newPaths = files.map(
        (f) => '/uploads/' + path.basename(f.path ?? f.filename ?? ''),
      );
      images = JSON.stringify(newPaths);
    }

    Object.assign(product, data, { images });
    return this.productRepo.save(product);
  }

  async deleteProduct(id: number, artisanId: number): Promise<void> {
    const product = await this.productRepo.findOne({
      where: { id, artisan_id: artisanId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check for active orders
    const activeOrderItem = await this.orderItemRepo
      .createQueryBuilder('oi')
      .innerJoin('oi.order', 'o')
      .where('oi.product_id = :pid', { pid: id })
      .andWhere('o.status NOT IN (:...statuses)', {
        statuses: ['delivered', 'cancelled', 'refunded'],
      })
      .getOne();

    if (activeOrderItem) {
      throw new BadRequestException(
        'Cannot delete a product with active orders.',
      );
    }

    await this.productRepo.remove(product);
  }

  // =========================================================================
  // ORDERS
  // =========================================================================

  async getOrdersList(
    artisanId: number,
    filters: { page?: number; limit?: number; status?: string; search?: string },
  ): Promise<{ orders: any[]; pagination: PaginationMeta }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(50, filters.limit ?? 20);
    const manager = this.orderRepo.manager;

    let where = `WHERE oi.artisan_id = ?`;
    const params: any[] = [artisanId];

    if (filters.status) {
      where += ` AND o.status = ?`;
      params.push(filters.status);
    }

    if (filters.search) {
      where += ` AND (u.name LIKE ? OR CAST(o.id AS TEXT) LIKE ?)`;
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    const countRows = (await manager.query(
      `SELECT COUNT(DISTINCT o.id) AS cnt
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN users u ON u.id = o.user_id
       ${where}`,
      params,
    )) as { cnt: string }[];

    const total = parseInt(countRows[0]?.cnt ?? '0', 10);

    const orders = (await manager.query(
      `SELECT o.*, u.name AS customer_name, u.email AS customer_email
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN users u ON u.id = o.user_id
       ${where}
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit],
    )) as any[];

    return { orders, pagination: buildPagination(page, limit, total) };
  }

  async getOrderDetail(orderId: number, artisanId: number): Promise<any> {
    const manager = this.orderRepo.manager;

    const [orderRows, items] = await Promise.all([
      manager.query(
        `SELECT o.*, u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone
         FROM orders o
         JOIN users u ON u.id = o.user_id
         WHERE o.id = ?`,
        [orderId],
      ) as Promise<any[]>,

      manager.query(
        `SELECT oi.*, p.name AS product_name, p.images AS product_images
         FROM order_items oi
         JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = ? AND oi.artisan_id = ?`,
        [orderId, artisanId],
      ) as Promise<any[]>,
    ]);

    if (!orderRows.length || !items.length) {
      throw new NotFoundException('Order not found');
    }

    return { ...orderRows[0], items };
  }

  async updateOrderStatus(
    orderId: number,
    artisanId: number,
    status: string,
  ): Promise<void> {
    const allowedTransitions: Record<string, string[]> = {
      pending: ['confirmed'],
      confirmed: ['shipped'],
    };

    const manager = this.orderRepo.manager;

    const rows = (await manager.query(
      `SELECT o.status FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.id = ? AND oi.artisan_id = ?
       LIMIT 1`,
      [orderId, artisanId],
    )) as { status: string }[];

    if (!rows.length) {
      throw new NotFoundException('Order not found');
    }

    const current = rows[0].status;
    if (!allowedTransitions[current]?.includes(status)) {
      throw new BadRequestException(
        `Cannot transition order from "${current}" to "${status}"`,
      );
    }

    await manager.query(
      `UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`,
      [status, orderId],
    );

    // Notify customer
    const orderRows = (await manager.query(
      `SELECT o.user_id FROM orders o WHERE o.id = ?`,
      [orderId],
    )) as { user_id: number }[];

    if (orderRows.length) {
      const notif = this.notificationRepo.create({
        user_id: orderRows[0].user_id,
        type: 'order',
        title: 'Order Status Updated',
        message: `Your order #${orderId} status has been updated to "${status}".`,
        link: `/orders/${orderId}`,
      });
      await this.notificationRepo.save(notif);
    }
  }

  // =========================================================================
  // AUCTIONS
  // =========================================================================

  async getAuctionsList(
    artisanId: number,
    filters: { page?: number; limit?: number; status?: string },
  ): Promise<{ auctions: Auction[]; pagination: PaginationMeta }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(50, filters.limit ?? 20);

    const qb = this.auctionRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.product', 'p')
      .where('a.artisan_id = :aid', { aid: artisanId });

    if (filters.status) {
      qb.andWhere('a.status = :status', { status: filters.status });
    }

    const [auctions, total] = await qb
      .orderBy('a.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { auctions, pagination: buildPagination(page, limit, total) };
  }

  async createAuction(
    artisanId: number,
    data: Partial<Auction>,
    images?: Express.Multer.File[],
  ): Promise<Auction> {
    const imagePaths = (images ?? []).map(
      (f) => '/uploads/' + path.basename(f.path ?? f.filename ?? ''),
    );

    // Normalize end_time to ISO string (BUG FIX from memory)
    const endTime = data.end_time
      ? new Date(data.end_time as unknown as string).toISOString()
      : undefined;
    const startTime = data.start_time
      ? new Date(data.start_time as unknown as string).toISOString()
      : new Date().toISOString();

    const auction = this.auctionRepo.create({
      ...data,
      artisan_id: artisanId,
      start_time: startTime as unknown as Date,
      end_time: endTime as unknown as Date,
      status: 'pending',
      images: imagePaths.length ? JSON.stringify(imagePaths) : data.images ?? null,
    });

    return this.auctionRepo.save(auction);
  }

  async cancelAuction(id: number, artisanId: number): Promise<void> {
    const auction = await this.auctionRepo.findOne({
      where: { id, artisan_id: artisanId },
    });

    if (!auction) {
      throw new NotFoundException('Auction not found');
    }

    if (!['pending', 'active'].includes(auction.status)) {
      throw new BadRequestException(
        `Cannot cancel an auction with status "${auction.status}"`,
      );
    }

    await this.auctionRepo.update(id, { status: 'cancelled' });
  }

  // =========================================================================
  // REVIEWS
  // =========================================================================

  async getReviewsList(
    artisanId: number,
    filters: { page?: number; limit?: number; rating?: number },
  ): Promise<{ reviews: any[]; pagination: PaginationMeta }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(50, filters.limit ?? 20);
    const manager = this.reviewRepo.manager;

    let where = `WHERE p.artisan_id = ?`;
    const params: any[] = [artisanId];

    if (filters.rating) {
      where += ` AND r.rating = ?`;
      params.push(filters.rating);
    }

    const countRows = (await manager.query(
      `SELECT COUNT(*) AS cnt FROM reviews r JOIN products p ON p.id = r.product_id ${where}`,
      params,
    )) as { cnt: string }[];
    const total = parseInt(countRows[0]?.cnt ?? '0', 10);

    const reviews = (await manager.query(
      `SELECT r.*, p.name AS product_name, u.name AS reviewer_name
       FROM reviews r
       JOIN products p ON p.id = r.product_id
       JOIN users u ON u.id = r.user_id
       ${where}
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit],
    )) as any[];

    return { reviews, pagination: buildPagination(page, limit, total) };
  }

  // =========================================================================
  // COUPONS
  // =========================================================================

  async getCouponsList(artisanId: number): Promise<Coupon[]> {
    return this.couponRepo.find({
      where: { scope: 'artisan', artisan_id: artisanId },
      order: { created_at: 'DESC' },
    });
  }

  async createCoupon(artisanId: number, data: Partial<Coupon>): Promise<Coupon> {
    // BUG FIX: validate expiry is in the future
    if (data.valid_until) {
      const expiry = new Date(data.valid_until as unknown as string);
      if (expiry <= new Date()) {
        throw new BadRequestException('Coupon expiry date must be in the future.');
      }
    }

    // Check code uniqueness
    if (data.code) {
      const existing = await this.couponRepo.findOne({ where: { code: data.code } });
      if (existing) {
        throw new BadRequestException('A coupon with this code already exists.');
      }
    }

    const coupon = this.couponRepo.create({
      ...data,
      scope: 'artisan',
      artisan_id: artisanId,
      created_by: artisanId,
      is_active: 1,
    });

    return this.couponRepo.save(coupon);
  }

  async toggleCoupon(id: number, artisanId: number): Promise<Coupon> {
    const coupon = await this.couponRepo.findOne({
      where: { id, artisan_id: artisanId, scope: 'artisan' },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    coupon.is_active = coupon.is_active ? 0 : 1;
    return this.couponRepo.save(coupon);
  }

  async deleteCoupon(id: number, artisanId: number): Promise<void> {
    const coupon = await this.couponRepo.findOne({
      where: { id, artisan_id: artisanId, scope: 'artisan' },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    await this.couponRepo.remove(coupon);
  }

  // =========================================================================
  // PROFILE
  // =========================================================================

  async updateProfile(
    userId: number,
    data: Partial<ArtisanProfile>,
    imageFiles?: {
      profile_image?: Express.Multer.File;
      banner_image?: Express.Multer.File;
      logo?: Express.Multer.File;
    },
  ): Promise<ArtisanProfile> {
    const profile = await this.profileRepo.findOne({ where: { user_id: userId } });

    if (!profile) {
      throw new NotFoundException('Artisan profile not found');
    }

    const updates: Partial<ArtisanProfile> = { ...data };

    if (imageFiles?.profile_image) {
      updates.profile_image =
        '/uploads/' + path.basename(imageFiles.profile_image.path ?? imageFiles.profile_image.filename ?? '');
    }
    if (imageFiles?.banner_image) {
      updates.banner_image =
        '/uploads/' + path.basename(imageFiles.banner_image.path ?? imageFiles.banner_image.filename ?? '');
    }
    if (imageFiles?.logo) {
      updates.logo =
        '/uploads/' + path.basename(imageFiles.logo.path ?? imageFiles.logo.filename ?? '');
    }

    Object.assign(profile, updates);
    return this.profileRepo.save(profile);
  }

  // =========================================================================
  // ANALYTICS
  // =========================================================================

  async getAnalytics(artisanId: number): Promise<{
    revenue: number;
    products: number;
    orders: number;
    avgRating: number;
    topProducts: any[];
    monthlyData: { month: string; revenue: number; orders: number }[];
  }> {
    const manager = this.productRepo.manager;

    const [summaryRows, topProducts, monthlyData] = await Promise.all([
      manager.query(
        `SELECT
           COALESCE(SUM(oi.total_price), 0)   AS revenue,
           COUNT(DISTINCT p.id)               AS products,
           COUNT(DISTINCT o.id)               AS orders,
           COALESCE(AVG(r.rating), 0)         AS avg_rating
         FROM users u
         LEFT JOIN products p ON p.artisan_id = u.id AND p.status = 'approved'
         LEFT JOIN order_items oi ON oi.artisan_id = u.id
         LEFT JOIN orders o ON o.id = oi.order_id AND o.status NOT IN ('cancelled','refunded')
         LEFT JOIN reviews r ON r.product_id = p.id
         WHERE u.id = ?`,
        [artisanId],
      ) as Promise<any[]>,

      manager.query(
        `SELECT p.id, p.name, p.images,
                COALESCE(SUM(oi.quantity), 0)     AS total_sold,
                COALESCE(SUM(oi.total_price), 0)  AS total_revenue,
                COALESCE(AVG(r.rating), 0)         AS avg_rating
         FROM products p
         LEFT JOIN order_items oi ON oi.product_id = p.id
         LEFT JOIN orders o ON o.id = oi.order_id AND o.status NOT IN ('cancelled','refunded')
         LEFT JOIN reviews r ON r.product_id = p.id
         WHERE p.artisan_id = ? AND p.status = 'approved'
         GROUP BY p.id
         ORDER BY total_sold DESC
         LIMIT 5`,
        [artisanId],
      ) as Promise<any[]>,

      manager.query(
        `SELECT strftime('%Y-%m', o.created_at)   AS month,
                COALESCE(SUM(oi.total_price), 0)  AS revenue,
                COUNT(DISTINCT o.id)              AS orders
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE oi.artisan_id = ?
           AND o.status NOT IN ('cancelled','refunded')
           AND o.created_at >= date('now', '-12 months')
         GROUP BY month
         ORDER BY month ASC`,
        [artisanId],
      ) as Promise<{ month: string; revenue: string; orders: string }[]>,
    ]);

    const raw = summaryRows[0] ?? {};

    return {
      revenue: parseFloat(raw.revenue ?? '0'),
      products: parseInt(raw.products ?? '0', 10),
      orders: parseInt(raw.orders ?? '0', 10),
      avgRating: parseFloat(raw.avg_rating ?? '0'),
      topProducts,
      monthlyData: monthlyData.map((r) => ({
        month: r.month,
        revenue: parseFloat(r.revenue),
        orders: parseInt(r.orders, 10),
      })),
    };
  }
}
