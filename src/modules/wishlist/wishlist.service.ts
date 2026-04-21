import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Wishlist } from '../../database/entities/wishlist.entity';
import { Product } from '../../database/entities/product.entity';
import { CartItem } from '../../database/entities/cart-item.entity';

export interface WishlistPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export interface WishlistResult {
  items: Array<Wishlist & { parsedImages: string[] }>;
  total: number;
  pagination: WishlistPagination;
}

@Injectable()
export class WishlistService {
  constructor(
    @InjectRepository(Wishlist)
    private readonly wishlistRepo: Repository<Wishlist>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(CartItem)
    private readonly cartItemRepo: Repository<CartItem>,
  ) {}

  // ---------------------------------------------------------------------------
  // findByUserId — paginated list with parsed product images
  // ---------------------------------------------------------------------------

  async findByUserId(
    userId: number,
    page = 1,
    limit = 12,
  ): Promise<WishlistResult> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [rawItems, total] = await this.wishlistRepo.findAndCount({
      where: { user_id: userId },
      relations: ['product', 'product.category'],
      order: { created_at: 'DESC' },
      skip,
      take: safeLimit,
    });

    const items = rawItems.map((item) => {
      let parsedImages: string[] = [];
      if (item.product?.images) {
        try {
          parsedImages = JSON.parse(item.product.images) as string[];
        } catch {
          parsedImages = [item.product.images];
        }
      }
      return Object.assign(item, { parsedImages });
    });

    const totalPages = Math.ceil(total / safeLimit);

    return {
      items,
      total,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
        hasPrev: safePage > 1,
        hasNext: safePage < totalPages,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // isInWishlist
  // ---------------------------------------------------------------------------

  async isInWishlist(userId: number, productId: number): Promise<boolean> {
    const count = await this.wishlistRepo.count({
      where: { user_id: userId, product_id: productId },
    });
    return count > 0;
  }

  // ---------------------------------------------------------------------------
  // add
  // ---------------------------------------------------------------------------

  async add(userId: number, productId: number): Promise<void> {
    // Verify product exists and is available
    const product = await this.productRepo.findOne({
      where: { id: productId, status: 'approved', is_active: 1 },
    });
    if (!product) throw new NotFoundException('Product not found');

    const already = await this.isInWishlist(userId, productId);
    if (already) return; // idempotent

    const item = this.wishlistRepo.create({ user_id: userId, product_id: productId });
    await this.wishlistRepo.save(item);
  }

  // ---------------------------------------------------------------------------
  // remove
  // ---------------------------------------------------------------------------

  async remove(userId: number, productId: number): Promise<void> {
    await this.wishlistRepo.delete({ user_id: userId, product_id: productId });
  }

  // ---------------------------------------------------------------------------
  // toggle — returns true if the item was ADDED, false if REMOVED
  // ---------------------------------------------------------------------------

  async toggle(userId: number, productId: number): Promise<boolean> {
    const inWishlist = await this.isInWishlist(userId, productId);
    if (inWishlist) {
      await this.remove(userId, productId);
      return false;
    } else {
      await this.add(userId, productId);
      return true;
    }
  }

  // ---------------------------------------------------------------------------
  // count
  // ---------------------------------------------------------------------------

  async count(userId: number): Promise<number> {
    return this.wishlistRepo.count({ where: { user_id: userId } });
  }

  // ---------------------------------------------------------------------------
  // moveToCart — add product to cart (via CartItem repo) and remove from wishlist.
  //
  // CartService is NOT injected here to avoid a circular dependency; instead
  // WishlistService owns the CartItem repository directly (it is registered in
  // WishlistModule.forFeature).
  // ---------------------------------------------------------------------------

  async moveToCart(userId: number, productId: number): Promise<void> {
    const inWishlist = await this.isInWishlist(userId, productId);
    if (!inWishlist) throw new NotFoundException('Item not in wishlist');

    // Upsert cart item
    const existing = await this.cartItemRepo.findOne({
      where: { user_id: userId, product_id: productId },
    });

    if (existing) {
      await this.cartItemRepo.update(existing.id, {
        quantity: existing.quantity + 1,
      });
    } else {
      const item = this.cartItemRepo.create({
        user_id: userId,
        product_id: productId,
        quantity: 1,
      });
      await this.cartItemRepo.save(item);
    }

    // Remove from wishlist
    await this.remove(userId, productId);
  }
}
