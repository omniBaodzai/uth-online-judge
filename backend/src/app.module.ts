import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './databases/database.module.js';
import { SubmissionsModule } from './submissions/submissions.module.js';

@Module({
  imports: [
    DatabaseModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    AuthModule,
    SubmissionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
