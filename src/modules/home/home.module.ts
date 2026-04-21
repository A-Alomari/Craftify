import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NewsletterSubscription } from '../../database/entities/newsletter-subscription.entity';

import { ProductsModule }        from '../products/products.module';
import { CategoriesModule }      from '../categories/categories.module';
import { AuctionsModule }        from '../auctions/auctions.module';
import { ArtisanProfilesModule } from '../artisan-profiles/artisan-profiles.module';
import { HomeController }        from './home.controller';

/**
 * HomeModule
 *
 * Owns all public-facing pages (/, /about, /contact, /artisans, …).
 *
 * Imports:
 *   ProductsModule        — provides ProductsService (getFeatured, getNewArrivals)
 *   CategoriesModule      — provides CategoriesService (findAll)
 *   AuctionsModule        — provides AuctionsService (findAll with status filter)
 *   ArtisanProfilesModule — provides ArtisanProfilesService (findApprovedWithStats)
 *   TypeOrmModule.forFeature([NewsletterSubscription]) — for the /subscribe endpoint
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([NewsletterSubscription]),
    ProductsModule,
    CategoriesModule,
    AuctionsModule,
    ArtisanProfilesModule,
  ],
  controllers: [HomeController],
})
export class HomeModule {}
