import { Module } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service.js';
import { UserProfileService } from './user-profile.service.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UserProfileService, LeaderboardService],
  exports: [UsersService],
})
export class UsersModule {}
