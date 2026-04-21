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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ArtisanRegisterDto } from './dto/artisan-register.dto';
import { LocalAuthGuard } from './strategies/local.strategy';
import { GuestGuard } from '../common/guards/guest.guard';

/**
 * Augmented Request type used throughout this controller.
 *
 * express-session stores the current user at req.session.user.
 * connect-flash adds req.flash().
 * csurf adds req.csrfToken().
 * Passport adds req.user (set by LocalAuthGuard) and req.isAuthenticated().
 */
type CraftifyRequest = Request & {
  session: Record<string, any>;
  user?: any;
  flash?: (type: string, message?: string) => string[];
  csrfToken?: () => string;
  isAuthenticated?: () => boolean;
};

/**
 * AuthController — maps every auth route from routes/auth.js into NestJS.
 *
 * All render calls pass:
 *   - title         (page <title>)
 *   - csrfToken     (for <input type="hidden" name="_csrf" …> in EJS forms)
 *   - flashError    (first error_msg flash, consumed on render)
 *   - flashSuccess  (first success_msg flash, consumed on render)
 *
 * Rate limiting is applied per-route as Express middleware in AuthModule.configure().
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** Reads and consumes a flash type.  Returns '' if flash is unavailable. */
  private flash(req: CraftifyRequest, type: string): string {
    if (typeof req.flash !== 'function') return '';
    const msgs = req.flash(type);
    return Array.isArray(msgs) && msgs.length > 0 ? msgs[0] : '';
  }

  /** Reads the CSRF token from csurf middleware.  Returns '' in test mode. */
  private csrf(req: CraftifyRequest): string {
    return typeof req.csrfToken === 'function' ? req.csrfToken() : '';
  }

  // =========================================================================
  // LOGIN
  // =========================================================================

  // GET /auth/login
  @Get('login')
  @UseGuards(GuestGuard)
  showLogin(@Req() req: CraftifyRequest, @Res() res: Response): void {
    res.render('auth/login', {
      title: 'Sign In - Craftify',
      csrfToken: this.csrf(req),
      flashError: this.flash(req, 'error_msg'),
      flashSuccess: this.flash(req, 'success_msg'),
    });
  }

  /**
   * POST /auth/login
   *
   * LocalAuthGuard runs LocalStrategy.validate() — throws UnauthorizedException
   * on bad credentials before this method is ever invoked.
   *
   * On success, AuthService.login() regenerates the session, calls req.logIn()
   * to serialise the user ID via SessionSerializer, then writes req.session.user
   * so existing guards work on the current response as well.
   */
  @Post('login')
  @HttpCode(HttpStatus.FOUND)
  @UseGuards(LocalAuthGuard)
  async login(@Req() req: CraftifyRequest, @Res() res: Response): Promise<void> {
    try {
      await this.authService.login(req, req.user);

      const role = (req.session.user as { role?: string } | undefined)?.role;
      const returnTo = req.session.returnTo as string | undefined;
      delete req.session.returnTo;

      if (role === 'admin') return void res.redirect('/admin/dashboard');
      if (role === 'artisan') return void res.redirect('/artisan/dashboard');
      return void res.redirect(returnTo || '/');
    } catch (_err) {
      req.flash?.('error_msg', 'An error occurred during login');
      return void res.redirect('/auth/login');
    }
  }

  // =========================================================================
  // CUSTOMER REGISTRATION
  // =========================================================================

  // GET /auth/register
  @Get('register')
  @UseGuards(GuestGuard)
  showRegister(@Req() req: CraftifyRequest, @Res() res: Response): void {
    res.render('auth/register', {
      title: 'Create Account - Craftify',
      csrfToken: this.csrf(req),
      flashError: this.flash(req, 'error_msg'),
      flashSuccess: this.flash(req, 'success_msg'),
    });
  }

  /**
   * POST /auth/register
   *
   * Validates the DTO (ValidationPipe applied globally in main.ts),
   * creates the user, then redirects to /auth/login with a success flash.
   */
  @Post('register')
  @HttpCode(HttpStatus.FOUND)
  async register(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Body() dto: RegisterDto,
  ): Promise<void> {
    try {
      await this.authService.register(dto);
      req.flash?.('success_msg', 'Registration successful! Please log in.');
      return void res.redirect('/auth/login');
    } catch (err: any) {
      const msg =
        err?.message === 'This email is already registered'
          ? 'This email is already registered'
          : 'An error occurred during registration';
      req.flash?.('error_msg', msg);
      return void res.redirect('/auth/register');
    }
  }

  // =========================================================================
  // ARTISAN REGISTRATION
  // =========================================================================

  // GET /auth/artisan-register
  @Get('artisan-register')
  @UseGuards(GuestGuard)
  showArtisanRegister(@Req() req: CraftifyRequest, @Res() res: Response): void {
    res.render('auth/artisan-register', {
      title: 'Become an Artisan - Craftify',
      csrfToken: this.csrf(req),
      flashError: this.flash(req, 'error_msg'),
      flashSuccess: this.flash(req, 'success_msg'),
    });
  }

  /**
   * POST /auth/artisan-register
   *
   * Accepts an optional profile_image upload (up to 30 MB, matching the
   * existing routes/artisan.js limit).  The uploaded file is validated for a
   * valid image signature (JPEG / PNG / WebP) by middleware applied in
   * AuthModule.configure() before this handler runs.
   */
  @Post('artisan-register')
  @HttpCode(HttpStatus.FOUND)
  @UseInterceptors(
    FileInterceptor('profile_image', {
      limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB
      dest: 'public/uploads',                  // mirrors createImageUpload() dest
    }),
  )
  async registerArtisan(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Body() dto: ArtisanRegisterDto,
    @UploadedFile() profileImage?: Express.Multer.File,
  ): Promise<void> {
    try {
      await this.authService.registerArtisan(dto, profileImage);
      req.flash?.('success_msg', 'Artisan registration successful! Your account is pending approval.');
      return void res.redirect('/auth/login');
    } catch (err: any) {
      const msg =
        err?.message === 'This email is already registered'
          ? 'This email is already registered'
          : 'An error occurred during registration';
      req.flash?.('error_msg', msg);
      return void res.redirect('/auth/artisan-register');
    }
  }

  // =========================================================================
  // LOGOUT
  // =========================================================================

  /**
   * GET /auth/logout — soft redirect (matches legacy routes/auth.js behaviour).
   * The actual session destruction requires a POST to avoid CSRF concerns.
   */
  @Get('logout')
  logoutGet(@Res() res: Response): void {
    res.redirect('/');
  }

  /**
   * POST /auth/logout — destroys the session and clears the session cookie.
   */
  @Post('logout')
  @HttpCode(HttpStatus.FOUND)
  async logoutPost(@Req() req: CraftifyRequest, @Res() res: Response): Promise<void> {
    await this.authService.logout(req);
    res.redirect('/');
  }

  // =========================================================================
  // FORGOT PASSWORD
  // =========================================================================

  // GET /auth/forgot-password
  @Get('forgot-password')
  @UseGuards(GuestGuard)
  showForgotPassword(@Req() req: CraftifyRequest, @Res() res: Response): void {
    res.render('auth/forgot-password', {
      title: 'Forgot Password - Craftify',
      csrfToken: this.csrf(req),
      flashError: this.flash(req, 'error_msg'),
      flashSuccess: this.flash(req, 'success_msg'),
    });
  }

  /**
   * POST /auth/forgot-password
   *
   * Always flashes the same generic success message regardless of whether the
   * email exists (prevents user enumeration).  In non-production environments
   * the dev reset link is appended to the message so developers can test the
   * full flow without a mail server.
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.FOUND)
  async forgotPassword(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Body('email') email: string,
  ): Promise<void> {
    const genericMsg =
      'If an account exists with this email, you will receive a password reset link.';

    try {
      await this.authService.forgotPassword(email);
      req.flash?.('success_msg', genericMsg);
    } catch (_err) {
      req.flash?.('error_msg', 'An error occurred. Please try again.');
    }

    return void res.redirect('/auth/forgot-password');
  }

  // =========================================================================
  // RESET PASSWORD
  // =========================================================================

  /**
   * GET /auth/reset-password/:token
   *
   * Validates the token before rendering the form.  If invalid or expired,
   * flashes an error and redirects to /auth/forgot-password.
   */
  @Get('reset-password/:token')
  @UseGuards(GuestGuard)
  async showResetPassword(
    @Param('token') token: string,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    const reset = await this.authService.findValidResetToken(token);
    if (!reset) {
      req.flash?.('error_msg', 'Invalid or expired reset link');
      return void res.redirect('/auth/forgot-password');
    }

    res.render('auth/reset-password', {
      title: 'Reset Password - Craftify',
      token,
      csrfToken: this.csrf(req),
      flashError: this.flash(req, 'error_msg'),
      flashSuccess: this.flash(req, 'success_msg'),
    });
  }

  /**
   * POST /auth/reset-password/:token
   *
   * Validates that passwords match and meet the minimum length before calling
   * AuthService.resetPassword().  The minimum length is resolved from
   * PASSWORD_MIN_LENGTH env var at request time (same logic as securityPolicy.js).
   */
  @Post('reset-password/:token')
  @HttpCode(HttpStatus.FOUND)
  async resetPassword(
    @Param('token') token: string,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Body('password') password: string,
    @Body('confirm_password') confirmPassword: string,
  ): Promise<void> {
    if (password !== confirmPassword) {
      req.flash?.('error_msg', 'Passwords do not match');
      return void res.redirect(`/auth/reset-password/${token}`);
    }

    // Resolve env-based minimum at request time (mirrors securityPolicy.js)
    const envMin = parseInt(process.env.PASSWORD_MIN_LENGTH || '', 10);
    const isProduction = process.env.NODE_ENV === 'production';
    const defaultMin = isProduction ? 10 : 6;
    const effectiveMin = Number.isInteger(envMin) && envMin >= 6 ? envMin : defaultMin;

    if (!password || password.length < effectiveMin) {
      req.flash?.('error_msg', `Password must be at least ${effectiveMin} characters`);
      return void res.redirect(`/auth/reset-password/${token}`);
    }

    try {
      const ok = await this.authService.resetPassword(token, password);
      if (!ok) {
        req.flash?.('error_msg', 'Invalid or expired reset link');
        return void res.redirect('/auth/forgot-password');
      }
      req.flash?.('success_msg', 'Password reset successful! Please log in.');
      return void res.redirect('/auth/login');
    } catch (_err) {
      req.flash?.('error_msg', 'An error occurred. Please try again.');
      return void res.redirect('/auth/forgot-password');
    }
  }
}
