import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import {
  ActiveGuard,
  ArtisanGuard,
} from '../../common/guards/roles.guard';

// ---------------------------------------------------------------------------
// Augmented request type (matches existing auth.controller.ts pattern)
// ---------------------------------------------------------------------------

type CraftifyRequest = Request & {
  session: Record<string, any> & {
    user?: {
      id: number;
      email: string;
      name: string;
      role: string;
      status: string;
      avatar: string | null;
      artisanProfile?: Record<string, any>;
    };
  };
  flash?: (type: string, message?: string) => string[];
  csrfToken?: () => string;
};

// ---------------------------------------------------------------------------
// Multer storage — persist uploads to .uploads/ with unique filenames
// ---------------------------------------------------------------------------

const avatarStorage = diskStorage({
  destination: '.uploads',
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `avatar-${uuidv4()}${ext}`);
  },
});

@Controller('user')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private flash(req: CraftifyRequest, type: string): string {
    if (typeof req.flash !== 'function') return '';
    const msgs = req.flash(type);
    return Array.isArray(msgs) && msgs.length > 0 ? msgs[0] : '';
  }

  private csrf(req: CraftifyRequest): string {
    return typeof req.csrfToken === 'function' ? req.csrfToken() : '';
  }

  /** Sync session.user fields after a profile update so the header reflects the new data. */
  private refreshSessionUser(
    req: CraftifyRequest,
    patches: { name?: string; email?: string; avatar?: string },
  ): void {
    if (req.session?.user) {
      if (patches.name !== undefined) req.session.user.name = patches.name;
      if (patches.email !== undefined) req.session.user.email = patches.email;
      if (patches.avatar !== undefined) req.session.user.avatar = patches.avatar;
    }
  }

  // =========================================================================
  // GET /user/profile
  // =========================================================================

  @Get('profile')
  @UseGuards(AuthGuard, ActiveGuard)
  async showProfile(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    const sessionUser = req.session.user!;
    const { user, artisanProfile } = await this.usersService.getProfile(
      sessionUser.id,
    );

    const activeTab = (req.query['tab'] as string) || 'profile';

    res.render('user/profile', {
      title: 'My Profile - Craftify',
      user: sessionUser,
      userProfile: user,
      artisanProfile,
      activeTab,
      csrfToken: this.csrf(req),
      flashError: this.flash(req, 'error_msg'),
      flashSuccess: this.flash(req, 'success_msg'),
    });
  }

  // =========================================================================
  // POST /user/profile — update profile + optional avatar upload
  // =========================================================================

  @Post('profile')
  @UseGuards(AuthGuard, ActiveGuard)
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: avatarStorage,
      limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB (matches routes/user.js)
      fileFilter: (_req, file, cb) => {
        const allowed = /\.(jpg|jpeg|png|webp)$/i;
        if (!allowed.test(extname(file.originalname))) {
          return cb(new Error('Only image files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  async updateProfile(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Body() dto: UpdateProfileDto,
    @UploadedFile() avatar?: Express.Multer.File,
  ): Promise<void> {
    const sessionUser = req.session.user!;

    try {
      // Update profile fields
      const updated = await this.usersService.updateProfile(sessionUser.id, dto);

      // Persist avatar if a new file was uploaded
      if (avatar) {
        const avatarPath = `/uploads/${avatar.filename}`;
        await this.usersService.updateAvatar(sessionUser.id, avatarPath);
        this.refreshSessionUser(req, {
          name: updated.name,
          email: updated.email,
          avatar: avatarPath,
        });
      } else {
        this.refreshSessionUser(req, {
          name: updated.name,
          email: updated.email,
        });
      }

      req.flash?.('success_msg', 'Profile updated successfully');
    } catch (err: any) {
      req.flash?.(
        'error_msg',
        err?.message || 'Failed to update profile. Please try again.',
      );
    }

    return void res.redirect('/user/profile');
  }

  // =========================================================================
  // POST /user/shop-profile — artisan shop profile update
  // =========================================================================

  @Post('shop-profile')
  @UseGuards(AuthGuard, ActiveGuard, ArtisanGuard)
  async updateShopProfile(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Body()
    body: {
      shop_name?: string;
      bio?: string;
      location?: string;
      phone?: string;
      instagram?: string;
      facebook?: string;
      twitter?: string;
      website?: string;
      bank_name?: string;
      bank_account?: string;
      shipping_methods?: string;
      return_policy?: string;
    },
  ): Promise<void> {
    const sessionUser = req.session.user!;

    try {
      const updates: Record<string, string | null> = {};
      const fields = [
        'shop_name',
        'bio',
        'location',
        'phone',
        'instagram',
        'facebook',
        'twitter',
        'website',
        'bank_name',
        'bank_account',
        'shipping_methods',
        'return_policy',
      ] as const;

      for (const field of fields) {
        if (body[field] !== undefined) {
          updates[field] = body[field]?.trim() || null;
        }
      }

      const profile = await this.usersService.updateShopProfile(
        sessionUser.id,
        updates as any,
      );

      // Keep session artisanProfile.shop_name in sync
      if (req.session.user?.artisanProfile && updates.shop_name) {
        req.session.user.artisanProfile.shop_name = profile.shop_name;
      }

      req.flash?.('success_msg', 'Shop profile updated successfully');
    } catch (err: any) {
      req.flash?.(
        'error_msg',
        err?.message || 'Failed to update shop profile. Please try again.',
      );
    }

    return void res.redirect('/user/profile?tab=shop');
  }

  // =========================================================================
  // POST /user/change-password
  // =========================================================================

  @Post('change-password')
  @UseGuards(AuthGuard, ActiveGuard)
  async changePassword(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    const sessionUser = req.session.user!;

    if (dto.new_password !== dto.confirm_password) {
      req.flash?.('error_msg', 'New passwords do not match');
      return void res.redirect('/user/profile?tab=security');
    }

    try {
      await this.usersService.changePassword(
        sessionUser.id,
        dto.current_password,
        dto.new_password,
      );
      req.flash?.('success_msg', 'Password changed successfully');
    } catch (err: any) {
      req.flash?.(
        'error_msg',
        err?.message || 'Failed to change password. Please try again.',
      );
    }

    return void res.redirect('/user/profile?tab=security');
  }

  // =========================================================================
  // GET /user/artisan/:id — public artisan profile
  // =========================================================================

  @Get('artisan/:id')
  async showArtisanProfile(
    @Param('id', ParseIntPipe) artisanId: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const data = await this.usersService.getArtisanPublicProfile(artisanId);

      res.render('user/artisan-profile', {
        title: `${data.artisan.name} - Craftify`,
        artisan: data.artisan,
        products: data.products,
        reviews: data.reviews,
        avgRating: data.avgRating,
        reviewCount: data.reviewCount,
        user: req.session?.user ?? null,
        csrfToken: this.csrf(req),
        flashError: this.flash(req, 'error_msg'),
        flashSuccess: this.flash(req, 'success_msg'),
      });
    } catch (err: any) {
      req.flash?.('error_msg', 'Artisan not found');
      return void res.redirect('/');
    }
  }
}
