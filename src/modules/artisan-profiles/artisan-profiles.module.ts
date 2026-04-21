import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtisanProfile } from '../../database/entities/artisan-profile.entity';
import { User } from '../../database/entities/user.entity';
import { ArtisanProfilesService } from './artisan-profiles.service';

/**
 * ArtisanProfilesModule
 *
 * Shared module that provides ArtisanProfilesService to any module that
 * imports it (HomeModule, ArtisanModule, AdminModule).
 */
@Module({
  imports: [TypeOrmModule.forFeature([ArtisanProfile, User])],
  providers: [ArtisanProfilesService],
  exports: [ArtisanProfilesService],
})
export class ArtisanProfilesModule {}
