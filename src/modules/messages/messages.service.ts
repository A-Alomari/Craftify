import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Message } from '../../database/entities/message.entity';
import { User } from '../../database/entities/user.entity';
import { ArtisanProfile } from '../../database/entities/artisan-profile.entity';

export interface ConversationThread {
  other_user_id: number;
  other_user_name: string;
  other_user_role: string;
  other_user_avatar: string | null;
  shop_name: string | null;
  shop_image: string | null;
  last_message: string;
  last_message_time: string;
  unread_count: number;
}

export interface MessagePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export interface ThreadResult {
  messages: Message[];
  pagination: MessagePagination;
}

export interface CreateMessageData {
  senderId: number;
  receiverId: number;
  content: string;
  imageUrl?: string;
}

// ---------------------------------------------------------------------------
// Simple HTML tag stripper for content sanitisation
// ---------------------------------------------------------------------------
function stripHtml(input: string): string {
  return String(input || '')
    .replace(/<[^>]*>/g, '')   // remove tags
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
}

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ArtisanProfile)
    private readonly artisanProfileRepo: Repository<ArtisanProfile>,
  ) {}

  // ---------------------------------------------------------------------------
  // getConversations — unique conversation threads for the current user
  //
  // Returns one row per "other participant" sorted by most recent message.
  // Uses raw SQL because the CASE WHEN + GROUP BY pattern is easiest expressed
  // that way without losing performance.
  // ---------------------------------------------------------------------------

  async getConversations(userId: number): Promise<ConversationThread[]> {
    const raw: Array<{
      other_user_id: number;
      other_user_name: string;
      other_user_role: string;
      other_user_avatar: string | null;
      shop_name: string | null;
      shop_image: string | null;
      last_message: string;
      last_message_time: string;
      unread_count: number;
    }> = await this.messageRepo.query(
      `
      SELECT
        CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END AS other_user_id,
        u.name   AS other_user_name,
        u.role   AS other_user_role,
        u.avatar AS other_user_avatar,
        ap.shop_name     AS shop_name,
        ap.profile_image AS shop_image,
        last_m.content    AS last_message,
        last_m.created_at AS last_message_time,
        COALESCE(
          SUM(CASE WHEN m.receiver_id = ? AND m.is_read = 0 THEN 1 ELSE 0 END),
          0
        ) AS unread_count
      FROM messages m
      JOIN users u
        ON u.id = CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END
      LEFT JOIN artisan_profiles ap ON ap.user_id = u.id
      JOIN messages last_m
        ON last_m.id = (
          SELECT id FROM messages
          WHERE (sender_id = ? AND receiver_id = u.id)
             OR (receiver_id = ? AND sender_id = u.id)
          ORDER BY created_at DESC
          LIMIT 1
        )
      WHERE m.sender_id = ? OR m.receiver_id = ?
      GROUP BY other_user_id
      ORDER BY last_message_time DESC
      `,
      [userId, userId, userId, userId, userId, userId, userId],
    );

    return raw.map((row) => ({
      other_user_id: Number(row.other_user_id),
      other_user_name: row.other_user_name,
      other_user_role: row.other_user_role,
      other_user_avatar: row.other_user_avatar,
      shop_name: row.shop_name,
      shop_image: row.shop_image,
      last_message: row.last_message,
      last_message_time: row.last_message_time,
      unread_count: Number(row.unread_count),
    }));
  }

  // ---------------------------------------------------------------------------
  // getThread — paginated messages between two users (newest-first for display
  // convenience; views typically reverse to show oldest-first)
  // ---------------------------------------------------------------------------

  async getThread(
    userId: number,
    otherUserId: number,
    page = 1,
    limit = 30,
  ): Promise<ThreadResult> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [messages, total] = await this.messageRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.sender', 'sender')
      .leftJoinAndSelect('m.receiver', 'receiver')
      .where(
        '(m.sender_id = :userId AND m.receiver_id = :otherId) OR (m.sender_id = :otherId AND m.receiver_id = :userId)',
        { userId, otherId: otherUserId },
      )
      .orderBy('m.created_at', 'ASC')
      .skip(skip)
      .take(safeLimit)
      .getManyAndCount();

    // Mark incoming messages as read
    await this.messageRepo.query(
      `UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0`,
      [otherUserId, userId],
    );

    const totalPages = Math.ceil(total / safeLimit);

    return {
      messages,
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
  // create — with role validation and HTML sanitisation
  //
  // Policy (mirrors controllers/userController.js logic):
  //   - Customers can message artisans/admins
  //   - Artisans can message customers, admins, or other artisans
  //   - Admins can message anyone
  //   - Customer → customer messaging is NOT allowed
  // ---------------------------------------------------------------------------

  async create(data: CreateMessageData): Promise<Message> {
    if (!data.content?.trim() && !data.imageUrl) {
      throw new BadRequestException('Message content cannot be empty');
    }

    const [sender, receiver] = await Promise.all([
      this.userRepo.findOne({ where: { id: data.senderId } }),
      this.userRepo.findOne({ where: { id: data.receiverId } }),
    ]);

    if (!sender) throw new NotFoundException('Sender not found');
    if (!receiver) throw new NotFoundException('Recipient not found');

    // Prevent customer-to-customer messaging
    if (sender.role === 'customer' && receiver.role === 'customer') {
      throw new BadRequestException(
        'You can only send messages to artisans or administrators',
      );
    }

    const sanitised = stripHtml(data.content);

    const message = this.messageRepo.create({
      sender_id: data.senderId,
      receiver_id: data.receiverId,
      content: sanitised,
      image_url: data.imageUrl ?? null,
      is_read: 0,
    });

    return this.messageRepo.save(message);
  }

  // ---------------------------------------------------------------------------
  // markAsRead
  // ---------------------------------------------------------------------------

  async markAsRead(id: number, userId: number): Promise<void> {
    // Only the receiver may mark as read
    await this.messageRepo.update(
      { id, receiver_id: userId },
      { is_read: 1 },
    );
  }

  // ---------------------------------------------------------------------------
  // delete (sender only)
  // ---------------------------------------------------------------------------

  async delete(id: number, userId: number): Promise<void> {
    const msg = await this.messageRepo.findOne({ where: { id } });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.sender_id !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }
    await this.messageRepo.delete(id);
  }

  // ---------------------------------------------------------------------------
  // getUnreadCount
  // ---------------------------------------------------------------------------

  async getUnreadCount(userId: number): Promise<number> {
    return this.messageRepo.count({
      where: { receiver_id: userId, is_read: 0 },
    });
  }

  // ---------------------------------------------------------------------------
  // findUserById — used by the controller to look up the "other" user in a thread
  // ---------------------------------------------------------------------------

  async findUserById(id: number): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async findArtisanProfileByUserId(
    userId: number,
  ): Promise<ArtisanProfile | null> {
    return (
      (await this.artisanProfileRepo.findOne({ where: { user_id: userId } })) ??
      null
    );
  }
}
