import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CartItem } from '../../database/entities/cart-item.entity';
import { Product } from '../../database/entities/product.entity';
import { Coupon } from '../../database/entities/coupon.entity';

import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { CouponsModule } from '../coupons/coupons.module';

/**
 * CartModule
 *
 * Manages the shopping cart for both authenticated users (user_id)
 * and guest visitors (session_id).
 *
 * Imports:
 *   TypeOrmModule — CartItem, Product, Coupon repositories
 *   CouponsModule — re-uses CouponsService for coupon validation
 *
 * Exports:
 *   CartService — consumed by OrdersModule for checkout and by
 *                 main.ts middleware for the cart badge count.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([CartItem, Product, Coupon]),
    CouponsModule,
  ],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
