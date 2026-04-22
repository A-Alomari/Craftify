import {
  Injectable,
  UnauthorizedException,
  ExecutionContext,
} from '@nestjs/common';
import { Request } from 'express';
import { PassportStrategy } from '@nestjs/passport';
import { AuthGuard } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

// ---------------------------------------------------------------------------
// LocalStrategy
// ---------------------------------------------------------------------------

/**
 * Passport "local" strategy.
 *
 * Called for POST /auth/login by LocalAuthGuard.
 *
 * Supports identifier/email/phone form fields. The strategy calls
 * AuthService.validateUser which accepts email OR phone (same as the legacy
 * Express app via User.findByIdentifier).
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly authService: AuthService) {
    super({
      // Must match the login form field name. passport-local rejects requests
      // before validate() if this field is missing.
      usernameField: 'identifier',
      passwordField: 'password',
      passReqToCallback: true,
    });
  }

  /**
   * validate() is invoked by Passport after it has pulled email + password from
   * the request body.  If credentials are valid, the returned value becomes
   * req.user.  Throwing UnauthorizedException causes Passport to respond with
   * 401 / redirect the guard's canActivate to return false.
   */
  async validate(req: Request, _email: string, password: string): Promise<any> {
    const body = (req?.body ?? {}) as {
      identifier?: string;
      email?: string;
      phone?: string;
    };
    const loginIdentifier =
      body.identifier || body.email || body.phone || _email || '';

    let user: any;
    try {
      user = await this.authService.validateUser(loginIdentifier, password);
    } catch (err: any) {
      // validateUser throws UnauthorizedException when account is suspended
      throw err instanceof UnauthorizedException
        ? err
        : new UnauthorizedException('Invalid email or password');
    }

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return user; // stored as req.user by Passport
  }
}

// ---------------------------------------------------------------------------
// LocalAuthGuard
// ---------------------------------------------------------------------------

/**
 * Guards POST /auth/login.
 *
 * super.canActivate() runs LocalStrategy.validate — if it throws, NestJS
 * returns 401 before the controller method runs.
 *
 * We deliberately do NOT call super.logIn() here.  AuthService.login() calls
 * req.logIn() itself so that session setup (session regeneration, cart merge,
 * req.session.user assignment) is centralised in one place and consistent with
 * the legacy Express implementation.
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Backward compatibility with older clients/tests that still post `email`
    // or `phone` instead of `identifier`.
    request.body = request.body || {};
    request.body.identifier =
      request.body.identifier || request.body.email || request.body.phone || '';

    try {
      const valid = (await super.canActivate(context)) as boolean;
      return valid;
    } catch (err) {
      // On auth failure: flash error and redirect back to login (web-app behavior)
      const message =
        err instanceof UnauthorizedException
          ? err.message
          : 'Invalid email or password';
      if (typeof request.flash === 'function') {
        request.flash('error_msg', message);
      }
      response.redirect('/auth/login');
      return false;
    }
  }

  handleRequest<TUser = any>(
    err: any,
    user: TUser | false,
    info: any,
  ): TUser {
    if (err) throw err;
    if (!user) {
      const message: string =
        info instanceof Error
          ? info.message
          : typeof info === 'string'
          ? info
          : 'Invalid email or password';
      throw new UnauthorizedException(message);
    }
    return user;
  }
}
