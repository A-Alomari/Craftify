import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

import { OrdersService } from './orders.service';
import { CheckoutDto } from './dto/checkout.dto';
import { CartService } from '../cart/cart.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import {
  ActiveGuard,
  CustomerGuard,
} from '../../common/guards/roles.guard';

// ---------------------------------------------------------------------------
// Augmented Request type
// ---------------------------------------------------------------------------

type CraftifyRequest = Request & {
  session: Record<string, any> & {
    user?: {
      id: number;
      role: string;
      status: string;
      name: string;
    };
    appliedCoupon?: {
      code: string;
      discount: number;
      coupon?: any;
    } | null;
    checkoutNonce?: string;
  };
  flash?: (type: string, message?: string) => string[];
  csrfToken?: () => string;
};

// ---------------------------------------------------------------------------
// OrdersController
// ---------------------------------------------------------------------------

/**
 * OrdersController
 *
 * Routes:
 *   GET  /orders                        — order history (customer)
 *   GET  /orders/checkout               — checkout form
 *   POST /orders/checkout               — process checkout
 *   GET  /orders/:id/confirmation       — order confirmation page
 *   GET  /orders/:id                    — order detail
 *   GET  /orders/:id/track              — shipment tracking
 *   GET  /orders/:id/items              — AJAX: items JSON
 *   POST /orders/:id/reorder            — add order items back to cart
 *   POST /orders/:id/cancel             — cancel order
 */
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly cartService: CartService,
  ) {}

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private csrf(req: CraftifyRequest): string {
    return typeof req.csrfToken === 'function' ? req.csrfToken() : '';
  }

  private flash(req: CraftifyRequest, type: string): string {
    if (typeof req.flash !== 'function') return '';
    const msgs = req.flash(type);
    return Array.isArray(msgs) && msgs.length > 0 ? msgs[0] : '';
  }

  // -------------------------------------------------------------------------
  // GET /orders — order history
  // -------------------------------------------------------------------------

  @Get()
  @UseGuards(AuthGuard, ActiveGuard, CustomerGuard)
  async orderHistory(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    const userId = req.session.user!.id;
    const statusParam = (req.query.status as string) || 'all';
    const filters = {
      status: statusParam === 'all' ? undefined : statusParam,
      page: parseInt((req.query.page as string) || '1', 10),
    };

    const { orders, pagination } = await this.ordersService.findByUserId(
      userId,
      filters,
    );

    res.render('orders/index', {
      title: 'My Orders - Craftify',
      orders,
      pagination,
      filters: { status: statusParam },
      user: req.session.user,
      csrfToken: this.csrf(req),
    });
  }

  // -------------------------------------------------------------------------
  // GET /orders/checkout — render checkout form
  // -------------------------------------------------------------------------

  @Get('checkout')
  @UseGuards(AuthGuard, ActiveGuard, CustomerGuard)
  async showCheckout(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    const userId = req.session.user!.id;

    // Validate cart before showing checkout
    const validation = await this.cartService.validateItems(userId);
    if (!validation.valid) {
      req.flash?.(
        'error_msg',
        validation.issues[0] ?? 'Please review your cart',
      );
      res.redirect('/cart');
      return;
    }

    const items = await this.cartService.getItems(userId);
    const appliedCoupon = req.session.appliedCoupon ?? null;
    const couponDiscount = appliedCoupon?.discount ?? 0;
    const { subtotal, shipping, discount, total } =
      this.cartService.calculateTotals(items, couponDiscount);

    // Generate checkout nonce for idempotency (only if one doesn't exist)
    if (!req.session.checkoutNonce) {
      req.session.checkoutNonce = randomUUID();
    }

    res.render('orders/checkout', {
      title: 'Checkout - Craftify',
      items,
      subtotal,
      shipping,
      discount,
      total,
      appliedCoupon,
      user: req.session.user,
      checkoutNonce: req.session.checkoutNonce,
      csrfToken: this.csrf(req),
    });
  }

  // -------------------------------------------------------------------------
  // POST /orders/checkout — process checkout
  // -------------------------------------------------------------------------

  @Post('checkout')
  @HttpCode(HttpStatus.FOUND)
  @UseGuards(AuthGuard, ActiveGuard, CustomerGuard)
  async processCheckout(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Body() dto: CheckoutDto,
  ): Promise<void> {
    const userId = req.session.user!.id;

    // Verify nonce matches session
    if (!req.session.checkoutNonce || req.session.checkoutNonce !== dto.checkoutNonce) {
      req.flash?.('error_msg', 'Invalid checkout session. Please try again.');
      res.redirect('/orders/checkout');
      return;
    }

    try {
      const order = await this.ordersService.create(
        { ...dto, session: req.session },
        userId,
      );

      // Clear applied coupon from session after successful order
      req.session.appliedCoupon = null;

      // Invalidate the nonce so the form can't be resubmitted
      delete req.session.checkoutNonce;

      req.flash?.('success_msg', `Order #${order.id} placed successfully!`);
      res.redirect(`/orders/${order.id}/confirmation`);
    } catch (err: any) {
      const message =
        err?.message ?? 'Checkout failed. Please try again.';
      req.flash?.('error_msg', message);

      // Refresh the nonce so the customer can retry
      req.session.checkoutNonce = randomUUID();

      res.redirect('/orders/checkout');
    }
  }

  // -------------------------------------------------------------------------
  // GET /orders/:id/confirmation — order confirmation
  // -------------------------------------------------------------------------

  @Get(':id/confirmation')
  @UseGuards(AuthGuard, ActiveGuard)
  async showConfirmation(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    const userId = req.session.user!.id;
    const order = await this.ordersService.findById(id, userId);

    if (!order) {
      req.flash?.('error_msg', 'Order not found');
      res.redirect('/orders');
      return;
    }

    res.render('orders/confirmation', {
      title: `Order Confirmed #${order.id} - Craftify`,
      order,
      user: req.session.user,
      csrfToken: this.csrf(req),
    });
  }

  // -------------------------------------------------------------------------
  // GET /orders/:id — order detail
  // -------------------------------------------------------------------------

  @Get(':id')
  @UseGuards(AuthGuard, ActiveGuard)
  async showOrder(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    const userId = req.session.user!.id;
    const order = await this.ordersService.findById(id, userId);

    if (!order) {
      req.flash?.('error_msg', 'Order not found');
      res.redirect('/orders');
      return;
    }

    res.render('orders/show', {
      title: `Order #${order.id} - Craftify`,
      order,
      user: req.session.user,
      csrfToken: this.csrf(req),
    });
  }

  // -------------------------------------------------------------------------
  // GET /orders/:id/track — shipment tracking
  // -------------------------------------------------------------------------

  @Get(':id/track')
  @UseGuards(AuthGuard, ActiveGuard)
  async trackOrder(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    const userId = req.session.user!.id;
    const order = await this.ordersService.findById(id, userId);

    if (!order) {
      req.flash?.('error_msg', 'Order not found');
      res.redirect('/orders');
      return;
    }

    // Parse shipment history JSON
    let shipmentHistory: Array<{
      status: string;
      message: string;
      timestamp: string;
    }> = [];

    if (order.shipment?.history) {
      try {
        shipmentHistory = JSON.parse(order.shipment.history);
      } catch {
        shipmentHistory = [];
      }
    }

    res.render('orders/track', {
      title: `Track Order #${order.id} - Craftify`,
      order,
      shipmentHistory,
      user: req.session.user,
      csrfToken: this.csrf(req),
    });
  }

  // -------------------------------------------------------------------------
  // GET /orders/:id/items — AJAX items list
  // -------------------------------------------------------------------------

  @Get(':id/items')
  @UseGuards(AuthGuard)
  async getOrderItems(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    const userId = req.session.user!.id;
    const order = await this.ordersService.findById(id, userId);

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    res.json({ items: order.items ?? [] });
  }

  // -------------------------------------------------------------------------
  // POST /orders/:id/reorder — add order items back to cart
  // -------------------------------------------------------------------------

  @Post(':id/reorder')
  @HttpCode(HttpStatus.FOUND)
  @UseGuards(AuthGuard, ActiveGuard, CustomerGuard)
  async reorder(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    const userId = req.session.user!.id;

    try {
      await this.ordersService.reorder(id, userId);
      req.flash?.('success_msg', 'Items added to your cart');
      res.redirect('/cart');
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to reorder');
      res.redirect(`/orders/${id}`);
    }
  }

  // -------------------------------------------------------------------------
  // POST /orders/:id/cancel — cancel order
  // -------------------------------------------------------------------------

  @Post(':id/cancel')
  @HttpCode(HttpStatus.FOUND)
  @UseGuards(AuthGuard, ActiveGuard, CustomerGuard)
  async cancelOrder(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    const userId = req.session.user!.id;

    try {
      await this.ordersService.cancel(id, userId);
      req.flash?.('success_msg', 'Order cancelled successfully');
      res.redirect(`/orders/${id}`);
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to cancel order');
      res.redirect(`/orders/${id}`);
    }
  }
}
