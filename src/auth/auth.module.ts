import {
  Module,
  MiddlewareConsumer,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import rateLimit from 'express-rate-limit';

import { User } from '../database/entities/user.entity';
import { ArtisanProfile } from '../database/entities/artisan-profile.entity';
import { CartItem } from '../database/entities/cart-item.entity';
import { PasswordReset } from '../database/entities/password-reset.entity';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LocalStrategy } from './strategies/local.strategy';
import { SessionSerializer } from './strategies/session.serializer';
import { EmailService } from './email.service';

// ---------------------------------------------------------------------------
// Rate limiters
//
// Disabled in test mode (NODE_ENV=test or JEST_WORKER_ID set) to avoid
// flapping test suites.  Mirrors the per-router rateLimit() calls in
// routes/auth.js exactly (windowMs, max, messages).
// ---------------------------------------------------------------------------

const isTest =
  process.env.NODE_ENV === 'test' ||
  Boolean(process.env.JEST_WORKER_ID) ||
  process.argv.some((a) => a.includes('jest'));

type MiddlewareFn = (req: any, res: any, next: () => void) => void;

const passThrough: MiddlewareFn = (_req, _res, next) => next();

/**
 * POST /auth/login — 10 attempts per 15 minutes.
 */
const loginLimiter: MiddlewareFn = isTest
  ? passThrough
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many login attempts, please try again later.' },
    });

/**
 * POST /auth/register and POST /auth/artisan-register — 5 attempts per hour.
 */
const registerLimiter: MiddlewareFn = isTest
  ? passThrough
  : rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many registration attempts, please try again later.' },
    });

/**
 * POST /auth/forgot-password — 5 attempts per 15 minutes.
 */
const forgotPasswordLimiter: MiddlewareFn = isTest
  ? passThrough
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many password reset requests, please try again later.' },
    });

/**
 * POST /auth/reset-password/:token — 10 attempts per 15 minutes.
 */
const resetPasswordLimiter: MiddlewareFn = isTest
  ? passThrough
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many reset attempts, please try again later.' },
    });

// ---------------------------------------------------------------------------
// AuthModule
// ---------------------------------------------------------------------------

/**
 * AuthModule — wires together all authentication concerns.
 *
 * Imports:
 *   TypeOrmModule.forFeature  — repositories for User, ArtisanProfile,
 *                               CartItem, PasswordReset
 *   PassportModule            — registers Passport with session: true so that
 *                               req.isAuthenticated() and req.logIn() work as
 *                               they do in the legacy Express app
 *
 * Providers:
 *   AuthService       — all business logic (validateUser, login, register, …)
 *   LocalStrategy     — passport-local credential validation
 *   SessionSerializer — serialize/deserialize user to/from the session store
 *   EmailService      — nodemailer wrapper for password-reset & welcome emails
 *
 * Exports:
 *   AuthService — re-exported so other modules (e.g. UserModule) can inject it
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User, ArtisanProfile, CartItem, PasswordReset]),
    PassportModule.register({ session: true }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, SessionSerializer, EmailService],
  exports: [AuthService],
})
export class AuthModule implements NestModule {
  /**
   * Apply Express rate-limit middleware to specific auth routes.
   *
   * NestJS MiddlewareConsumer lets us bind existing Express middleware without
   * any changes to the rate-limit library itself.
   */
  configure(consumer: MiddlewareConsumer): void {
    // Login
    consumer
      .apply(loginLimiter)
      .forRoutes({ path: 'auth/login', method: RequestMethod.POST });

    // Customer & artisan registration
    consumer
      .apply(registerLimiter)
      .forRoutes(
        { path: 'auth/register', method: RequestMethod.POST },
        { path: 'auth/artisan-register', method: RequestMethod.POST },
      );

    // Forgot password
    consumer
      .apply(forgotPasswordLimiter)
      .forRoutes({ path: 'auth/forgot-password', method: RequestMethod.POST });

    // Reset password (wildcard covers the :token segment)
    consumer
      .apply(resetPasswordLimiter)
      .forRoutes({ path: 'auth/reset-password/*', method: RequestMethod.POST });
  }
}
