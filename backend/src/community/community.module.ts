import { Module } from '@nestjs/common';
import { DiscussionsController } from './discussions.controller.js';
import { DiscussionsRepository } from './discussions.repository.js';
import { DiscussionsService } from './discussions.service.js';
import { AdminNewsController, NewsController } from './news.controller.js';
import { NewsRepository } from './news.repository.js';
import { NewsService } from './news.service.js';
import { ReactionsRepository } from './reactions.repository.js';

@Module({
  controllers: [NewsController, AdminNewsController, DiscussionsController],
  providers: [NewsRepository, NewsService, DiscussionsRepository, ReactionsRepository, DiscussionsService],
})
export class CommunityModule {}
