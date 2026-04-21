import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Notification } from '../../database/entities/notification.entity';

export interface NotificationPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export interface NotificationResult {
  notifications: Notification[];
  pagination: NotificationPagination;
}

export interface CreateNotificationData {
  userId: number;
  type: string;
  title: string;
  message: string;
  link?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  // ---------------------------------------------------------------------------
  // findByUserId — paginated
  // ---------------------------------------------------------------------------

  async findByUserId(
    userId: number,
    page = 1,
    limit = 20,
  ): Promise<NotificationResult> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [notifications, total] = await this.notificationRepo.findAndCount({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      skip,
      take: safeLimit,
    });

    const totalPages = Math.ceil(total / safeLimit);

    return {
      notifications,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
        hasPrev: safePage > 1,
        hasNext: safePage < totalPages,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  async create(data: CreateNotificationData): Promise<Notification> {
    const notification = this.notificationRepo.create({
      user_id: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      link: data.link ?? null,
      is_read: 0,
    });
    return this.notificationRepo.save(notification);
  }

  // ---------------------------------------------------------------------------
  // markAsRead
  // ---------------------------------------------------------------------------

  async markAsRead(id: number, userId: number): Promise<void> {
    await this.notificationRepo.update(
      { id, user_id: userId },
      { is_read: 1 },
    );
  }

  // ---------------------------------------------------------------------------
  // markAllAsRead
  // ---------------------------------------------------------------------------

  async markAllAsRead(userId: number): Promise<void> {
    await this.notificationRepo.update({ user_id: userId }, { is_read: 1 });
  }

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------

  async delete(id: number, userId: number): Promise<void> {
    await this.notificationRepo.delete({ id, user_id: userId });
  }

  // ---------------------------------------------------------------------------
  // getUnreadCount
  // ---------------------------------------------------------------------------

  async getUnreadCount(userId: number): Promise<number> {
    return this.notificationRepo.count({
      where: { user_id: userId, is_read: 0 },
    });
  }

  // ---------------------------------------------------------------------------
  // Convenience notification methods
  // ---------------------------------------------------------------------------

  async notifyOrderPlaced(userId: number, orderId: number): Promise<void> {
    await this.create({
      userId,
      type: 'order',
      title: 'Order Placed',
      message: `Your order #${orderId} has been placed successfully.`,
      link: `/orders/${orderId}`,
    });
  }

  async notifyNewOrderForArtisan(
    artisanId: number,
    orderId: number,
  ): Promise<void> {
    await this.create({
      userId: artisanId,
      type: 'order',
      title: 'New Order Received',
      message: `You have received a new order #${orderId}.`,
      link: `/artisan/orders/${orderId}`,
    });
  }

  async notifyAuctionOutbid(
    userId: number,
    auctionId: number,
    auctionTitle: string,
  ): Promise<void> {
    await this.create({
      userId,
      type: 'auction',
      title: 'You have been outbid',
      message: `Someone placed a higher bid on "${auctionTitle}". Bid again to stay in the lead.`,
      link: `/auctions/${auctionId}`,
    });
  }

  async notifyOrderStatusChange(
    userId: number,
    orderId: number,
    status: string,
  ): Promise<void> {
    const statusLabels: Record<string, string> = {
      processing: 'is being processed',
      shipped: 'has been shipped',
      delivered: 'has been delivered',
      cancelled: 'has been cancelled',
    };
    const label = statusLabels[status] ?? `status changed to ${status}`;

    await this.create({
      userId,
      type: 'order',
      title: 'Order Update',
      message: `Your order #${orderId} ${label}.`,
      link: `/orders/${orderId}`,
    });
  }
}
