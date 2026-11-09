import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminRoleGuard } from '../admin/admin-role.guard.js';
import { SubmissionsModule } from '../submissions/submissions.module.js';
import { ContestsController } from './contests.controller.js';
import { ContestsRepository } from './contests.repository.js';
import { ContestsService } from './contests.service.js';
import { StudentContestsController } from './student-contests.controller.js';
import { StudentContestsRepository } from './student-contests.repository.js';
import { StudentContestsService } from './student-contests.service.js';

@Module({
  imports: [AuthModule, SubmissionsModule],
  controllers: [ContestsController, StudentContestsController],
  providers: [
    AdminRoleGuard,
    ContestsRepository,
    ContestsService,
    StudentContestsRepository,
    StudentContestsService,
  ],
  exports: [ContestsService],
})
export class ContestsModule {}
