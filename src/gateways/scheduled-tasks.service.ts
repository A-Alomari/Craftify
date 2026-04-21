import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';

import { AuctionsService } from '../modules/auctions/auctions.service';
import { AuctionGateway }  from './auction.gateway';
import { Shipment }        from '../database/entities/shipment.entity';

// ---------------------------------------------------------------------------
// Status progression for shipment simulation
// ---------------------------------------------------------------------------

const STATUS_FLOW = [
  'pending',
  'processing',
  'shipped',
  'in_transit',
  'delivered',
] as const;

type ShipmentStatus = (typeof STATUS_FLOW)[number];

const ADVANCE_LOCATIONS = [
  'Manama Sorting Center',
  'Riffa Distribution Hub',
  'Muharraq Warehouse',
  'Isa Town Depot',
  'Hamad Town Facility',
  'Local Delivery Station',
  'Out for Delivery',
] as const;

const randomLocation = (): string =>
  ADVANCE_LOCATIONS[Math.floor(Math.random() * ADVANCE_LOCATIONS.length)];

// ---------------------------------------------------------------------------
// ScheduledTasksService
//
// Runs two periodic cron jobs:
//
//   processAuctions  (every 30 s)
//     — Ends auctions whose end_time has passed.
//     — Activates pending auctions whose start_time has arrived.
//     — Emits 'auctionEnded' Socket.io events to affected rooms.
//
//   advanceShipments (every 60 s)
//     — Randomly advances non-delivered shipments one status step.
//     — Updates the linked order's status when relevant.
//     — Creates a shipment-update notification for the customer.
//
// Both tasks are skipped when RUN_BACKGROUND_TASKS=false so tests and
// staging environments can opt out without modifying code.
// ---------------------------------------------------------------------------

@Injectable()
export class ScheduledTasksService {
  private readonly logger = new Logger(ScheduledTasksService.name);

  constructor(
    private readonly auctionsService: AuctionsService,
    private readonly auctionGateway:  AuctionGateway,
    @InjectRepository(Shipment)
    private readonly shipmentRepo:    Repository<Shipment>,
    private readonly dataSource:      DataSource,
  ) {}

  // -------------------------------------------------------------------------
  // Auction background job — every 30 seconds
  // -------------------------------------------------------------------------

  @Cron('*/30 * * * * *')
  async processAuctions(): Promise<void> {
    if (process.env.RUN_BACKGROUND_TASKS === 'false') return;

    try {
      await this.auctionsService.endExpiredAndActivatePending(
        this.auctionGateway.server,
      );
    } catch (err) {
      this.logger.error(
        `processAuctions cron error: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Shipment simulation job — every 60 seconds
  // -------------------------------------------------------------------------

  @Cron('0 * * * * *')
  async advanceShipments(): Promise<void> {
    if (process.env.RUN_BACKGROUND_TASKS === 'false') return;

    try {
      await this.advanceShipmentStatuses();
    } catch (err) {
      this.logger.error(
        `advanceShipments cron error: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  // -------------------------------------------------------------------------
  // advanceShipmentStatuses
  //
  // Mirrors the logic of the original Express Shipment.advanceAll():
  //   1. Fetch all non-terminal shipments (not 'delivered' or 'failed').
  //   2. For each, roll a random die (>0.7 = advance).
  //   3. Determine the next status from STATUS_FLOW.
  //   4. Update the shipment row (status, history, timestamps).
  //   5. If the new status is 'shipped' or 'delivered', sync the Order status.
  //   6. Create a shipment-update notification for the customer.
  // -------------------------------------------------------------------------

  private async advanceShipmentStatuses(): Promise<void> {
    // Load all active (non-terminal) shipments with their order's user_id
    const shipments = await this.dataSource.query<
      (Shipment & { user_id: number })[]
    >(
      `SELECT s.*, o.user_id
       FROM shipments s
       JOIN orders o ON s.order_id = o.id
       WHERE s.status NOT IN ('delivered', 'failed')`,
    );

    let advancedCount = 0;

    for (const shipment of shipments) {
      // Random advancement — ~30 % chance per tick (matches original >0.7 check)
      if (Math.random() <= 0.7) continue;

      const currentIndex = STATUS_FLOW.indexOf(shipment.status as ShipmentStatus);
      if (currentIndex < 0 || currentIndex >= STATUS_FLOW.length - 1) continue;

      const newStatus = STATUS_FLOW[currentIndex + 1] as ShipmentStatus;
      const now       = new Date().toISOString();
      const location  = randomLocation();

      // Parse existing history
      let history: { status: string; timestamp: string; location: string }[];
      try {
        history = JSON.parse(shipment.history ?? '[]');
      } catch {
        history = [];
      }
      history.push({ status: newStatus, timestamp: now, location });

      // Build the UPDATE statement with optional timestamp columns
      const extraCols: string[]   = [];
      const extraParams: unknown[] = [];

      if (newStatus === 'shipped') {
        extraCols.push('shipped_at = ?');
        extraParams.push(now);
      } else if (newStatus === 'delivered') {
        extraCols.push('delivered_at = ?');
        extraParams.push(now);
      }

      const extraClause = extraCols.length ? `, ${extraCols.join(', ')}` : '';

      await this.dataSource.query(
        `UPDATE shipments
         SET status = ?, history = ?, last_update = ?, updated_at = CURRENT_TIMESTAMP
             ${extraClause}
         WHERE id = ?`,
        [newStatus, JSON.stringify(history), now, ...extraParams, shipment.id],
      );

      // Sync order status when transitioning to shipped or delivered
      if (newStatus === 'shipped' || newStatus === 'delivered') {
        await this.dataSource.query(
          `UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [newStatus, shipment.order_id],
        );
      }

      // Shipment-update notification (deduplicated — remove previous)
      await this.dataSource.query(
        `DELETE FROM notifications
         WHERE user_id = ? AND title = 'Shipment Update' AND link LIKE ?`,
        [shipment.user_id, `/orders/${shipment.order_id}%`],
      );

      await this.dataSource.query(
        `INSERT INTO notifications (user_id, type, title, message, link, is_read, created_at)
         VALUES (?, 'order', 'Shipment Update', ?, ?, 0, datetime('now'))`,
        [
          shipment.user_id,
          `Your order #${shipment.order_id} is now ${newStatus.replace(/_/g, ' ')}`,
          `/orders/${shipment.order_id}/track`,
        ],
      );

      advancedCount++;
    }

    if (advancedCount > 0) {
      this.logger.log(
        `advanceShipmentStatuses: advanced ${advancedCount} shipment(s).`,
      );
    }
  }
}
