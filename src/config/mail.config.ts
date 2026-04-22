import { MailerOptions } from '@nestjs-modules/mailer';
import { join } from 'path';

/**
 * getMailerConfig
 *
 * Returns the @nestjs-modules/mailer MailerOptions used in AppModule's
 * MailerModule.forRootAsync() factory.
 *
 * Transport strategy:
 *   - test mode : jsonTransport (nodemailer built-in stub; messages logged, not sent)
 *   - production: SMTP via env vars (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
 *   - development: attempts SMTP if SMTP_HOST is set; falls back to Ethereal
 *     preview URLs when SMTP_HOST is absent (set up separately in AuthService)
 *
 * Template engine:
 *   - Handlebars (.hbs) templates stored in views/emails/
 *   - Layouts in views/emails/layouts/
 *   - Partials in views/emails/partials/
 *
 * Environment variables:
 *   SMTP_HOST        Hostname of SMTP server          (default: smtp.gmail.com)
 *   SMTP_PORT        SMTP port number                  (default: 587)
 *   SMTP_SECURE      Use TLS on connect (true/false)   (default: false → STARTTLS)
 *   SMTP_USER        SMTP authentication username
 *   SMTP_PASS        SMTP authentication password
 *   SMTP_FROM        Default "From" address            (default: "Craftify" <noreply@craftify.com>)
 *   SMTP_FROM_NAME   Sender display name               (default: Craftify)
 *
 * Usage in AppModule:
 *   MailerModule.forRootAsync({
 *     useFactory: getMailerConfig,
 *   })
 */
export function getMailerConfig(): MailerOptions {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isTest = nodeEnv === 'test'
    || Boolean(process.env.JEST_WORKER_ID)
    || process.argv.some((a) => a.includes('jest'));

  const fromName = process.env.SMTP_FROM_NAME ?? 'Craftify';
  const fromAddress = process.env.SMTP_FROM ?? 'noreply@craftify.com';
  const defaultFrom = `"${fromName}" <${fromAddress}>`;

  // -------------------------------------------------------------------------
  // Test transport — swallows all outgoing mail; zero network I/O
  // -------------------------------------------------------------------------
  if (isTest) {
    return {
      transport: {
        // Custom stub transport: captures all mail without network I/O.
        // Provides a verify() method returning Promise so @nestjs-modules/mailer
        // startup check doesn't throw "then is not a function".
        name: 'test-stub',
        version: '1.0.0',
        send(mail: any, callback: (...args: any[]) => void) {
          const envelope = mail.message.getEnvelope();
          const messageId = mail.message.messageId();
          callback(null, { envelope, messageId, response: 'OK (test stub)' });
        },
        verify() {
          return Promise.resolve(true);
        },
      } as any,
      defaults: {
        from: defaultFrom,
      },
    };
  }

  // -------------------------------------------------------------------------
  // SMTP transport for development and production
  // -------------------------------------------------------------------------
  const smtpHost = process.env.SMTP_HOST ?? 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT ?? '587', 10);
  // `secure: true` means TLS on connect (port 465).
  // `secure: false` with STARTTLS is the recommended setting for port 587.
  const smtpSecure = process.env.SMTP_SECURE === 'true';

  // Validate critical SMTP credentials in production
  if (nodeEnv === 'production') {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error(
        'FATAL: SMTP_USER and SMTP_PASS environment variables are required in production.',
      );
    }
  }

  // Lazy-load to avoid pulling css-inline (and its CustomGC handle) during tests.
  // This keeps jest --detectOpenHandles output clean.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { HandlebarsAdapter } = require('@nestjs-modules/mailer/dist/adapters/handlebars.adapter');

  return {
    transport: {
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
      // Gracefully handle self-signed certificates in development
      tls: {
        rejectUnauthorized: nodeEnv === 'production',
      },
      // Pool connections to reduce handshake overhead in production
      ...(nodeEnv === 'production' ? { pool: true as const, maxConnections: 5, maxMessages: 100 } : { maxConnections: 1, maxMessages: Infinity }),
    },

    defaults: {
      from: defaultFrom,
    },

    // -----------------------------------------------------------------------
    // Handlebars template engine
    // Template files live in views/emails/ alongside the existing EJS views.
    // -----------------------------------------------------------------------
    template: {
      dir: join(process.cwd(), 'views', 'emails'),
      adapter: new HandlebarsAdapter(
        /* helpers */ {          /**
           * eq helper: {{#if (eq status "shipped")}} … {{/if}}
           */
          eq: (a: unknown, b: unknown): boolean => a === b,

          /**
           * formatDate helper: {{formatDate createdAt "en-BH"}}
           */
          formatDate: (
            date: string | Date,
            locale: string = 'en-US',
          ): string => {
            try {
              return new Date(date).toLocaleDateString(locale, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              });
            } catch {
              return String(date);
            }
          },

          /**
           * currency helper: {{currency amount}}  →  "BHD 12.500"
           */
          currency: (
            amount: number,
            currency: string = process.env.APP_CURRENCY ?? 'BHD',
            locale: string = process.env.APP_LOCALE ?? 'en-BH',
          ): string => {
            try {
              return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency,
              }).format(amount);
            } catch {
              return `${currency} ${Number(amount).toFixed(3)}`;
            }
          },
        },
        /* options */ {},
      ),
      options: {
        // Partials directory for shared snippets (header, footer, button, etc.)
        partialsDir: join(process.cwd(), 'views', 'emails', 'partials'),
        // Layouts directory for base email skeleton
        layoutsDir: join(process.cwd(), 'views', 'emails', 'layouts'),
        // Default layout applied to every template unless overridden in send()
        defaultLayout: 'email-base',
      },
    },

    // Preview emails in development using preview-email (if installed)
    preview:
      nodeEnv === 'development' &&
      process.env.MAIL_PREVIEW === 'true',
  };
}
