import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../../database/entities/user.entity';
import { ArtisanProfile } from '../../database/entities/artisan-profile.entity';
import { Product } from '../../database/entities/product.entity';
import { Order } from '../../database/entities/order.entity';
import { OrderItem } from '../../database/entities/order-item.entity';
import { Auction } from '../../database/entities/auction.entity';
import { Review } from '../../database/entities/review.entity';
import { Coupon } from '../../database/entities/coupon.entity';
import { Notification } from '../../database/entities/notification.entity';
import { Category } from '../../database/entities/category.entity';

import { ArtisanService } from './artisan.service';
import { ArtisanController } from './artisan.controller';

/**
 * ArtisanModule
 *
 * Owns the /artisan/* routes for the artisan dashboard, products, orders,
 * auctions, coupons, reviews, and analytics.
 *
 * Exports ArtisanService so other modules (e.g. AdminModule) can inject it
 * when they need to delegate to artisan-level business logic.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      ArtisanProfile,
      Product,
      Order,
      OrderItem,
      Auction,
      Review,
      Coupon,
      Notification,
      Category,
    ]),
  ],
  controllers: [ArtisanController],
  providers: [ArtisanService],
  exports: [ArtisanService],
})
export class ArtisanModule {}
