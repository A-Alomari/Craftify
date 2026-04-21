import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Product }        from '../../database/entities/product.entity';
import { Category }       from '../../database/entities/category.entity';
import { CartItem }       from '../../database/entities/cart-item.entity';
import { Wishlist }       from '../../database/entities/wishlist.entity';
import { Review }         from '../../database/entities/review.entity';
import { ArtisanProfile } from '../../database/entities/artisan-profile.entity';
import { User }           from '../../database/entities/user.entity';

import { ProductsService }    from './products.service';
import { ProductsController } from './products.controller';

import { CategoriesModule } from '../categories/categories.module';

/**
 * ProductsModule
 *
 * Encapsulates the public product catalogue: browsing, filtering, detail
 * pages, and all supporting data (reviews, wishlist, cart quantities, artisan
 * profile spotlights).
 *
 * Repositories registered (via TypeOrmModule.forFeature):
 *   Product        — main product CRUD and query logic
 *   Category       — category name lookups and sidebar filter list
 *   CartItem       — used to compute availableStock = stock − cartQty
 *   Wishlist       — per-user wishlist membership checks
 *   Review         — product reviews, rating stats, distribution
 *   ArtisanProfile — artisan spotlight section on product show page
 *   User           — joined into artisan/review queries for names & avatars
 *
 * Imports:
 *   CategoriesModule — re-exports CategoriesService so ProductsController can
 *                      fetch the categories list for the filter sidebar without
 *                      duplicating repository setup
 *
 * Exports:
 *   ProductsService — re-exported so ArtisanModule, AdminModule, HomeModule,
 *                     CartModule, OrdersModule, and ApiModule can inject it
 *                     without re-declaring repositories
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      Category,
      CartItem,
      Wishlist,
      Review,
      ArtisanProfile,
      User,
    ]),
    CategoriesModule,
  ],
  controllers: [ProductsController],
  providers:   [ProductsService],
  exports:     [ProductsService],
})
export class ProductsModule {}
