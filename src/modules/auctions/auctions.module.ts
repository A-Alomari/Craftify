import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Auction }        from '../../database/entities/auction.entity';
import { Bid }            from '../../database/entities/bid.entity';
import { Product }        from '../../database/entities/product.entity';
import { Category }       from '../../database/entities/category.entity';
import { User }           from '../../database/entities/user.entity';
import { ArtisanProfile } from '../../database/entities/artisan-profile.entity';
import { Notification }   from '../../database/entities/notification.entity';

import { AuctionsService }    from './auctions.service';
import { AuctionsController } from './auctions.controller';

/**
 * AuctionsModule
 *
 * Encapsulates all auction-related concerns:
 *   - AuctionsService  : business logic, raw SQL queries via DataSource
 *   - AuctionsController: HTTP routes for /auctions/*
 *
 * TypeOrmModule.forFeature registers repositories for the entities used
 * by AuctionsService.  DataSource is provided automatically by the root
 * TypeOrmModule registered in AppModule.
 *
 * AuctionsService is exported so GatewaysModule (and any other module that
 * needs to call placeBid, endExpiredAndActivatePending, etc.) can inject it
 * without re-importing this module's TypeORM feature slice.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Auction,
      Bid,
      Product,
      Category,
      User,
      ArtisanProfile,
      Notification,
    ]),
  ],
  controllers: [AuctionsController],
  providers:   [AuctionsService],
  exports:     [AuctionsService],
})
export class AuctionsModule {}
