import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Review } from '../../database/entities/review.entity';
import { Product } from '../../database/entities/product.entity';

export interface ReviewFilters {
  page?: number;
  limit?: number;
  rating?: number;
  sort?: 'newest' | 'oldest' | 'highest' | 'lowest';
}

export interface ReviewPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export interface ReviewResult {
  reviews: Review[];
  pagination: ReviewPagination;
}

export interface ReviewStats {
  avg: number;
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface CreateReviewData {
  productId: number;
  userId: number;
  orderId?: number;
  rating: number;
  title?: string;
  comment?: string;
}

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  // ---------------------------------------------------------------------------
  // Shared pagination builder
  // ---------------------------------------------------------------------------

  private buildPagination(
    page: number,
    limit: number,
    total: number,
  ): ReviewPagination {
    const totalPages = Math.ceil(total / limit);
    return {
      page,
      limit,
      total,
      totalPages,
      hasPrev: page > 1,
      hasNext: page < totalPages,
    };
  }

  // ---------------------------------------------------------------------------
  // findByProductId
  // ---------------------------------------------------------------------------

  async findByProductId(
    productId: number,
    filters: ReviewFilters = {},
  ): Promise<ReviewResult> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(50, Math.max(1, filters.limit ?? 10));
    const skip = (page - 1) * limit;

    const qb = this.reviewRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.user', 'u')
      .where('r.product_id = :productId', { productId })
      .andWhere('r.is_approved = 1');

    if (filters.rating) {
      qb.andWhere('r.rating = :rating', { rating: filters.rating });
    }

    switch (filters.sort) {
      case 'oldest':
        qb.orderBy('r.created_at', 'ASC');
        break;
      case 'highest':
        qb.orderBy('r.rating', 'DESC').addOrderBy('r.created_at', 'DESC');
        break;
      case 'lowest':
        qb.orderBy('r.rating', 'ASC').addOrderBy('r.created_at', 'DESC');
        break;
      default:
        qb.orderBy('r.created_at', 'DESC');
    }

    const [reviews, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return { reviews, pagination: this.buildPagination(page, limit, total) };
  }

  // ---------------------------------------------------------------------------
  // findByUserId
  // ---------------------------------------------------------------------------

  async findByUserId(
    userId: number,
    filters: ReviewFilters = {},
  ): Promise<ReviewResult> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(50, Math.max(1, filters.limit ?? 10));
    const skip = (page - 1) * limit;

    const qb = this.reviewRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.product', 'p')
      .where('r.user_id = :userId', { userId });

    switch (filters.sort) {
      case 'oldest':
        qb.orderBy('r.created_at', 'ASC');
        break;
      case 'highest':
        qb.orderBy('r.rating', 'DESC').addOrderBy('r.created_at', 'DESC');
        break;
      case 'lowest':
        qb.orderBy('r.rating', 'ASC').addOrderBy('r.created_at', 'DESC');
        break;
      default:
        qb.orderBy('r.created_at', 'DESC');
    }

    const [reviews, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return { reviews, pagination: this.buildPagination(page, limit, total) };
  }

  // ---------------------------------------------------------------------------
  // findById
  // ---------------------------------------------------------------------------

  async findById(id: number): Promise<Review> {
    const review = await this.reviewRepo.findOne({
      where: { id },
      relations: ['user', 'product'],
    });
    if (!review) throw new NotFoundException('Review not found');
    return review;
  }

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  async create(data: CreateReviewData): Promise<Review> {
    // Validate rating range
    if (!Number.isInteger(data.rating) || data.rating < 1 || data.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    // Check product exists
    const product = await this.productRepo.findOne({
      where: { id: data.productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    // Prevent duplicate review by the same user for the same product
    const existing = await this.reviewRepo.findOne({
      where: { product_id: data.productId, user_id: data.userId },
    });
    if (existing) {
      throw new BadRequestException('You have already reviewed this product');
    }

    const review = this.reviewRepo.create({
      product_id: data.productId,
      user_id: data.userId,
      order_id: data.orderId ?? null,
      rating: data.rating,
      title: data.title?.trim() || null,
      comment: data.comment?.trim() || null,
      is_approved: 1,
    });

    return this.reviewRepo.save(review);
  }

  // ---------------------------------------------------------------------------
  // update (owner only)
  // ---------------------------------------------------------------------------

  async update(
    id: number,
    userId: number,
    data: { rating?: number; title?: string; comment?: string },
  ): Promise<Review> {
    const review = await this.findById(id);

    if (review.user_id !== userId) {
      throw new ForbiddenException('You can only edit your own reviews');
    }

    if (data.rating !== undefined) {
      if (!Number.isInteger(data.rating) || data.rating < 1 || data.rating > 5) {
        throw new BadRequestException('Rating must be between 1 and 5');
      }
      review.rating = data.rating;
    }
    if (data.title !== undefined) review.title = data.title.trim() || null;
    if (data.comment !== undefined) review.comment = data.comment.trim() || null;

    return this.reviewRepo.save(review);
  }

  // ---------------------------------------------------------------------------
  // delete (owner only)
  // ---------------------------------------------------------------------------

  async delete(id: number, userId: number): Promise<void> {
    const review = await this.findById(id);
    if (review.user_id !== userId) {
      throw new ForbiddenException('You can only delete your own reviews');
    }
    await this.reviewRepo.delete(id);
  }

  // ---------------------------------------------------------------------------
  // getStats — average, count, star distribution
  // ---------------------------------------------------------------------------

  async getStats(productId: number): Promise<ReviewStats> {
    const reviews = await this.reviewRepo.find({
      where: { product_id: productId, is_approved: 1 },
      select: ['rating'],
    });

    const count = reviews.length;
    const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    let total = 0;
    for (const r of reviews) {
      total += r.rating;
      const star = r.rating as 1 | 2 | 3 | 4 | 5;
      if (star >= 1 && star <= 5) distribution[star]++;
    }

    const avg = count > 0 ? Math.round((total / count) * 10) / 10 : 0;

    return { avg, count, distribution };
  }

  // ---------------------------------------------------------------------------
  // countByUserId
  // ---------------------------------------------------------------------------

  async countByUserId(userId: number): Promise<number> {
    return this.reviewRepo.count({ where: { user_id: userId } });
  }

  // ---------------------------------------------------------------------------
  // Admin methods
  // ---------------------------------------------------------------------------

  async adminApprove(id: number): Promise<void> {
    await this.reviewRepo.update(id, { is_approved: 1 });
  }

  async adminDelete(id: number): Promise<void> {
    const review = await this.reviewRepo.findOne({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    await this.reviewRepo.delete(id);
  }

  async getAll(filters: ReviewFilters & { approved?: number } = {}): Promise<ReviewResult> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const skip = (page - 1) * limit;

    const qb = this.reviewRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.user', 'u')
      .leftJoinAndSelect('r.product', 'p');

    if (filters.approved !== undefined) {
      qb.where('r.is_approved = :approved', { approved: filters.approved });
    }

    qb.orderBy('r.created_at', 'DESC');

    const [reviews, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return { reviews, pagination: this.buildPagination(page, limit, total) };
  }
}
