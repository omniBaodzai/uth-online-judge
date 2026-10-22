import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { JudgeProcessor } from './judge.processor.js';
import { JUDGE_QUEUE } from './submission.constants.js';
import { SubmissionsController } from './submissions.controller.js';
import { SubmissionsRepository } from './submissions.repository.js';
import { SubmissionsService } from './submissions.service.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: JUDGE_QUEUE }),
    HttpModule.register({ timeout: 30_000 }),
  ],
  controllers: [SubmissionsController],
  providers: [SubmissionsService, SubmissionsRepository, JudgeProcessor],
})
export class SubmissionsModule {}
