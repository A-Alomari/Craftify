import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Order } from '../../database/entities/order.entity';
import { OrderItem } from '../../database/entities/order-item.entity';
import { Product } from '../../database/entities/product.entity';
import { CartItem } from '../../database/entities/cart-item.entity';
import { Coupon } from '../../database/entities/coupon.entity';
import { Shipment } from '../../database/entities/shipment.entity';
import { Notification } from '../../database/entities/notification.entity';
import { User } from '../../database/entities/user.entity';

import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { CouponsModule } from '../coupons/coupons.module';
import { CartModule } from '../cart/cart.module';

/**
 * OrdersModule
 *
 * Manages the full order lifecycle from checkout through fulfilment.
 *
 * Imports:
 *   TypeOrmModule — repositories for all order-related entities
 *   CouponsModule — CouponsService for coupon application and usage tracking
 *   CartModule    — CartService for cart reads, validation, and post-order clear
 *
 * Exports:
 *   OrdersService — consumed by ArtisanModule (dashboard stats) and
 *                   AdminModule (order management)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      Product,
      CartItem,
      Coupon,
      Shipment,
      Notification,
      User,
    ]),
    CouponsModule,
    CartModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
