/**
 * main.ts — Craftify NestJS Application Bootstrap
 *
 * Middleware stack (in registration order):
 *   1.  NestFactory.create with ExpressAdapter
 *   2.  EJS view engine + views directory
 *   3.  express-ejs-layouts middleware
 *   4.  helmet() with CSP
 *   5.  express.json() + urlencoded
 *   6.  cookie-parser
 *   7.  express-session (FileStore in dev/prod, MemoryStore in test)
 *   8.  connect-flash
 *   9.  passport.initialize() + passport.session()
 *   10. csurf (session-based, skipped for GET/HEAD/OPTIONS and all /api/*)
 *   11. method-override (_method)
 *   12. express-rate-limit (global, skipped in test)
 *   13. Static assets (/public → /public, /.uploads → /uploads)
 *   14. Global res.locals (flash, user, cartCount, notificationCount, csrfToken, currentPath)
 *   15. Global ValidationPipe
 *   16. Global HttpExceptionFilter
 *   17. CORS (development only)
 *   18. app.listen(PORT)
 */

import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { createSessionConfig } from './config/session.config';

import * as express from 'express';
import expressLayouts from 'express-ejs-layouts';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import flash from 'connect-flash';
import passport from 'passport';
import csurf from 'csurf';
import methodOverride from 'method-override';
import rateLimit from 'express-rate-limit';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { SessionIoAdapter } from './gateways/session-io.adapter';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT ?? '3000', 10);
const NODE_ENV = process.env.NODE_ENV ?? 'development';
const isProduction = NODE_ENV === 'production';
const isTest =
  NODE_ENV === 'test' ||
  Boolean(process.env.JEST_WORKER_ID) ||
  process.argv.some((a) => a.includes('jest'));

// Trust X-Forwarded-* headers only when explicitly configured
// (needed behind nginx/Caddy for accurate IP-based rate-limiting)
const trustProxyEnv = process.env.TRUST_PROXY ?? '';
const trustProxyEnabled =
  trustProxyEnv.length > 0 &&
  !['false', '0', 'no'].includes(trustProxyEnv.toLowerCase());

// Upload directory — must exist before static middleware registers it
const uploadDir = process.env.UPLOAD_DIR
  ? process.env.UPLOAD_DIR
  : join(process.cwd(), '.uploads');

const legacyUploadDir = join(process.cwd(), 'public', 'uploads');

if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

// ---------------------------------------------------------------------------
// CSP nonce / enable flag
// ---------------------------------------------------------------------------
const enableNonProdCsp = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.ENABLE_NON_PROD_CSP ?? '').toLowerCase(),
);

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  // 1. Create NestJS application with the Express adapter so we can use
  //    familiar Express middleware directly.
  const app = await NestFactory.create(AppModule, new ExpressAdapter(), {
    logger: isTest ? false : ['log', 'warn', 'error'],
    // Disable buffering of log messages before NestJS logger is ready
    bufferLogs: false,
  });

  // Expose the underlying Express instance for direct middleware registration.
  const expressApp = app.getHttpAdapter().getInstance() as express.Application;

  // -------------------------------------------------------------------------
  // Trust proxy (must be set before anything reads req.ip / req.protocol)
  // -------------------------------------------------------------------------
  if (trustProxyEnabled) {
    const parsed = parseInt(trustProxyEnv, 10);
    const proxySetting = Number.isNaN(parsed)
      ? trustProxyEnv === 'true'
        ? 1
        : trustProxyEnv
      : parsed;
    expressApp.set('trust proxy', proxySetting);
  }

  // -------------------------------------------------------------------------
  // 2. EJS view engine
  // -------------------------------------------------------------------------
  // Views live at <project-root>/views/. From dist/ __dirname is dist/, so
  // join(__dirname, '..', 'views') correctly resolves to the root views dir
  // in both compiled (dist) and development (ts-node/src) contexts.
  expressApp.set('view engine', 'ejs');
  expressApp.set('views', join(__dirname, '..', 'views'));

  // -------------------------------------------------------------------------
  // 3. express-ejs-layouts
  // The existing templates use manual header/footer partials rather than a
  // layout wrapper, so we register the middleware but leave setDefaultLayout
  // uncalled. Individual controllers can opt into a layout by setting
  // res.locals.layout or passing layout: 'name' to res.render().
  // -------------------------------------------------------------------------
  expressApp.use(expressLayouts);
  // Disable the default layout so partials-based templates work unchanged
  expressApp.set('layout', false);
  expressApp.set('layout extractScripts', true);
  expressApp.set('layout extractStyles', true);

  // -------------------------------------------------------------------------
  // 4. Helmet — security headers
  // -------------------------------------------------------------------------
  const applyCSP = (isProduction || enableNonProdCsp) && !isTest;

  expressApp.use(
    helmet({
      contentSecurityPolicy: applyCSP
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                'https://cdn.jsdelivr.net',
              ],
              styleSrc: [
                "'self'",
                "'unsafe-inline'",
                'https://cdn.jsdelivr.net',
                'https://fonts.googleapis.com',
              ],
              fontSrc: [
                "'self'",
                'https://fonts.gstatic.com',
                'https://cdn.jsdelivr.net',
                'data:',
              ],
              imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
              // WebSocket connections (Socket.io)
              connectSrc: ["'self'", 'ws:', 'wss:'],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
              frameAncestors: ["'self'"],
            },
          }
        : false,
      // Disable COEP — breaks third-party embeds that some views may use
      crossOriginEmbedderPolicy: false,
    }),
  );

  // -------------------------------------------------------------------------
  // 5. Body parsers
  // -------------------------------------------------------------------------
  expressApp.use(express.json({ limit: '5mb' }));
  expressApp.use(express.urlencoded({ extended: true, limit: '30mb' }));

  // -------------------------------------------------------------------------
  // 6. Cookie parser (must come before session and csurf)
  // -------------------------------------------------------------------------
  expressApp.use(cookieParser());

  // -------------------------------------------------------------------------
  // 7. Session
  // -------------------------------------------------------------------------
  const sessionConfig = createSessionConfig();
  const sessionMiddleware = session(sessionConfig);
  expressApp.use(sessionMiddleware);

  // Expose the session middleware so Socket.io can reuse it
  expressApp.set('sessionMiddleware', sessionMiddleware);

  // -------------------------------------------------------------------------
  // 8. Flash messages
  // -------------------------------------------------------------------------
  expressApp.use(flash());

  // -------------------------------------------------------------------------
  // 9. Passport
  // -------------------------------------------------------------------------
  expressApp.use(passport.initialize());
  expressApp.use(passport.session());

  // -------------------------------------------------------------------------
  // 10. CSRF protection
  //
  // Uses session storage (cookie: false) so the CSRF secret is held
  // server-side and cannot be read or forged by client-side JS.
  //
  // Skipped for:
  //   - GET, HEAD, OPTIONS (safe, idempotent methods)
  //   - All /api/* paths (API clients authenticate via session/JWT; they
  //     send their own CSRF headers where required)
  //   - Test environment (simplifies integration test setup)
  // -------------------------------------------------------------------------
  if (!isTest) {
    const csrfProtection = csurf({ cookie: false });

    expressApp.use(
      (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
      ): void => {
        // Safe HTTP methods and API routes bypass CSRF verification
        const isSafeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
        const isApiRoute = req.path.startsWith('/api/');

        if (isSafeMethod || isApiRoute) {
          return next();
        }

        csrfProtection(req, res, (err) => {
          if (err) {
            // Delegate to the global exception filter (handles EBADCSRFTOKEN)
            return next(err);
          }
          next();
        });
      },
    );
  }

  // -------------------------------------------------------------------------
  // 11. Method override (supports _method query/body param for HTML forms
  //     that need to send PUT / DELETE / PATCH requests)
  // -------------------------------------------------------------------------
  expressApp.use(methodOverride('_method'));

  // -------------------------------------------------------------------------
  // 12. Global rate limiting
  // -------------------------------------------------------------------------
  if (!isTest) {
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 200,                  // requests per window per IP
      standardHeaders: true,     // Return rate limit info in RateLimit-* headers
      legacyHeaders: false,      // Disable the deprecated X-RateLimit-* headers
      message: {
        success: false,
        message: 'Too many requests, please try again later.',
      },
      // Skip limit for trusted internal health-check paths
      skip: (req) =>
        req.path === '/health' || req.path === '/favicon.ico',
    });

    expressApp.use(limiter);
  }

  // -------------------------------------------------------------------------
  // 13. Static assets
  // -------------------------------------------------------------------------

  // Public assets (CSS, JS bundles, fonts, images bundled with the app)
  expressApp.use(
    express.static(join(process.cwd(), 'public'), { maxAge: '1d' }),
  );
  expressApp.use(
    '/assets',
    express.static(join(process.cwd(), 'assets'), { maxAge: '1d' }),
  );

  // Favicon shortcut — browsers request /favicon.ico regardless of <link> tags
  expressApp.get('/favicon.ico', (_req, res) => {
    res.sendFile(join(process.cwd(), 'public', 'favicon.png'), (err) => {
      if (err) res.status(404).end();
    });
  });

  // User-uploaded media — served from .uploads/ (primary) with a fallback to
  // the legacy public/uploads/ path for backward compatibility
  const uploadStaticOptions: Parameters<typeof express.static>[1] = {
    dotfiles: 'deny',
    index: false,
    fallthrough: true,
  };

  expressApp.use('/uploads', express.static(uploadDir, uploadStaticOptions));

  if (
    uploadDir !== legacyUploadDir &&
    existsSync(legacyUploadDir)
  ) {
    expressApp.use(
      '/uploads',
      express.static(legacyUploadDir, uploadStaticOptions),
    );
  }

  // -------------------------------------------------------------------------
  // 14. Global res.locals middleware
  //
  // Runs on every request to populate template variables that every EJS view
  // expects to exist without controllers having to pass them explicitly.
  //
  // cartCount and notificationCount are retrieved from NestJS services via
  // the DI container (obtained after app.init() below).
  // -------------------------------------------------------------------------

  // Initialise the NestJS DI container so services can be resolved
  await app.init();

  // -------------------------------------------------------------------------
  // Socket.io — attach session middleware to the WebSocket handshake so that
  // gateways can read socket.handshake.session.user without a separate auth
  // handshake.  Must be registered AFTER app.init() so the HTTP adapter is
  // fully ready.
  // -------------------------------------------------------------------------
  app.useWebSocketAdapter(new SessionIoAdapter(app));

  // Resolve services that require DB access — wrapped in try/catch so a
  // missing module during incremental migration does not crash the server.
  let cartServiceGetCount: ((userId: number | null, sessionId: string | null) => number) | null = null;
  let notificationServiceGetUnread: ((userId: number) => Promise<number>) | null = null;

  try {
    // Dynamic import to avoid hard coupling before the modules exist
    const { CartService } = await import('./modules/cart/cart.service');
    const cartService = app.get(CartService);
    cartServiceGetCount = (userId, sessionId) =>
      cartService.getCount(userId, sessionId);
  } catch {
    logger.warn(
      'CartService not available yet — cart count will default to 0. ' +
        'Wire CartModule into AppModule to enable this.',
    );
  }

  try {
    const { NotificationsService } = await import(
      './modules/notifications/notifications.service'
    );
    const notificationsService = app.get(NotificationsService);
    notificationServiceGetUnread = (userId) =>
      notificationsService.getUnreadCount(userId);
  } catch {
    logger.warn(
      'NotificationsService not available yet — notification count will default to 0. ' +
        'Wire NotificationsModule into AppModule to enable this.',
    );
  }

  let cartCountWarningLogged = false;

  expressApp.use(
    async (
      req: express.Request & {
        session: session.Session & Partial<session.SessionData> & {
          user?: Record<string, unknown>;
        };
        csrfToken?: () => string;
      },
      res: express.Response,
      next: express.NextFunction,
    ): Promise<void> => {
      // Flash messages (connect-flash populates req.flash after the session)
      const flashFn = (req as unknown as {
        flash: (type: string) => string[];
      }).flash;

      if (typeof flashFn === 'function') {
        res.locals.success_msg = flashFn.call(req, 'success_msg');
        res.locals.error_msg   = flashFn.call(req, 'error_msg');
        res.locals.error       = flashFn.call(req, 'error');
      } else {
        res.locals.success_msg = [];
        res.locals.error_msg   = [];
        res.locals.error       = [];
      }

      // Current authenticated user
      const sessionUser = req.session?.user ?? null;
      res.locals.user = sessionUser;

      // Current request path (used by nav to highlight active links)
      res.locals.currentPath = req.path;

      // CSRF token — safe call: csrfToken() may throw if csurf was skipped
      // for this route (GET, /api/*, test mode)
      try {
        res.locals.csrfToken =
          typeof req.csrfToken === 'function' ? req.csrfToken() : '';
      } catch {
        res.locals.csrfToken = '';
      }

      // Cart & notification counts — delegate to services when available
      res.locals.cartCount         = 0;
      res.locals.notificationCount = 0;

      try {
        if (cartServiceGetCount) {
          if (sessionUser?.id != null) {
            res.locals.cartCount = cartServiceGetCount(
              Number(sessionUser.id),
              null,
            );
          } else if ((req as any).sessionID) {
            res.locals.cartCount = cartServiceGetCount(null, (req as any).sessionID);
          }
        }

        if (notificationServiceGetUnread && sessionUser?.id != null) {
          res.locals.notificationCount = notificationServiceGetUnread(
            Number(sessionUser.id),
          );
        }
      } catch (err) {
        if (!cartCountWarningLogged && !isTest) {
          cartCountWarningLogged = true;
          logger.warn(
            `Cart/notification count middleware error: ${(err as Error).message}`,
          );
        }
      }

      next();
    },
  );

  // -------------------------------------------------------------------------
  // 15. Global ValidationPipe
  //
  // Automatically validates and transforms DTO classes annotated with
  // class-validator / class-transformer decorators.
  // -------------------------------------------------------------------------
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,            // Auto-convert primitives (e.g. "1" → 1)
      whitelist: true,            // Strip unknown properties from DTOs
      forbidNonWhitelisted: false, // Warn rather than throw on extra props
      transformOptions: {
        enableImplicitConversion: true, // Convert query-string values by type
      },
    }),
  );

  // -------------------------------------------------------------------------
  // 16. Global exception filter
  //
  // Handles CSRF errors, 404s, 500s, and converts them to the correct
  // EJS view render or JSON response depending on request type.
  // -------------------------------------------------------------------------
  app.useGlobalFilters(new HttpExceptionFilter());

  // -------------------------------------------------------------------------
  // 17. CORS (development only)
  //
  // In production, CORS is handled at the reverse-proxy (nginx/Caddy) layer.
  // -------------------------------------------------------------------------
  if (!isProduction) {
    app.enableCors({
      origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    });
  }

  // -------------------------------------------------------------------------
  // 18. 404 fallback (must be registered after all route modules)
  // -------------------------------------------------------------------------
  expressApp.use(
    (_req: express.Request, res: express.Response): void => {
      res.status(404).render('errors/404', {
        title: 'Page Not Found',
        user: res.locals.user ?? null,
        currentPath: _req.path,
      });
    },
  );

  // -------------------------------------------------------------------------
  // Start listening
  // -------------------------------------------------------------------------
  await app.listen(PORT);

  logger.log(
    `Craftify NestJS server running on http://localhost:${PORT} [${NODE_ENV}]`,
  );
}

// ---------------------------------------------------------------------------
// Graceful shutdown — flush any pending DB writes before exit
// ---------------------------------------------------------------------------
async function gracefulShutdown(signal: string): Promise<void> {
  const logger = new Logger('Shutdown');
  logger.log(`${signal} received — shutting down gracefully.`);
  process.exit(0);
}

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => void gracefulShutdown('SIGINT'));

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
bootstrap().catch((err: Error) => {
  const logger = new Logger('Bootstrap');
  logger.error(`Fatal error during bootstrap: ${err.message}`, err.stack);
  process.exit(1);
});
