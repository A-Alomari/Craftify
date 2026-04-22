import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';

// ---------------------------------------------------------------------------
// Helper types
// ---------------------------------------------------------------------------

interface SessionUser {
  id: number;
  role: 'customer' | 'artisan' | 'admin';
  status: string;
  artisanProfile?: { is_approved: number };
}

type CraftifyRequest = Request & {
  session: Record<string, any> & { user?: SessionUser };
  user?: SessionUser;
  flash?: (type: string, message: string) => void;
};

function getCurrentUser(req: CraftifyRequest): SessionUser | undefined {
  const sessionUser = req.session?.user as SessionUser | undefined;
  if (sessionUser) return sessionUser;

  const passportUser = req.user as SessionUser | undefined;
  if (passportUser && req.session) {
    req.session.user = passportUser;
  }
  return passportUser;
}

// ---------------------------------------------------------------------------
// Shared redirect helper
// ---------------------------------------------------------------------------

function denyAccess(
  req: CraftifyRequest,
  res: Response,
  message: string,
  redirectTo: string,
): boolean {
  if (req.flash) {
    req.flash('error_msg', message);
  }
  res.redirect(redirectTo);
  return false;
}

// ---------------------------------------------------------------------------
// RolesGuard — generic; reads @Roles() metadata from the handler/class
// ---------------------------------------------------------------------------

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() decoration — route is open to any authenticated user
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<CraftifyRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    const user = getCurrentUser(req);

    if (!user) {
      return denyAccess(req, res, 'Please log in to access this page', '/auth/login');
    }

    if (!requiredRoles.includes(user.role)) {
      return denyAccess(req, res, "You don't have permission to access this page", '/');
    }

    return true;
  }
}

// ---------------------------------------------------------------------------
// CustomerGuard — role must be exactly 'customer'
// ---------------------------------------------------------------------------

@Injectable()
export class CustomerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<CraftifyRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    const user = getCurrentUser(req);

    if (!user) {
      return denyAccess(req, res, 'Please log in to access this page', '/auth/login');
    }

    if (user.role !== 'customer') {
      return denyAccess(req, res, 'This area is for customers only', '/');
    }

    return true;
  }
}

// ---------------------------------------------------------------------------
// ArtisanGuard — role must be 'artisan' OR 'admin'
// ---------------------------------------------------------------------------

@Injectable()
export class ArtisanGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<CraftifyRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    const user = getCurrentUser(req);

    if (!user) {
      return denyAccess(req, res, 'Please log in to access this page', '/auth/login');
    }

    if (user.role !== 'artisan' && user.role !== 'admin') {
      return denyAccess(req, res, 'This area is for artisans only', '/');
    }

    return true;
  }
}

// ---------------------------------------------------------------------------
// AdminGuard — role must be exactly 'admin'
// ---------------------------------------------------------------------------

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<CraftifyRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    const user = getCurrentUser(req);

    if (!user) {
      return denyAccess(req, res, 'Please log in to access this page', '/auth/login');
    }

    if (user.role !== 'admin') {
      return denyAccess(req, res, 'This area is for administrators only', '/');
    }

    return true;
  }
}

// ---------------------------------------------------------------------------
// CustomerOrGuestGuard — blocks artisans and admins from accessing the route
// (customer or unauthenticated visitors are allowed through)
// ---------------------------------------------------------------------------

@Injectable()
export class CustomerOrGuestGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<CraftifyRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    const user = getCurrentUser(req);

    if (user && (user.role === 'artisan' || user.role === 'admin')) {
      return denyAccess(req, res, 'This area is not available for your account type', '/');
    }

    return true;
  }
}

// ---------------------------------------------------------------------------
// ActiveGuard — user must exist and have status === 'active'
// ---------------------------------------------------------------------------

@Injectable()
export class ActiveGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<CraftifyRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    const user = getCurrentUser(req);

    if (!user) {
      return denyAccess(req, res, 'Please log in to access this page', '/auth/login');
    }

    if (user.status !== 'active') {
      return denyAccess(req, res, 'Your account has been suspended', '/auth/login');
    }

    return true;
  }
}

// ---------------------------------------------------------------------------
// ApprovedArtisanGuard — role must be 'artisan' AND artisanProfile.is_approved === 1
// ---------------------------------------------------------------------------

@Injectable()
export class ApprovedArtisanGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<CraftifyRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    const user = getCurrentUser(req);

    if (!user) {
      return denyAccess(req, res, 'Please log in to access this page', '/auth/login');
    }

    if (user.role !== 'artisan') {
      return denyAccess(req, res, 'This area is for approved artisans only', '/');
    }

    if (!user.artisanProfile || user.artisanProfile.is_approved !== 1) {
      return denyAccess(
        req,
        res,
        'Your artisan profile is pending approval. You will be notified once it is reviewed.',
        '/artisan/pending',
      );
    }

    return true;
  }
}
