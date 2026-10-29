import { Module } from '@nestjs/common';
import { LeaderboardModule } from '../leaderboard/leaderboard.module.js';
import { PublicProfileController } from './public-profile.controller.js';
import { PublicProfileRepository } from './public-profile.repository.js';
import { PublicProfileService } from './public-profile.service.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [LeaderboardModule],
  controllers: [PublicProfileController],
  providers: [UsersService, PublicProfileRepository, PublicProfileService],
  exports: [UsersService, PublicProfileService],
})
export class UsersModule {}
