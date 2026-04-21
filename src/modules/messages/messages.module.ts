import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Message } from '../../database/entities/message.entity';
import { User } from '../../database/entities/user.entity';
import { ArtisanProfile } from '../../database/entities/artisan-profile.entity';

import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Message, User, ArtisanProfile])],
  providers: [MessagesService],
  controllers: [MessagesController],
  exports: [MessagesService],
})
export class MessagesModule {}
