import { Module } from '@nestjs/common';
import { SubmissionsController } from './submissions.controller.js';
import { SubmissionsRepository } from './submissions.repository.js';
import { SubmissionsService } from './submissions.service.js';

@Module({
  controllers: [SubmissionsController],
  providers: [SubmissionsService, SubmissionsRepository],
})
export class SubmissionsModule {}
