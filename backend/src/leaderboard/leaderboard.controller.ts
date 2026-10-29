import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import { LeaderboardQueryDto } from './leaderboard.dto.js';
import { LeaderboardService } from './leaderboard.service.js';

type OptionalAuthRequest = Request & { user?: { id: string } | null };

@ApiTags('Leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Bảng xếp hạng tổng thể theo bài AC, điểm tích lũy và hiệu suất tương đương' })
  get(@Query() query: LeaderboardQueryDto, @Req() request: OptionalAuthRequest) {
    return this.leaderboard.getLeaderboard(query, request.user?.id ?? null);
  }
}