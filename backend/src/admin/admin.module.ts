import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { JUDGE_QUEUE } from '../submissions/submission.constants.js';
import { AdminContentService } from './admin-content.service.js';
import { AdminDataService } from './admin-data.service.js';
import { AdminSystemService } from './admin-system.service.js';
import { AdminUsersService } from './admin-users.service.js';
import {
  AdminContentController,
  AdminDataController,
  AdminModerationController,
  AdminSystemController,
  AdminUsersController,
} from './admin.controllers.js';

@Module({
  imports: [BullModule.registerQueue({ name: JUDGE_QUEUE }), HttpModule.register({ timeout: 5000 })],
  controllers: [AdminUsersController, AdminContentController, AdminModerationController, AdminDataController, AdminSystemController],
  providers: [AdminUsersService, AdminContentService, AdminDataService, AdminSystemService],
})
export class AdminModule {}
