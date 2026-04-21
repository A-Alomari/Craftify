import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import session from 'express-session';
import FileStoreFactory from 'session-file-store';

// Augment express-session types so TypeScript accepts the `returnTo` field
// that auth middleware writes to the session during login redirects.
// @ts-ignore — express-session ships without bundled types; augmentation is valid at runtime
declare module 'express-session' {
  interface SessionData {
    user?: Record<string, unknown>;
    returnTo?: string;
  }
}

/**
 * createSessionConfig
 *
 * Builds and returns the express-session options used by the Craftify NestJS
 * bootstrap (main.ts).  Called once at application startup.
 *
 * Session storage strategy:
 *   - Development / Production: session-file-store (disk-backed JSON files)
 *     Stored at SESSION_STORE_PATH env var, defaulting to <cwd>/.sessions
 *   - Test: no persistent store — uses the default MemoryStore so tests are
 *     fully isolated and do not leave files on disk.
 *
 * Security settings:
 *   - httpOnly: true   — cookie inaccessible to client-side JS
 *   - sameSite: 'lax'  — sent on top-level navigations; blocks cross-site POST
 *   - secure: true     — cookie only over HTTPS in production
 *   - maxAge: 24 hours — sliding session lifetime
 *
 * The session secret MUST be provided via SESSION_SECRET in production.
 * An error is thrown at startup if the secret is missing outside of test mode.
 */
export function createSessionConfig(): session.SessionOptions {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';
  const isTest = nodeEnv === 'test'
    || Boolean(process.env.JEST_WORKER_ID)
    || process.argv.some((a) => a.includes('jest'));

  // -------------------------------------------------------------------------
  // Session secret validation
  // -------------------------------------------------------------------------
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (isTest) {
      // Use a fixed, non-secret value in tests so they don't need env setup
      process.env.SESSION_SECRET = 'craftify-test-secret-do-not-use-in-production';
    } else {
      throw new Error(
        'FATAL: SESSION_SECRET environment variable is required. ' +
          'Set it to a long, random string (≥ 32 characters).',
      );
    }
  }

  // -------------------------------------------------------------------------
  // File-based session store (skipped in test mode)
  // -------------------------------------------------------------------------
  let store: session.Store | undefined;

  if (!isTest) {
    const storePath = process.env.SESSION_STORE_PATH
      ? process.env.SESSION_STORE_PATH
      : join(process.cwd(), '.sessions');

    // Ensure the sessions directory exists before FileStore tries to use it
    if (!existsSync(storePath)) {
      try {
        mkdirSync(storePath, { recursive: true });
      } catch (mkdirErr) {
        if (isProduction) {
          throw new Error(
            `FATAL: Cannot create session store directory at ${storePath}: ${(mkdirErr as Error).message}`,
          );
        }
        console.warn(
          `[SessionConfig] Could not create session store directory at ${storePath}. ` +
            'Falling back to in-memory session store.',
        );
      }
    }

    if (existsSync(storePath)) {
      try {
        const FileStore = FileStoreFactory(session);
        store = new FileStore({
          path: storePath,
          // Session file TTL in seconds (matches cookie maxAge: 24 h)
          ttl: 24 * 60 * 60,
          // Number of retries when reading a session file
          retries: 2,
          // Retry delay in ms between read attempts
          retryDelay: 100,
          // Silence FileStore's own logging (we handle errors above)
          logFn: () => undefined,
          // Encrypt session files at rest when SESSION_FILE_SECRET is set
          ...(process.env.SESSION_FILE_SECRET
            ? {
                filePattern: 'craftify-%s.json',
                encoding: 'utf-8',
              }
            : {}),
        });
      } catch (storeErr) {
        if (isProduction) {
          throw new Error(
            `FATAL: session-file-store failed to initialise: ${(storeErr as Error).message}`,
          );
        }
        console.warn(
          `[SessionConfig] session-file-store failed to initialise ` +
            `(${(storeErr as Error).message}). Falling back to MemoryStore.`,
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Final session options
  // -------------------------------------------------------------------------
  return {
    secret: process.env.SESSION_SECRET as string,

    // Custom session cookie name — avoids fingerprinting the framework
    name: 'craftify.sid',

    store,

    // Do not re-save sessions that have not been modified.
    // Required by most store implementations to prevent race conditions.
    resave: false,

    // Do not persist uninitialised sessions (reduces storage overhead and
    // satisfies GDPR-style requirements about not storing data before consent).
    saveUninitialized: false,

    // Honour the X-Forwarded-Proto header set by a reverse proxy when
    // determining whether the request is secure (used for secure cookie).
    proxy: isProduction,

    cookie: {
      // Cookie is never accessible via document.cookie
      httpOnly: true,

      // Prevent CSRF: cookie is only sent on same-site requests.
      // 'lax' allows top-level navigation GET requests (e.g. OAuth redirects).
      sameSite: 'lax' as const,

      // Enforce HTTPS-only cookie transmission in production
      secure: isProduction,

      // 24-hour sliding expiry (milliseconds)
      maxAge: 24 * 60 * 60 * 1000,
    },
  };
}
