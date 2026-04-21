import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { randomUUID } from 'crypto';

import { Order } from '../../database/entities/order.entity';
import { OrderItem } from '../../database/entities/order-item.entity';
import { Product } from '../../database/entities/product.entity';
import { CartItem } from '../../database/entities/cart-item.entity';
import { Coupon } from '../../database/entities/coupon.entity';
import { Shipment } from '../../database/entities/shipment.entity';
import { Notification } from '../../database/entities/notification.entity';
import { User } from '../../database/entities/user.entity';

import { CouponsService } from '../coupons/coupons.service';
import { CheckoutDto } from './dto/checkout.dto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface PaginatedOrders {
  orders: Order[];
  total: number;
  pagination: PaginationMeta;
}

export interface OrderFilters {
  status?: string;
  page?: number;
  limit?: number;
  userId?: number;
}

export interface OrderStats {
  total: number;
  pending: number;
  completed: number;
  cancelled: number;
  total_revenue: number;
}

export interface CheckoutData extends CheckoutDto {
  session: Record<string, any>;
}

// ---------------------------------------------------------------------------
// OrdersService
// ---------------------------------------------------------------------------

/**
 * OrdersService
 *
 * Implements the full order lifecycle:
 *   create     — checkout with idempotency nonce, stock management, notifications
 *   findById   — load order with items and shipment
 *   findByUserId — paginated order history for a customer
 *   findAll    — admin paginated list
 *   updateStatus / updatePaymentStatus — status transitions
 *   cancel     — restore stock atomically
 *   reorder    — copy order items back to cart
 *   getStats   — aggregate dashboard metrics
 *   getRecentByArtisan / getMonthlyRevenueByArtisan — artisan dashboard data
 */
@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,

    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,

    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,

    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,

    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,

    @InjectRepository(Shipment)
    private readonly shipmentRepository: Repository<Shipment>,

    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectDataSource()
    private readonly dataSource: DataSource,

    private readonly couponsService: CouponsService,
  ) {}

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private buildPagination(
    page: number,
    limit: number,
    total: number,
  ): PaginationMeta {
    return {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Mock payment processing.
   * In development (ALLOW_MOCK_PAYMENTS=true) all card payments succeed.
   * Returns a transaction reference string.
   */
  private processPayment(
    method: 'card' | 'cash',
    amount: number,
  ): { success: boolean; transactionRef: string | null } {
    if (method === 'cash') {
      return { success: true, transactionRef: null };
    }

    const allowMock =
      process.env.ALLOW_MOCK_PAYMENTS === 'true' ||
      process.env.NODE_ENV !== 'production';

    if (allowMock) {
      return {
        success: true,
        transactionRef: `TXN-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`,
      };
    }

    // Real payment gateway would be called here
    throw new BadRequestException('Payment processing not configured');
  }

  /** Generate a unique Craftify tracking number. */
  private generateTrackingNumber(): string {
    return `CRF${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
  }

  /** Estimate delivery: 7 days from now. */
  private estimatedDelivery(): Date {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  }

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  /**
   * findById — load a single order with its items and shipment.
   * If userId is provided, the order must belong to that user.
   */
  async findById(
    id: number,
    userId?: number,
  ): Promise<(Order & { items: OrderItem[]; shipment: Shipment | null }) | null> {
    const qb = this.orderRepository
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('o.shipment', 'shipment')
      .leftJoinAndSelect('o.user', 'user')
      .where('o.id = :id', { id });

    if (userId !== undefined) {
      qb.andWhere('o.user_id = :userId', { userId });
    }

    const order = await qb.getOne();
    return order as any;
  }

  /**
   * findByUserId — paginated order history for a customer.
   */
  async findByUserId(
    userId: number,
    filters: { status?: string; page?: number; limit?: number } = {},
  ): Promise<PaginatedOrders> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(50, Math.max(1, filters.limit ?? 10));
    const offset = (page - 1) * limit;

    const qb = this.orderRepository
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('o.shipment', 'shipment')
      .where('o.user_id = :userId', { userId })
      .orderBy('o.created_at', 'DESC')
      .skip(offset)
      .take(limit);

    if (filters.status) {
      qb.andWhere('o.status = :status', { status: filters.status });
    }

    const [orders, total] = await qb.getManyAndCount();

    return {
      orders,
      total,
      pagination: this.buildPagination(page, limit, total),
    };
  }

  /**
   * findAll — admin paginated order list with optional status filter.
   */
  async findAll(filters: OrderFilters = {}): Promise<PaginatedOrders> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const offset = (page - 1) * limit;

    const qb = this.orderRepository
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.user', 'user')
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('o.shipment', 'shipment')
      .orderBy('o.created_at', 'DESC')
      .skip(offset)
      .take(limit);

    if (filters.status) {
      qb.where('o.status = :status', { status: filters.status });
    }

    if (filters.userId) {
      qb.andWhere('o.user_id = :userId', { userId: filters.userId });
    }

    const [orders, total] = await qb.getManyAndCount();

    return {
      orders,
      total,
      pagination: this.buildPagination(page, limit, total),
    };
  }

  // -------------------------------------------------------------------------
  // Checkout / Create
  // -------------------------------------------------------------------------

  /**
   * create — the main checkout flow.
   *
   * Runs inside a TypeORM transaction to guarantee atomicity.
   * Steps:
   *   1. Validate cart is non-empty
   *   2. Validate all items are in stock
   *   3. Verify checkout nonce (idempotency guard)
   *   4. Process payment (mock)
   *   5. Create Order record
   *   6. Create OrderItem records (prices locked at checkout time)
   *   7. Decrement product stock
   *   8. Apply coupon (mark as used)
   *   9. Create Shipment record
   *  10. Clear cart
   *  11. Clear nonce from session
   *  12. Send notifications to customer and affected artisans
   */
  async create(data: CheckoutData, userId: number): Promise<Order> {
    const session = data.session;

    // -----------------------------------------------------------------------
    // 1. Load cart items
    // -----------------------------------------------------------------------
    const cartItems = await this.cartItemRepository.find({
      where: { user_id: userId },
      relations: ['product'],
    });

    if (cartItems.length === 0) {
      throw new BadRequestException('Your cart is empty');
    }

    // -----------------------------------------------------------------------
    // 2. Validate stock
    // -----------------------------------------------------------------------
    for (const cartItem of cartItems) {
      const product = cartItem.product;
      if (!product || product.status !== 'approved' || product.is_active !== 1) {
        throw new BadRequestException(
          `"${product?.name ?? 'A product'}" is no longer available`,
        );
      }
      if (cartItem.quantity > product.stock) {
        throw new BadRequestException(
          `"${product.name}" only has ${product.stock} unit(s) in stock`,
        );
      }
    }

    // -----------------------------------------------------------------------
    // 3. Verify checkout nonce (idempotency)
    // -----------------------------------------------------------------------
    const sessionNonce = session.checkoutNonce as string | undefined;
    if (!sessionNonce || sessionNonce !== data.checkoutNonce) {
      throw new BadRequestException(
        'Invalid or expired checkout session. Please try again.',
      );
    }

    // -----------------------------------------------------------------------
    // 4. Process payment
    // -----------------------------------------------------------------------
    const appliedCoupon = session.appliedCoupon as {
      code?: string;
      discount?: number;
    } | null;

    // Calculate totals
    let subtotal = 0;
    for (const item of cartItems) {
      subtotal += (item.product?.price ?? 0) * item.quantity;
    }
    subtotal = Math.round(subtotal * 100) / 100;

    const couponDiscount = appliedCoupon?.discount ?? 0;
    const discountAmount = Math.min(
      Math.round(couponDiscount * 100) / 100,
      subtotal,
    );
    const shipping = subtotal >= 50 ? 0 : 5;
    const totalAmount = Math.max(
      0,
      Math.round((subtotal - discountAmount + shipping) * 100) / 100,
    );

    const { success: paymentSuccess, transactionRef } = this.processPayment(
      data.payment_method,
      totalAmount,
    );

    if (!paymentSuccess) {
      throw new BadRequestException('Payment processing failed. Please try again.');
    }

    // -----------------------------------------------------------------------
    // 5–11. Execute within a database transaction
    // -----------------------------------------------------------------------
    let createdOrder!: Order;

    await this.dataSource.transaction(async (manager) => {
      // 5. Create Order
      const order = manager.create(Order, {
        user_id: userId,
        subtotal,
        shipping_cost: shipping,
        discount_amount: discountAmount,
        total_amount: totalAmount,
        coupon_code: appliedCoupon?.code ?? null,
        status: 'pending',
        payment_method: data.payment_method,
        payment_status:
          data.payment_method === 'card' ? 'paid' : 'pending',
        transaction_ref: transactionRef,
        shipping_address: data.shipping_address,
        shipping_building: data.building ?? null,
        shipping_city: data.city,
        shipping_postal: data.postal_code,
        shipping_country: data.country,
        notes: data.notes ?? null,
      });

      createdOrder = await manager.save(Order, order);

      // 6. Create OrderItems & 7. Decrement stock
      const artisanIds = new Set<number>();

      for (const cartItem of cartItems) {
        const product = cartItem.product!;
        const lineTotal =
          Math.round(product.price * cartItem.quantity * 100) / 100;

        const orderItem = manager.create(OrderItem, {
          order_id: createdOrder.id,
          product_id: product.id,
          artisan_id: product.artisan_id,
          quantity: cartItem.quantity,
          unit_price: product.price,
          total_price: lineTotal,
        });

        await manager.save(OrderItem, orderItem);

        // Decrement stock
        await manager
          .createQueryBuilder()
          .update(Product)
          .set({ stock: () => `stock - ${cartItem.quantity}` })
          .where('id = :id AND stock >= :qty', {
            id: product.id,
            qty: cartItem.quantity,
          })
          .execute();

        artisanIds.add(product.artisan_id);
      }

      // 8. Mark coupon as used
      if (appliedCoupon?.code) {
        await manager
          .createQueryBuilder()
          .update(Coupon)
          .set({ times_used: () => 'times_used + 1' })
          .where('UPPER(code) = UPPER(:code)', { code: appliedCoupon.code })
          .execute();
      }

      // 9. Create Shipment
      const shipment = manager.create(Shipment, {
        order_id: createdOrder.id,
        tracking_number: this.generateTrackingNumber(),
        carrier: 'Craftify Express',
        status: 'pending',
        estimated_delivery: this.estimatedDelivery(),
        history: JSON.stringify([
          {
            status: 'pending',
            message: 'Order received and being processed',
            timestamp: new Date().toISOString(),
          },
        ]),
      });

      await manager.save(Shipment, shipment);

      // 10. Clear cart
      await manager.delete(CartItem, { user_id: userId });

      // 12. Notifications — customer confirmation
      const customerNotif = manager.create(Notification, {
        user_id: userId,
        type: 'order',
        title: 'Order Placed Successfully',
        message: `Your order #${createdOrder.id} has been placed and is being processed.`,
        link: `/orders/${createdOrder.id}`,
        is_read: 0,
      });

      await manager.save(Notification, customerNotif);

      // 12. Notifications — each artisan
      for (const artisanId of artisanIds) {
        const artisanNotif = manager.create(Notification, {
          user_id: artisanId,
          type: 'order',
          title: 'New Order Received',
          message: `You have a new order #${createdOrder.id}. Please prepare it for shipment.`,
          link: `/artisan/orders/${createdOrder.id}`,
          is_read: 0,
        });

        await manager.save(Notification, artisanNotif);
      }
    });

    // -----------------------------------------------------------------------
    // 11. Clear nonce from session (outside transaction — session is not DB)
    // -----------------------------------------------------------------------
    delete session.checkoutNonce;

    return createdOrder;
  }

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  /**
   * updateStatus — transition order status.
   * If artisanId is provided, verify the order contains the artisan's products.
   */
  async updateStatus(
    id: number,
    status: string,
    artisanId?: number,
  ): Promise<void> {
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(`Invalid status: ${status}`);
    }

    const order = await this.orderRepository.findOne({ where: { id } });
    if (!order) throw new NotFoundException(`Order #${id} not found`);

    if (artisanId !== undefined) {
      // Artisan can only update orders that contain their products
      const count = await this.orderItemRepository.count({
        where: { order_id: id, artisan_id: artisanId },
      });
      if (count === 0) {
        throw new ForbiddenException('You do not have access to this order');
      }
    }

    await this.orderRepository.update(id, { status });
  }

  /**
   * updatePaymentStatus — set payment_status and optional transaction reference.
   */
  async updatePaymentStatus(
    id: number,
    status: string,
    transactionRef?: string,
  ): Promise<void> {
    const validStatuses = ['pending', 'paid', 'failed', 'refunded'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(`Invalid payment status: ${status}`);
    }

    const order = await this.orderRepository.findOne({ where: { id } });
    if (!order) throw new NotFoundException(`Order #${id} not found`);

    await this.orderRepository.update(id, {
      payment_status: status,
      ...(transactionRef ? { transaction_ref: transactionRef } : {}),
    });
  }

  /**
   * cancel — customer cancels a pending order.
   * Restores product stock atomically inside a transaction.
   */
  async cancel(id: number, userId: number): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id, user_id: userId },
    });

    if (!order) {
      throw new NotFoundException(`Order #${id} not found`);
    }

    if (order.status !== 'pending') {
      throw new BadRequestException(
        'Only pending orders can be cancelled',
      );
    }

    const items = await this.orderItemRepository.find({
      where: { order_id: id },
    });

    await this.dataSource.transaction(async (manager) => {
      // Restore stock for each item
      for (const item of items) {
        await manager
          .createQueryBuilder()
          .update(Product)
          .set({ stock: () => `stock + ${item.quantity}` })
          .where('id = :id', { id: item.product_id })
          .execute();
      }

      // Update order status
      await manager.update(Order, id, {
        status: 'cancelled',
        updated_at: new Date(),
      });

      // Notify customer
      const notif = manager.create(Notification, {
        user_id: userId,
        type: 'order',
        title: 'Order Cancelled',
        message: `Your order #${id} has been cancelled. Stock has been restored.`,
        link: `/orders/${id}`,
        is_read: 0,
      });

      await manager.save(Notification, notif);
    });
  }

  /**
   * reorder — copy items from a past order into the current cart.
   * Only adds items that are still available and in stock.
   */
  async reorder(orderId: number, userId: number): Promise<void> {
    const items = await this.orderItemRepository.find({
      where: { order_id: orderId },
      relations: ['product'],
    });

    if (items.length === 0) {
      throw new NotFoundException('Order items not found');
    }

    for (const item of items) {
      const product = item.product;
      if (!product || product.status !== 'approved' || product.stock <= 0) {
        continue; // Skip unavailable products silently
      }

      const qty = Math.min(item.quantity, product.stock);

      const existing = await this.cartItemRepository.findOne({
        where: { user_id: userId, product_id: item.product_id },
      });

      if (existing) {
        const newQty = Math.min(existing.quantity + qty, product.stock);
        await this.cartItemRepository.update(existing.id, { quantity: newQty });
      } else {
        await this.cartItemRepository.save(
          this.cartItemRepository.create({
            user_id: userId,
            session_id: null,
            product_id: item.product_id,
            quantity: qty,
          }),
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Stats / Artisan data
  // -------------------------------------------------------------------------

  /**
   * getStats — admin dashboard aggregates.
   */
  async getStats(): Promise<OrderStats> {
    const qb = this.orderRepository.createQueryBuilder('o');

    const [total, pending, completed, cancelled] = await Promise.all([
      qb.getCount(),
      this.orderRepository.count({ where: { status: 'pending' } }),
      this.orderRepository.count({ where: { status: 'delivered' } }),
      this.orderRepository.count({ where: { status: 'cancelled' } }),
    ]);

    const revenueResult = await this.orderRepository
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.total_amount), 0)', 'revenue')
      .where('o.status != :cancelled', { cancelled: 'cancelled' })
      .getRawOne<{ revenue: string }>();

    return {
      total,
      pending,
      completed,
      cancelled,
      total_revenue: parseFloat(revenueResult?.revenue ?? '0'),
    };
  }

  /**
   * getRecentByArtisan — most recent orders containing the artisan's products.
   */
  async getRecentByArtisan(
    artisanId: number,
    limit = 5,
  ): Promise<Order[]> {
    const itemSubquery = this.dataSource
      .createQueryBuilder()
      .select('DISTINCT oi.order_id')
      .from('order_items', 'oi')
      .where('oi.artisan_id = :artisanId', { artisanId });

    const rows = await this.orderRepository
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.user', 'user')
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .where(`o.id IN (${itemSubquery.getQuery()})`)
      .setParameters(itemSubquery.getParameters())
      .orderBy('o.created_at', 'DESC')
      .take(limit)
      .getMany();

    return rows;
  }

  /**
   * getMonthlyRevenueByArtisan — revenue grouped by calendar month.
   * Returns up to `months` months of history.
   */
  async getMonthlyRevenueByArtisan(
    artisanId: number,
    months = 6,
  ): Promise<Array<{ month: string; revenue: number }>> {
    const rows = await this.dataSource
      .createQueryBuilder()
      .select([
        "strftime('%Y-%m', o.created_at) AS month",
        'COALESCE(SUM(oi.total_price), 0) AS revenue',
      ])
      .from('orders', 'o')
      .innerJoin('order_items', 'oi', 'oi.order_id = o.id')
      .where('oi.artisan_id = :artisanId', { artisanId })
      .andWhere("o.status != 'cancelled'")
      .groupBy("strftime('%Y-%m', o.created_at)")
      .orderBy('month', 'DESC')
      .limit(months)
      .getRawMany<{ month: string; revenue: string }>();

    return rows.map((r) => ({
      month: r.month,
      revenue: parseFloat(r.revenue),
    }));
  }
}
