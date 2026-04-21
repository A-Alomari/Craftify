import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { User } from '../../database/entities/user.entity';
import { ArtisanProfile } from '../../database/entities/artisan-profile.entity';
import { Product } from '../../database/entities/product.entity';
import { Review } from '../../database/entities/review.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

export interface ArtisanPublicProfile {
  artisan: User & { artisanProfile: ArtisanProfile | null };
  products: Product[];
  reviews: Review[];
  avgRating: number;
  reviewCount: number;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ArtisanProfile)
    private readonly artisanProfileRepo: Repository<ArtisanProfile>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
  ) {}

  // ---------------------------------------------------------------------------
  // Core user finders
  // ---------------------------------------------------------------------------

  async findById(id: number): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { email: String(email || '').trim().toLowerCase() },
    });
  }

  // ---------------------------------------------------------------------------
  // Update helpers
  // ---------------------------------------------------------------------------

  async update(id: number, data: Partial<User>): Promise<User> {
    await this.userRepo.update(id, data);
    return this.findById(id);
  }

  async updatePassword(id: number, hashedPassword: string): Promise<void> {
    await this.userRepo.update(id, { password: hashedPassword });
  }

  async updateAvatar(id: number, avatarPath: string): Promise<void> {
    await this.userRepo.update(id, { avatar: avatarPath });
  }

  // ---------------------------------------------------------------------------
  // Profile
  // ---------------------------------------------------------------------------

  async getProfile(
    userId: number,
  ): Promise<{ user: User; artisanProfile: ArtisanProfile | null }> {
    const user = await this.findById(userId);
    const artisanProfile =
      (await this.artisanProfileRepo.findOne({ where: { user_id: userId } })) ??
      null;
    return { user, artisanProfile };
  }

  async updateProfile(userId: number, dto: UpdateProfileDto): Promise<User> {
    const updates: Partial<User> = {};

    if (dto.name !== undefined) updates.name = dto.name.trim();
    if (dto.email !== undefined) {
      const email = dto.email.toLowerCase().trim();
      // Guard against duplicate email takeover
      const existing = await this.userRepo.findOne({ where: { email } });
      if (existing && existing.id !== userId) {
        throw new BadRequestException('That email address is already in use');
      }
      updates.email = email;
    }
    if (dto.phone !== undefined) updates.phone = dto.phone || null;
    if (dto.shipping_address !== undefined)
      updates.shipping_address = dto.shipping_address || null;
    if (dto.building !== undefined) updates.building = dto.building || null;
    if (dto.city !== undefined) updates.city = dto.city || null;
    if (dto.postal_code !== undefined)
      updates.postal_code = dto.postal_code || null;
    if (dto.country !== undefined) updates.country = dto.country || 'Bahrain';
    if (dto.dob !== undefined) updates.dob = dto.dob || null;

    if (Object.keys(updates).length > 0) {
      await this.userRepo.update(userId, updates);
    }

    return this.findById(userId);
  }

  async updateShopProfile(
    userId: number,
    data: Partial<ArtisanProfile>,
  ): Promise<ArtisanProfile> {
    const profile = await this.artisanProfileRepo.findOne({
      where: { user_id: userId },
    });
    if (!profile) {
      throw new NotFoundException('Artisan profile not found');
    }
    await this.artisanProfileRepo.update(profile.id, data);
    const updated = await this.artisanProfileRepo.findOne({
      where: { user_id: userId },
    });
    return updated!;
  }

  // ---------------------------------------------------------------------------
  // Change password
  // ---------------------------------------------------------------------------

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.findById(userId);

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (newPassword.length < 6) {
      throw new BadRequestException(
        'New password must be at least 6 characters',
      );
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await this.userRepo.update(userId, { password: hashed });
  }

  // ---------------------------------------------------------------------------
  // Stats (counts derived from available repositories)
  // ---------------------------------------------------------------------------

  async getStats(userId: number): Promise<{
    reviewCount: number;
    productCount: number;
  }> {
    const [reviewCount, productCount] = await Promise.all([
      this.reviewRepo.count({ where: { user_id: userId } }),
      this.productRepo.count({ where: { artisan_id: userId } }),
    ]);
    return { reviewCount, productCount };
  }

  // ---------------------------------------------------------------------------
  // Public artisan profile page
  // ---------------------------------------------------------------------------

  async getArtisanPublicProfile(artisanId: number): Promise<ArtisanPublicProfile> {
    const artisan = await this.userRepo.findOne({
      where: { id: artisanId, role: 'artisan' },
    });
    if (!artisan) throw new NotFoundException('Artisan not found');

    const artisanProfile =
      (await this.artisanProfileRepo.findOne({
        where: { user_id: artisanId },
      })) ?? null;

    // Active, approved products for this artisan
    const products = await this.productRepo.find({
      where: {
        artisan_id: artisanId,
        status: 'approved',
        is_active: 1,
      },
      order: { created_at: 'DESC' },
      take: 20,
    });

    // Reviews for those products
    const reviews = await this.reviewRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.user', 'u')
      .leftJoinAndSelect('r.product', 'p')
      .where('p.artisan_id = :artisanId', { artisanId })
      .andWhere('r.is_approved = 1')
      .orderBy('r.created_at', 'DESC')
      .take(20)
      .getMany();

    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

    return {
      artisan: Object.assign(artisan, { artisanProfile }),
      products,
      reviews,
      avgRating: Math.round(avgRating * 10) / 10,
      reviewCount: reviews.length,
    };
  }
}
