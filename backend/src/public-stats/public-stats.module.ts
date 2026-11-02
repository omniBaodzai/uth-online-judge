import { Module } from '@nestjs/common';
import { PublicStatsController } from './public-stats.controller.js';
import { PublicStatsService } from './public-stats.service.js';

@Module({
  controllers: [PublicStatsController],
  providers: [PublicStatsService],
})
export class PublicStatsModule {}
