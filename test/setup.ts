/**
 * test/setup.ts — Global NestJS test utilities for Craftify
 *
 * Provides createTestApp(), seedTestDatabase(), loginAs(), and makeUnique()
 * used by all spec files.
 */

import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import session from 'express-session';
import passport from 'passport';
import flash from 'connect-flash';
import cookieParser from 'cookie-parser';
import * as bcrypt from 'bcryptjs';

// Must be set before AppModule is imported so TypeORM uses in-memory DB
process.env.NODE_ENV            = 'test';
process.env.CRAFTIFY_DB_PATH    = ':memory:';
process.env.SESSION_SECRET      = 'test-secret-at-least-32-chars-long';
process.env.RUN_BACKGROUND_TASKS = 'false';
process.env.ALLOW_MOCK_PAYMENTS  = 'true';
process.env.PASSWORD_MIN_LENGTH  = '6';

// Lazy import AppModule after env is set
let _appModule: any;
async function getAppModule() {
  if (!_appModule) {
    _appModule = (await import('../src/app.module')).AppModule;
  }
  return _appModule;
}

export interface TestContext {
  app: INestApplication;
  dataSource: any;
  httpServer: any;
}

export async function createTestApp(): Promise<TestContext> {
  const AppModule = await getAppModule();

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();

  // Minimal middleware stack for tests (no CSRF, no rate-limit)
  const expressApp = app.getHttpAdapter().getInstance() as any;
  expressApp.use(cookieParser('test-secret-at-least-32-chars-long'));
  expressApp.use(
    session({
      secret: 'test-secret-at-least-32-chars-long',
      resave: false,
      saveUninitialized: false,
      name: 'craftify.test.sid',
    }),
  );
  expressApp.use(flash());
  expressApp.use(passport.initialize());
  expressApp.use(passport.session());

  expressApp.use((req: any, res: any, next: any) => {
    res.locals.csrfToken         = 'test-csrf-token';
    res.locals.user              = req.session?.user ?? null;
    res.locals.success_msg       = req.flash ? req.flash('success_msg') : [];
    res.locals.error_msg         = req.flash ? req.flash('error_msg')   : [];
    res.locals.error             = req.flash ? req.flash('error')       : [];
    res.locals.cartCount         = 0;
    res.locals.notificationCount = 0;
    res.locals.currentPath       = req.path;
    next();
  });

  expressApp.set('view engine', 'ejs');
  const { join } = await import('path');
  expressApp.set('views', join(process.cwd(), 'views'));

  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }),
  );

  await app.init();

  // Resolve DataSource — handles both DataSource token and class token
  let dataSource: any;
  try {
    const { DataSource } = await import('typeorm');
    dataSource = app.get(DataSource);
  } catch {
    try {
      const { getDataSourceToken } = await import('@nestjs/typeorm');
      dataSource = app.get(getDataSourceToken());
    } catch {
      /* will be undefined in unit-test contexts */
    }
  }

  return { app, dataSource, httpServer: app.getHttpServer() };
}

// ── Database helpers ─────────────────────────────────────────────────────────

export async function seedTestDatabase(ds: any) {
  if (!ds) return;

  const h = async (pw: string) => bcrypt.hash(pw, 4); // low rounds = fast in tests

  await ds.query(`
    INSERT OR IGNORE INTO users
      (name, email, password, role, status, country)
    VALUES
      ('Admin User',     'admin@test.com',     '${await h('admin123')}', 'admin',    'active', 'Bahrain'),
      ('Customer User',  'customer@test.com',  '${await h('cust123')}',  'customer', 'active', 'Bahrain'),
      ('Customer2 User', 'customer2@test.com', '${await h('cust123')}',  'customer', 'active', 'Bahrain'),
      ('Artisan User',   'artisan@test.com',   '${await h('art123')}',   'artisan',  'active', 'Bahrain')
  `);

  const [artisanRow] = await ds.query(`SELECT id FROM users WHERE email='artisan@test.com'`);
  const artisanId: number = artisanRow?.id;

  if (artisanId) {
    await ds.query(`
      INSERT OR IGNORE INTO artisan_profiles (user_id, shop_name, bio, is_approved)
      VALUES (${artisanId}, 'Test Shop', 'Test artisan bio', 1)
    `);
  }

  await ds.query(`
    INSERT OR IGNORE INTO categories (name, slug, is_active)
    VALUES ('Pottery', 'pottery', 1), ('Textiles', 'textiles', 1)
  `);

  const [catRow] = await ds.query(`SELECT id FROM categories WHERE slug='pottery'`);
  const catId: number = catRow?.id;

  if (catId && artisanId) {
    await ds.query(`
      INSERT OR IGNORE INTO products
        (artisan_id, category_id, name, description, price, stock, images, status, is_active, featured)
      VALUES
        (${artisanId}, ${catId}, 'Test Product', 'A test product', 49.99, 10, '["https://example.com/img1.jpg"]', 'approved', 1, 0),
        (${artisanId}, ${catId}, 'Featured Product', 'A featured product', 89.99, 5, '["https://example.com/img2.jpg"]', 'approved', 1, 1)
    `);
  }

  // Future coupon
  await ds.query(`
    INSERT OR IGNORE INTO coupons
      (code, discount_type, discount_value, min_purchase, is_active, scope, valid_from, valid_until)
    VALUES
      ('TEST10', 'percent', 10, 0, 1, 'global', datetime('now','-1 day'), datetime('now','+30 days')),
      ('EXPIRED', 'percent', 15, 0, 1, 'global', datetime('now','-30 days'), datetime('now','-1 day'))
  `);
}

// ── Login helper ──────────────────────────────────────────────────────────────

export async function loginAs(
  agent: any,
  email: string,
  password: string,
): Promise<any> {
  await agent
    .post('/auth/login')
    .send({ email, password })
    .redirects(0);
  return agent;
}

// ── Unique string helper ──────────────────────────────────────────────────────

export function makeUnique(str: string): string {
  return `${str}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
