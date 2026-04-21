import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Category } from '../../database/entities/category.entity';
import { Product } from '../../database/entities/product.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

// ---------------------------------------------------------------------------
// Shape returned by getWithProductCount / findAll
// ---------------------------------------------------------------------------
export interface CategoryWithCount extends Category {
  product_count: number;
}

/**
 * CategoriesService
 *
 * All category data access for both public storefront views and the admin
 * dashboard.  Uses TypeORM QueryBuilder so complex subqueries (product count
 * per category) can be expressed cleanly without raw SQL strings scattered
 * across controllers.
 */
@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  // ===========================================================================
  // INTERNAL HELPERS
  // ===========================================================================

  /**
   * Auto-generates a URL-safe slug from a display name.
   *
   *   "Ceramic Pottery" → "ceramic-pottery"
   *   "Handmade & Knit!" → "handmade-knit"
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  /**
   * Shared QueryBuilder that selects all category columns plus the
   * approved-product count subquery.  Callers may further chain
   * .where() / .orderBy() / etc. before calling .getRawMany() or .getRawOne().
   */
  private baseQb() {
    return this.categoryRepo
      .createQueryBuilder('c')
      .select('c.id', 'id')
      .addSelect('c.name', 'name')
      .addSelect('c.slug', 'slug')
      .addSelect('c.description', 'description')
      .addSelect('c.image', 'image')
      .addSelect('c.parent_id', 'parent_id')
      .addSelect('c.is_active', 'is_active')
      .addSelect('c.created_at', 'created_at')
      .addSelect(
        "(SELECT COUNT(p.id) FROM products p WHERE p.category_id = c.id AND p.status = 'approved')",
        'product_count',
      );
  }

  // ===========================================================================
  // READ
  // ===========================================================================

  /**
   * Returns all active categories, sorted alphabetically by name.
   *
   * @param includeEmpty  When false, categories with zero approved products
   *                      are excluded (useful for the public storefront filter
   *                      sidebar so customers don't see empty options).
   */
  async findAll(includeEmpty = true): Promise<CategoryWithCount[]> {
    const qb = this.baseQb().where('c.is_active = :active', { active: 1 });

    if (!includeEmpty) {
      qb.andWhere(
        "(SELECT COUNT(p.id) FROM products p WHERE p.category_id = c.id AND p.status = 'approved') > 0",
      );
    }

    qb.orderBy('c.name', 'ASC');

    const rows = await qb.getRawMany<Record<string, unknown>>();
    return rows.map(this.mapRow);
  }

  /**
   * Finds a single category by its primary key.
   * Returns null (not throws) so callers can decide how to handle missing items.
   */
  async findById(id: number): Promise<CategoryWithCount | null> {
    const row = await this.baseQb()
      .where('c.id = :id', { id })
      .getRawOne<Record<string, unknown>>();

    return row ? this.mapRow(row) : null;
  }

  /**
   * Finds a single category by its slug.
   * Returns null when not found.
   */
  async findBySlug(slug: string): Promise<CategoryWithCount | null> {
    const row = await this.baseQb()
      .where('c.slug = :slug', { slug })
      .getRawOne<Record<string, unknown>>();

    return row ? this.mapRow(row) : null;
  }

  /**
   * Total count of ALL categories (active + inactive).
   * Used by admin dashboard stats.
   */
  async count(): Promise<number> {
    return this.categoryRepo.count();
  }

  /**
   * Returns every active category with its approved-product count.
   * Alias that mirrors findAll(true) but makes the intent explicit when called
   * from admin contexts that always want counts included.
   */
  async getWithProductCount(): Promise<CategoryWithCount[]> {
    return this.findAll(true);
  }

  // ===========================================================================
  // WRITE
  // ===========================================================================

  /**
   * Creates a new category.
   *
   * Slug is auto-generated from `name` when not provided.  Uniqueness is
   * enforced at DB level (unique index on categories.slug) — a ConflictException
   * is thrown on collision so the controller can flash a friendly message.
   */
  async create(data: CreateCategoryDto): Promise<CategoryWithCount> {
    const slug = data.slug ?? this.generateSlug(data.name);

    // Guard against slug collisions before hitting the DB constraint
    const existing = await this.categoryRepo.findOne({ where: { slug } });
    if (existing) {
      throw new ConflictException(
        `A category with slug "${slug}" already exists. Please choose a different name or provide a unique slug.`,
      );
    }

    const category = this.categoryRepo.create({
      name: data.name,
      slug,
      description: data.description ?? null,
      image: data.image ?? null,
      parent_id: data.parent_id ?? null,
      is_active: data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1,
    });

    const saved = await this.categoryRepo.save(category);

    this.logger.log(`Category created: id=${saved.id} slug="${saved.slug}"`);

    // Re-fetch with product_count subquery so the returned shape is consistent
    return (await this.findById(saved.id))!;
  }

  /**
   * Updates an existing category.
   *
   * When `name` changes and no explicit `slug` is provided, a new slug is
   * NOT auto-regenerated — this avoids breaking existing URLs.  Pass an
   * explicit `slug` in the DTO to rename it intentionally.
   *
   * @throws NotFoundException  when category does not exist
   * @throws ConflictException  when the new slug collides with another row
   */
  async update(id: number, data: UpdateCategoryDto): Promise<CategoryWithCount> {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category #${id} not found`);
    }

    // Slug uniqueness check only when slug is explicitly being changed
    if (data.slug && data.slug !== category.slug) {
      const collision = await this.categoryRepo.findOne({
        where: { slug: data.slug },
      });
      if (collision) {
        throw new ConflictException(
          `A category with slug "${data.slug}" already exists.`,
        );
      }
    }

    // Apply only the fields present in the DTO
    if (data.name !== undefined) category.name = data.name;
    if (data.slug !== undefined) category.slug = data.slug;
    if (data.description !== undefined) category.description = data.description ?? null;
    if (data.image !== undefined) category.image = data.image ?? null;
    if (data.parent_id !== undefined) category.parent_id = data.parent_id ?? null;
    if (data.is_active !== undefined) category.is_active = data.is_active ? 1 : 0;

    await this.categoryRepo.save(category);

    this.logger.log(`Category updated: id=${id}`);

    return (await this.findById(id))!;
  }

  /**
   * Deletes a category by ID.
   *
   * Refuses deletion when the category has any assigned products (approved
   * or otherwise) so orphaned product rows are never created.
   *
   * @throws NotFoundException   when category does not exist
   * @throws BadRequestException when category still has products
   */
  async delete(id: number): Promise<void> {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category #${id} not found`);
    }

    const productCount = await this.productRepo.count({
      where: { category_id: id },
    });

    if (productCount > 0) {
      throw new BadRequestException(
        `Cannot delete category "${category.name}" — it has ${productCount} product(s) assigned to it. ` +
          'Reassign or delete those products first.',
      );
    }

    await this.categoryRepo.delete(id);
    this.logger.log(`Category deleted: id=${id} slug="${category.slug}"`);
  }

  // ===========================================================================
  // PRIVATE MAPPING
  // ===========================================================================

  /**
   * Maps a raw QueryBuilder row (all strings) back to a typed CategoryWithCount
   * object.  TypeORM's getRawMany() returns everything as strings from SQLite,
   * so numeric fields must be parsed explicitly.
   */
  private mapRow(row: Record<string, unknown>): CategoryWithCount {
    return {
      id: Number(row['id']),
      name: String(row['name'] ?? ''),
      slug: String(row['slug'] ?? ''),
      description: row['description'] != null ? String(row['description']) : null,
      image: row['image'] != null ? String(row['image']) : null,
      parent_id: row['parent_id'] != null ? Number(row['parent_id']) : null,
      is_active: Number(row['is_active'] ?? 1),
      created_at: row['created_at'] ? new Date(String(row['created_at'])) : new Date(),
      product_count: Number(row['product_count'] ?? 0),
      // Relation fields are not loaded via raw query — set to safe defaults
      parent: null,
      children: [],
      products: [],
    } as CategoryWithCount;
  }
}
