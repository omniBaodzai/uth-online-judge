import { Module } from '@nestjs/common';
import { AdminRoleGuard } from '../admin/admin-role.guard.js';
import { AdminRepository } from '../admin/admin.repository.js';
import { AuthModule } from '../auth/auth.module.js';
import { ContestsModule } from '../contests/contests.module.js';
import { SubmissionsModule } from '../submissions/submissions.module.js';
import {
  AdminOrganizationRequestsController,
  AdminOrganizationsController,
  OrganizationRequestsController,
  OrganizationsController,
} from './organizations.controller.js';
import { OrganizationProblemsController } from './organization-problems.controller.js';
import { OrganizationProblemsService } from './organization-problems.service.js';
import { OrganizationContestsController } from './organization-contests.controller.js';
import { OrganizationContestsService } from './organization-contests.service.js';
import { OrganizationProblemGrantsController } from './organization-problem-grants.controller.js';
import { OrganizationSubmissionsController } from './organization-submissions.controller.js';
import { OrganizationSubmissionsRepository } from './organization-submissions.repository.js';
import { OrganizationSubmissionsService } from './organization-submissions.service.js';
import { OrganizationLeaderboardRepository } from './organization-leaderboard.repository.js';
import { OrganizationLeaderboardService } from './organization-leaderboard.service.js';
import { OrganizationProblemGrantsRepository } from './organization-problem-grants.repository.js';
import { OrganizationProblemGrantsService } from './organization-problem-grants.service.js';
import { OrganizationsRepository } from './organizations.repository.js';
import { OrganizationsService } from './organizations.service.js';

@Module({
  imports: [AuthModule, ContestsModule, SubmissionsModule],
  controllers: [
    OrganizationRequestsController,
    AdminOrganizationRequestsController,
    AdminOrganizationsController,
    OrganizationsController,
    OrganizationProblemsController,
    OrganizationContestsController,
    OrganizationProblemGrantsController,
    OrganizationSubmissionsController,
  ],
  providers: [
    OrganizationsRepository,
    OrganizationsService,
    OrganizationProblemsService,
    OrganizationContestsService,
    OrganizationProblemGrantsService,
    AdminRepository,
    OrganizationProblemGrantsRepository,
    OrganizationSubmissionsRepository,
    OrganizationSubmissionsService,
    OrganizationLeaderboardRepository,
    OrganizationLeaderboardService,
    AdminRoleGuard,
  ],
})
export class OrganizationsModule {}
