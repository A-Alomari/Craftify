import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * CurrentUser param decorator.
 *
 * Resolves the logged-in user from the request. It first checks
 * req.session.user (populated by the session-based auth flow) and falls back
 * to req.user which Passport sets after a successful strategy verification.
 *
 * Usage:
 *   async getProfile(@CurrentUser() user: SessionUser) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{
      session?: { user?: unknown };
      user?: unknown;
    }>();

    // Prefer session user (set by authController after login) over passport user
    return request.session?.user ?? request.user ?? null;
  },
);
