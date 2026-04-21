import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Product } from '../../database/entities/product.entity';
import { CartItem } from '../../database/entities/cart-item.entity';
import { Notification } from '../../database/entities/notification.entity';
import { Wishlist } from '../../database/entities/wishlist.entity';
import { Auction } from '../../database/entities/auction.entity';
import { Coupon } from '../../database/entities/coupon.entity';

import { ApiController } from './api.controller';

/**
 * ApiModule
 *
 * Owns all /api/* JSON endpoints consumed by the front-end AJAX code and
 * any future mobile clients.  No authentication guards are applied at the
 * controller level — individual endpoints return sensible defaults for
 * unauthenticated callers (empty lists, inWishlist: false, etc.).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      CartItem,
      Notification,
      Wishlist,
      Auction,
      Coupon,
    ]),
  ],
  controllers: [ApiController],
})
export class ApiModule {}
