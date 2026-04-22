import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { WishlistService } from './wishlist.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import {
  ActiveGuard,
  CustomerGuard,
} from '../../common/guards/roles.guard';

type CraftifyRequest = Request & {
  session: Record<string, any> & {
    user?: { id: number; role: string };
  };
  user?: { id: number; role: string };
  flash?: (type: string, message?: string) => string[];
  csrfToken?: () => string;
};

@Controller('user')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  private flash(req: CraftifyRequest, type: string): string {
    if (typeof req.flash !== 'function') return '';
    const msgs = req.flash(type);
    return Array.isArray(msgs) && msgs.length > 0 ? msgs[0] : '';
  }

  private csrf(req: CraftifyRequest): string {
    return typeof req.csrfToken === 'function' ? req.csrfToken() : '';
  }

  private currentUserId(req: CraftifyRequest): number {
    const id = req.session?.user?.id ?? req.user?.id;
    if (!req.session?.user && req.user && req.session) {
      req.session.user = req.user;
    }
    return Number(id);
  }

  private parseProductId(rawA?: string, rawB?: string): number {
    return parseInt(String(rawA ?? rawB ?? ''), 10);
  }

  private isXhr(req: Request): boolean {
    return (
      !!(req as any).xhr ||
      String(req.headers['x-requested-with'] || '').toLowerCase() === 'xmlhttprequest'
    );
  }

  // =========================================================================
  // GET /user/wishlist
  // =========================================================================

  @Get('wishlist')
  @UseGuards(AuthGuard, ActiveGuard, CustomerGuard)
  async showWishlist(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Query('page') pageStr?: string,
  ): Promise<void> {
    const userId = this.currentUserId(req);
    const page = parseInt(pageStr || '1', 10) || 1;

    const result = await this.wishlistService.findByUserId(userId, page, 12);

    res.render('user/wishlist', {
      title: 'My Wishlist - Craftify',
      user: req.session.user ?? req.user,
      items: result.items,
      total: result.total,
      pagination: result.pagination,
      csrfToken: this.csrf(req),
      flashError: this.flash(req, 'error_msg'),
      flashSuccess: this.flash(req, 'success_msg'),
    });
  }

  // =========================================================================
  // POST /user/wishlist/add
  // =========================================================================

  @Post('wishlist/add')
  @UseGuards(AuthGuard, ActiveGuard, CustomerGuard)
  async addToWishlist(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Body('product_id') productIdStr: string,
    @Body('productId') productIdAlt: string,
  ): Promise<void> {
    const userId = this.currentUserId(req);
    const productId = this.parseProductId(productIdStr, productIdAlt);

    try {
      await this.wishlistService.add(userId, productId);
      if (this.isXhr(req)) {
        return void res.json({ success: true, inWishlist: true });
      }
      req.flash?.('success_msg', 'Added to wishlist');
    } catch (err: any) {
      if (this.isXhr(req)) {
        return void res.status(400).json({ success: false, error: err.message, message: err.message });
      }
      req.flash?.('error_msg', err.message || 'Could not add to wishlist');
    }

    const returnTo = (req.headers['referer'] as string) || '/user/wishlist';
    return void res.redirect(returnTo);
  }

  // =========================================================================
  // POST /user/wishlist/remove
  // =========================================================================

  @Post('wishlist/remove')
  @UseGuards(AuthGuard, ActiveGuard, CustomerGuard)
  async removeFromWishlist(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Body('product_id') productIdStr: string,
    @Body('productId') productIdAlt: string,
  ): Promise<void> {
    const userId = this.currentUserId(req);
    const productId = this.parseProductId(productIdStr, productIdAlt);

    try {
      await this.wishlistService.remove(userId, productId);
      if (this.isXhr(req)) {
        return void res.json({ success: true, inWishlist: false });
      }
      req.flash?.('success_msg', 'Removed from wishlist');
    } catch (err: any) {
      if (this.isXhr(req)) {
        return void res.status(400).json({ success: false, error: err.message, message: err.message });
      }
      req.flash?.('error_msg', 'Could not remove from wishlist');
    }

    const returnTo = (req.headers['referer'] as string) || '/user/wishlist';
    return void res.redirect(returnTo);
  }

  // =========================================================================
  // POST /user/wishlist/toggle — AJAX endpoint, returns { inWishlist: bool }
  // =========================================================================

  @Post('wishlist/toggle')
  @UseGuards(AuthGuard, ActiveGuard, CustomerGuard)
  async toggleWishlist(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Body('product_id') productIdStr: string,
    @Body('productId') productIdAlt: string,
  ): Promise<void> {
    const userId = this.currentUserId(req);
    const productId = this.parseProductId(productIdStr, productIdAlt);

    try {
      const inWishlist = await this.wishlistService.toggle(userId, productId);

      if (this.isXhr(req)) {
        return void res.json({ success: true, inWishlist });
      }

      req.flash?.(
        'success_msg',
        inWishlist ? 'Added to wishlist' : 'Removed from wishlist',
      );
    } catch (err: any) {
      if (this.isXhr(req)) {
        return void res
          .status(400)
          .json({ success: false, error: err.message, message: err.message });
      }
      req.flash?.('error_msg', err.message || 'Could not update wishlist');
    }

    const returnTo = (req.headers['referer'] as string) || '/user/wishlist';
    return void res.redirect(returnTo);
  }

  // =========================================================================
  // POST /user/wishlist/move-to-cart
  // =========================================================================

  @Post('wishlist/move-to-cart')
  @UseGuards(AuthGuard, ActiveGuard, CustomerGuard)
  async moveToCart(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Body('product_id') productIdStr: string,
    @Body('productId') productIdAlt: string,
  ): Promise<void> {
    const userId = this.currentUserId(req);
    const productId = this.parseProductId(productIdStr, productIdAlt);

    try {
      await this.wishlistService.moveToCart(userId, productId);
      req.flash?.('success_msg', 'Item moved to cart');
    } catch (err: any) {
      req.flash?.('error_msg', err.message || 'Could not move item to cart');
    }

    return void res.redirect('/user/wishlist');
  }
}
