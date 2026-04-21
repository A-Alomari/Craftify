import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { User } from '../../database/entities/user.entity';
import { ArtisanProfile } from '../../database/entities/artisan-profile.entity';
import { CartItem } from '../../database/entities/cart-item.entity';
import { Product } from '../../database/entities/product.entity';
import { Review } from '../../database/entities/review.entity';

// Sub-modules (each declares its own controller + service)
import { WishlistModule } from '../wishlist/wishlist.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MessagesModule } from '../messages/messages.module';

// Core user service + controller
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

/**
 * UsersModule — umbrella module for all user-facing features:
 *
 *   - User profile (view, edit, change password, avatar upload)
 *   - Public artisan profile page
 *   - Wishlist     (/user/wishlist/*)        — WishlistModule
 *   - Reviews      (/user/reviews/*)          — ReviewsModule
 *   - Notifications (/user/notifications/*)   — NotificationsModule
 *   - Messages      (/user/messages/*)        — MessagesModule
 *
 * Importing UsersModule into AppModule automatically registers all sub-module
 * routes and makes their services available for injection by other modules via
 * the re-exported sub-modules.
 */
@Module({
  imports: [
    // Repositories needed directly by UsersService (User/ArtisanProfile/Product/Review)
    TypeOrmModule.forFeature([User, ArtisanProfile, CartItem, Product, Review]),

    // Sub-feature modules — their controllers register their own /user/* routes
    WishlistModule,
    ReviewsModule,
    NotificationsModule,
    MessagesModule,
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [
    // UsersService is directly provided by this module
    UsersService,
    // Re-export sub-modules so callers of UsersModule can inject their services
    // (e.g. OrdersModule can inject NotificationsService without importing NotificationsModule)
    WishlistModule,
    ReviewsModule,
    NotificationsModule,
    MessagesModule,
  ],
})
export class UsersModule {}
