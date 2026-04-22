import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * GuestGuard — prevents already-authenticated users from reaching guest-only
 * pages such as /auth/login and /auth/register.
 *
 * If the user is already logged in they are redirected to the appropriate
 * dashboard for their role. Unauthenticated visitors are allowed through.
 */
@Injectable()
export class GuestGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<
      Request & { session: Record<string, any>; user?: Record<string, any> }
    >();
    const res = context.switchToHttp().getResponse<Response>();

    const sessionUser = req.session?.user as
      | { role: 'customer' | 'artisan' | 'admin' }
      | undefined;
    const passportUser = req.user as
      | { role: 'customer' | 'artisan' | 'admin' }
      | undefined;
    const user = sessionUser ?? passportUser;

    if (!sessionUser && passportUser && req.session) {
      req.session.user = passportUser;
    }

    if (!user) {
      // Not logged in — allow access to the guest page
      return true;
    }

    // Already authenticated — send them to their home area
    const destination = resolveHome(user.role);
    res.redirect(destination);
    return false;
  }
}

/**
 * Returns the appropriate landing path for each role.
 */
function resolveHome(role: 'customer' | 'artisan' | 'admin'): string {
  switch (role) {
    case 'admin':
      return '/admin/dashboard';
    case 'artisan':
      return '/artisan/dashboard';
    case 'customer':
    default:
      return '/';
  }
}
