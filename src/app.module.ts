import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { MailerModule } from '@nestjs-modules/mailer';

import { DatabaseConfig } from './config/database.config';
import { getMailerConfig } from './config/mail.config';

// ---------------------------------------------------------------------------
// Feature modules
// Each module encapsulates its own controllers, services, and repository logic.
// They are created incrementally during the Express → NestJS migration;
// comment out any module that has not been scaffolded yet.
// ---------------------------------------------------------------------------

// Authentication & users
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ArtisanProfilesModule } from './modules/artisan-profiles/artisan-profiles.module';

// Shop
import { ProductsModule } from './modules/products/products.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
import { CouponsModule } from './modules/coupons/coupons.module';

// Auctions
import { AuctionsModule }  from './modules/auctions/auctions.module';

// Real-time gateways + background tasks
import { GatewaysModule }  from './gateways/gateways.module';

// Dashboards
import { ArtisanModule } from './modules/artisan/artisan.module';
import { AdminModule } from './modules/admin/admin.module';

// Public-facing pages
import { HomeModule } from './modules/home/home.module';

// REST API (JSON endpoints consumed by AJAX + mobile)
import { ApiModule } from './modules/api/api.module';

/**
 * AppModule
 *
 * Root module for the Craftify NestJS application.
 *
 * Infrastructure modules registered here:
 *   - ConfigModule  : loads .env and makes ConfigService globally injectable
 *   - TypeOrmModule : better-sqlite3 database via DatabaseConfig factory class
 *   - ScheduleModule: @nestjs/schedule task scheduler for background jobs
 *                     (auction expiry, shipment advancement)
 *   - MailerModule  : @nestjs-modules/mailer for transactional emails
 *
 * All feature modules are imported so their providers are available
 * application-wide and their routes are registered with the NestJS router.
 */
@Module({
  imports: [
    // ------------------------------------------------------------------
    // 1. Configuration — must be first so env vars are available to all
    //    other module factories via ConfigService.
    // ------------------------------------------------------------------
    ConfigModule.forRoot({
      isGlobal: true,           // ConfigService injectable everywhere without re-importing ConfigModule
      envFilePath: '.env',      // Root .env file
      expandVariables: true,    // Support ${VAR} references inside .env
      cache: true,              // Cache parsed values for performance
    }),

    // ------------------------------------------------------------------
    // 2. Database — TypeORM with better-sqlite3
    // ------------------------------------------------------------------
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useClass: DatabaseConfig,
    }),

    // ------------------------------------------------------------------
    // 3. Task scheduler (used by AuctionScheduler, ShipmentScheduler)
    // ------------------------------------------------------------------
    ScheduleModule.forRoot(),

    // ------------------------------------------------------------------
    // 4. Mailer
    // ------------------------------------------------------------------
    MailerModule.forRootAsync({
      useFactory: getMailerConfig,
    }),

    // ------------------------------------------------------------------
    // 5. Feature modules
    // ------------------------------------------------------------------

    // Auth / users
    AuthModule,
    UsersModule,
    ArtisanProfilesModule,

    // Shop
    HomeModule,
    ProductsModule,
    CategoriesModule,
    CartModule,
    OrdersModule,
    CouponsModule,

    // Auctions
    AuctionsModule,

    // Real-time gateways + background task scheduler
    GatewaysModule,

    // Dashboards
    ArtisanModule,
    AdminModule,

    // JSON API
    ApiModule,
  ],
})
export class AppModule {}
