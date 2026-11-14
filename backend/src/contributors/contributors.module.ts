import { Module } from '@nestjs/common';
import { ContributorsController } from './contributors.controller.js';
import { ContributorsRepository } from './contributors.repository.js';
import { ContributorsService } from './contributors.service.js';

@Module({
  controllers: [ContributorsController],
  providers: [ContributorsRepository, ContributorsService],
})
export class ContributorsModule {}
