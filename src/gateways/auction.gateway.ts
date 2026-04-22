import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

import { AuctionsService } from '../modules/auctions/auctions.service';

// ---------------------------------------------------------------------------
// Rate-limiter configuration (driven by environment variables so tests and
// production can tune limits without code changes)
// ---------------------------------------------------------------------------

const BID_WINDOW_MS       = parseInt(process.env.SOCKET_BID_WINDOW_MS       ?? '60000',  10);
const BID_MAX_PER_WINDOW  = parseInt(process.env.SOCKET_BID_MAX_PER_WINDOW  ?? '12',     10);
const BID_BLOCK_MS        = parseInt(process.env.SOCKET_BID_BLOCK_MS        ?? '30000',  10);

// ---------------------------------------------------------------------------
// Per-user-per-auction rate-limit entry
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  /** Number of bids placed in the current window */
  count:        number;
  /** Timestamp (ms) when the current window started */
  windowStart:  number;
  /** Whether the user is currently blocked */
  blocked:      boolean;
  /** Timestamp (ms) until which the user is blocked */
  blockUntil:   number;
  /** Number of times the user has been blocked (for exponential back-off) */
  strikes:      number;
}

// ---------------------------------------------------------------------------
// AuctionGateway
//
// Handles real-time bidding over Socket.io.
//
// Room conventions:
//   auction-{id}   — broadcast channel for a single auction
//   user-{id}      — private channel for a single authenticated user
//
// Events emitted to clients:
//   bidUpdate      — a new winning bid was placed  (to auction room)
//   bidError       — bid was rejected              (to placing client only)
//   auctionEnded   — auction expired               (to auction room, via service)
//   outbid         — you were outbid               (to previous winner's user room)
// ---------------------------------------------------------------------------

@WebSocketGateway({
  cors:      { origin: '*' },
  namespace: '/',
})
export class AuctionGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AuctionGateway.name);

  /**
   * Rate-limit map: key = `${userId}-${auctionId}` → RateLimitEntry.
   * Stale entries are pruned every 60 seconds.
   */
  private readonly bidRateMap = new Map<string, RateLimitEntry>();

  constructor(private readonly auctionsService: AuctionsService) {
    // Clean up stale rate-limit entries every 60 seconds to prevent memory leaks
    setInterval(() => this.pruneRateMap(), 60_000);
  }

  // -------------------------------------------------------------------------
  // Lifecycle hooks
  // -------------------------------------------------------------------------

  handleConnection(client: Socket): void {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
    // Socket.io automatically removes the client from all rooms on disconnect;
    // no manual cleanup is required.
  }

  // -------------------------------------------------------------------------
  // Room management
  // -------------------------------------------------------------------------

  @SubscribeMessage('joinAuction')
  handleJoinAuction(
    @ConnectedSocket() client: Socket,
    @MessageBody()    auctionId: string,
  ): void {
    const id = parseInt(auctionId, 10);
    if (!Number.isInteger(id) || id <= 0) {
      client.emit('error', { message: 'Invalid auction ID' });
      return;
    }
    const room = `auction-${id}`;
    void client.join(room);
    this.logger.debug(`${client.id} joined ${room}`);
  }

  @SubscribeMessage('leaveAuction')
  handleLeaveAuction(
    @ConnectedSocket() client: Socket,
    @MessageBody()    auctionId: string,
  ): void {
    const id = parseInt(auctionId, 10);
    if (!Number.isInteger(id) || id <= 0) return;
    const room = `auction-${id}`;
    void client.leave(room);
    this.logger.debug(`${client.id} left ${room}`);
  }

  @SubscribeMessage('joinUser')
  handleJoinUser(@ConnectedSocket() client: Socket): void {
    const session = (client.handshake as any).session ?? (client.request as any)?.session;
    const userId  = session?.user?.id ?? session?.passport?.user;
    if (!userId) return;
    const room = `user-${userId}`;
    void client.join(room);
    this.logger.debug(`${client.id} joined personal room ${room}`);
  }

  // -------------------------------------------------------------------------
  // Place bid
  // -------------------------------------------------------------------------

  @SubscribeMessage('placeBid')
  async handlePlaceBid(
    @ConnectedSocket() client: Socket,
    @MessageBody()    data: { auctionId: number; amount: number },
  ): Promise<void> {
    // ---- 1. Validate authentication ----
    const session = (client.handshake as any).session ?? (client.request as any)?.session;
    const user =
      session?.user ??
      (session?.passport?.user
        ? { id: session.passport.user, status: 'active', name: 'User' }
        : null);

    if (!user?.id) {
      client.emit('bidError', { message: 'You must be logged in to place a bid' });
      return;
    }

    // ---- 2. Validate user status ----
    if (user.status !== 'active') {
      client.emit('bidError', { message: 'Your account is not active' });
      return;
    }

    // ---- 3. Validate auctionId ----
    const auctionId = Number(data?.auctionId);
    if (!Number.isInteger(auctionId) || auctionId <= 0) {
      client.emit('bidError', { message: 'Invalid auction ID' });
      return;
    }

    // ---- 4. Validate amount ----
    const amount = Number(data?.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      client.emit('bidError', { message: 'Invalid bid amount' });
      return;
    }

    // ---- 5. Rate limiting ----
    const userId = Number(user.id);
    const rateLimitResult = this.checkRateLimit(userId, auctionId);

    if (!rateLimitResult.allowed) {
      client.emit('bidError', {
        message:    `You are placing bids too quickly. Please wait ${Math.ceil((rateLimitResult.retryAfter ?? 0) / 1000)} seconds.`,
        retryAfter: rateLimitResult.retryAfter,
        rateLimited: true,
      });
      return;
    }

    // ---- 6. Place bid via service ----
    try {
      const result = await this.auctionsService.placeBid(auctionId, userId, amount);

      if (!result.success || !result.bid || !result.auction) {
        client.emit('bidError', { message: result.error ?? 'Failed to place bid' });
        return;
      }

      // ---- 7. Broadcast bid update to auction room ----
      const bidUpdatePayload = {
        auctionId,
        amount:       result.bid.amount,
        currentBid:   result.auction.current_highest_bid,
        bidCount:     (result.auction as any).bid_count,
        bidderId:     userId,
        bidderName:   user.name ?? 'Anonymous',
        bidIncrement: result.auction.bid_increment,
        bidTime:      (result.bid as any).bid_time || result.bid.created_at,
      };

      this.server.to(`auction-${auctionId}`).emit('bidUpdate', bidUpdatePayload);

      // Legacy event for backward-compatible older clients
      this.server.to(`auction-${auctionId}`).emit('new-bid', {
        auctionId,
        amount:     result.bid.amount,
        bidderId:   userId,
        bidderName: user.name ?? 'Anonymous',
        bidTime:    (result.bid as any).bid_time || result.bid.created_at,
        totalBids:  (result.auction as any).bid_count,
      });

      // ---- 8. Notify the previous highest bidder that they were outbid ----
      if (
        result.previousBidderId &&
        result.previousBidderId !== userId
      ) {
        this.server.to(`user-${result.previousBidderId}`).emit('outbid', {
          auctionId,
          newBid: result.bid.amount,
        });
      }
    } catch (err) {
      this.logger.error(
        `handlePlaceBid error (auction=${auctionId}, user=${userId}): ${(err as Error).message}`,
        (err as Error).stack,
      );
      client.emit('bidError', { message: 'An unexpected error occurred. Please try again.' });
    }
  }

  // -------------------------------------------------------------------------
  // Public helpers for use by ScheduledTasksService
  // -------------------------------------------------------------------------

  emitBidUpdate(auctionId: number, data: Record<string, unknown>): void {
    this.server.to(`auction-${auctionId}`).emit('bidUpdate', data);
  }

  emitToUser(userId: number, event: string, data: Record<string, unknown>): void {
    this.server.to(`user-${userId}`).emit(event, data);
  }

  emitAuctionEnded(auctionId: number, data: Record<string, unknown>): void {
    this.server.to(`auction-${auctionId}`).emit('auctionEnded', data);
  }

  // -------------------------------------------------------------------------
  // Rate limiter
  // -------------------------------------------------------------------------

  /**
   * Returns whether the user is allowed to place a bid right now.
   *
   * Algorithm:
   *   - Each (userId, auctionId) pair has a sliding window of BID_WINDOW_MS ms.
   *   - Up to BID_MAX_PER_WINDOW bids are allowed per window.
   *   - On the (MAX+1)th bid the user is blocked for BID_BLOCK_MS ms.
   *   - Each subsequent block doubles the block duration (exponential back-off).
   */
  private checkRateLimit(
    userId:    number,
    auctionId: number,
  ): { allowed: boolean; retryAfter?: number } {
    const key  = `${userId}-${auctionId}`;
    const now  = Date.now();
    let entry  = this.bidRateMap.get(key);

    // Initialise entry on first bid
    if (!entry) {
      entry = {
        count:       0,
        windowStart: now,
        blocked:     false,
        blockUntil:  0,
        strikes:     0,
      };
      this.bidRateMap.set(key, entry);
    }

    // ---- Check block status ----
    if (entry.blocked) {
      if (now < entry.blockUntil) {
        return { allowed: false, retryAfter: entry.blockUntil - now };
      }
      // Block expired — reset for a fresh window
      entry.blocked    = false;
      entry.count      = 0;
      entry.windowStart = now;
    }

    // ---- Slide the window if it has expired ----
    if (now - entry.windowStart >= BID_WINDOW_MS) {
      entry.count      = 0;
      entry.windowStart = now;
    }

    // ---- Increment counter ----
    entry.count += 1;

    // ---- Enforce limit ----
    if (entry.count > BID_MAX_PER_WINDOW) {
      entry.strikes  += 1;
      // Exponential back-off: block duration doubles with each strike (capped at 10 min)
      const blockDuration = Math.min(
        BID_BLOCK_MS * Math.pow(2, entry.strikes - 1),
        600_000,
      );
      entry.blocked    = true;
      entry.blockUntil = now + blockDuration;
      this.bidRateMap.set(key, entry);
      return { allowed: false, retryAfter: blockDuration };
    }

    this.bidRateMap.set(key, entry);
    return { allowed: true };
  }

  /**
   * Remove entries that have been idle for longer than 2 × BID_WINDOW_MS and
   * whose block (if any) has expired.  Called every 60 s.
   */
  private pruneRateMap(): void {
    const now   = Date.now();
    const stale = 2 * BID_WINDOW_MS;

    for (const [key, entry] of this.bidRateMap.entries()) {
      const lastActive = entry.windowStart + BID_WINDOW_MS;
      const blockDone  = !entry.blocked || now >= entry.blockUntil;
      if (now - lastActive > stale && blockDone) {
        this.bidRateMap.delete(key);
      }
    }
  }
}
