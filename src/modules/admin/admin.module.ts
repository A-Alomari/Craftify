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
import { Category } from '../../database/entities/category.entity';
import { Shipment } from '../../database/entities/shipment.entity';
import { Notification } from '../../database/entities/notification.entity';

import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

/**
 * AdminModule
 *
 * Owns the /admin/* routes for the admin control panel.
 * Provides AdminService (not exported — admin logic is self-contained).
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
      Category,
      Shipment,
      Notification,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
