import { Module } from '@nestjs/common';
import { JudgingModule } from '../judging/judging.module.js';
import { BestSubmissionsController } from './best-submissions.controller.js';
import { BestSubmissionsRepository } from './best-submissions.repository.js';
import { SubmissionsController } from './submissions.controller.js';
import { SubmissionsRepository } from './submissions.repository.js';
import { SubmissionsService } from './submissions.service.js';

@Module({
  imports: [JudgingModule],
  controllers: [SubmissionsController, BestSubmissionsController],
  providers: [SubmissionsService, SubmissionsRepository, BestSubmissionsRepository],
})
export class SubmissionsModule {}
