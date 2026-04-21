import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

type FlashFn = (type: string) => string[];

type CraftifyRequest = Request & {
  flash?: FlashFn & ((type: string, message: string) => void);
  session?: Record<string, any> & { user?: unknown };
};

/**
 * FlashInterceptor
 *
 * Runs before every handler to populate res.locals with flash messages from
 * connect-flash so that every EJS template rendered during this request
 * cycle has direct access to:
 *
 *   res.locals.success_msg   — array of success messages
 *   res.locals.error_msg     — array of error messages
 *   res.locals.error         — array of generic error messages (Passport)
 *   res.locals.messages      — combined object { success_msg, error_msg, error }
 *   res.locals.user          — current session user (or null)
 *
 * This mirrors what the original Express app sets in app.use() middleware
 * so that EJS partials (header, footer) continue to work unchanged.
 *
 * Register globally in AppModule or main.ts:
 *
 *   app.useGlobalInterceptors(new FlashInterceptor());
 */
@Injectable()
export class FlashInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<CraftifyRequest>();
    const res = ctx.getResponse<Response>();

    // Populate locals before the handler runs
    this.populateLocals(req, res);

    return next.handle().pipe(
      tap(() => {
        // Re-populate after the handler in case flash messages were added
        // during handler execution (e.g. a redirect that re-renders the page)
        this.populateLocals(req, res);
      }),
    );
  }

  private populateLocals(req: CraftifyRequest, res: Response): void {
    if (typeof req.flash === 'function') {
      // connect-flash exposes flash(type) → string[]
      const successMsgs = (req.flash as FlashFn)('success_msg') ?? [];
      const errorMsgs = (req.flash as FlashFn)('error_msg') ?? [];
      const errors = (req.flash as FlashFn)('error') ?? [];

      res.locals.success_msg = successMsgs;
      res.locals.error_msg = errorMsgs;
      res.locals.error = errors;

      // Provide a single object for templates that destructure it
      res.locals.messages = {
        success_msg: successMsgs,
        error_msg: errorMsgs,
        error: errors,
      };

      // Convenience boolean flags — true when there are pending messages
      res.locals.hasSuccess = successMsgs.length > 0;
      res.locals.hasError = errorMsgs.length > 0 || errors.length > 0;
    } else {
      // connect-flash not installed or not initialised — provide safe defaults
      res.locals.success_msg = [];
      res.locals.error_msg = [];
      res.locals.error = [];
      res.locals.messages = { success_msg: [], error_msg: [], error: [] };
      res.locals.hasSuccess = false;
      res.locals.hasError = false;
    }

    // Always expose the session user to templates so partials like
    // header.ejs can render the correct navigation state without needing
    // each controller to pass `user` explicitly.
    res.locals.user = req.session?.user ?? null;

    // Expose the CSRF token helper if csurf has been registered.
    // Controllers can still pass csrfToken explicitly; this is a fallback.
    if (typeof (req as any).csrfToken === 'function') {
      try {
        res.locals.csrfToken = (req as any).csrfToken();
      } catch {
        // csrfToken() can throw if the session is not yet initialised
        res.locals.csrfToken = '';
      }
    }
  }
}
