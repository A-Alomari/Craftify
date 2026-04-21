import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ArtisanProfile } from '../../database/entities/artisan-profile.entity';

// ---------------------------------------------------------------------------
// Filters accepted by findAll / getFeatured
// ---------------------------------------------------------------------------
export interface ArtisanProfileFilters {
  approved?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Stats shape returned by getStats()
// ---------------------------------------------------------------------------
export interface ArtisanStats {
  totalOrders: number;
  totalRevenue: number;
  totalProducts: number;
  totalReviews: number;
  avgRating: number;
  monthlyRevenue: { month: string; revenue: number }[];
}

// ---------------------------------------------------------------------------
// ArtisanProfilesService
//
// Shared service used by HomeModule, ArtisanModule, and AdminModule.
// All queries go through TypeORM's query builder so they work with the
// existing SQLite schema.
// ---------------------------------------------------------------------------
@Injectable()
export class ArtisanProfilesService {
  constructor(
    @InjectRepository(ArtisanProfile)
    private readonly repo: Repository<ArtisanProfile>,
  ) {}

  // -------------------------------------------------------------------------
  // findAll — with product_count + avg_rating via LEFT JOINs
  // -------------------------------------------------------------------------
  async findAll(filters: ArtisanProfileFilters = {}): Promise<ArtisanProfile[]> {
    const qb = this.repo
      .createQueryBuilder('ap')
      .leftJoin('ap.user', 'u')
      .addSelect(['u.id', 'u.name', 'u.email', 'u.avatar', 'u.status'])
      .leftJoin('products', 'p', 'p.artisan_id = u.id AND p.status = :approved', {
        approved: 'approved',
      })
      .leftJoin('reviews', 'r', 'r.product_id = p.id')
      .addSelect('COUNT(DISTINCT p.id)', 'product_count')
      .addSelect('AVG(r.rating)', 'avg_rating')
      .groupBy('ap.id');

    if (filters.approved !== undefined) {
      qb.andWhere('ap.is_approved = :isApproved', {
        isApproved: filters.approved ? 1 : 0,
      });
    }

    if (filters.search) {
      qb.andWhere(
        '(ap.shop_name LIKE :search OR u.name LIKE :search OR ap.bio LIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    if (filters.limit) {
      qb.limit(filters.limit);
    }

    if (filters.offset) {
      qb.offset(filters.offset);
    }

    const raw = await qb.getRawAndEntities();

    // Attach computed columns to each entity
    return raw.entities.map((entity, i) => {
      (entity as any).product_count = parseInt(raw.raw[i]?.product_count ?? '0', 10);
      (entity as any).avg_rating = parseFloat(raw.raw[i]?.avg_rating ?? '0') || 0;
      return entity;
    });
  }

  // -------------------------------------------------------------------------
  // getFeatured — approved artisans ordered by product count DESC
  // -------------------------------------------------------------------------
  async getFeatured(limit: number): Promise<ArtisanProfile[]> {
    return this.findAll({ approved: true, limit });
  }

  // -------------------------------------------------------------------------
  // findApprovedWithStats — used on the home artisan spotlight
  // -------------------------------------------------------------------------
  async findApprovedWithStats(limit: number): Promise<ArtisanProfile[]> {
    const qb = this.repo
      .createQueryBuilder('ap')
      .leftJoin('ap.user', 'u')
      .addSelect(['u.id', 'u.name', 'u.email', 'u.avatar'])
      .leftJoin('products', 'p', 'p.artisan_id = u.id AND p.status = :st', {
        st: 'approved',
      })
      .leftJoin('reviews', 'r', 'r.product_id = p.id')
      .addSelect('COUNT(DISTINCT p.id)', 'product_count')
      .addSelect('AVG(r.rating)', 'avg_rating')
      .where('ap.is_approved = 1')
      .groupBy('ap.id')
      .orderBy('product_count', 'DESC')
      .limit(limit);

    const raw = await qb.getRawAndEntities();

    return raw.entities.map((entity, i) => {
      (entity as any).product_count = parseInt(raw.raw[i]?.product_count ?? '0', 10);
      (entity as any).avg_rating = parseFloat(raw.raw[i]?.avg_rating ?? '0') || 0;
      return entity;
    });
  }

  // -------------------------------------------------------------------------
  // findByUserId
  // -------------------------------------------------------------------------
  async findByUserId(userId: number): Promise<ArtisanProfile | null> {
    return this.repo.findOne({
      where: { user_id: userId },
      relations: ['user'],
    });
  }

  // -------------------------------------------------------------------------
  // findById
  // -------------------------------------------------------------------------
  async findById(id: number): Promise<ArtisanProfile | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['user'],
    });
  }

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------
  async create(data: Partial<ArtisanProfile>): Promise<ArtisanProfile> {
    const profile = this.repo.create(data);
    return this.repo.save(profile);
  }

  // -------------------------------------------------------------------------
  // update — partial update identified by user_id
  // -------------------------------------------------------------------------
  async update(userId: number, data: Partial<ArtisanProfile>): Promise<ArtisanProfile> {
    const profile = await this.repo.findOne({ where: { user_id: userId } });
    if (!profile) {
      throw new Error(`Artisan profile not found for user ${userId}`);
    }
    Object.assign(profile, data);
    return this.repo.save(profile);
  }

  // -------------------------------------------------------------------------
  // approve / reject — flip is_approved flag (by artisan_profile.id)
  // -------------------------------------------------------------------------
  async approve(id: number): Promise<void> {
    await this.repo.update(id, { is_approved: 1 });
  }

  async reject(id: number): Promise<void> {
    await this.repo.update(id, { is_approved: 0 });
  }

  // -------------------------------------------------------------------------
  // getStats — aggregate stats for one artisan
  // -------------------------------------------------------------------------
  async getStats(artisanId: number): Promise<ArtisanStats> {
    const manager = this.repo.manager;

    // Products
    const productRows = (await manager.query(
      `SELECT COUNT(*) AS cnt FROM products WHERE artisan_id = ? AND status = 'approved'`,
      [artisanId],
    )) as { cnt: string }[];
    const totalProducts = parseInt(productRows[0]?.cnt ?? '0', 10);

    // Orders & Revenue
    const orderRows = (await manager.query(
      `SELECT COUNT(DISTINCT o.id) AS cnt, COALESCE(SUM(oi.total_price), 0) AS rev
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE oi.artisan_id = ? AND o.status NOT IN ('cancelled','refunded')`,
      [artisanId],
    )) as { cnt: string; rev: string }[];
    const totalOrders = parseInt(orderRows[0]?.cnt ?? '0', 10);
    const totalRevenue = parseFloat(orderRows[0]?.rev ?? '0');

    // Reviews
    const reviewRows = (await manager.query(
      `SELECT COUNT(*) AS cnt, COALESCE(AVG(r.rating), 0) AS avg
       FROM reviews r
       JOIN products p ON p.id = r.product_id
       WHERE p.artisan_id = ?`,
      [artisanId],
    )) as { cnt: string; avg: string }[];
    const totalReviews = parseInt(reviewRows[0]?.cnt ?? '0', 10);
    const avgRating = parseFloat(reviewRows[0]?.avg ?? '0');

    // Monthly revenue — last 6 months
    const monthlyRows = (await manager.query(
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
    )) as { month: string; revenue: string }[];

    const monthlyRevenue = monthlyRows.map((r) => ({
      month: r.month,
      revenue: parseFloat(r.revenue),
    }));

    return {
      totalOrders,
      totalRevenue,
      totalProducts,
      totalReviews,
      avgRating,
      monthlyRevenue,
    };
  }
}
