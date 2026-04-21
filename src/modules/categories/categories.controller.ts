import { Controller } from '@nestjs/common';
import { CategoriesService } from './categories.service';

/**
 * CategoriesController
 *
 * No public-facing routes are defined here — category browsing is handled
 * entirely within ProductsController (/products?category=:id).
 *
 * Admin CRUD endpoints (list / create / update / delete) live in AdminModule's
 * own controller so they can be guarded with AdminGuard in one place.
 *
 * This controller exists as a structural placeholder and will be extended when
 * a dedicated public category page (e.g. /categories) is required.
 */
@Controller('categories')
export class CategoriesController {
  constructor(
    // CategoriesService is injected here so it can be used if routes are added
    // in future iterations without touching the module wiring.
    readonly categoriesService: CategoriesService,
  ) {}
}
