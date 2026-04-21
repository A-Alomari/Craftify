import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
  ParseIntPipe,
} from '@nestjs/common';
import { FilesInterceptor, FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuthGuard } from '../../common/guards/auth.guard';
import {
  ActiveGuard,
  ArtisanGuard,
  ApprovedArtisanGuard,
} from '../../common/guards/roles.guard';
import { ArtisanService } from './artisan.service';
import { Category } from '../../database/entities/category.entity';
import { Product } from '../../database/entities/product.entity';

// ---------------------------------------------------------------------------
// Request type
// ---------------------------------------------------------------------------
type CraftifyRequest = Request & {
  session: Record<string, any> & { user?: { id: number; role: string; status: string; artisanProfile?: any } };
  flash?: (type: string, message?: string) => string[];
  csrfToken?: () => string;
};

// ---------------------------------------------------------------------------
// Shared file upload options (mirrors routes/artisan.js — 30 MB limit)
// ---------------------------------------------------------------------------
const uploadOptions = {
  dest: 'public/uploads',
  limits: { fileSize: 30 * 1024 * 1024 },
};

// ---------------------------------------------------------------------------
// ArtisanController
//
// All routes require AuthGuard + ActiveGuard + ArtisanGuard.
// Routes that need an approved artisan additionally use ApprovedArtisanGuard.
// ---------------------------------------------------------------------------
@Controller('artisan')
@UseGuards(AuthGuard, ActiveGuard, ArtisanGuard)
export class ArtisanController {
  constructor(
    private readonly artisanService: ArtisanService,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private getUser(req: CraftifyRequest) {
    return req.session?.user!;
  }

  private csrf(req: CraftifyRequest): string {
    return typeof req.csrfToken === 'function' ? req.csrfToken() : '';
  }

  private flash(req: CraftifyRequest, type: string): string {
    if (typeof req.flash !== 'function') return '';
    const msgs = req.flash(type);
    return Array.isArray(msgs) && msgs.length > 0 ? msgs[0] : '';
  }

  // =========================================================================
  // DASHBOARD
  // =========================================================================

  @Get('dashboard')
  @UseGuards(ApprovedArtisanGuard)
  async dashboard(@Req() req: CraftifyRequest, @Res() res: Response): Promise<void> {
    const user = this.getUser(req);
    const data = await this.artisanService.getDashboardData(user.id);

    res.render('artisan/dashboard', {
      title: 'Dashboard — Craftify',
      user,
      csrfToken: this.csrf(req),
      ...data,
      flashSuccess: this.flash(req, 'success_msg'),
      flashError: this.flash(req, 'error_msg'),
    });
  }

  // -------------------------------------------------------------------------
  // GET /artisan/pending — shown to unapproved artisans
  // -------------------------------------------------------------------------
  @Get('pending')
  async pendingApproval(@Req() req: CraftifyRequest, @Res() res: Response): Promise<void> {
    const user = this.getUser(req);
    let profile = null;
    if (user) {
      try {
        profile = await this.artisanService.getArtisanProfileByUserId(user.id);
      } catch {
        profile = null;
      }
    }
    res.render('artisan/pending', {
      title: 'Pending Approval — Craftify',
      user,
      csrfToken: this.csrf(req),
      profile,
    });
  }

  // =========================================================================
  // PROFILE
  // =========================================================================

  @Post('profile')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'profile_image', maxCount: 1 },
        { name: 'banner_image', maxCount: 1 },
        { name: 'logo', maxCount: 1 },
      ],
      uploadOptions,
    ),
  )
  async updateProfile(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Body() body: Record<string, string>,
    @UploadedFiles()
    files: {
      profile_image?: Express.Multer.File[];
      banner_image?: Express.Multer.File[];
      logo?: Express.Multer.File[];
    },
  ): Promise<void> {
    const user = this.getUser(req);

    try {
      await this.artisanService.updateProfile(user.id, body as any, {
        profile_image: files.profile_image?.[0],
        banner_image: files.banner_image?.[0],
        logo: files.logo?.[0],
      });
      req.flash?.('success_msg', 'Profile updated successfully!');
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to update profile.');
    }

    return void res.redirect('/artisan/dashboard');
  }

  // =========================================================================
  // PRODUCTS
  // =========================================================================

  @Get('products')
  @UseGuards(ApprovedArtisanGuard)
  async products(@Req() req: CraftifyRequest, @Res() res: Response): Promise<void> {
    const user = this.getUser(req);
    const page = parseInt((req.query.page as string) ?? '1', 10);
    const status = (req.query.status as string) || undefined;
    const search = (req.query.search as string) || undefined;

    const { products, pagination } = await this.artisanService.getProductsList(
      user.id,
      { page, status, search },
    );

    res.render('artisan/products', {
      title: 'My Products — Craftify',
      user,
      csrfToken: this.csrf(req),
      products,
      pagination,
      currentStatus: status,
      flashSuccess: this.flash(req, 'success_msg'),
      flashError: this.flash(req, 'error_msg'),
    });
  }

  @Get('products/new')
  async newProductForm(@Req() req: CraftifyRequest, @Res() res: Response): Promise<void> {
    const categories = await this.categoryRepo.find({
      where: { is_active: 1 },
      order: { name: 'ASC' },
    });

    res.render('artisan/product-form', {
      title: 'Add Product — Craftify',
      user: this.getUser(req),
      csrfToken: this.csrf(req),
      product: null,
      categories,
      flashError: this.flash(req, 'error_msg'),
    });
  }

  @Post('products')
  @UseGuards(ApprovedArtisanGuard)
  @UseInterceptors(FilesInterceptor('images', 5, uploadOptions))
  async createProduct(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Body() body: Record<string, any>,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<void> {
    const user = this.getUser(req);

    try {
      const product = await this.artisanService.createProduct(
        user.id,
        {
          name: body.name,
          description: body.description,
          price: parseFloat(body.price) || 0,
          compare_price: body.compare_price ? parseFloat(body.compare_price) : null,
          stock: parseInt(body.stock, 10) || 0,
          category_id: body.category_id ? parseInt(body.category_id, 10) : null,
          tags: body.tags ?? null,
          weight: body.weight ? parseFloat(body.weight) : null,
          length_cm: body.length_cm ? parseFloat(body.length_cm) : null,
          width_cm: body.width_cm ? parseFloat(body.width_cm) : null,
          height_cm: body.height_cm ? parseFloat(body.height_cm) : null,
        },
        files ?? [],
      );

      req.flash?.('success_msg', 'Product submitted for review!');
      return void res.redirect(`/products/${product.id}`);
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to create product.');
      return void res.redirect('/artisan/products/new');
    }
  }

  @Get('products/:id/edit')
  async editProductForm(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    const user = this.getUser(req);
    const [product, categories] = await Promise.all([
      this.productRepo.findOne({
        where: { id, artisan_id: user.id },
        relations: ['category'],
      }),
      this.categoryRepo.find({ where: { is_active: 1 }, order: { name: 'ASC' } }),
    ]);

    if (!product) {
      req.flash?.('error_msg', 'Product not found.');
      return void res.redirect('/artisan/products');
    }

    res.render('artisan/product-form', {
      title: 'Edit Product — Craftify',
      user,
      csrfToken: this.csrf(req),
      product,
      categories,
      flashError: this.flash(req, 'error_msg'),
    });
  }

  @Post('products/:id')
  @UseInterceptors(FilesInterceptor('images', 5, uploadOptions))
  async updateProduct(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Body() body: Record<string, any>,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<void> {
    const user = this.getUser(req);

    try {
      const updated = await this.artisanService.updateProduct(
        id,
        user.id,
        {
          name: body.name,
          description: body.description,
          price: parseFloat(body.price) || 0,
          compare_price: body.compare_price ? parseFloat(body.compare_price) : null,
          stock: parseInt(body.stock, 10) || 0,
          category_id: body.category_id ? parseInt(body.category_id, 10) : null,
          tags: body.tags ?? null,
          weight: body.weight ? parseFloat(body.weight) : null,
          length_cm: body.length_cm ? parseFloat(body.length_cm) : null,
          width_cm: body.width_cm ? parseFloat(body.width_cm) : null,
          height_cm: body.height_cm ? parseFloat(body.height_cm) : null,
        },
        files?.length ? files : undefined,
      );

      req.flash?.('success_msg', 'Product updated successfully!');

      // Redirect to product page if approved, else back to artisan products list
      if (updated.status === 'approved') {
        return void res.redirect(`/products/${id}`);
      }
      return void res.redirect('/artisan/products');
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to update product.');
      return void res.redirect(`/artisan/products/${id}/edit`);
    }
  }

  @Post('products/:id/delete')
  async deleteProduct(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    const user = this.getUser(req);

    try {
      await this.artisanService.deleteProduct(id, user.id);
      req.flash?.('success_msg', 'Product deleted.');
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to delete product.');
    }

    return void res.redirect('/artisan/products');
  }

  @Delete('products/:id')
  async deleteProductDELETE(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    return this.deleteProduct(id, req, res);
  }

  // =========================================================================
  // ORDERS
  // =========================================================================

  @Get('orders')
  @UseGuards(ApprovedArtisanGuard)
  async orders(@Req() req: CraftifyRequest, @Res() res: Response): Promise<void> {
    const user = this.getUser(req);
    const page = parseInt((req.query.page as string) ?? '1', 10);
    const status = (req.query.status as string) || undefined;

    const { orders, pagination } = await this.artisanService.getOrdersList(user.id, {
      page,
      status,
    });

    // Build quick stats from all orders for this artisan
    const allOrders = await this.artisanService.getOrdersList(user.id, { limit: 1000 });
    const stats = {
      totalPending: allOrders.orders.filter((o: any) => o.status === 'pending').length,
      inProduction: allOrders.orders.filter((o: any) => o.status === 'processing').length,
      readyToShip: allOrders.orders.filter((o: any) => o.status === 'shipped').length,
    };

    res.render('artisan/orders', {
      title: 'Orders — Craftify',
      user,
      csrfToken: this.csrf(req),
      orders,
      pagination,
      stats,
      currentStatus: status,
      flashSuccess: this.flash(req, 'success_msg'),
      flashError: this.flash(req, 'error_msg'),
    });
  }

  @Get('orders/:id')
  @UseGuards(ApprovedArtisanGuard)
  async orderDetail(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    const user = this.getUser(req);

    try {
      const order = await this.artisanService.getOrderDetail(id, user.id);

      res.render('artisan/order-detail', {
        title: `Order #${id} — Craftify`,
        user,
        csrfToken: this.csrf(req),
        order,
        flashSuccess: this.flash(req, 'success_msg'),
        flashError: this.flash(req, 'error_msg'),
      });
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Order not found.');
      return void res.redirect('/artisan/orders');
    }
  }

  @Post('orders/:id/status')
  async updateOrderStatus(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Body('status') status: string,
  ): Promise<void> {
    const user = this.getUser(req);

    try {
      await this.artisanService.updateOrderStatus(id, user.id, status);
      req.flash?.('success_msg', `Order status updated to "${status}".`);
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to update order status.');
    }

    return void res.redirect(`/artisan/orders/${id}`);
  }

  // =========================================================================
  // AUCTIONS
  // =========================================================================

  @Get('auctions')
  @UseGuards(ApprovedArtisanGuard)
  async auctions(@Req() req: CraftifyRequest, @Res() res: Response): Promise<void> {
    const user = this.getUser(req);
    const page = parseInt((req.query.page as string) ?? '1', 10);
    const status = (req.query.status as string) || undefined;

    const { auctions, pagination } = await this.artisanService.getAuctionsList(user.id, {
      page,
      status,
    });

    res.render('artisan/auctions', {
      title: 'Auctions — Craftify',
      user,
      csrfToken: this.csrf(req),
      auctions,
      pagination,
      currentStatus: status,
      flashSuccess: this.flash(req, 'success_msg'),
      flashError: this.flash(req, 'error_msg'),
    });
  }

  @Get('auctions/new')
  @UseGuards(ApprovedArtisanGuard)
  async newAuctionForm(@Req() req: CraftifyRequest, @Res() res: Response): Promise<void> {
    const user = this.getUser(req);
    const products = await this.productRepo.find({
      where: { artisan_id: user.id, status: 'approved', is_active: 1 },
      order: { name: 'ASC' },
    });

    res.render('artisan/auction-form', {
      title: 'Create Auction — Craftify',
      user,
      csrfToken: this.csrf(req),
      products,
      auction: null,
      flashError: this.flash(req, 'error_msg'),
    });
  }

  @Post('auctions')
  @UseGuards(ApprovedArtisanGuard)
  @UseInterceptors(FilesInterceptor('images', 5, uploadOptions))
  async createAuction(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Body() body: Record<string, any>,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<void> {
    const user = this.getUser(req);

    try {
      const auction = await this.artisanService.createAuction(
        user.id,
        {
          title: body.title,
          description: body.description ?? null,
          product_id: body.product_id ? parseInt(body.product_id, 10) : null,
          starting_price: parseFloat(body.starting_price) || 0,
          starting_bid: body.starting_bid ? parseFloat(body.starting_bid) : null,
          reserve_price: body.reserve_price ? parseFloat(body.reserve_price) : null,
          bid_increment: body.bid_increment ? parseFloat(body.bid_increment) : 1,
          start_time: body.start_time as unknown as Date,
          end_time: body.end_time as unknown as Date,
        },
        files ?? [],
      );

      req.flash?.('success_msg', 'Auction created and submitted for review!');
      return void res.redirect(`/auctions/${auction.id}`);
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to create auction.');
      return void res.redirect('/artisan/auctions/new');
    }
  }

  @Post('auctions/:id/cancel')
  async cancelAuction(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    const user = this.getUser(req);

    try {
      await this.artisanService.cancelAuction(id, user.id);
      req.flash?.('success_msg', 'Auction cancelled.');
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to cancel auction.');
    }

    return void res.redirect('/artisan/auctions');
  }

  // =========================================================================
  // REVIEWS
  // =========================================================================

  @Get('reviews')
  @UseGuards(ApprovedArtisanGuard)
  async reviews(@Req() req: CraftifyRequest, @Res() res: Response): Promise<void> {
    const user = this.getUser(req);
    const page = parseInt((req.query.page as string) ?? '1', 10);
    const rating = req.query.rating ? parseInt(req.query.rating as string, 10) : undefined;

    const { reviews, pagination } = await this.artisanService.getReviewsList(user.id, {
      page,
      rating,
    });

    res.render('artisan/reviews', {
      title: 'Reviews — Craftify',
      user,
      csrfToken: this.csrf(req),
      reviews,
      pagination,
      currentRating: rating,
    });
  }

  // =========================================================================
  // ANALYTICS
  // =========================================================================

  @Get('analytics')
  @UseGuards(ApprovedArtisanGuard)
  async analytics(@Req() req: CraftifyRequest, @Res() res: Response): Promise<void> {
    const user = this.getUser(req);
    const analytics = await this.artisanService.getAnalytics(user.id);

    res.render('artisan/analytics', {
      title: 'Analytics — Craftify',
      user,
      csrfToken: this.csrf(req),
      ...analytics,
    });
  }

  // =========================================================================
  // COUPONS
  // =========================================================================

  @Get('coupons')
  @UseGuards(ApprovedArtisanGuard)
  async coupons(@Req() req: CraftifyRequest, @Res() res: Response): Promise<void> {
    const user = this.getUser(req);
    const coupons = await this.artisanService.getCouponsList(user.id);

    res.render('artisan/coupons', {
      title: 'Coupons — Craftify',
      user,
      csrfToken: this.csrf(req),
      coupons,
      flashSuccess: this.flash(req, 'success_msg'),
      flashError: this.flash(req, 'error_msg'),
    });
  }

  @Post('coupons')
  async createCoupon(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Body() body: Record<string, any>,
  ): Promise<void> {
    const user = this.getUser(req);

    try {
      await this.artisanService.createCoupon(user.id, {
        code: (body.code as string)?.toUpperCase().trim(),
        description: body.description ?? null,
        discount_type: body.discount_type,
        discount_value: parseFloat(body.discount_value) || 0,
        min_purchase: body.min_purchase ? parseFloat(body.min_purchase) : 0,
        max_discount: body.max_discount ? parseFloat(body.max_discount) : null,
        usage_limit: body.usage_limit ? parseInt(body.usage_limit, 10) : null,
        valid_from: body.valid_from ? (new Date(body.valid_from) as unknown as Date) : null,
        valid_until: body.valid_until ? (new Date(body.valid_until) as unknown as Date) : null,
      });
      req.flash?.('success_msg', 'Coupon created successfully!');
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to create coupon.');
    }

    return void res.redirect('/artisan/coupons');
  }

  @Post('coupons/:id/toggle')
  async toggleCoupon(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    const user = this.getUser(req);

    try {
      const coupon = await this.artisanService.toggleCoupon(id, user.id);
      req.flash?.('success_msg', `Coupon ${coupon.is_active ? 'activated' : 'deactivated'}.`);
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to toggle coupon.');
    }

    return void res.redirect('/artisan/coupons');
  }

  @Post('coupons/:id/delete')
  async deleteCoupon(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    const user = this.getUser(req);

    try {
      await this.artisanService.deleteCoupon(id, user.id);
      req.flash?.('success_msg', 'Coupon deleted.');
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to delete coupon.');
    }

    return void res.redirect('/artisan/coupons');
  }
}
