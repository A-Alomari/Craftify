import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuctionsModule }       from '../modules/auctions/auctions.module';
import { Shipment }             from '../database/entities/shipment.entity';
import { AuctionGateway }       from './auction.gateway';
import { ChatGateway }          from './chat.gateway';
import { ScheduledTasksService } from './scheduled-tasks.service';

/**
 * GatewaysModule
 *
 * Registers all Socket.io gateways and the background-task scheduler.
 *
 * Design notes
 * ─────────────
 * • AuctionsModule is imported so AuctionsService can be injected into both
 *   AuctionGateway (for placeBid / findById) and ScheduledTasksService
 *   (for endExpiredAndActivatePending).
 *
 * • TypeOrmModule.forFeature([Shipment]) gives ScheduledTasksService the
 *   Shipment repository it uses when loading active shipments.  DataSource
 *   is available application-wide from the root TypeOrmModule in AppModule.
 *
 * • Both gateways are exported so other modules (e.g. UsersModule) can
 *   inject ChatGateway.notifyNewMessage() without re-importing GatewaysModule.
 *
 * • GatewaysModule must be imported in AppModule AFTER AuctionsModule so the
 *   DI container can resolve the AuctionsService dependency.
 */
@Module({
  imports: [
    AuctionsModule,
    TypeOrmModule.forFeature([Shipment]),
  ],
  providers: [
    AuctionGateway,
    ChatGateway,
    ScheduledTasksService,
  ],
  exports: [
    AuctionGateway,
    ChatGateway,
  ],
})
export class GatewaysModule {}
