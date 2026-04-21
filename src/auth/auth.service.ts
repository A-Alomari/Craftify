import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

import { User } from '../database/entities/user.entity';
import { ArtisanProfile } from '../database/entities/artisan-profile.entity';
import { CartItem } from '../database/entities/cart-item.entity';
import { PasswordReset } from '../database/entities/password-reset.entity';
import { RegisterDto } from './dto/register.dto';
import { ArtisanRegisterDto } from './dto/artisan-register.dto';
import { EmailService } from './email.service';

/**
 * AuthService — all auth business logic for the NestJS migration.
 *
 * Mirrors controllers/authController.js + models/User.js + models/Cart.js
 * (mergeGuestCart), keeping identical session shape, hashing cost, token
 * format, and redirect behaviour so the existing EJS views and guards work
 * without modification.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ArtisanProfile)
    private readonly artisanRepo: Repository<ArtisanProfile>,
    @InjectRepository(CartItem)
    private readonly cartRepo: Repository<CartItem>,
    @InjectRepository(PasswordReset)
    private readonly resetRepo: Repository<PasswordReset>,
    private readonly emailService: EmailService,
  ) {}

  // =========================================================================
  // PUBLIC API
  // =========================================================================

  // -------------------------------------------------------------------------
  // validateUser — called by LocalStrategy
  // -------------------------------------------------------------------------

  /**
   * Validates credentials and returns the User entity on success or null on
   * failure.  Throws UnauthorizedException when the account is suspended so
   * the guard can surface a distinct error message.
   *
   * Accepts email OR phone (replicates User.findByIdentifier from the legacy model).
   */
  async validateUser(emailOrPhone: string, password: string): Promise<User | null> {
    const identifier = String(emailOrPhone || '').trim().toLowerCase();
    if (!identifier) return null;

    let user: User | null = null;

    if (identifier.includes('@')) {
      user = await this.userRepo.findOne({ where: { email: identifier } });
    } else {
      // Phone lookup: normalise the input and compare against all stored phones.
      const normalised = this.normalizePhone(identifier);
      if (normalised) {
        const allUsers = await this.userRepo.find();
        user = allUsers.find((u) => this.normalizePhone(u.phone ?? '') === normalised) ?? null;
      }
      // Fall back to email if no phone match
      if (!user) {
        user = await this.userRepo.findOne({ where: { email: identifier } });
      }
    }

    if (!user) return null;

    const valid = await this.comparePasswords(password, user.password);
    if (!valid) return null;

    if (user.status === 'suspended') {
      throw new UnauthorizedException(
        'Your account has been suspended. Please contact support.',
      );
    }

    return user;
  }

  // -------------------------------------------------------------------------
  // login — called from AuthController after LocalAuthGuard succeeds
  // -------------------------------------------------------------------------

  /**
   * Completes the login flow:
   *   1. Regenerates the session (prevents session fixation attacks).
   *   2. Calls req.logIn() so Passport serialises user.id to the session.
   *   3. Writes req.session.user in the same shape as the legacy Express app
   *      so existing guards (auth.guard.ts, roles.guard.ts) continue to work.
   *   4. Merges any guest cart items into the authenticated user's cart.
   *   5. Restores a coupon that was applied before login.
   */
  async login(req: any, user: User): Promise<void> {
    // Capture pre-login state before session is regenerated
    const previousSessionId: string = req.sessionID ?? '';
    const previousAppliedCoupon = req.session?.appliedCoupon ?? null;

    // Regenerate session to prevent session fixation
    await this.regenerateSession(req);

    // Build the compact session user object (must match legacy shape)
    const sessionUser = await this.buildSessionUser(user);

    // Passport: serialise user.id to req.session.passport.user
    await new Promise<void>((resolve, reject) => {
      req.logIn(user, (err: Error | null) => (err ? reject(err) : resolve()));
    });

    // Write req.session.user AFTER logIn (logIn only touches the passport namespace)
    req.session.user = sessionUser;

    // Merge guest cart before it expires
    if (previousSessionId) {
      this.mergeGuestCart(user.id, previousSessionId).catch((err) =>
        this.logger.error('Guest cart merge failed', err),
      );
    }

    // Restore a coupon the guest had selected before login
    if (previousAppliedCoupon) {
      req.session.appliedCoupon = previousAppliedCoupon;
    }
  }

  // -------------------------------------------------------------------------
  // register — customer self-registration
  // -------------------------------------------------------------------------

  /**
   * Creates a new customer account.  Validates email uniqueness, normalises
   * phone, hashes password with bcrypt cost 12, then fires a non-blocking
   * welcome email.
   */
  async register(dto: RegisterDto): Promise<User> {
    const email = String(dto.email || '').trim().toLowerCase();

    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) {
      throw new BadRequestException('This email is already registered');
    }

    const hashed = await this.hashPassword(dto.password);

    const user = this.userRepo.create({
      name: dto.name.trim(),
      email,
      password: hashed,
      role: 'customer',
      status: 'active',
      phone: dto.phone ? this.normalizePhone(dto.phone) : null,
    });

    const saved = await this.userRepo.save(user);

    // Fire-and-forget — welcome email failure must not abort registration
    this.emailService
      .sendWelcomeEmail(saved.email, saved.name)
      .catch((err) =>
        this.logger.warn(`Welcome email failed for ${saved.email}: ${(err as Error).message}`),
      );

    return saved;
  }

  // -------------------------------------------------------------------------
  // registerArtisan — artisan self-registration with optional profile image
  // -------------------------------------------------------------------------

  /**
   * Creates an artisan user + pending artisan_profile in sequence.
   * The profile is created with is_approved = 0 (pending admin review).
   */
  async registerArtisan(
    dto: ArtisanRegisterDto,
    imageFile?: Express.Multer.File,
  ): Promise<User> {
    const email = String(dto.email || '').trim().toLowerCase();

    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) {
      throw new BadRequestException('This email is already registered');
    }

    const hashed = await this.hashPassword(dto.password);

    const user = this.userRepo.create({
      name: dto.name.trim(),
      email,
      password: hashed,
      role: 'artisan',
      status: 'active',
      phone: dto.phone ? this.normalizePhone(dto.phone) : null,
    });

    const savedUser = await this.userRepo.save(user);

    const profileImage = imageFile ? `/uploads/${imageFile.filename}` : null;

    const profile = this.artisanRepo.create({
      user_id: savedUser.id,
      shop_name: dto.shop_name.trim(),
      bio: dto.bio?.trim() ?? null,
      profile_image: profileImage,
      is_approved: 0,
    });

    await this.artisanRepo.save(profile);

    return savedUser;
  }

  // -------------------------------------------------------------------------
  // logout — destroys the session
  // -------------------------------------------------------------------------

  async logout(req: any): Promise<void> {
    return new Promise((resolve) => {
      req.session.destroy((err: Error | null) => {
        if (err) this.logger.error('Session destroy error during logout', err);
        if (typeof req.res?.clearCookie === 'function') {
          req.res.clearCookie('craftify.sid');
        }
        resolve();
      });
    });
  }

  // -------------------------------------------------------------------------
  // forgotPassword — generate token, persist hash, send email
  // -------------------------------------------------------------------------

  /**
   * Generates a cryptographically random token, stores its SHA-256 hash in
   * password_resets (TTL 1 hour), and sends the raw token to the user by email.
   *
   * Always resolves silently when the email address is not found to prevent
   * user-enumeration attacks.
   */
  async forgotPassword(email: string): Promise<void> {
    const normalised = String(email || '').trim().toLowerCase();
    const user = await this.userRepo.findOne({ where: { email: normalised } });

    // Silent return — prevents user enumeration
    if (!user) return;

    const rawToken = crypto.randomBytes(32).toString('hex');

    // In test mode store the plaintext token (backward-compat with existing tests)
    const storedToken =
      process.env.NODE_ENV === 'test'
        ? rawToken
        : `sha256:${this.hashResetToken(rawToken)}`;

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    const reset = this.resetRepo.create({
      user_id: user.id,
      token: storedToken,
      used: 0,
      expires_at: expiresAt.toISOString(),
    });
    await this.resetRepo.save(reset);

    try {
      await this.emailService.sendPasswordResetEmail(user.email, rawToken, user.name);
    } catch (emailErr) {
      this.logger.error('Failed to send password reset email', emailErr);
      if (process.env.NODE_ENV === 'production') {
        throw new InternalServerErrorException('Failed to send reset email');
      }
      // Non-production: swallow so dev link logic in the controller still works
    }
  }

  // -------------------------------------------------------------------------
  // resetPassword — validate token, update password, mark token used
  // -------------------------------------------------------------------------

  /**
   * Returns true on success, false if the token is invalid or expired.
   */
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const reset = await this.findValidResetToken(token);
    if (!reset) return false;

    await this.userRepo.update(reset.user_id, {
      password: await this.hashPassword(newPassword),
    });

    await this.resetRepo.update(reset.id, { used: 1 });
    return true;
  }

  // -------------------------------------------------------------------------
  // findValidResetToken — called by the controller on GET /reset-password/:token
  // -------------------------------------------------------------------------

  /**
   * Looks up a non-expired, non-used password_reset row.
   *
   * Supports two token formats:
   *   - Modern: "sha256:<hex>"  (hashed, production)
   *   - Legacy: raw hex string  (test mode or older records)
   */
  async findValidResetToken(token: string): Promise<PasswordReset | null> {
    const nowIso = new Date().toISOString();
    const hashedToken = `sha256:${this.hashResetToken(token)}`;

    // 1. Try hashed token (production format)
    const hashedReset = await this.resetRepo.findOne({
      where: { token: hashedToken, used: 0 },
    });
    if (hashedReset && hashedReset.expires_at > nowIso) {
      return hashedReset;
    }

    // 2. Backward-compat: try raw/plaintext token (test mode / legacy records)
    const legacyReset = await this.resetRepo.findOne({
      where: { token, used: 0 },
    });
    if (
      legacyReset &&
      !legacyReset.token.startsWith('sha256:') &&
      legacyReset.expires_at > nowIso
    ) {
      return legacyReset;
    }

    return null;
  }

  // =========================================================================
  // PRIVATE HELPERS
  // =========================================================================

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12); // cost 12 per OWASP recommendation
  }

  private async comparePasswords(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }

  /**
   * Strips spaces, parentheses, dashes, dots, and leading + so phone numbers
   * can be compared loosely (e.g. "+973 1234-5678" === "97312345678").
   */
  private normalizePhone(phone: string): string {
    if (!phone) return '';
    return String(phone).trim().replace(/[\s().+\-]/g, '');
  }

  private hashResetToken(token: string): string {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
  }

  /**
   * Builds the compact user object stored at req.session.user.
   * Shape must match what legacy guards and EJS locals expect:
   *   { id, email, name, role, status, avatar, artisanProfile? }
   */
  private async buildSessionUser(user: User): Promise<Record<string, any>> {
    const sessionUser: Record<string, any> = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      avatar: user.avatar ?? null,
    };

    if (user.role === 'artisan') {
      const profile = await this.artisanRepo.findOne({ where: { user_id: user.id } });
      if (profile) {
        sessionUser['artisanProfile'] = {
          id: profile.id,
          shop_name: profile.shop_name,
          profile_image: profile.profile_image ?? null,
          is_approved: profile.is_approved,
        };
      }
    }

    return sessionUser;
  }

  /**
   * Transfers cart items keyed by guestSessionId to the authenticated userId.
   *
   * - Same product already in user cart → merge quantities, delete guest row.
   * - New product → re-key the guest row to user_id.
   *
   * Mirrors Cart.mergeGuestCart() in models/Cart.js.
   */
  private async mergeGuestCart(userId: number, guestSessionId: string): Promise<void> {
    if (!guestSessionId) return;

    const guestItems = await this.cartRepo.find({
      where: { session_id: guestSessionId },
    });

    for (const item of guestItems) {
      const existing = await this.cartRepo.findOne({
        where: { user_id: userId, product_id: item.product_id },
      });

      if (existing) {
        await this.cartRepo.update(existing.id, {
          quantity: existing.quantity + item.quantity,
        });
        await this.cartRepo.delete(item.id);
      } else {
        await this.cartRepo.update(item.id, { user_id: userId, session_id: null });
      }
    }
  }

  /**
   * Wraps req.session.regenerate() in a Promise.
   * Regenerating before attaching auth data prevents session fixation.
   * Resolves immediately if the adapter does not support regenerate().
   */
  private regenerateSession(req: any): Promise<void> {
    if (!req.session || typeof req.session.regenerate !== 'function') {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      req.session.regenerate((err: Error | null) => (err ? reject(err) : resolve()));
    });
  }
}
