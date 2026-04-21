import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key used by RolesGuard to read required roles from a handler or class.
 */
export const ROLES_KEY = 'roles';

/**
 * @Roles(...roles) decorator.
 *
 * Attach one or more role strings to a controller method or class.
 * RolesGuard will read this metadata and block any authenticated user whose
 * role is not included in the list.
 *
 * Usage:
 *   @Roles('admin')
 *   @Roles('artisan', 'admin')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
