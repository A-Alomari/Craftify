import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Category } from '../../database/entities/category.entity';
import { Product } from '../../database/entities/product.entity';

import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';

/**
 * CategoriesModule
 *
 * Encapsulates all category data access for the Craftify application.
 *
 * Repositories registered:
 *   - Category — direct CRUD on the categories table
 *   - Product  — used by CategoriesService to guard against deleting a
 *                category that still has products assigned to it, and to
 *                compute per-category product counts via SQL subqueries
 *
 * Exports:
 *   - CategoriesService — re-exported so that other modules (ProductsModule,
 *                         AdminModule, HomeModule) can inject and use it
 *                         without duplicating the TypeORM repository setup
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Category, Product]),
  ],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
