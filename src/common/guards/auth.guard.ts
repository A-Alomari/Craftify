import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Request, Response } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & {
      isAuthenticated?: () => boolean;
      session: Record<string, any>;
      flash?: (type: string, message: string) => void;
      xhr?: boolean;
    }>();
    const res = context.switchToHttp().getResponse<Response>();

    if (req.isAuthenticated && req.isAuthenticated()) {
      return true;
    }

    const isXhr =
      req.xhr ||
      String(req.headers['x-requested-with'] || '').toLowerCase() === 'xmlhttprequest';

    if (isXhr) {
      res.status(401).json({ error: 'Unauthorized', message: 'Please log in to access this page' });
      return false;
    }

    // Store the return URL so we can redirect back after login
    req.session.returnTo = req.originalUrl;

    if (req.flash) {
      req.flash('error_msg', 'Please log in to access this page');
    }

    res.redirect('/auth/login');
    return false;
  }
}
