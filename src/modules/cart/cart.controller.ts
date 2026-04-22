import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { CartService } from './cart.service';
import {
  ActiveGuard,
  CustomerOrGuestGuard,
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
    };
    appliedCoupon?: {
      code: string;
      discount: number;
      coupon?: any;
    } | null;
  };
  flash?: (type: string, message?: string) => string[];
  csrfToken?: () => string;
  xhr?: boolean;
    user?: Record<string, any>;
};

// ---------------------------------------------------------------------------
// CartController
// ---------------------------------------------------------------------------

/**
 * CartController
 *
 * Handles the shopping cart UI and mutation endpoints.
 *
 * Guest vs. authenticated distinction:
 *   - Authenticated customers: cart keyed on session.user.id
 *   - Guest visitors          : cart keyed on req.sessionID
 *
 * Artisans and admins are blocked from adding items (CustomerOrGuestGuard).
 *
 * AJAX detection: endpoints that modify the cart check for XHR via the
 * X-Requested-With header and return JSON instead of redirecting.
 */
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private getUserId(req: CraftifyRequest): number | null {
    return req.session?.user?.id ?? (req.user as any)?.id ?? null;
  }

  private getSessionId(req: CraftifyRequest): string | null {
    // Use the numeric user id if logged in (avoids mixing carts on login)
    if (req.session?.user?.id || (req.user as any)?.id) return null;
    return (req as any).sessionID ?? null;
  }

  private isXhr(req: CraftifyRequest): boolean {
    return (
      req.xhr === true ||
      String(req.headers['x-requested-with'] || '').toLowerCase() ===
        'xmlhttprequest'
    );
  }

  private csrf(req: CraftifyRequest): string {
    return typeof req.csrfToken === 'function' ? req.csrfToken() : '';
  }

  private flash(req: CraftifyRequest, type: string): string {
    if (typeof req.flash !== 'function') return '';
    const msgs = req.flash(type);
    return Array.isArray(msgs) && msgs.length > 0 ? msgs[0] : '';
  }

  // -------------------------------------------------------------------------
  // GET /cart — render cart page
  // -------------------------------------------------------------------------

  @Get()
  @UseGuards(CustomerOrGuestGuard)
  async showCart(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    const userId = this.getUserId(req);
    const sessionId = this.getSessionId(req);

    const items = await this.cartService.getItems(userId, sessionId);

    // Load applied coupon from session and recalculate totals
    const appliedCoupon = req.session.appliedCoupon ?? null;
    const couponDiscount = appliedCoupon?.discount ?? 0;
    const { subtotal, shipping, discount, total } =
      this.cartService.calculateTotals(items, couponDiscount);

    const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

    res.render('cart/index', {
      title: 'Shopping Cart - Craftify',
      items,
      subtotal,
      itemCount,
      shipping,
      discount,
      total,
      appliedCoupon,
      user: req.session.user ?? req.user ?? null,
      csrfToken: this.csrf(req),
    });
  }

  // -------------------------------------------------------------------------
  // POST /cart/add — add item to cart
  // -------------------------------------------------------------------------

  @Post('add')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CustomerOrGuestGuard)
  async addItem(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Body('productId') productIdRaw: string,
    @Body('quantity') quantityRaw: string,
  ): Promise<void> {
    const productId = parseInt(productIdRaw, 10);
    const quantity = parseInt(quantityRaw || '1', 10);
    const userId = this.getUserId(req);
    const sessionId = this.getSessionId(req);

    if (isNaN(productId)) {
      if (this.isXhr(req)) {
        res.status(400).json({ success: false, message: 'Invalid product' });
        return;
      }
      req.flash?.('error_msg', 'Invalid product');
      res.redirect('/cart');
      return;
    }

    try {
      await this.cartService.addItem(userId, sessionId, productId, quantity);

      const cartCount = this.cartService.getCount(userId, sessionId);

      if (this.isXhr(req)) {
        res.json({
          success: true,
          message: 'Item added to cart',
          cartCount,
        });
        return;
      }

      req.flash?.('success_msg', 'Item added to cart');
      res.redirect('/cart');
    } catch (err: any) {
      const message = err?.message ?? 'Failed to add item to cart';

      if (this.isXhr(req)) {
        res.status(400).json({ success: false, message });
        return;
      }

      req.flash?.('error_msg', message);
      res.redirect('back');
    }
  }

  // -------------------------------------------------------------------------
  // POST /cart/update — update item quantity
  // -------------------------------------------------------------------------

  @Post('update')
  @HttpCode(HttpStatus.FOUND)
  @UseGuards(CustomerOrGuestGuard)
  async updateItem(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Body('productId') productIdRaw: string,
    @Body('quantity') quantityRaw: string,
  ): Promise<void> {
    const productId = parseInt(productIdRaw, 10);
    const quantity = parseInt(quantityRaw, 10);
    const userId = this.getUserId(req);
    const sessionId = this.getSessionId(req);

    try {
      await this.cartService.updateItem(userId, sessionId, productId, quantity);
      req.flash?.('success_msg', 'Cart updated');
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to update cart');
    }

    res.redirect('/cart');
  }

  // -------------------------------------------------------------------------
  // POST /cart/remove — remove item from cart
  // -------------------------------------------------------------------------

  @Post('remove')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CustomerOrGuestGuard)
  async removeItem(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Body('productId') productIdRaw: string,
  ): Promise<void> {
    const productId = parseInt(productIdRaw, 10);
    const userId = this.getUserId(req);
    const sessionId = this.getSessionId(req);

    await this.cartService.removeItem(userId, sessionId, productId);

    if (this.isXhr(req)) {
      const cartCount = this.cartService.getCount(userId, sessionId);
      res.json({ success: true, message: 'Item removed', cartCount });
      return;
    }

    req.flash?.('success_msg', 'Item removed from cart');
    res.redirect('/cart');
  }

  // -------------------------------------------------------------------------
  // POST /cart/coupon — apply a coupon code
  // -------------------------------------------------------------------------

  @Post('coupon')
  @HttpCode(HttpStatus.FOUND)
  async applyCoupon(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Body('coupon_code') couponCode: string,
  ): Promise<void> {
    const userId = this.getUserId(req);
    const sessionId = this.getSessionId(req);

    if (!couponCode || !couponCode.trim()) {
      req.flash?.('error_msg', 'Please enter a coupon code');
      res.redirect('/cart');
      return;
    }

    try {
      const result = await this.cartService.applyCoupon(
        couponCode.trim(),
        userId,
        sessionId,
      );

      if (!result.valid) {
        req.flash?.('error_msg', result.error ?? 'Invalid coupon');
      } else {
        req.session.appliedCoupon = {
          code: couponCode.trim().toUpperCase(),
          discount: result.discount,
          coupon: result.coupon,
        };
        req.flash?.('success_msg', `Coupon applied! You saved $${result.discount.toFixed(2)}`);
      }
    } catch {
      req.flash?.('error_msg', 'Failed to apply coupon');
    }

    res.redirect('/cart');
  }

  // -------------------------------------------------------------------------
  // POST /cart/coupon/remove — remove applied coupon
  // -------------------------------------------------------------------------

  @Post('coupon/remove')
  @HttpCode(HttpStatus.FOUND)
  removeCoupon(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): void {
    req.session.appliedCoupon = null;
    req.flash?.('success_msg', 'Coupon removed');
    res.redirect('/cart');
  }

  // -------------------------------------------------------------------------
  // POST /cart/clear — empty the cart
  // -------------------------------------------------------------------------

  @Post('clear')
  @HttpCode(HttpStatus.FOUND)
  @UseGuards(CustomerOrGuestGuard)
  async clearCart(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    const userId = this.getUserId(req);
    const sessionId = this.getSessionId(req);

    await this.cartService.clear(userId, sessionId);
    req.session.appliedCoupon = null;
    req.flash?.('success_msg', 'Cart cleared');
    res.redirect('/cart');
  }
}
