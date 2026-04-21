import {
  Controller,
  Get,
  Post,
  Delete,
  Req,
  Res,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { ReviewsService } from './reviews.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import {
  ActiveGuard,
  CustomerGuard,
} from '../../common/guards/roles.guard';

type CraftifyRequest = Request & {
  session: Record<string, any> & {
    user?: { id: number; role: string };
  };
  flash?: (type: string, message?: string) => string[];
  csrfToken?: () => string;
};

@Controller('user')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  private flash(req: CraftifyRequest, type: string): string {
    if (typeof req.flash !== 'function') return '';
    const msgs = req.flash(type);
    return Array.isArray(msgs) && msgs.length > 0 ? msgs[0] : '';
  }

  private csrf(req: CraftifyRequest): string {
    return typeof req.csrfToken === 'function' ? req.csrfToken() : '';
  }

  // =========================================================================
  // GET /user/reviews
  // =========================================================================

  @Get('reviews')
  @UseGuards(AuthGuard, ActiveGuard, CustomerGuard)
  async showReviews(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Query('page') pageStr?: string,
    @Query('sort') sort?: string,
  ): Promise<void> {
    const userId = req.session.user!.id;
    const page = parseInt(pageStr || '1', 10) || 1;

    const result = await this.reviewsService.findByUserId(userId, {
      page,
      limit: 10,
      sort: (sort as any) || 'newest',
    });

    res.render('user/reviews', {
      title: 'My Reviews - Craftify',
      user: req.session.user,
      reviews: result.reviews,
      pagination: result.pagination,
      sort: sort || 'newest',
      filters: {
        sort: sort || 'newest',
        rating: req.query.rating ? parseInt(req.query.rating as string, 10) : null,
      },
      csrfToken: this.csrf(req),
      flashError: this.flash(req, 'error_msg'),
      flashSuccess: this.flash(req, 'success_msg'),
    });
  }

  // =========================================================================
  // POST /user/reviews — create review
  // =========================================================================

  @Post('reviews')
  @UseGuards(AuthGuard, ActiveGuard, CustomerGuard)
  async createReview(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Body()
    body: {
      product_id: string;
      order_id?: string;
      rating: string;
      title?: string;
      comment?: string;
    },
  ): Promise<void> {
    const userId = req.session.user!.id;

    try {
      await this.reviewsService.create({
        productId: parseInt(body.product_id, 10),
        userId,
        orderId: body.order_id ? parseInt(body.order_id, 10) : undefined,
        rating: parseInt(body.rating, 10),
        title: body.title,
        comment: body.comment,
      });
      req.flash?.('success_msg', 'Review submitted successfully');
    } catch (err: any) {
      req.flash?.('error_msg', err.message || 'Failed to submit review');
    }

    return void res.redirect('/user/reviews');
  }

  // =========================================================================
  // DELETE /user/reviews/:id  (also POST /user/reviews/:id/delete via method-override)
  // =========================================================================

  @Delete('reviews/:id')
  @UseGuards(AuthGuard, ActiveGuard, CustomerGuard)
  async deleteReview(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    const userId = req.session.user!.id;

    try {
      await this.reviewsService.delete(id, userId);
      req.flash?.('success_msg', 'Review deleted successfully');
    } catch (err: any) {
      req.flash?.('error_msg', err.message || 'Failed to delete review');
    }

    return void res.redirect('/user/reviews');
  }

  // method-override fallback: POST /user/reviews/:id/delete
  @Post('reviews/:id/delete')
  @UseGuards(AuthGuard, ActiveGuard, CustomerGuard)
  async deleteReviewPost(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    return this.deleteReview(id, req, res);
  }
}
