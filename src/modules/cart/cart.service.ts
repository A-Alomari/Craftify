import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { CartItem } from '../../database/entities/cart-item.entity';
import { Product } from '../../database/entities/product.entity';
import { CouponsService, ValidationResult } from '../coupons/coupons.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CartTotals {
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
}

export interface CartValidation {
  valid: boolean;
  issues: string[];
}

// ---------------------------------------------------------------------------
// CartService
// ---------------------------------------------------------------------------

/**
 * CartService
 *
 * Handles all cart operations supporting both:
 *   - Authenticated users  : items stored against user_id
 *   - Guest visitors        : items stored against session_id
 *
 * Shipping: flat $5.00 fee; free (0) when subtotal >= $50.
 *
 * getCount() is intentionally SYNCHRONOUS.  main.ts calls it inside an
 * Express middleware without awaiting so the cart badge in the header
 * renders correctly on every request. It accesses the underlying
 * better-sqlite3 driver directly to avoid the Promise overhead.
 */
@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,

    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,

    @InjectDataSource()
    private readonly dataSource: DataSource,

    private readonly couponsService: CouponsService,
  ) {}

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** Build a TypeORM where clause for user_id or session_id. */
  private buildWhere(
    userId: number | null | undefined,
    sessionId: string | null | undefined,
  ): Record<string, unknown> {
    if (userId) return { user_id: userId };
    if (sessionId) return { session_id: sessionId };
    return {};
  }

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  /**
   * getItems — load cart items with full product details.
   * Parses the product images JSON string into an array.
   */
  async getItems(
    userId?: number | null,
    sessionId?: string | null,
  ): Promise<CartItem[]> {
    if (!userId && !sessionId) return [];

    const qb = this.cartItemRepository
      .createQueryBuilder('ci')
      .leftJoinAndSelect('ci.product', 'p')
      .leftJoin('p.artisan', 'artisan')
      .leftJoin('artisan.artisanProfile', 'ap')
      .addSelect([
        'artisan.id',
        'artisan.name',
        'ap.shop_name',
      ]);

    if (userId) {
      qb.where('ci.user_id = :userId', { userId });
    } else {
      qb.where('ci.session_id = :sessionId', { sessionId });
    }

    const items = await qb.getMany();

    // Parse images JSON for each product
    for (const item of items) {
      if (item.product && typeof item.product.images === 'string') {
        try {
          (item.product as any).imageList = JSON.parse(item.product.images);
        } catch {
          (item.product as any).imageList = [];
        }
      }
    }

    return items;
  }

  /**
   * getCount — SYNCHRONOUS cart item count for the header badge.
   *
   * Uses the raw better-sqlite3 connection so it can be called
   * from Express middleware without async/await.
   */
  getCount(
    userId?: number | null,
    sessionId?: string | null,
  ): number {
    try {
      // Access the underlying better-sqlite3 Database instance
      const db = (this.dataSource.driver as any).databaseConnection as {
        prepare: (sql: string) => { get: (...params: unknown[]) => Record<string, number> | undefined };
      };

      if (userId) {
        const row = db
          .prepare(
            'SELECT COALESCE(SUM(quantity), 0) AS cnt FROM cart_items WHERE user_id = ?',
          )
          .get(userId);
        return Number(row?.cnt ?? 0);
      }

      if (sessionId) {
        const row = db
          .prepare(
            'SELECT COALESCE(SUM(quantity), 0) AS cnt FROM cart_items WHERE session_id = ?',
          )
          .get(sessionId);
        return Number(row?.cnt ?? 0);
      }

      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * getTotal — subtotal and item count (used for cart badge API calls).
   */
  async getTotal(
    userId?: number | null,
    sessionId?: string | null,
  ): Promise<{ total: number; item_count: number }> {
    if (!userId && !sessionId) return { total: 0, item_count: 0 };

    const items = await this.getItems(userId, sessionId);
    let total = 0;
    let item_count = 0;

    for (const item of items) {
      if (item.product) {
        total += item.product.price * item.quantity;
        item_count += item.quantity;
      }
    }

    return {
      total: Math.round(total * 100) / 100,
      item_count,
    };
  }

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  /**
   * addItem — validate product and add to cart.
   * If the item already exists, increment quantity up to stock limit.
   */
  async addItem(
    userId: number | null,
    sessionId: string | null,
    productId: number,
    quantity: number,
  ): Promise<void> {
    if (!userId && !sessionId) {
      throw new BadRequestException('Cart requires a user or session');
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException('Quantity must be a positive integer');
    }

    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new BadRequestException('Product not found');
    }
    if (product.status !== 'approved') {
      throw new BadRequestException('Product is not available');
    }
    if (product.stock <= 0) {
      throw new BadRequestException('Product is out of stock');
    }
    if (quantity > product.stock) {
      throw new BadRequestException(
        `Only ${product.stock} unit(s) available in stock`,
      );
    }

    const where = this.buildWhere(userId, sessionId);
    const existing = await this.cartItemRepository.findOne({
      where: { ...where, product_id: productId } as any,
    });

    if (existing) {
      const newQty = Math.min(existing.quantity + quantity, product.stock);
      await this.cartItemRepository.update(existing.id, { quantity: newQty });
    } else {
      const item = this.cartItemRepository.create({
        user_id: userId,
        session_id: sessionId,
        product_id: productId,
        quantity,
      });
      await this.cartItemRepository.save(item);
    }
  }

  /**
   * updateItem — change quantity of an existing cart item.
   */
  async updateItem(
    userId: number | null,
    sessionId: string | null,
    productId: number,
    quantity: number,
  ): Promise<void> {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException('Quantity must be a positive integer');
    }

    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new BadRequestException('Product not found');
    }
    if (quantity > product.stock) {
      throw new BadRequestException(
        `Only ${product.stock} unit(s) available in stock`,
      );
    }

    const where = this.buildWhere(userId, sessionId);
    await this.cartItemRepository.update(
      { ...where, product_id: productId } as any,
      { quantity },
    );
  }

  /**
   * removeItem — delete a single product from the cart.
   */
  async removeItem(
    userId: number | null,
    sessionId: string | null,
    productId: number,
  ): Promise<void> {
    const where = this.buildWhere(userId, sessionId);
    await this.cartItemRepository.delete({
      ...where,
      product_id: productId,
    } as any);
  }

  /**
   * clear — remove all items from the cart.
   */
  async clear(
    userId: number | null,
    sessionId: string | null,
  ): Promise<void> {
    const where = this.buildWhere(userId, sessionId);
    if (Object.keys(where).length === 0) return;
    await this.cartItemRepository.delete(where as any);
  }

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  /**
   * validateItems — check that every cart item can still be purchased.
   * Returns a list of human-readable issues for display in the checkout UI.
   */
  async validateItems(
    userId: number | null,
    sessionId?: string | null,
  ): Promise<CartValidation> {
    const items = await this.getItems(userId, sessionId);
    const issues: string[] = [];

    if (items.length === 0) {
      return { valid: false, issues: ['Your cart is empty'] };
    }

    for (const item of items) {
      const product = item.product;

      if (!product) {
        issues.push(`A product in your cart is no longer available`);
        continue;
      }

      if (product.status !== 'approved' || product.is_active !== 1) {
        issues.push(
          `"${product.name}" is no longer available`,
        );
        continue;
      }

      if (item.quantity > product.stock) {
        if (product.stock === 0) {
          issues.push(`"${product.name}" is out of stock`);
        } else {
          issues.push(
            `"${product.name}" only has ${product.stock} unit(s) left (you have ${item.quantity} in your cart)`,
          );
        }
      }
    }

    return { valid: issues.length === 0, issues };
  }

  // -------------------------------------------------------------------------
  // Merge
  // -------------------------------------------------------------------------

  /**
   * mergeGuestCart — copy guest session items into a user's cart on login.
   *
   * Merge strategy: for product conflicts keep the MAX quantity up to
   * the product's current stock limit, then delete the guest cart.
   */
  async mergeGuestCart(
    userId: number,
    guestSessionId: string,
  ): Promise<void> {
    const guestItems = await this.cartItemRepository.find({
      where: { session_id: guestSessionId },
      relations: ['product'],
    });

    if (guestItems.length === 0) return;

    for (const guestItem of guestItems) {
      const product = guestItem.product;
      if (!product || product.status !== 'approved') continue;

      const existing = await this.cartItemRepository.findOne({
        where: { user_id: userId, product_id: guestItem.product_id },
      });

      if (existing) {
        const merged = Math.min(
          Math.max(existing.quantity, guestItem.quantity),
          product.stock,
        );
        await this.cartItemRepository.update(existing.id, { quantity: merged });
      } else {
        await this.cartItemRepository.save(
          this.cartItemRepository.create({
            user_id: userId,
            session_id: null,
            product_id: guestItem.product_id,
            quantity: Math.min(guestItem.quantity, product.stock),
          }),
        );
      }
    }

    // Remove the guest cart
    await this.cartItemRepository.delete({ session_id: guestSessionId });
  }

  // -------------------------------------------------------------------------
  // Coupon delegation
  // -------------------------------------------------------------------------

  /**
   * applyCoupon — validates a coupon against current cart and returns
   * the discount information.  Delegates to CouponsService.validate().
   */
  async applyCoupon(
    code: string,
    userId: number | null,
    sessionId: string | null,
  ): Promise<ValidationResult> {
    const items = await this.getItems(userId, sessionId);
    const { total } = await this.getTotal(userId, sessionId);

    return this.couponsService.validate(code, total, items);
  }

  // -------------------------------------------------------------------------
  // Totals calculation
  // -------------------------------------------------------------------------

  /**
   * calculateTotals — pure calculation, no DB access.
   *
   * Shipping: $5.00 flat fee; free when subtotal >= $50.
   */
  calculateTotals(
    items: CartItem[],
    couponDiscount = 0,
  ): CartTotals {
    let subtotal = 0;

    for (const item of items) {
      if (item.product) {
        subtotal += item.product.price * item.quantity;
      }
    }

    subtotal = Math.round(subtotal * 100) / 100;
    const discount = Math.min(
      Math.round(couponDiscount * 100) / 100,
      subtotal,
    );
    const shipping = subtotal >= 50 ? 0 : 5;
    const total = Math.max(0, subtotal - discount + shipping);

    return {
      subtotal,
      shipping,
      discount,
      total: Math.round(total * 100) / 100,
    };
  }
}
