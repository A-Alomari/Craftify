import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

type CraftifyRequest = Request & {
  flash?: (type: string, message: string) => void;
  xhr?: boolean;
  session?: Record<string, unknown>;
};

/**
 * HttpExceptionFilter
 *
 * Global catch-all exception filter for the Craftify NestJS application.
 *
 * Handles:
 *  - CSRF token mismatch (code EBADCSRFTOKEN) → flash + redirect back
 *  - HttpException thrown by NestJS guards/pipes/controllers
 *  - Unknown/unhandled errors (wrapped as 500)
 *
 * Response strategy:
 *  - API routes (/api/*) or XHR/JSON requests → structured JSON
 *  - 401 Unauthorized → flash + redirect to /auth/login
 *  - 403 Forbidden     → flash + redirect back
 *  - 404 Not Found     → render errors/404.ejs
 *  - 500 / other       → render errors/500.ejs (message masked in production)
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<CraftifyRequest>();
    const res = ctx.getResponse<Response>();

    // -----------------------------------------------------------------------
    // 1. CSRF error — csurf attaches a `code` property
    // -----------------------------------------------------------------------
    const maybeCsrf = exception as Error & { code?: string };
    if (maybeCsrf?.code === 'EBADCSRFTOKEN') {
      if (typeof req.flash === 'function') {
        req.flash(
          'error_msg',
          'Form submission expired or invalid. Please refresh the page and try again.',
        );
      }
      const referer =
        typeof req.headers.referer === 'string' && req.headers.referer
          ? req.headers.referer
          : '/';
      res.status(HttpStatus.FORBIDDEN).redirect(referer);
      return;
    }

    // -----------------------------------------------------------------------
    // 2. Resolve HTTP status + message
    // -----------------------------------------------------------------------
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        if (typeof b.message === 'string') {
          message = b.message;
        } else if (Array.isArray(b.message)) {
          message = (b.message as string[]).join(', ');
        } else {
          message = exception.message;
        }
      }
    } else if (exception instanceof Error) {
      message = this.isProduction ? 'An unexpected error occurred' : exception.message;
    }

    // Log server-side errors with full stack
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `Unhandled exception [${req.method} ${req.path}]: ${
          exception instanceof Error ? exception.message : String(exception)
        }`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    // -----------------------------------------------------------------------
    // 3. JSON response for API / XHR / JSON-Accept requests
    // -----------------------------------------------------------------------
    const isApiPath = req.path.startsWith('/api/');
    const isXhr =
      Boolean(req.xhr) ||
      (String(req.headers['x-requested-with'] ?? '')).toLowerCase() === 'xmlhttprequest';
    const acceptsJson = (req.headers.accept ?? '').includes('application/json');

    if (isApiPath || isXhr || acceptsJson) {
      res.status(status).json({
        success: false,
        statusCode: status,
        message:
          this.isProduction && status >= HttpStatus.INTERNAL_SERVER_ERROR
            ? 'An unexpected error occurred'
            : message,
        path: req.path,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // -----------------------------------------------------------------------
    // 4. Browser (HTML) response helpers
    // -----------------------------------------------------------------------
    const sessionUser = (req.session as Record<string, unknown>)?.user ?? null;

    const flash = (type: string, msg: string): void => {
      if (typeof req.flash === 'function') {
        req.flash(type, msg);
      }
    };

    const redirectBack = (): void => {
      const referer =
        typeof req.headers.referer === 'string' &&
        req.headers.referer &&
        req.headers.referer !== req.originalUrl
          ? req.headers.referer
          : '/';
      res.redirect(referer);
    };

    // -----------------------------------------------------------------------
    // 5. Status-specific rendering / redirect
    // -----------------------------------------------------------------------
    switch (status) {
      case HttpStatus.UNAUTHORIZED: {
        if (req.session) {
          (req.session as Record<string, unknown>).returnTo = req.originalUrl;
        }
        flash('error_msg', 'Please log in to access this page');
        res.redirect('/auth/login');
        break;
      }

      case HttpStatus.FORBIDDEN: {
        flash(
          'error_msg',
          message || "You don't have permission to perform this action",
        );
        redirectBack();
        break;
      }

      case HttpStatus.NOT_FOUND: {
        res.status(HttpStatus.NOT_FOUND).render('errors/404', {
          title: 'Page Not Found',
          user: sessionUser,
          currentPath: req.path,
        });
        break;
      }

      case HttpStatus.INTERNAL_SERVER_ERROR:
      default: {
        res.status(status).render('errors/500', {
          title: 'Server Error',
          error: this.isProduction
            ? 'An unexpected error occurred. Please try again later.'
            : message,
          user: sessionUser,
          currentPath: req.path,
        });
        break;
      }
    }
  }
}
