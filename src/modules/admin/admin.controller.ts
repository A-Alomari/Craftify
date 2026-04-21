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
  UploadedFile,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuthGuard } from '../../common/guards/auth.guard';
import { ActiveGuard, AdminGuard } from '../../common/guards/roles.guard';
import { AdminService } from './admin.service';
import { Category } from '../../database/entities/category.entity';

// ---------------------------------------------------------------------------
// Request type
// ---------------------------------------------------------------------------
type CraftifyRequest = Request & {
  session: Record<string, any> & {
    user?: { id: number; role: string; status: string };
  };
  flash?: (type: string, message?: string) => string[];
  csrfToken?: () => string;
};

const uploadOptions = {
  dest: 'public/uploads',
  limits: { fileSize: 30 * 1024 * 1024 },
};

// ---------------------------------------------------------------------------
// AdminController
//
// All routes require AuthGuard + ActiveGuard + AdminGuard.
// ---------------------------------------------------------------------------
@Controller('admin')
@UseGuards(AuthGuard, ActiveGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
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
  async dashboard(@Req() req: CraftifyRequest, @Res() res: Response): Promise<void> {
    const data = await this.adminService.getDashboardData();

    res.render('admin/dashboard', {
      title: 'Admin Dashboard — Craftify',
      user: this.getUser(req),
      csrfToken: this.csrf(req),
      ...data,
      flashSuccess: this.flash(req, 'success_msg'),
      flashError: this.flash(req, 'error_msg'),
    });
  }

  // =========================================================================
  // USERS
  // =========================================================================

  @Get('users')
  async users(@Req() req: CraftifyRequest, @Res() res: Response): Promise<void> {
    const page = parseInt((req.query.page as string) ?? '1', 10);
    const role = (req.query.role as string) || undefined;
    const status = (req.query.status as string) || undefined;
    const search = (req.query.search as string) || undefined;

    const { users, pagination } = await this.adminService.getUsersList({
      page,
      role,
      status,
      search,
    });

    res.render('admin/users', {
      title: 'Users — Admin',
      user: this.getUser(req),
      csrfToken: this.csrf(req),
      users,
      pagination,
      filters: { role, status, search },
      flashSuccess: this.flash(req, 'success_msg'),
      flashError: this.flash(req, 'error_msg'),
    });
  }

  @Post('users/:id/status')
  async updateUserStatus(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Body('status') status: 'active' | 'suspended',
  ): Promise<void> {
    try {
      await this.adminService.updateUserStatus(id, status);
      req.flash?.('success_msg', `User status updated to "${status}".`);
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to update user status.');
    }
    return void res.redirect('/admin/users');
  }

  @Post('users/:id/delete')
  async deleteUser(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    try {
      await this.adminService.deleteUser(id);
      req.flash?.('success_msg', 'User deleted.');
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to delete user.');
    }
    return void res.redirect('/admin/users');
  }

  @Delete('users/:id')
  async deleteUserDELETE(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    return this.deleteUser(id, req, res);
  }

  // =========================================================================
  // ARTISANS
  // =========================================================================

  @Get('artisans')
  async artisans(@Req() req: CraftifyRequest, @Res() res: Response): Promise<void> {
    const page = parseInt((req.query.page as string) ?? '1', 10);
    const status = (req.query.status as string) || undefined;
    const search = (req.query.search as string) || undefined;

    const { artisans, pagination } = await this.adminService.getArtisansList({
      page,
      status,
      search,
    });

    res.render('admin/artisans', {
      title: 'Artisans — Admin',
      user: this.getUser(req),
      csrfToken: this.csrf(req),
      artisans,
      pagination,
      filters: { status, search },
      flashSuccess: this.flash(req, 'success_msg'),
      flashError: this.flash(req, 'error_msg'),
    });
  }

  @Post('artisans/:id/approve')
  async approveArtisan(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    try {
      await this.adminService.approveArtisan(id);
      req.flash?.('success_msg', 'Artisan approved.');
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to approve artisan.');
    }
    return void res.redirect('/admin/artisans');
  }

  @Post('artisans/:id/reject')
  async rejectArtisan(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    try {
      await this.adminService.rejectArtisan(id);
      req.flash?.('success_msg', 'Artisan rejected.');
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to reject artisan.');
    }
    return void res.redirect('/admin/artisans');
  }

  // =========================================================================
  // PRODUCTS
  // =========================================================================

  @Get('products')
  async products(@Req() req: CraftifyRequest, @Res() res: Response): Promise<void> {
    const page = parseInt((req.query.page as string) ?? '1', 10);
    const status = (req.query.status as string) || undefined;
    const search = (req.query.search as string) || undefined;
    const category = (req.query.category as string) || undefined;

    const [{ products, pagination }, categories] = await Promise.all([
      this.adminService.getProductsList({ page, status, search }),
      this.adminService.getCategoriesList(),
    ]);

    res.render('admin/products', {
      title: 'Products — Admin',
      user: this.getUser(req),
      csrfToken: this.csrf(req),
      products,
      pagination,
      categories,
      filters: { status, search, category },
      flashSuccess: this.flash(req, 'success_msg'),
      flashError: this.flash(req, 'error_msg'),
    });
  }

  @Post('products/:id/approve')
  async approveProduct(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    try {
      await this.adminService.approveProduct(id);
      req.flash?.('success_msg', 'Product approved.');
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to approve product.');
    }
    return void res.redirect('/admin/products');
  }

  @Post('products/:id/reject')
  async rejectProduct(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    try {
      await this.adminService.rejectProduct(id);
      req.flash?.('success_msg', 'Product rejected.');
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to reject product.');
    }
    return void res.redirect('/admin/products');
  }

  @Post('products/:id/featured')
  async toggleFeatured(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    try {
      await this.adminService.toggleFeatured(id);
      req.flash?.('success_msg', 'Featured status toggled.');
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to toggle featured.');
    }
    return void res.redirect('/admin/products');
  }

  // =========================================================================
  // CATEGORIES
  // =========================================================================

  @Get('categories')
  async categories(@Req() req: CraftifyRequest, @Res() res: Response): Promise<void> {
    const categories = await this.adminService.getCategoriesList();

    res.render('admin/categories', {
      title: 'Categories — Admin',
      user: this.getUser(req),
      csrfToken: this.csrf(req),
      categories,
      flashSuccess: this.flash(req, 'success_msg'),
      flashError: this.flash(req, 'error_msg'),
    });
  }

  @Post('categories')
  @UseInterceptors(FileInterceptor('image', uploadOptions))
  async createCategory(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Body() body: Record<string, any>,
    @UploadedFile() imageFile?: Express.Multer.File,
  ): Promise<void> {
    try {
      await this.adminService.createCategory(
        {
          name: body.name,
          description: body.description ?? null,
          parent_id: body.parent_id ? parseInt(body.parent_id, 10) : null,
          is_active: body.is_active !== undefined ? parseInt(body.is_active, 10) : 1,
        },
        imageFile,
      );
      req.flash?.('success_msg', 'Category created.');
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to create category.');
    }
    return void res.redirect('/admin/categories');
  }

  @Post('categories/:id')
  @UseInterceptors(FileInterceptor('image', uploadOptions))
  async updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Body() body: Record<string, any>,
    @UploadedFile() imageFile?: Express.Multer.File,
  ): Promise<void> {
    try {
      await this.adminService.updateCategory(
        id,
        {
          name: body.name,
          description: body.description ?? null,
          parent_id: body.parent_id ? parseInt(body.parent_id, 10) : null,
          is_active: body.is_active !== undefined ? parseInt(body.is_active, 10) : 1,
        },
        imageFile,
      );
      req.flash?.('success_msg', 'Category updated.');
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to update category.');
    }
    return void res.redirect('/admin/categories');
  }

  @Post('categories/:id/delete')
  async deleteCategory(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    try {
      await this.adminService.deleteCategory(id);
      req.flash?.('success_msg', 'Category deleted.');
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to delete category.');
    }
    return void res.redirect('/admin/categories');
  }

  @Delete('categories/:id')
  async deleteCategoryDELETE(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    return this.deleteCategory(id, req, res);
  }

  // =========================================================================
  // ORDERS
  // =========================================================================

  @Get('orders')
  async orders(@Req() req: CraftifyRequest, @Res() res: Response): Promise<void> {
    const page = parseInt((req.query.page as string) ?? '1', 10);
    const status = (req.query.status as string) || undefined;
    const search = (req.query.search as string) || undefined;

    const { orders, pagination } = await this.adminService.getOrdersList({
      page,
      status,
      search,
    });

    res.render('admin/orders', {
      title: 'Orders — Admin',
      user: this.getUser(req),
      csrfToken: this.csrf(req),
      orders,
      pagination,
      filters: { status, search },
      flashSuccess: this.flash(req, 'success_msg'),
      flashError: this.flash(req, 'error_msg'),
    });
  }

  @Get('orders/:id')
  async orderDetail(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const order = await this.adminService.getOrderDetail(id);
      res.render('admin/order-detail', {
        title: `Order #${id} — Admin`,
        user: this.getUser(req),
        csrfToken: this.csrf(req),
        order,
        flashSuccess: this.flash(req, 'success_msg'),
        flashError: this.flash(req, 'error_msg'),
      });
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Order not found.');
      return void res.redirect('/admin/orders');
    }
  }

  @Post('orders/:id/status')
  async updateOrderStatus(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Body('status') status: string,
  ): Promise<void> {
    try {
      await this.adminService.updateOrderStatus(id, status);
      req.flash?.('success_msg', `Order status updated to "${status}".`);
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to update order.');
    }
    return void res.redirect(`/admin/orders/${id}`);
  }

  // =========================================================================
  // AUCTIONS
  // =========================================================================

  @Get('auctions')
  async auctions(@Req() req: CraftifyRequest, @Res() res: Response): Promise<void> {
    const page = parseInt((req.query.page as string) ?? '1', 10);
    const status = (req.query.status as string) || undefined;
    const search = (req.query.search as string) || undefined;

    const { auctions, pagination } = await this.adminService.getAuctionsList({
      page,
      status,
      search,
    });

    res.render('admin/auctions', {
      title: 'Auctions — Admin',
      user: this.getUser(req),
      csrfToken: this.csrf(req),
      auctions,
      pagination,
      filters: { status, search },
      flashSuccess: this.flash(req, 'success_msg'),
      flashError: this.flash(req, 'error_msg'),
    });
  }

  @Post('auctions/:id/approve')
  async approveAuction(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    try {
      await this.adminService.approveAuction(id);
      req.flash?.('success_msg', 'Auction approved and set to active.');
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to approve auction.');
    }
    return void res.redirect('/admin/auctions');
  }

  @Post('auctions/:id/reject')
  async rejectAuction(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    try {
      await this.adminService.rejectAuction(id);
      req.flash?.('success_msg', 'Auction rejected.');
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to reject auction.');
    }
    return void res.redirect('/admin/auctions');
  }

  @Post('auctions/:id/cancel')
  async cancelAuction(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    try {
      await this.adminService.cancelAuction(id);
      req.flash?.('success_msg', 'Auction cancelled.');
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to cancel auction.');
    }
    return void res.redirect('/admin/auctions');
  }

  // =========================================================================
  // REVIEWS
  // =========================================================================

  @Get('reviews')
  async reviews(@Req() req: CraftifyRequest, @Res() res: Response): Promise<void> {
    const page = parseInt((req.query.page as string) ?? '1', 10);
    const status = (req.query.status as string) || undefined;
    const search = (req.query.search as string) || undefined;

    const { reviews, pagination } = await this.adminService.getReviewsList({
      page,
      status,
      search,
    });

    res.render('admin/reviews', {
      title: 'Reviews — Admin',
      user: this.getUser(req),
      csrfToken: this.csrf(req),
      reviews,
      pagination,
      filters: { status, search },
      flashSuccess: this.flash(req, 'success_msg'),
      flashError: this.flash(req, 'error_msg'),
    });
  }

  @Post('reviews/:id/approve')
  async approveReview(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    try {
      await this.adminService.approveReview(id);
      req.flash?.('success_msg', 'Review approved.');
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to approve review.');
    }
    return void res.redirect('/admin/reviews');
  }

  @Post('reviews/:id/delete')
  async deleteReview(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    try {
      await this.adminService.deleteReview(id);
      req.flash?.('success_msg', 'Review deleted.');
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to delete review.');
    }
    return void res.redirect('/admin/reviews');
  }

  @Delete('reviews/:id')
  async deleteReviewDELETE(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    return this.deleteReview(id, req, res);
  }

  // =========================================================================
  // COUPONS
  // =========================================================================

  @Get('coupons')
  async coupons(@Req() req: CraftifyRequest, @Res() res: Response): Promise<void> {
    const { coupons, pagination } = await this.adminService.getCouponsList({
      page: parseInt((req.query.page as string) ?? '1', 10),
      search: (req.query.search as string) || undefined,
      scope: (req.query.scope as string) || undefined,
    });

    const { artisans } = await this.adminService.getArtisansList({ limit: 200 });

    res.render('admin/coupons', {
      title: 'Coupons — Admin',
      user: this.getUser(req),
      csrfToken: this.csrf(req),
      coupons,
      pagination,
      artisans,
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
    try {
      await this.adminService.createCoupon({
        code: (body.code as string)?.toUpperCase().trim(),
        description: body.description ?? null,
        discount_type: body.discount_type,
        discount_value: parseFloat(body.discount_value) || 0,
        min_purchase: body.min_purchase ? parseFloat(body.min_purchase) : 0,
        max_discount: body.max_discount ? parseFloat(body.max_discount) : null,
        usage_limit: body.usage_limit ? parseInt(body.usage_limit, 10) : null,
        scope: body.scope ?? 'global',
        valid_from: body.valid_from ? (new Date(body.valid_from) as unknown as Date) : null,
        valid_until: body.valid_until ? (new Date(body.valid_until) as unknown as Date) : null,
      });
      req.flash?.('success_msg', 'Coupon created.');
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to create coupon.');
    }
    return void res.redirect('/admin/coupons');
  }

  @Post('coupons/:id/toggle')
  async toggleCoupon(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const coupon = await this.adminService.toggleCoupon(id);
      req.flash?.('success_msg', `Coupon ${coupon.is_active ? 'activated' : 'deactivated'}.`);
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to toggle coupon.');
    }
    return void res.redirect('/admin/coupons');
  }

  @Post('coupons/:id/delete')
  async deleteCoupon(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    try {
      await this.adminService.deleteCoupon(id);
      req.flash?.('success_msg', 'Coupon deleted.');
    } catch (err: any) {
      req.flash?.('error_msg', err?.message ?? 'Failed to delete coupon.');
    }
    return void res.redirect('/admin/coupons');
  }

  @Delete('coupons/:id')
  async deleteCouponDELETE(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    return this.deleteCoupon(id, req, res);
  }

  // =========================================================================
  // REPORTS
  // =========================================================================

  @Get('reports')
  async reports(@Req() req: CraftifyRequest, @Res() res: Response): Promise<void> {
    const period = (req.query.period as string) || 'month';
    const reports = await this.adminService.getReports(period);

    res.render('admin/reports', {
      title: 'Reports — Admin',
      user: this.getUser(req),
      csrfToken: this.csrf(req),
      period,
      ...reports,
    });
  }

  // =========================================================================
  // SETTINGS
  // =========================================================================

  @Get('settings')
  settings(@Req() req: CraftifyRequest, @Res() res: Response): void {
    res.render('admin/settings', {
      title: 'Settings — Admin',
      user: this.getUser(req),
      csrfToken: this.csrf(req),
      flashSuccess: this.flash(req, 'success_msg'),
      flashError: this.flash(req, 'error_msg'),
    });
  }
}
