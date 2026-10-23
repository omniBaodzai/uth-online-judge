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
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import { CreateSubmissionDto } from './dto/create-submission.dto.js';
import { GlobalSubmissionsQueryDto } from './dto/global-submissions.dto.js';
import { ProblemSubmissionsParamsDto, ProblemSubmissionsQueryDto } from './dto/problem-submissions.dto.js';
import { SubmissionsService } from './submissions.service.js';

type AuthenticatedRequest = Request & { user: { id: string } };
type OptionalAuthRequest = Request & { user?: { id: string } | null };

@ApiTags('Submissions')
@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo bài nộp và xếp hàng chấm bất đồng bộ' })
  create(@Body() dto: CreateSubmissionDto, @Req() request: AuthenticatedRequest) {
    // userId lấy từ token, không bao giờ từ body.
    return this.submissions.create(request.user.id, dto);
  }

  // Công khai: khách không cần đăng nhập. Token (nếu có) chỉ dùng để đánh dấu bài nộp của chính họ.
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Bảng chấm bài công khai: danh sách và thống kê bài nộp (không có mã nguồn)' })
  list(@Query() query: GlobalSubmissionsQueryDto, @Req() request: OptionalAuthRequest) {
    return this.submissions.getGlobalSubmissions(request.user?.id ?? null, query);
  }

  @Get('mine/:problemCode')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xem danh sách bài nộp của chính mình cho một bài tập' })
  getMineForProblem(
    @Param() params: ProblemSubmissionsParamsDto,
    @Query() query: ProblemSubmissionsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.submissions.getProblemSubmissions(request.user.id, params.problemCode, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xem bài nộp của chính mình' })
  get(@Param('id', new ParseUUIDPipe()) id: string, @Req() request: AuthenticatedRequest) {
    return this.submissions.getOwned(id, request.user.id);
  }
}
