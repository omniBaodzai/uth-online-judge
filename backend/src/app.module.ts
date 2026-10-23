import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './databases/database.module.js';
import { DemoQueueModule } from './queues/demo-queue.module.js';
import { ProblemsModule } from './problems/problems.module.js';
import { SubmissionsModule } from './submissions/submissions.module.js';
import { AdminModule } from './admin/admin.module.js';

@Module({
  imports: [DatabaseModule, AuthModule, DemoQueueModule, ProblemsModule, SubmissionsModule, AdminModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
