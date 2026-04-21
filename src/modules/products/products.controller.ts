import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  ParseIntPipe,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { ProductsService } from './products.service';
import { CategoriesService } from '../categories/categories.service';
import { ProductFiltersDto } from './dto/product-filters.dto';

// ---------------------------------------------------------------------------
// Augmented request type
// ---------------------------------------------------------------------------

type CraftifyRequest = Request & {
  session: Record<string, any> & {
    user?: {
      id: number;
      role: string;
      name?: string;
      avatar?: string;
    };
  };
  flash?: (type: string, message?: string) => string[];
  csrfToken?: () => string;
  sessionID: string;
};

/**
 * ProductsController
 *
 * Public storefront routes for browsing, filtering, and viewing products.
 * No authentication is required for any of these routes — all users (including
 * unauthenticated guests) can browse the catalogue.
 *
 * Route registration order matters: specific literal segments (/search,
 * /artisan/:id, /category/:id) are declared BEFORE the generic /:id catch-all
 * so NestJS registers them first and they are matched with priority.
 *
 * Template context:
 *   All routes pass the following minimum context to EJS templates:
 *     - user         from res.locals (set by global locals middleware in main.ts)
 *     - csrfToken    from res.locals
 *     - currentPath  from res.locals
 *   Flash messages (success_msg, error_msg) are also in res.locals and are
 *   available to every template without the controller explicitly passing them.
 */
@Controller('products')
export class ProductsController {
  private readonly logger = new Logger(ProductsController.name);

  constructor(
    private readonly productsService: ProductsService,
    private readonly categoriesService: CategoriesService,
  ) {}

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private flash(req: CraftifyRequest, type: string): string {
    if (typeof req.flash !== 'function') return '';
    const msgs = req.flash(type);
    return Array.isArray(msgs) && msgs.length > 0 ? msgs[0] : '';
  }

  private setFlash(req: CraftifyRequest, type: string, msg: string): void {
    if (typeof req.flash === 'function') {
      req.flash(type, msg);
    }
  }

  private csrf(req: CraftifyRequest): string {
    return typeof req.csrfToken === 'function' ? req.csrfToken() : '';
  }

  // ===========================================================================
  // GET /products
  // ===========================================================================

  /**
   * Main product catalogue index with filtering, sorting, and pagination.
   *
   * Query params (all optional):
   *   category    — one or more category IDs (?category=1&category=3)
   *   search      — full-text search across name, description, shop_name
   *   sort        — newest | oldest | price_low | price_high | popular | rating | highest_rated
   *   min_price   — minimum price filter
   *   max_price   — maximum price filter
   *   featured    — "true" to show only featured products
   *   page        — page number (default 1)
   */
  @Get()
  async index(
    @Query() rawQuery: ProductFiltersDto,
    @Req()  req: CraftifyRequest,
    @Res()  res: Response,
  ): Promise<void> {
    try {
      // The DTO @Transform always normalises category to number[], default []
      const activeCategoryIds: number[] = rawQuery.category ?? [];

      const filters: ProductFiltersDto = {
        ...rawQuery,
        category: activeCategoryIds,
        page: rawQuery.page ?? 1,
        sort: rawQuery.sort ?? 'newest',
      };

      const [listResult, categories] = await Promise.all([
        this.productsService.findAll(filters),
        this.categoriesService.findAll(false), // exclude empty for filter sidebar
      ]);

      // Parse images for all products so templates can use imageArray
      const products = listResult.products.map((p) =>
        this.productsService.parseImages(p),
      );

      // Mark wishlist items for logged-in customers
      const sessionUser = req.session?.user ?? null;
      if (sessionUser?.id && sessionUser.role === 'customer') {
        await Promise.all(
          products.map(async (p) => {
            p.inWishlist = await this.productsService.isInWishlist(
              sessionUser.id,
              p.id,
            );
          }),
        );
      }

      res.render('products/index', {
        title:            'Browse Products - Craftify',
        products,
        categories,
        filters: {
          category:  activeCategoryIds,
          search:    rawQuery.search ?? '',
          sort:      rawQuery.sort   ?? 'newest',
          min_price: rawQuery.min_price ?? '',
          max_price: rawQuery.max_price ?? '',
          featured:  rawQuery.featured ?? false,
        },
        pagination:        listResult.pagination,
        activeCategoryIds,
        totalProducts:     listResult.total,
        user:              res.locals['user'] ?? sessionUser,
        csrfToken:         this.csrf(req),
      });
    } catch (err) {
      this.logger.error(`Products index error: ${(err as Error).message}`, (err as Error).stack);
      this.setFlash(req, 'error_msg', 'Error loading products');
      res.redirect('/');
    }
  }

  // ===========================================================================
  // GET /products/search → redirect
  // ===========================================================================

  /**
   * Convenience endpoint that accepts a `q` param from the topbar search form
   * and redirects to /products?search=<q>.  Declared before /:id so it is
   * matched first.
   */
  @Get('search')
  search(
    @Query('q') q: string,
    @Res() res: Response,
  ): void {
    const encoded = encodeURIComponent((q ?? '').trim());
    res.redirect(`/products?search=${encoded}`);
  }

  // ===========================================================================
  // GET /products/category/:id → redirect
  // ===========================================================================

  /**
   * Legacy URL support — redirects old /products/category/:id links to the
   * unified products page with the category filter pre-selected.
   */
  @Get('category/:id')
  byCategory(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ): void {
    res.redirect(`/products?category=${id}`);
  }

  // ===========================================================================
  // GET /products/artisan/:id
  // ===========================================================================

  /**
   * Filters the product catalogue to a single artisan's approved listings.
   * Renders the same products/index.ejs template with an artisan context banner.
   */
  @Get('artisan/:id')
  async byArtisan(
    @Param('id', ParseIntPipe) artisanId: number,
    @Query() rawQuery: ProductFiltersDto,
    @Req()  req: CraftifyRequest,
    @Res()  res: Response,
  ): Promise<void> {
    try {
      const artisan = await this.productsService.getArtisanProfile(artisanId);
      if (!artisan) {
        this.setFlash(req, 'error_msg', 'Artisan not found');
        return res.redirect('/products');
      }

      const filters: ProductFiltersDto = {
        ...rawQuery,
        artisan_id: artisanId,
        // Public artisan page shows only approved products
        status:     'approved' as string,
        page:       rawQuery.page ?? 1,
        sort:       rawQuery.sort ?? 'newest',
      };

      const [listResult, categories] = await Promise.all([
        this.productsService.findAll(filters),
        this.categoriesService.findAll(false),
      ]);

      const products = listResult.products.map((p) =>
        this.productsService.parseImages(p),
      );

      const sessionUser = req.session?.user ?? null;
      if (sessionUser?.id && sessionUser.role === 'customer') {
        await Promise.all(
          products.map(async (p) => {
            p.inWishlist = await this.productsService.isInWishlist(
              sessionUser.id,
              p.id,
            );
          }),
        );
      }

      res.render('products/index', {
        title:            `${artisan.shop_name} - Craftify`,
        products,
        categories,
        artisan,
        filters: {
          category:  [],
          search:    rawQuery.search ?? '',
          sort:      rawQuery.sort   ?? 'newest',
          min_price: rawQuery.min_price ?? '',
          max_price: rawQuery.max_price ?? '',
          featured:  false,
        },
        pagination:        listResult.pagination,
        activeCategoryIds: [] as number[],
        totalProducts:     listResult.total,
        user:              res.locals['user'] ?? sessionUser,
        csrfToken:         this.csrf(req),
      });
    } catch (err) {
      this.logger.error(`Artisan products error: ${(err as Error).message}`, (err as Error).stack);
      res.redirect('/products');
    }
  }

  // ===========================================================================
  // GET /products/:id
  // ===========================================================================

  /**
   * Product detail (show) page.
   *
   * - Increments the view counter (fire-and-forget)
   * - Fetches reviews, rating stats, and rating distribution
   * - Checks wishlist membership for logged-in customers
   * - Calculates availableStock = product.stock − qty already in the cart
   */
  @Get(':id')
  async show(
    @Param('id', ParseIntPipe) id: number,
    @Req()  req: CraftifyRequest,
    @Res()  res: Response,
  ): Promise<void> {
    try {
      const product = await this.productsService.findById(id);

      // Only approved products are publicly visible
      if (!product || product.status !== 'approved') {
        this.setFlash(req, 'error_msg', 'Product not found');
        return res.redirect('/products');
      }

      // Fire-and-forget view increment
      void this.productsService.incrementViews(id);

      const sessionUser = req.session?.user ?? null;

      // Run all independent data fetches in parallel
      const [
        reviews,
        ratingStats,
        ratingDistribution,
        artisan,
        relatedProducts,
      ] = await Promise.all([
        this.productsService.getReviews(id),
        this.productsService.getRatingStats(id),
        this.productsService.getRatingDistribution(id),
        this.productsService.getArtisanProfile(product.artisan_id),
        this.productsService.getRelated(id, 4),
      ]);

      // Per-user data (wishlist + cart quantity)
      let inWishlist     = false;
      let availableStock = Math.max(0, product.stock);

      if (sessionUser?.id) {
        const [wishlistFlag, cartQty] = await Promise.all([
          sessionUser.role === 'customer'
            ? this.productsService.isInWishlist(sessionUser.id, id)
            : Promise.resolve(false),
          this.productsService.getCartQty(sessionUser.id, null, id),
        ]);
        inWishlist     = wishlistFlag;
        availableStock = Math.max(0, product.stock - cartQty);
      } else if (req.sessionID) {
        const cartQty = await this.productsService.getCartQty(null, req.sessionID, id);
        availableStock = Math.max(0, product.stock - cartQty);
      }

      // Parse images and attach imageArray
      const parsedProduct = this.productsService.parseImages(product);

      // Parse related product images too
      const relatedParsed = relatedProducts.map((p) =>
        this.productsService.parseImages(p),
      );

      res.render('products/show', {
        title:              `${product.name} - Craftify`,
        product:            parsedProduct,
        artisan,
        reviews,
        ratingStats,
        ratingDistribution,
        relatedProducts:    relatedParsed,
        inWishlist,
        availableStock,
        canReview:          null,
        user:               res.locals['user'] ?? sessionUser,
        csrfToken:          this.csrf(req),
      });
    } catch (err) {
      this.logger.error(`Product show error [id=${id}]: ${(err as Error).message}`, (err as Error).stack);
      this.setFlash(req, 'error_msg', 'Error loading product');
      res.redirect('/products');
    }
  }
}
