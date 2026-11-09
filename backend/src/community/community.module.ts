import { Module } from '@nestjs/common';
import { DiscussionsController } from './discussions.controller.js';
import { DiscussionsRepository } from './discussions.repository.js';
import { DiscussionsService } from './discussions.service.js';
import { AdminNewsController, NewsController } from './news.controller.js';
import { NewsRepository } from './news.repository.js';
import { NewsService } from './news.service.js';
import { ProblemCommentsController } from './problem-comments.controller.js';
import { ProblemCommentsRepository } from './problem-comments.repository.js';
import { ProblemCommentsService } from './problem-comments.service.js';
import { ReactionsRepository } from './reactions.repository.js';

@Module({
  controllers: [NewsController, AdminNewsController, DiscussionsController, ProblemCommentsController],
  providers: [
    NewsRepository,
    NewsService,
    DiscussionsRepository,
    ReactionsRepository,
    DiscussionsService,
    ProblemCommentsRepository,
    ProblemCommentsService,
  ],
})
export class CommunityModule {}
