import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateSubmissionDto } from './dto/create-submission.dto.js';
import { SubmissionsService } from './submissions.service.js';

type AuthenticatedRequest = Request & { user: { id: string } };

function toPositiveInt(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

@ApiTags('submissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/submissions')
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() input: CreateSubmissionDto) {
    return this.submissions.create(request.user.id, input);
  }

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('problemCode') problemCode?: string,
    @Query('mine') mine?: string,
  ) {
    const currentPage = toPositiveInt(page, 1, 100_000);
    const size = toPositiveInt(pageSize, 20, 100);
    return this.submissions
      .list({
        userId: mine === 'true' ? request.user.id : undefined,
        problemCode: problemCode?.slice(0, 30),
        page: currentPage,
        pageSize: size,
      })
      .then((result) => ({ ...result, page: currentPage, pageSize: size }));
  }

  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.submissions.get(id, request.user.id);
  }
}
