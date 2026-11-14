import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LeaderboardQueryDto } from '../leaderboard/leaderboard.dto.js';
import { DocumentControllerOperations } from '../swagger/document-controller-operations.decorator.js';
import { ContributorsService } from './contributors.service.js';

@ApiTags('Contributors')
@DocumentControllerOperations()
@Controller('contributors')
export class ContributorsController {
  constructor(private readonly contributors: ContributorsService) {}

  @Get()
  @ApiOperation({
    summary: 'Bảng xếp hạng người tạo bài tập Global đã xuất bản',
  })
  get(@Query() query: LeaderboardQueryDto) {
    return this.contributors.getContributors(query);
  }
}
