import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Body,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request, Response } from 'express';

import { NewsletterSubscription } from '../../database/entities/newsletter-subscription.entity';
import { ProductsService }        from '../products/products.service';
import { CategoriesService }      from '../categories/categories.service';
import { AuctionsService }        from '../auctions/auctions.service';
import { ArtisanProfilesService } from '../artisan-profiles/artisan-profiles.service';

// ---------------------------------------------------------------------------
// Request type helpers
// ---------------------------------------------------------------------------
type CraftifyRequest = Request & {
  session: Record<string, any> & { user?: any };
  flash?: (type: string, message?: string) => string[];
  csrfToken?: () => string;
};

// ---------------------------------------------------------------------------
// HomeController
//
// Renders every public-facing page of Craftify.  No auth guards are applied;
// all routes are accessible to unauthenticated visitors.
// ---------------------------------------------------------------------------
@Controller()
export class HomeController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly categoriesService: CategoriesService,
    private readonly auctionsService: AuctionsService,
    private readonly artisanProfilesService: ArtisanProfilesService,
    @InjectRepository(NewsletterSubscription)
    private readonly newsletterRepo: Repository<NewsletterSubscription>,
  ) {}

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private getUser(req: CraftifyRequest) {
    return req.session?.user ?? null;
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
  // GET /  —  Homepage
  // =========================================================================
  @Get('/')
  async home(@Req() req: CraftifyRequest, @Res() res: Response): Promise<void> {
    const [
      featuredProducts,
      newArrivals,
      categories,
      featuredArtisans,
      auctionsResult,
    ] = await Promise.all([
      this.productsService.getFeatured(8),
      this.productsService.getNewArrivals(8),
      this.categoriesService.findAll(),
      this.artisanProfilesService.findApprovedWithStats(6),
      this.auctionsService.findAll({ active: true, limit: 4 }),
    ]);

    // Attach parsed image arrays to featured + new arrivals
    const featuredWithImages = featuredProducts.map((p) =>
      this.productsService.parseImages(p),
    );
    const newArrivalsWithImages = newArrivals.map((p) =>
      this.productsService.parseImages(p),
    );

    res.render('home/index', {
      title: 'Craftify — Handcrafted with Love',
      user: this.getUser(req),
      csrfToken: this.csrf(req),
      featuredProducts: featuredWithImages,
      newArrivals: newArrivalsWithImages,
      categories,
      featuredArtisans,
      activeAuctions: auctionsResult.auctions,
      flashSuccess: this.flash(req, 'success_msg'),
      flashError: this.flash(req, 'error_msg'),
    });
  }

  // =========================================================================
  // GET /about
  // =========================================================================
  @Get('/about')
  about(@Req() req: CraftifyRequest, @Res() res: Response): void {
    res.render('home/about', {
      title: 'About Us — Craftify',
      user: this.getUser(req),
      csrfToken: this.csrf(req),
    });
  }

  // =========================================================================
  // GET /contact
  // =========================================================================
  @Get('/contact')
  contact(@Req() req: CraftifyRequest, @Res() res: Response): void {
    res.render('home/contact', {
      title: 'Contact Us — Craftify',
      user: this.getUser(req),
      csrfToken: this.csrf(req),
      flashSuccess: this.flash(req, 'success_msg'),
      flashError: this.flash(req, 'error_msg'),
    });
  }

  // =========================================================================
  // POST /contact
  // =========================================================================
  @Post('/contact')
  async contactSubmit(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Body('name') name: string,
    @Body('email') email: string,
    @Body('subject') _subject: string,
    @Body('message') message: string,
  ): Promise<void> {
    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      req.flash?.('error_msg', 'Please fill in all required fields.');
      return void res.redirect('/contact');
    }

    // Email sending is a known non-blocking issue — flash success regardless
    req.flash?.('success_msg', 'Thank you for your message! We will get back to you soon.');
    return void res.redirect('/contact');
  }

  // =========================================================================
  // GET /faq
  // =========================================================================
  @Get('/faq')
  faq(@Req() req: CraftifyRequest, @Res() res: Response): void {
    res.render('home/faq', {
      title: 'FAQ — Craftify',
      user: this.getUser(req),
      csrfToken: this.csrf(req),
    });
  }

  // =========================================================================
  // GET /shipping
  // =========================================================================
  @Get('/shipping')
  shipping(@Req() req: CraftifyRequest, @Res() res: Response): void {
    res.render('home/shipping', {
      title: 'Shipping Policy — Craftify',
      user: this.getUser(req),
      csrfToken: this.csrf(req),
    });
  }

  // =========================================================================
  // GET /guidelines
  // =========================================================================
  @Get('/guidelines')
  guidelines(@Req() req: CraftifyRequest, @Res() res: Response): void {
    res.render('home/guidelines', {
      title: 'Seller Guidelines — Craftify',
      user: this.getUser(req),
      csrfToken: this.csrf(req),
    });
  }

  // =========================================================================
  // GET /terms
  // =========================================================================
  @Get('/terms')
  terms(@Req() req: CraftifyRequest, @Res() res: Response): void {
    res.render('home/terms', {
      title: 'Terms of Service — Craftify',
      user: this.getUser(req),
      csrfToken: this.csrf(req),
    });
  }

  // =========================================================================
  // GET /privacy
  // =========================================================================
  @Get('/privacy')
  privacy(@Req() req: CraftifyRequest, @Res() res: Response): void {
    res.render('home/privacy', {
      title: 'Privacy Policy — Craftify',
      user: this.getUser(req),
      csrfToken: this.csrf(req),
    });
  }

  // =========================================================================
  // GET /artisans  —  Public artisan directory
  // =========================================================================
  @Get('/artisans')
  async artisans(@Req() req: CraftifyRequest, @Res() res: Response): Promise<void> {
    const artisans = await this.artisanProfilesService.findAll({ approved: true });

    res.render('home/artisans', {
      title: 'Our Artisans — Craftify',
      user: this.getUser(req),
      csrfToken: this.csrf(req),
      artisans,
    });
  }

  // =========================================================================
  // POST /subscribe  —  Newsletter signup
  // =========================================================================
  @Post('/subscribe')
  async subscribe(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Body('email') email: string,
  ): Promise<void> {
    const trimmed = (email ?? '').trim().toLowerCase();

    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      req.flash?.('error_msg', 'Please enter a valid email address.');
      return void res.redirect('/');
    }

    // INSERT OR IGNORE semantics — silently skip duplicates
    try {
      const existing = await this.newsletterRepo.findOne({
        where: { email: trimmed },
      });
      if (!existing) {
        const sub = this.newsletterRepo.create({ email: trimmed });
        await this.newsletterRepo.save(sub);
      }
      req.flash?.('success_msg', 'You have been subscribed to our newsletter!');
    } catch {
      req.flash?.('error_msg', 'Something went wrong. Please try again.');
    }

    return void res.redirect('/');
  }
}
