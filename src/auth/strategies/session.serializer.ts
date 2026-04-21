import { Injectable } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { ArtisanProfile } from '../../database/entities/artisan-profile.entity';

/**
 * SessionSerializer — instructs Passport how to persist and restore user
 * identity across HTTP requests using the session store.
 *
 * serializeUser   : called once on login; stores only the user ID to keep the
 *                   session payload small.
 * deserializeUser : called on every subsequent request that carries a session;
 *                   re-loads the full user record from the DB and builds the
 *                   session user shape that existing guards expect.
 *
 * After deserialization, Passport sets req.user to the return value.
 * AuthService.login also writes req.session.user directly so legacy guards
 * that check req.session.user (rather than req.user) continue to work
 * on the very first post-login response before a new request comes in.
 */
@Injectable()
export class SessionSerializer extends PassportSerializer {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ArtisanProfile)
    private readonly artisanRepo: Repository<ArtisanProfile>,
  ) {
    super();
  }

  // -------------------------------------------------------------------------
  // serializeUser — write to session
  // -------------------------------------------------------------------------

  serializeUser(
    user: any,
    done: (err: Error | null, id?: number) => void,
  ): void {
    // user may be the raw User entity (on first login) or a sessionUser object
    // on subsequent calls; both carry an .id field.
    const id: number = typeof user === 'object' ? user.id : user;
    done(null, id);
  }

  // -------------------------------------------------------------------------
  // deserializeUser — restore from session
  // -------------------------------------------------------------------------

  async deserializeUser(
    userId: number,
    done: (err: Error | null, user?: any | false) => void,
  ): Promise<void> {
    try {
      const user = await this.userRepo.findOne({ where: { id: Number(userId) } });

      if (!user) {
        // User deleted since session was created — invalidate
        return done(null, false as any);
      }

      // Build the compact session user object (matches legacy req.session.user shape)
      const sessionUser: Record<string, any> = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        avatar: user.avatar ?? null,
      };

      if (user.role === 'artisan') {
        const profile = await this.artisanRepo.findOne({
          where: { user_id: user.id },
        });
        if (profile) {
          sessionUser['artisanProfile'] = {
            id: profile.id,
            shop_name: profile.shop_name,
            profile_image: profile.profile_image ?? null,
            is_approved: profile.is_approved,
          };
        }
      }

      done(null, sessionUser);
    } catch (err) {
      done(err as Error);
    }
  }
}
