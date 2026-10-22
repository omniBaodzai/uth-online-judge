import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './databases/database.module.js';
import { DemoQueueModule } from './queues/demo-queue.module.js';

@Module({
  imports: [DatabaseModule, AuthModule, DemoQueueModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
