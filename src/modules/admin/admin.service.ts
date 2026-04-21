import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'path';

import { User } from '../../database/entities/user.entity';
import { ArtisanProfile } from '../../database/entities/artisan-profile.entity';
import { Product } from '../../database/entities/product.entity';
import { Order } from '../../database/entities/order.entity';
import { OrderItem } from '../../database/entities/order-item.entity';
import { Auction } from '../../database/entities/auction.entity';
import { Review } from '../../database/entities/review.entity';
import { Coupon } from '../../database/entities/coupon.entity';
import { Category } from '../../database/entities/category.entity';
import { Shipment } from '../../database/entities/shipment.entity';
import { Notification } from '../../database/entities/notification.entity';

// ---------------------------------------------------------------------------
// Re-export pagination type
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
  return { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
}

// ---------------------------------------------------------------------------
// AdminService
// ---------------------------------------------------------------------------
@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ArtisanProfile)
    private readonly profileRepo: Repository<ArtisanProfile>,
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
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Shipment)
    private readonly shipmentRepo: Repository<Shipment>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  // =========================================================================
  // DASHBOARD
  // =========================================================================

  async getDashboardData(): Promise<{
    userStats: any;
    productStats: any;
    orderStats: any;
    auctionStats: any;
    recentOrders: any[];
    pendingArtisans: ArtisanProfile[];
    pendingProducts: Product[];
  }> {
    const manager = this.userRepo.manager;

    const [
      userStats,
      productStats,
      orderStats,
      auctionStats,
      recentOrders,
      pendingArtisans,
      pendingProducts,
    ] = await Promise.all([
      manager.query(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN role='customer' THEN 1 ELSE 0 END) AS customers,
           SUM(CASE WHEN role='artisan' THEN 1 ELSE 0 END) AS artisans,
           SUM(CASE WHEN status='suspended' THEN 1 ELSE 0 END) AS suspended
         FROM users`,
      ) as Promise<any[]>,

      manager.query(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) AS approved,
           SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
           SUM(CASE WHEN featured=1 THEN 1 ELSE 0 END) AS featured
         FROM products`,
      ) as Promise<any[]>,

      manager.query(
        `SELECT
           COUNT(*) AS total,
           COALESCE(SUM(total_amount), 0) AS revenue,
           SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
           SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) AS delivered
         FROM orders`,
      ) as Promise<any[]>,

      manager.query(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active,
           SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
           SUM(CASE WHEN status='sold' THEN 1 ELSE 0 END) AS sold
         FROM auctions`,
      ) as Promise<any[]>,

      manager.query(
        `SELECT o.*, u.name AS customer_name
         FROM orders o
         JOIN users u ON u.id = o.user_id
         ORDER BY o.created_at DESC
         LIMIT 10`,
      ) as Promise<any[]>,

      this.profileRepo.find({
        where: { is_approved: 0 },
        relations: ['user'],
        order: { created_at: 'DESC' },
        take: 10,
      }),

      this.productRepo.find({
        where: { status: 'pending' },
        relations: ['artisan'],
        order: { created_at: 'DESC' },
        take: 10,
      }),
    ]);

    return {
      userStats: userStats[0] ?? {},
      productStats: productStats[0] ?? {},
      orderStats: orderStats[0] ?? {},
      auctionStats: auctionStats[0] ?? {},
      recentOrders,
      pendingArtisans,
      pendingProducts,
    };
  }

  // =========================================================================
  // USERS
  // =========================================================================

  async getUsersList(filters: {
    role?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ users: User[]; pagination: PaginationMeta }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(50, filters.limit ?? 20);

    const qb = this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.artisanProfile', 'ap');

    if (filters.role) qb.andWhere('u.role = :role', { role: filters.role });
    if (filters.status) qb.andWhere('u.status = :status', { status: filters.status });
    if (filters.search) {
      qb.andWhere('(u.name LIKE :s OR u.email LIKE :s)', { s: `%${filters.search}%` });
    }

    const [users, total] = await qb
      .orderBy('u.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { users, pagination: buildPagination(page, limit, total) };
  }

  async updateUserStatus(id: number, status: 'active' | 'suspended'): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.userRepo.update(id, { status });
  }

  async deleteUser(id: number): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'admin') throw new BadRequestException('Cannot delete admin accounts');
    await this.userRepo.delete(id);
  }

  // =========================================================================
  // ARTISANS
  // =========================================================================

  async getArtisansList(filters: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ artisans: ArtisanProfile[]; pagination: PaginationMeta }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(50, filters.limit ?? 20);

    const qb = this.profileRepo
      .createQueryBuilder('ap')
      .leftJoinAndSelect('ap.user', 'u');

    if (filters.status === 'pending') qb.andWhere('ap.is_approved = 0');
    if (filters.status === 'approved') qb.andWhere('ap.is_approved = 1');

    if (filters.search) {
      qb.andWhere(
        '(ap.shop_name LIKE :s OR u.name LIKE :s OR u.email LIKE :s)',
        { s: `%${filters.search}%` },
      );
    }

    const [artisans, total] = await qb
      .orderBy('ap.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { artisans, pagination: buildPagination(page, limit, total) };
  }

  async approveArtisan(id: number): Promise<void> {
    const profile = await this.profileRepo.findOne({ where: { id }, relations: ['user'] });
    if (!profile) throw new NotFoundException('Artisan profile not found');
    await this.profileRepo.update(id, { is_approved: 1 });

    // Notify artisan
    const notif = this.notificationRepo.create({
      user_id: profile.user_id,
      type: 'account',
      title: 'Application Approved',
      message: 'Congratulations! Your artisan application has been approved. You can now start selling.',
      link: '/artisan/dashboard',
    });
    await this.notificationRepo.save(notif);
  }

  async rejectArtisan(id: number): Promise<void> {
    const profile = await this.profileRepo.findOne({ where: { id }, relations: ['user'] });
    if (!profile) throw new NotFoundException('Artisan profile not found');
    await this.profileRepo.update(id, { is_approved: 0 });

    const notif = this.notificationRepo.create({
      user_id: profile.user_id,
      type: 'account',
      title: 'Application Reviewed',
      message: 'Unfortunately, your artisan application was not approved at this time.',
      link: '/artisan/pending',
    });
    await this.notificationRepo.save(notif);
  }

  // =========================================================================
  // PRODUCTS
  // =========================================================================

  async getProductsList(filters: {
    status?: string;
    category?: number;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ products: Product[]; pagination: PaginationMeta }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(50, filters.limit ?? 20);

    const qb = this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.category', 'c')
      .leftJoin('p.artisan', 'u')
      .addSelect(['u.id', 'u.name']);

    if (filters.status) qb.andWhere('p.status = :status', { status: filters.status });
    if (filters.category) qb.andWhere('p.category_id = :cat', { cat: filters.category });
    if (filters.search) {
      qb.andWhere('(p.name LIKE :s OR u.name LIKE :s)', { s: `%${filters.search}%` });
    }

    const [products, total] = await qb
      .orderBy('p.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { products, pagination: buildPagination(page, limit, total) };
  }

  async approveProduct(id: number): Promise<void> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    await this.productRepo.update(id, { status: 'approved' });

    const notif = this.notificationRepo.create({
      user_id: product.artisan_id,
      type: 'product',
      title: 'Product Approved',
      message: `Your product "${product.name}" has been approved and is now live.`,
      link: `/products/${id}`,
    });
    await this.notificationRepo.save(notif);
  }

  async rejectProduct(id: number): Promise<void> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    await this.productRepo.update(id, { status: 'rejected' });

    const notif = this.notificationRepo.create({
      user_id: product.artisan_id,
      type: 'product',
      title: 'Product Not Approved',
      message: `Your product "${product.name}" was not approved. Please review the guidelines and resubmit.`,
      link: `/artisan/products`,
    });
    await this.notificationRepo.save(notif);
  }

  async toggleFeatured(id: number): Promise<void> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    await this.productRepo.update(id, { featured: product.featured ? 0 : 1 });
  }

  // =========================================================================
  // CATEGORIES
  // =========================================================================

  async getCategoriesList(): Promise<Category[]> {
    return this.categoryRepo.find({
      order: { name: 'ASC' },
      relations: ['parent'],
    });
  }

  async createCategory(
    data: Partial<Category>,
    imageFile?: Express.Multer.File,
  ): Promise<Category> {
    const image = imageFile
      ? '/uploads/' + path.basename(imageFile.path ?? imageFile.filename ?? '')
      : undefined;

    const category = this.categoryRepo.create({
      ...data,
      slug: this.slugify(data.name ?? ''),
      image: image ?? data.image ?? null,
      is_active: 1,
    });

    return this.categoryRepo.save(category);
  }

  async updateCategory(
    id: number,
    data: Partial<Category>,
    imageFile?: Express.Multer.File,
  ): Promise<Category> {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');

    const image = imageFile
      ? '/uploads/' + path.basename(imageFile.path ?? imageFile.filename ?? '')
      : category.image;

    const slug = data.name && data.name !== category.name
      ? this.slugify(data.name)
      : category.slug;

    Object.assign(category, { ...data, slug, image });
    return this.categoryRepo.save(category);
  }

  async deleteCategory(id: number): Promise<void> {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');

    // Check for products
    const productCount = await this.productRepo.count({ where: { category_id: id } });
    if (productCount > 0) {
      throw new BadRequestException(
        `Cannot delete category with ${productCount} associated product(s).`,
      );
    }

    await this.categoryRepo.remove(category);
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // =========================================================================
  // ORDERS
  // =========================================================================

  async getOrdersList(filters: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ orders: any[]; pagination: PaginationMeta }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(50, filters.limit ?? 20);

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoin('o.user', 'u')
      .addSelect(['u.id', 'u.name', 'u.email']);

    if (filters.status) qb.andWhere('o.status = :status', { status: filters.status });
    if (filters.search) {
      qb.andWhere(
        '(u.name LIKE :s OR u.email LIKE :s OR CAST(o.id AS TEXT) LIKE :s)',
        { s: `%${filters.search}%` },
      );
    }

    const [orders, total] = await qb
      .orderBy('o.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { orders, pagination: buildPagination(page, limit, total) };
  }

  async getOrderDetail(id: number): Promise<Order & { items: OrderItem[]; shipment: Shipment | null }> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['user', 'items', 'items.product', 'shipment'],
    });

    if (!order) throw new NotFoundException('Order not found');
    return order as Order & { items: OrderItem[]; shipment: Shipment | null };
  }

  async updateOrderStatus(id: number, status: string): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');

    await this.orderRepo.update(id, { status });

    const notif = this.notificationRepo.create({
      user_id: order.user_id,
      type: 'order',
      title: 'Order Status Updated',
      message: `Your order #${id} status has been updated to "${status}".`,
      link: `/orders/${id}`,
    });
    await this.notificationRepo.save(notif);
  }

  // =========================================================================
  // AUCTIONS
  // =========================================================================

  async getAuctionsList(filters: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ auctions: Auction[]; pagination: PaginationMeta }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(50, filters.limit ?? 20);

    const qb = this.auctionRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.product', 'p')
      .leftJoin('a.artisan', 'u')
      .addSelect(['u.id', 'u.name']);

    if (filters.status) qb.andWhere('a.status = :status', { status: filters.status });
    if (filters.search) {
      qb.andWhere('(a.title LIKE :s OR u.name LIKE :s)', { s: `%${filters.search}%` });
    }

    const [auctions, total] = await qb
      .orderBy('a.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { auctions, pagination: buildPagination(page, limit, total) };
  }

  async approveAuction(id: number): Promise<void> {
    const auction = await this.auctionRepo.findOne({ where: { id } });
    if (!auction) throw new NotFoundException('Auction not found');
    await this.auctionRepo.update(id, { status: 'active' });
  }

  async rejectAuction(id: number): Promise<void> {
    const auction = await this.auctionRepo.findOne({ where: { id } });
    if (!auction) throw new NotFoundException('Auction not found');
    await this.auctionRepo.update(id, { status: 'rejected' });
  }

  async cancelAuction(id: number): Promise<void> {
    const auction = await this.auctionRepo.findOne({ where: { id } });
    if (!auction) throw new NotFoundException('Auction not found');
    await this.auctionRepo.update(id, { status: 'cancelled' });
  }

  // =========================================================================
  // REVIEWS
  // =========================================================================

  async getReviewsList(filters: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ reviews: Review[]; pagination: PaginationMeta }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(50, filters.limit ?? 20);

    const qb = this.reviewRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.product', 'p')
      .leftJoinAndSelect('r.user', 'u');

    if (filters.status === 'pending') qb.andWhere('r.is_approved = 0');
    if (filters.status === 'approved') qb.andWhere('r.is_approved = 1');

    if (filters.search) {
      qb.andWhere('(r.comment LIKE :s OR u.name LIKE :s OR p.name LIKE :s)', {
        s: `%${filters.search}%`,
      });
    }

    const [reviews, total] = await qb
      .orderBy('r.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { reviews, pagination: buildPagination(page, limit, total) };
  }

  async approveReview(id: number): Promise<void> {
    const review = await this.reviewRepo.findOne({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    await this.reviewRepo.update(id, { is_approved: 1 });
  }

  async deleteReview(id: number): Promise<void> {
    const review = await this.reviewRepo.findOne({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    await this.reviewRepo.remove(review);
  }

  // =========================================================================
  // COUPONS
  // =========================================================================

  async getCouponsList(filters: {
    scope?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ coupons: Coupon[]; pagination: PaginationMeta }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(50, filters.limit ?? 50);

    const qb = this.couponRepo.createQueryBuilder('c');

    if (filters.scope) qb.andWhere('c.scope = :scope', { scope: filters.scope });
    if (filters.search) {
      qb.andWhere('(c.code LIKE :s OR c.description LIKE :s)', { s: `%${filters.search}%` });
    }

    const [coupons, total] = await qb
      .orderBy('c.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { coupons, pagination: buildPagination(page, limit, total) };
  }

  async createCoupon(data: Partial<Coupon>): Promise<Coupon> {
    // BUG FIX: validate expiry is in the future
    if (data.valid_until) {
      const expiry = new Date(data.valid_until as unknown as string);
      if (expiry <= new Date()) {
        throw new BadRequestException('Coupon expiry date must be in the future.');
      }
    }

    if (data.code) {
      const existing = await this.couponRepo.findOne({ where: { code: data.code } });
      if (existing) throw new BadRequestException('A coupon with this code already exists.');
    }

    const coupon = this.couponRepo.create({ ...data, is_active: 1 });
    return this.couponRepo.save(coupon);
  }

  async toggleCoupon(id: number): Promise<Coupon> {
    const coupon = await this.couponRepo.findOne({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    coupon.is_active = coupon.is_active ? 0 : 1;
    return this.couponRepo.save(coupon);
  }

  async deleteCoupon(id: number): Promise<void> {
    const coupon = await this.couponRepo.findOne({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    await this.couponRepo.remove(coupon);
  }

  // =========================================================================
  // REPORTS
  // =========================================================================

  async getReports(period: string = 'month'): Promise<{
    totalRevenue: number;
    totalOrders: number;
    totalUsers: number;
    totalProducts: number;
    topSellingProducts: any[];
    topProducts: any[];
    topArtisans: any[];
    salesData: { date: string; revenue: number; orders: number }[];
    revenueByMonth: { month: string; revenue: number }[];
    ordersByStatus: { status: string; count: number }[];
    categoryBreakdown: { name: string; count: number }[];
  }> {
    const manager = this.userRepo.manager;

    // Compute report window start based on period
    const periodDaysMap: Record<string, number> = { week: 7, month: 30, quarter: 90, year: 365 };
    const days = periodDaysMap[period] ?? 30;
    const startIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [
      summaryRows,
      topProductsRows,
      topArtisans,
      salesData,
      revenueByMonth,
      ordersByStatus,
      categoryBreakdown,
    ] = await Promise.all([
      manager.query(
        `SELECT
           (SELECT COUNT(*) FROM users)    AS total_users,
           (SELECT COUNT(*) FROM products WHERE status='approved') AS total_products,
           (SELECT COUNT(*) FROM orders)  AS total_orders,
           (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE status NOT IN ('cancelled','refunded')) AS total_revenue`,
      ) as Promise<any[]>,

      manager.query(
        `SELECT p.id, p.name, p.images,
                COALESCE(SUM(oi.quantity), 0)     AS total_sold,
                COALESCE(SUM(oi.total_price), 0)  AS total_revenue
         FROM products p
         LEFT JOIN order_items oi ON oi.product_id = p.id
         LEFT JOIN orders o ON o.id = oi.order_id AND o.status NOT IN ('cancelled','refunded')
         GROUP BY p.id
         ORDER BY total_sold DESC
         LIMIT 10`,
      ) as Promise<any[]>,

      manager.query(
        `SELECT u.id, u.name, ap.shop_name,
                COALESCE(SUM(oi.total_price), 0)  AS total_revenue,
                COUNT(DISTINCT o.id)              AS total_orders
         FROM users u
         JOIN artisan_profiles ap ON ap.user_id = u.id
         LEFT JOIN order_items oi ON oi.artisan_id = u.id
         LEFT JOIN orders o ON o.id = oi.order_id AND o.status NOT IN ('cancelled','refunded')
         WHERE u.role = 'artisan'
         GROUP BY u.id
         ORDER BY total_revenue DESC
         LIMIT 10`,
      ) as Promise<any[]>,

      manager.query(
        `SELECT DATE(created_at) AS date,
                COALESCE(SUM(total_amount), 0) AS revenue,
                COUNT(*) AS orders
         FROM orders
         WHERE payment_status = 'paid'
           AND created_at >= ?
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
        [startIso],
      ) as Promise<any[]>,

      manager.query(
        `SELECT strftime('%Y-%m', created_at) AS month,
                COALESCE(SUM(total_amount), 0) AS revenue
         FROM orders
         WHERE status NOT IN ('cancelled','refunded')
           AND created_at >= date('now', '-12 months')
         GROUP BY month
         ORDER BY month ASC`,
      ) as Promise<{ month: string; revenue: string }[]>,

      manager.query(
        `SELECT status, COUNT(*) AS count FROM orders GROUP BY status`,
      ) as Promise<{ status: string; count: string }[]>,

      manager.query(
        `SELECT c.name, COUNT(p.id) AS count
         FROM categories c
         LEFT JOIN products p ON p.category_id = c.id AND p.status = 'approved'
         GROUP BY c.id
         ORDER BY count DESC`,
      ) as Promise<{ name: string; count: string }[]>,
    ]);

    const summary = summaryRows[0] ?? {};

    return {
      totalRevenue: parseFloat(summary.total_revenue ?? '0'),
      totalOrders: parseInt(summary.total_orders ?? '0', 10),
      totalUsers: parseInt(summary.total_users ?? '0', 10),
      totalProducts: parseInt(summary.total_products ?? '0', 10),
      topSellingProducts: topProductsRows,
      topProducts: topProductsRows,
      topArtisans,
      salesData: salesData.map((r) => ({
        date: r.date,
        revenue: parseFloat(r.revenue),
        orders: parseInt(r.orders, 10),
      })),
      revenueByMonth: revenueByMonth.map((r) => ({
        month: r.month,
        revenue: parseFloat(r.revenue),
      })),
      ordersByStatus: ordersByStatus.map((r) => ({
        status: r.status,
        count: parseInt(r.count as unknown as string, 10),
      })),
      categoryBreakdown: categoryBreakdown.map((r) => ({
        name: r.name,
        count: parseInt(r.count as unknown as string, 10),
      })),
    };
  }
}
