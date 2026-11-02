import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminRoleGuard } from '../admin/admin-role.guard.js';
import {
  AdminContactMessagesController,
  MyContactMessagesController,
  MyNotificationsController,
  PublicContactMessagesController,
} from './contact.controller.js';
import { ContactRepository } from './contact.repository.js';
import { ContactService } from './contact.service.js';

@Module({
  imports: [AuthModule],
  controllers: [
    PublicContactMessagesController,
    AdminContactMessagesController,
    MyContactMessagesController,
    MyNotificationsController,
  ],
  providers: [ContactRepository, ContactService, AdminRoleGuard],
})
export class ContactModule {}
