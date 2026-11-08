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
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import { CreateSubmissionDto } from '../submissions/dto/create-submission.dto.js';
import { OrganizationSubmissionQueryDto } from './organization-submissions.dto.js';
import { OrganizationSubmissionsService } from './organization-submissions.service.js';
import type { Viewer } from './organizations.types.js';
import { DocumentControllerOperations } from '../swagger/document-controller-operations.decorator.js';

type OptionalRequest = Request & { user?: { id: string; role: 'STUDENT' | 'ADMIN' } | null };
type AuthenticatedRequest = Request & { user: { id: string; role: 'STUDENT' | 'ADMIN' } };

const viewerOf = (request: OptionalRequest): Viewer =>
  request.user ? { id: request.user.id, role: request.user.role } : null;

@ApiTags('Organization submissions')
@DocumentControllerOperations()
@Controller('organizations/:slug/submissions')
export class OrganizationSubmissionsController {
  constructor(private readonly submissions: OrganizationSubmissionsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiBody({
    type: CreateSubmissionDto,
    examples: {
      example: {
        summary: 'Bài nộp minh họa (mã bài và ngôn ngữ phải tồn tại)',
        value: {
          problemCode: 'problem_code',
          language: 'cpp',
          sourceCode: '#include <iostream>\nint main() { return 0; }',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Bài nộp được lưu và xếp hàng chấm; ID và timestamp trong ví dụ là placeholder.',
    schema: {
      example: {
        id: '00000000-0000-4000-8000-000000000000',
        status: 'QUEUED',
        submittedAt: '2026-01-01T00:00:00.000Z',
      },
    },
  })
  @ApiOperation({ summary: 'Tạo bài nộp độc lập cho bài tập Organization và đưa vào pipeline Judge0' })
  create(
    @Param('slug') slug: string,
    @Body() input: CreateSubmissionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.submissions.create(slug, viewerOf(request), input);
  }

  @Get('languages/:problemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ngôn ngữ được phép nộp cho bài tập Organization hiện có thể nộp' })
  languages(
    @Param('slug') slug: string,
    @Param('problemId', ParseUUIDPipe) problemId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.submissions.listStandaloneLanguages(
      slug,
      problemId,
      viewerOf(request),
    );
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Lịch sử bài nộp Organization theo visibility và bộ lọc' })
  list(
    @Param('slug') slug: string,
    @Query() query: OrganizationSubmissionQueryDto,
    @Req() request: OptionalRequest,
  ) {
    return this.submissions.list(slug, viewerOf(request), query);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lịch sử cá nhân, kể cả sau khi rời hoặc khi Organization được lưu trữ; không trả thông tin problem/contest',
  })
  mine(
    @Param('slug') slug: string,
    @Query() query: OrganizationSubmissionQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.submissions.mine(slug, viewerOf(request), query);
  }

  @Get(':submissionId/source')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mã nguồn: chỉ người nộp, OWNER/ADMIN hiện tại hoặc System Admin' })
  source(
    @Param('slug') slug: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.submissions.source(slug, submissionId, viewerOf(request));
  }

  @Get(':submissionId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Chi tiết kết quả bài nộp; không trả source, hidden input hoặc expected output' })
  get(
    @Param('slug') slug: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Req() request: OptionalRequest,
  ) {
    return this.submissions.get(slug, submissionId, viewerOf(request));
  }
}
