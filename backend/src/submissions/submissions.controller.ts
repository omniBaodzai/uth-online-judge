import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateSubmissionDto } from './dto/create-submission.dto.js';
import { ProblemSubmissionsParamsDto, ProblemSubmissionsQueryDto } from './dto/problem-submissions.dto.js';
import { SubmissionsService } from './submissions.service.js';

type AuthenticatedRequest = Request & { user: { id: string } };

@ApiTags('Submissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo bài nộp và xếp hàng chấm bất đồng bộ' })
  create(@Body() dto: CreateSubmissionDto, @Req() request: AuthenticatedRequest) {
    // userId lấy từ token, không bao giờ từ body.
    return this.submissions.create(request.user.id, dto);
  }

  @Get('mine/:problemCode')
  @ApiOperation({ summary: 'Xem danh sách bài nộp của chính mình cho một bài tập' })
  getMineForProblem(
    @Param() params: ProblemSubmissionsParamsDto,
    @Query() query: ProblemSubmissionsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.submissions.getProblemSubmissions(request.user.id, params.problemCode, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem bài nộp của chính mình' })
  get(@Param('id', new ParseUUIDPipe()) id: string, @Req() request: AuthenticatedRequest) {
    return this.submissions.getOwned(id, request.user.id);
  }
}
