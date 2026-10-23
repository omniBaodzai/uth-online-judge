import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminController } from './admin.controller.js';
import { AdminRepository } from './admin.repository.js';
import { AdminRoleGuard } from './admin-role.guard.js';
import { AdminService } from './admin.service.js';
import { AdminUsersController } from './admin-users.controller.js';
import { AdminUsersRepository } from './admin-users.repository.js';
import { AdminUsersService } from './admin-users.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AdminController, AdminUsersController],
  providers: [AdminRepository, AdminRoleGuard, AdminService, AdminUsersRepository, AdminUsersService],
})
export class AdminModule {}
