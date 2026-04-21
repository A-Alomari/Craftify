import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { Product } from '../../database/entities/product.entity';
import { Category } from '../../database/entities/category.entity';
import { Review } from '../../database/entities/review.entity';
import { Wishlist } from '../../database/entities/wishlist.entity';
import { CartItem } from '../../database/entities/cart-item.entity';
import { ArtisanProfile } from '../../database/entities/artisan-profile.entity';
import { User } from '../../database/entities/user.entity';
import { ProductFiltersDto } from './dto/product-filters.dto';

// ---------------------------------------------------------------------------
// Shared return shapes
// ---------------------------------------------------------------------------

/** Product row enriched with joined / aggregated fields. */
export interface ProductRow {
  id: number;
  artisan_id: number;
  category_id: number | null;
  name: string;
  description: string;
  price: number;
  compare_price: number | null;
  stock: number;
  images: string | null;
  tags: string | null;
  weight: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  featured: number;
  status: string;
  is_active: number;
  views: number;
  created_at: Date;
  updated_at: Date;
  // Joined
  category_name: string | null;
  artisan_name: string | null;
  shop_name: string | null;
  artisan_avatar: string | null;
  artisan_profile_image: string | null;
  // Aggregated
  avg_rating: number | null;
  review_count: number;
  // Parsed convenience field (set by parseImages)
  imageArray?: string[];
  // Optional wishlist flag (set by controller per-user)
  inWishlist?: boolean;
}

export interface Pagination {
  current: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
  pages: number[];
}

export interface ProductListResult {
  products: ProductRow[];
  total: number;
  pagination: Pagination;
}

export interface RatingStats {
  avg_rating: number;
  review_count: number;
}

export interface RatingDistribution {
  star: number;
  count: number;
  percentage: number;
}

export interface ReviewRow {
  id: number;
  user_id: number;
  product_id: number;
  rating: number;
  title: string | null;
  comment: string | null;
  helpful_count: number;
  is_approved: number;
  created_at: Date;
  reviewer_name: string;
  reviewer_avatar: string | null;
}

export interface ArtisanRow {
  user_id: number;
  shop_name: string;
  bio: string | null;
  logo: string | null;
  profile_image: string | null;
  banner_image: string | null;
  location: string | null;
  phone: string | null;
  instagram: string | null;
  facebook: string | null;
  twitter: string | null;
  website: string | null;
  return_policy: string | null;
  is_approved: number;
  artisan_name: string;
  artisan_avatar: string | null;
}

export interface ProductStats {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
}

// ---------------------------------------------------------------------------
// Sort map
// ---------------------------------------------------------------------------

const SORT_MAP: Record<string, { column: string; direction: 'ASC' | 'DESC'; extra?: Array<{ column: string; direction: 'ASC' | 'DESC' }> }> = {
  newest:       { column: 'p.created_at',  direction: 'DESC' },
  oldest:       { column: 'p.created_at',  direction: 'ASC'  },
  price_low:    { column: 'p.price',        direction: 'ASC'  },
  price_asc:    { column: 'p.price',        direction: 'ASC'  },
  price_high:   { column: 'p.price',        direction: 'DESC' },
  price_desc:   { column: 'p.price',        direction: 'DESC' },
  popular:      { column: 'p.views',        direction: 'DESC' },
  rating:       { column: 'avg_rating',     direction: 'DESC' },
  highest_rated: {
    column: 'avg_rating',
    direction: 'DESC',
    extra: [
      { column: 'review_count', direction: 'DESC' },
      { column: 'p.created_at', direction: 'DESC' },
    ],
  },
};

const DEFAULT_PAGE_LIMIT = 12;

/**
 * ProductsService
 *
 * All product data access for the Craftify storefront, artisan dashboard,
 * and admin panel.  Uses TypeORM QueryBuilder throughout so that complex
 * multi-join queries, dynamic filter conditions, and subquery aggregates
 * are handled cleanly in one place.
 */
@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Wishlist)
    private readonly wishlistRepo: Repository<Wishlist>,
    @InjectRepository(CartItem)
    private readonly cartItemRepo: Repository<CartItem>,
    @InjectRepository(ArtisanProfile)
    private readonly artisanProfileRepo: Repository<ArtisanProfile>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // ===========================================================================
  // BASE QUERY BUILDER
  // ===========================================================================

  /**
   * Returns a QueryBuilder with all standard JOIN / SELECT already wired.
   * All product columns are explicitly aliased to avoid the `p_` prefix that
   * TypeORM would add to entity columns when using getRawMany().
   */
  private baseQb(): SelectQueryBuilder<Product> {
    return this.productRepo
      .createQueryBuilder('p')
      // ---- Product columns (explicit aliases to keep raw result clean) ----
      .select('p.id',           'id')
      .addSelect('p.artisan_id',    'artisan_id')
      .addSelect('p.category_id',   'category_id')
      .addSelect('p.name',          'name')
      .addSelect('p.description',   'description')
      .addSelect('p.price',         'price')
      .addSelect('p.compare_price', 'compare_price')
      .addSelect('p.stock',         'stock')
      .addSelect('p.images',        'images')
      .addSelect('p.tags',          'tags')
      .addSelect('p.weight',        'weight')
      .addSelect('p.length_cm',     'length_cm')
      .addSelect('p.width_cm',      'width_cm')
      .addSelect('p.height_cm',     'height_cm')
      .addSelect('p.featured',      'featured')
      .addSelect('p.status',        'status')
      .addSelect('p.is_active',     'is_active')
      .addSelect('p.views',         'views')
      .addSelect('p.created_at',    'created_at')
      .addSelect('p.updated_at',    'updated_at')
      // ---- Joined / computed columns ----
      .addSelect('c.name',          'category_name')
      .addSelect('u.name',          'artisan_name')
      .addSelect('ap.shop_name',    'shop_name')
      .addSelect('u.avatar',        'artisan_avatar')
      .addSelect('ap.profile_image','artisan_profile_image')
      .addSelect(
        '(SELECT AVG(r.rating) FROM reviews r WHERE r.product_id = p.id AND r.is_approved = 1)',
        'avg_rating',
      )
      .addSelect(
        '(SELECT COUNT(r.id) FROM reviews r WHERE r.product_id = p.id AND r.is_approved = 1)',
        'review_count',
      )
      // ---- JOINs ----
      .leftJoin('categories',       'c',  'c.id = p.category_id')
      .leftJoin('users',            'u',  'u.id = p.artisan_id')
      .leftJoin('artisan_profiles', 'ap', 'ap.user_id = p.artisan_id');
  }

  /**
   * Applies all standard filter conditions to a QueryBuilder instance that was
   * already created via baseQb() or a count-variant.  Shared between findAll,
   * count, and adminFindAll so filter logic is defined in exactly one place.
   */
  private applyFilters(
    qb: SelectQueryBuilder<Product>,
    filters: ProductFiltersDto & { status?: string; artisan_id?: number },
  ): void {
    // Status — defaults to 'approved' for public routes; admin passes 'all'
    // or a specific status
    if (filters.status && filters.status !== 'all') {
      qb.andWhere('p.status = :status', { status: filters.status });
    }

    // Single or multi-category
    const categoryIds = filters.category ?? [];
    if (categoryIds.length === 1) {
      qb.andWhere('p.category_id = :categoryId', { categoryId: categoryIds[0] });
    } else if (categoryIds.length > 1) {
      qb.andWhere('p.category_id IN (:...categoryIds)', { categoryIds });
    }

    // Artisan
    if (filters.artisan_id) {
      qb.andWhere('p.artisan_id = :artisanId', { artisanId: filters.artisan_id });
    }

    // Featured
    if (filters.featured) {
      qb.andWhere('p.featured = 1');
    }

    // Full-text search (name, description, shop_name)
    if (filters.search && filters.search.trim()) {
      const term = `%${filters.search.trim()}%`;
      qb.andWhere(
        '(p.name LIKE :search OR p.description LIKE :search OR ap.shop_name LIKE :search)',
        { search: term },
      );
    }

    // Price range
    if (filters.min_price !== undefined && filters.min_price !== null) {
      qb.andWhere('p.price >= :minPrice', { minPrice: filters.min_price });
    }
    if (filters.max_price !== undefined && filters.max_price !== null) {
      qb.andWhere('p.price <= :maxPrice', { maxPrice: filters.max_price });
    }
  }

  // ===========================================================================
  // READ — SINGLE PRODUCT
  // ===========================================================================

  /**
   * Fetches a single product by ID, enriched with category, artisan, and
   * aggregate rating data.
   *
   * Returns null when not found so the controller can decide whether to
   * render a 404 or redirect.
   */
  async findById(id: number): Promise<ProductRow | null> {
    const row = await this.baseQb()
      .where('p.id = :id', { id })
      .getRawOne<Record<string, unknown>>();

    return row ? this.mapRow(row) : null;
  }

  // ===========================================================================
  // READ — PRODUCT LISTS
  // ===========================================================================

  /**
   * Paginated product list with optional filtering and sorting.
   *
   * Defaults to status='approved' unless `filters.status` is explicitly set.
   * Pagination defaults: page=1, limit=12.
   */
  async findAll(
    filters: ProductFiltersDto = {},
  ): Promise<ProductListResult> {
    const effectiveFilters = {
      status: 'approved',
      ...filters,
    };

    const page  = Math.max(1, filters.page  ?? 1);
    const limit = Math.max(1, filters.limit ?? DEFAULT_PAGE_LIMIT);
    const offset = (page - 1) * limit;
    const sort  = filters.sort ?? 'newest';

    // --- Data query ---
    const qb = this.baseQb();
    this.applyFilters(qb, effectiveFilters);
    this.applySort(qb, sort);
    qb.limit(limit).offset(offset);

    // --- Count query (same filters, no LIMIT/ORDER) ---
    const total = await this.count(effectiveFilters);

    const rows = await qb.getRawMany<Record<string, unknown>>();
    const products = rows.map(this.mapRow);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      products,
      total,
      pagination: this.buildPagination(page, totalPages),
    };
  }

  /**
   * Returns only the count matching the given filters (no rows).
   * Uses a lean query builder to avoid the overhead of all the JOIN selects.
   */
  async count(
    filters: ProductFiltersDto & { status?: string; artisan_id?: number } = {},
  ): Promise<number> {
    const qb = this.productRepo
      .createQueryBuilder('p')
      .select('COUNT(DISTINCT p.id)', 'cnt')
      .leftJoin('artisan_profiles', 'ap', 'ap.user_id = p.artisan_id');

    this.applyFilters(qb, filters);

    const result = await qb.getRawOne<{ cnt: string }>();
    return parseInt(result?.cnt ?? '0', 10);
  }

  /**
   * Returns featured products (featured=1, status='approved').
   */
  async getFeatured(limit = 8): Promise<ProductRow[]> {
    const { products } = await this.findAll({
      featured: true,
      limit,
      page: 1,
    });
    return products;
  }

  /**
   * Returns the newest approved products, sorted by created_at DESC.
   */
  async getNewArrivals(limit = 8): Promise<ProductRow[]> {
    const { products } = await this.findAll({
      sort: 'newest',
      limit,
      page: 1,
    });
    return products;
  }

  /**
   * Returns products belonging to a specific artisan.
   *
   * Unlike findAll (which defaults to status='approved'), this returns ALL
   * product statuses so artisans can see their pending/rejected listings.
   * Pass `filters.status` to narrow further (e.g. 'approved' only).
   */
  async getByArtisan(
    artisanId: number,
    filters: ProductFiltersDto = {},
  ): Promise<ProductListResult> {
    return this.findAll({
      ...filters,
      artisan_id: artisanId,
      // Override: artisans see all their own product statuses by default
      status: filters.status ?? ('all' as string),
    });
  }

  /**
   * Returns products related to a given product (same category or same artisan,
   * excluding the product itself).  Results are randomised so each page visit
   * shows a varied selection.
   */
  async getRelated(productId: number, limit = 4): Promise<ProductRow[]> {
    const product = await this.findById(productId);
    if (!product) return [];

    const qb = this.baseQb()
      .where('p.id != :productId', { productId })
      .andWhere("p.status = 'approved'")
      .andWhere(
        '(p.category_id = :categoryId OR p.artisan_id = :artisanId)',
        { categoryId: product.category_id ?? -1, artisanId: product.artisan_id },
      )
      .orderBy('RANDOM()')
      .limit(limit);

    const rows = await qb.getRawMany<Record<string, unknown>>();
    return rows.map(this.mapRow);
  }

  /**
   * Admin product list — returns ALL products regardless of status.
   * Supports the same filter/sort/pagination API as findAll but ignores the
   * default status='approved' guard.
   */
  async adminFindAll(
    filters: ProductFiltersDto & { status?: string } = {},
  ): Promise<ProductListResult> {
    return this.findAll({
      ...filters,
      status: filters.status ?? 'all',
    });
  }

  // ===========================================================================
  // READ — AGGREGATES
  // ===========================================================================

  /**
   * Returns approved-product counts broken down by status for the admin
   * dashboard stats cards.
   */
  async getStats(): Promise<ProductStats> {
    const [total, approved, pending, rejected] = await Promise.all([
      this.count(),
      this.count({ status: 'approved' }),
      this.count({ status: 'pending' }),
      this.count({ status: 'rejected' }),
    ]);
    return { total, approved, pending, rejected };
  }

  /**
   * Returns approved reviews for a product, enriched with the reviewer's
   * name and avatar so the product show page can render them inline.
   */
  async getReviews(productId: number): Promise<ReviewRow[]> {
    const rows = await this.reviewRepo
      .createQueryBuilder('rv')
      .select('rv.id',            'id')
      .addSelect('rv.user_id',    'user_id')
      .addSelect('rv.product_id', 'product_id')
      .addSelect('rv.rating',     'rating')
      .addSelect('rv.title',      'title')
      .addSelect('rv.comment',    'comment')
      .addSelect('rv.helpful_count', 'helpful_count')
      .addSelect('rv.is_approved', 'is_approved')
      .addSelect('rv.created_at', 'created_at')
      .addSelect('u.name',        'reviewer_name')
      .addSelect('u.avatar',      'reviewer_avatar')
      .leftJoin('users', 'u', 'u.id = rv.user_id')
      .where('rv.product_id = :productId', { productId })
      .andWhere('rv.is_approved = 1')
      .orderBy('rv.created_at', 'DESC')
      .getRawMany<Record<string, unknown>>();

    return rows.map((r) => ({
      id:             Number(r['id']),
      user_id:        Number(r['user_id']),
      product_id:     Number(r['product_id']),
      rating:         Number(r['rating']),
      title:          r['title'] != null ? String(r['title']) : null,
      comment:        r['comment'] != null ? String(r['comment']) : null,
      helpful_count:  Number(r['helpful_count'] ?? 0),
      is_approved:    Number(r['is_approved'] ?? 1),
      created_at:     r['created_at'] ? new Date(String(r['created_at'])) : new Date(),
      reviewer_name:  String(r['reviewer_name'] ?? 'Anonymous'),
      reviewer_avatar: r['reviewer_avatar'] != null ? String(r['reviewer_avatar']) : null,
    }));
  }

  /**
   * Returns average rating and total review count for a product.
   */
  async getRatingStats(productId: number): Promise<RatingStats> {
    const row = await this.reviewRepo
      .createQueryBuilder('rv')
      .select('AVG(rv.rating)', 'avg_rating')
      .addSelect('COUNT(rv.id)', 'review_count')
      .where('rv.product_id = :productId', { productId })
      .andWhere('rv.is_approved = 1')
      .getRawOne<Record<string, unknown>>();

    return {
      avg_rating:   row?.['avg_rating'] != null ? parseFloat(String(row['avg_rating'])) : 0,
      review_count: row?.['review_count'] != null ? parseInt(String(row['review_count']), 10) : 0,
    };
  }

  /**
   * Returns per-star rating counts and percentages for the review histogram
   * on the product show page.
   */
  async getRatingDistribution(productId: number): Promise<RatingDistribution[]> {
    const totalResult = await this.reviewRepo
      .createQueryBuilder('rv')
      .select('COUNT(rv.id)', 'total')
      .where('rv.product_id = :productId', { productId })
      .andWhere('rv.is_approved = 1')
      .getRawOne<{ total: string }>();

    const total = parseInt(totalResult?.total ?? '0', 10);

    const rows = await this.reviewRepo
      .createQueryBuilder('rv')
      .select('rv.rating', 'star')
      .addSelect('COUNT(rv.id)', 'count')
      .where('rv.product_id = :productId', { productId })
      .andWhere('rv.is_approved = 1')
      .groupBy('rv.rating')
      .getRawMany<{ star: string; count: string }>();

    // Build full 1-5 distribution (fill zeros for missing stars)
    const map = new Map<number, number>();
    for (const r of rows) {
      map.set(Number(r.star), parseInt(r.count, 10));
    }

    return [5, 4, 3, 2, 1].map((star) => {
      const count = map.get(star) ?? 0;
      return {
        star,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      };
    });
  }

  /**
   * Returns the full artisan profile row (with the artisan's user name and
   * avatar joined in) for the product show page's "Artisan Spotlight" section.
   */
  async getArtisanProfile(userId: number): Promise<ArtisanRow | null> {
    const row = await this.artisanProfileRepo
      .createQueryBuilder('ap')
      .select('ap.user_id',       'user_id')
      .addSelect('ap.shop_name',  'shop_name')
      .addSelect('ap.bio',        'bio')
      .addSelect('ap.logo',       'logo')
      .addSelect('ap.profile_image', 'profile_image')
      .addSelect('ap.banner_image',  'banner_image')
      .addSelect('ap.location',   'location')
      .addSelect('ap.phone',      'phone')
      .addSelect('ap.instagram',  'instagram')
      .addSelect('ap.facebook',   'facebook')
      .addSelect('ap.twitter',    'twitter')
      .addSelect('ap.website',    'website')
      .addSelect('ap.return_policy', 'return_policy')
      .addSelect('ap.is_approved',   'is_approved')
      .addSelect('u.name',        'artisan_name')
      .addSelect('u.avatar',      'artisan_avatar')
      .leftJoin('users', 'u', 'u.id = ap.user_id')
      .where('ap.user_id = :userId', { userId })
      .getRawOne<Record<string, unknown>>();

    if (!row) return null;

    return {
      user_id:        Number(row['user_id']),
      shop_name:      String(row['shop_name'] ?? ''),
      bio:            row['bio'] != null ? String(row['bio']) : null,
      logo:           row['logo'] != null ? String(row['logo']) : null,
      profile_image:  row['profile_image'] != null ? String(row['profile_image']) : null,
      banner_image:   row['banner_image'] != null ? String(row['banner_image']) : null,
      location:       row['location'] != null ? String(row['location']) : null,
      phone:          row['phone'] != null ? String(row['phone']) : null,
      instagram:      row['instagram'] != null ? String(row['instagram']) : null,
      facebook:       row['facebook'] != null ? String(row['facebook']) : null,
      twitter:        row['twitter'] != null ? String(row['twitter']) : null,
      website:        row['website'] != null ? String(row['website']) : null,
      return_policy:  row['return_policy'] != null ? String(row['return_policy']) : null,
      is_approved:    Number(row['is_approved'] ?? 0),
      artisan_name:   String(row['artisan_name'] ?? ''),
      artisan_avatar: row['artisan_avatar'] != null ? String(row['artisan_avatar']) : null,
    };
  }

  /**
   * Returns true when the given product is in the specified user's wishlist.
   */
  async isInWishlist(userId: number, productId: number): Promise<boolean> {
    const count = await this.wishlistRepo.count({
      where: { user_id: userId, product_id: productId },
    });
    return count > 0;
  }

  /**
   * Returns the quantity of a product in the user's (or guest session's) cart.
   * Used to calculate `availableStock = product.stock - cartQty`.
   */
  async getCartQty(
    userId: number | null,
    sessionId: string | null,
    productId: number,
  ): Promise<number> {
    const qb = this.cartItemRepo
      .createQueryBuilder('ci')
      .select('SUM(ci.quantity)', 'qty')
      .where('ci.product_id = :productId', { productId });

    if (userId) {
      qb.andWhere('ci.user_id = :userId', { userId });
    } else if (sessionId) {
      qb.andWhere('ci.session_id = :sessionId', { sessionId });
    } else {
      return 0;
    }

    const result = await qb.getRawOne<{ qty: string | null }>();
    return parseInt(result?.qty ?? '0', 10) || 0;
  }

  // ===========================================================================
  // WRITE
  // ===========================================================================

  /**
   * Creates a new product with status='pending' (requires admin approval).
   */
  async create(data: Partial<Product> & { artisan_id: number; name: string; price: number }): Promise<ProductRow> {
    const product = this.productRepo.create({
      artisan_id:   data.artisan_id,
      category_id:  data.category_id ?? null,
      name:         data.name,
      description:  data.description ?? '',
      price:        data.price,
      compare_price: data.compare_price ?? null,
      stock:        data.stock ?? 0,
      images:       data.images ?? '[]',
      tags:         data.tags ?? null,
      weight:       data.weight ?? null,
      length_cm:    data.length_cm ?? null,
      width_cm:     data.width_cm ?? null,
      height_cm:    data.height_cm ?? null,
      featured:     data.featured ?? 0,
      status:       'pending',  // always starts pending
      is_active:    1,
    });

    const saved = await this.productRepo.save(product);
    this.logger.log(`Product created: id=${saved.id} artisan=${saved.artisan_id} name="${saved.name}"`);

    return (await this.findById(saved.id))!;
  }

  /**
   * Partially updates a product.  Only fields present in `data` are written;
   * omitted fields retain their current values.
   *
   * @throws NotFoundException when the product does not exist
   */
  async update(id: number, data: Partial<Product>): Promise<ProductRow> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }

    const ALLOWED: Array<keyof Product> = [
      'name', 'description', 'price', 'compare_price', 'stock',
      'images', 'category_id', 'status', 'featured', 'is_active',
      'weight', 'tags', 'length_cm', 'width_cm', 'height_cm',
    ];

    for (const key of ALLOWED) {
      if (key in data && data[key] !== undefined) {
        (product as unknown as Record<string, unknown>)[key] = data[key] as unknown;
      }
    }

    await this.productRepo.save(product);
    this.logger.log(`Product updated: id=${id}`);

    return (await this.findById(id))!;
  }

  /**
   * Hard-deletes a product by ID.
   *
   * @throws NotFoundException when the product does not exist
   */
  async delete(id: number): Promise<void> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }
    await this.productRepo.delete(id);
    this.logger.log(`Product deleted: id=${id}`);
  }

  // ===========================================================================
  // STOCK & VIEW MUTATIONS
  // ===========================================================================

  /**
   * Atomically increments the view counter.  Fire-and-forget — errors are
   * swallowed so a DB hiccup never breaks the product page render.
   */
  async incrementViews(id: number): Promise<void> {
    try {
      await this.productRepo
        .createQueryBuilder()
        .update(Product)
        .set({ views: () => 'views + 1' })
        .where('id = :id', { id })
        .execute();
    } catch (err) {
      this.logger.warn(`incrementViews failed for product ${id}: ${(err as Error).message}`);
    }
  }

  /**
   * Decreases stock by `quantity` only when sufficient stock exists.
   * Used by the checkout flow to prevent overselling.
   *
   * @throws BadRequestException (via the caller) when stock is insufficient —
   *   the query silently no-ops so callers should check the updated row.
   */
  async decreaseStock(id: number, quantity: number): Promise<void> {
    await this.productRepo
      .createQueryBuilder()
      .update(Product)
      .set({ stock: () => `stock - ${quantity}` })
      .where('id = :id AND stock >= :quantity', { id, quantity })
      .execute();
  }

  /**
   * Increases stock by `quantity`.  Used for order cancellations / restocks.
   */
  async increaseStock(id: number, quantity: number): Promise<void> {
    await this.productRepo
      .createQueryBuilder()
      .update(Product)
      .set({ stock: () => `stock + ${quantity}` })
      .where('id = :id', { id })
      .execute();
  }

  // ===========================================================================
  // UTILITIES
  // ===========================================================================

  /**
   * Parses the JSON `images` column into a string array and attaches it as
   * `product.imageArray`.  Falls back to ['/images/placeholder-product.svg']
   * so templates never receive an empty array.
   */
  parseImages(product: ProductRow): ProductRow {
    let imageArray: string[] = [];
    try {
      imageArray = JSON.parse(product.images ?? '[]');
      if (!Array.isArray(imageArray)) imageArray = [];
    } catch {
      imageArray = [];
    }
    if (imageArray.length === 0) {
      imageArray = ['/images/placeholder-product.svg'];
    }
    return { ...product, imageArray };
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  private applySort(
    qb: SelectQueryBuilder<Product>,
    sort: string,
  ): void {
    const config = SORT_MAP[sort] ?? SORT_MAP['newest'];
    qb.orderBy(config.column, config.direction);
    for (const extra of config.extra ?? []) {
      qb.addOrderBy(extra.column, extra.direction);
    }
  }

  private buildPagination(current: number, total: number): Pagination {
    // Sliding window of up to 5 page numbers centred around current page
    const delta = 2;
    const start = Math.max(1, current - delta);
    const end   = Math.min(total, current + delta);
    const pages: number[] = [];
    for (let i = start; i <= end; i++) pages.push(i);

    return {
      current,
      total,
      hasNext:  current < total,
      hasPrev:  current > 1,
      pages,
    };
  }

  /** Maps a getRawMany() row to a typed ProductRow. */
  private mapRow = (row: Record<string, unknown>): ProductRow => ({
    id:             Number(row['id']),
    artisan_id:     Number(row['artisan_id']),
    category_id:    row['category_id'] != null ? Number(row['category_id']) : null,
    name:           String(row['name'] ?? ''),
    description:    String(row['description'] ?? ''),
    price:          parseFloat(String(row['price'] ?? '0')),
    compare_price:  row['compare_price'] != null ? parseFloat(String(row['compare_price'])) : null,
    stock:          Number(row['stock'] ?? 0),
    images:         row['images'] != null ? String(row['images']) : null,
    tags:           row['tags'] != null ? String(row['tags']) : null,
    weight:         row['weight'] != null ? parseFloat(String(row['weight'])) : null,
    length_cm:      row['length_cm'] != null ? parseFloat(String(row['length_cm'])) : null,
    width_cm:       row['width_cm'] != null ? parseFloat(String(row['width_cm'])) : null,
    height_cm:      row['height_cm'] != null ? parseFloat(String(row['height_cm'])) : null,
    featured:       Number(row['featured'] ?? 0),
    status:         String(row['status'] ?? 'pending'),
    is_active:      Number(row['is_active'] ?? 1),
    views:          Number(row['views'] ?? 0),
    created_at:     row['created_at'] ? new Date(String(row['created_at'])) : new Date(),
    updated_at:     row['updated_at'] ? new Date(String(row['updated_at'])) : new Date(),
    category_name:  row['category_name'] != null ? String(row['category_name']) : null,
    artisan_name:   row['artisan_name'] != null ? String(row['artisan_name']) : null,
    shop_name:      row['shop_name'] != null ? String(row['shop_name']) : null,
    artisan_avatar: row['artisan_avatar'] != null ? String(row['artisan_avatar']) : null,
    artisan_profile_image: row['artisan_profile_image'] != null ? String(row['artisan_profile_image']) : null,
    avg_rating:     row['avg_rating'] != null ? parseFloat(String(row['avg_rating'])) : null,
    review_count:   Number(row['review_count'] ?? 0),
  });
}
