import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import { CreateSubmissionDto } from '../submissions/dto/create-submission.dto.js';
import {
  CreateContestDto,
  ListContestsQueryDto,
  ReplaceContestProblemsDto,
  UpdateContestDto,
} from '../contests/dto/contest.dto.js';
import { OrganizationContestProblemOptionsQueryDto } from '../contests/dto/organization-contest-problem-options.dto.js';
import { OrganizationContestsService } from './organization-contests.service.js';
import { OrganizationSubmissionsService } from './organization-submissions.service.js';
import type { Viewer } from './organizations.types.js';
import { DocumentControllerOperations } from '../swagger/document-controller-operations.decorator.js';

type OptionalRequest = Request & { user?: { id: string; role: 'STUDENT' | 'ADMIN' } | null };
type AuthedRequest = Request & { user: { id: string; role: 'STUDENT' | 'ADMIN' } };

const viewerOf = (request: OptionalRequest): Viewer =>
  request.user ? { id: request.user.id, role: request.user.role } : null;

@ApiTags('Organization contests')
@DocumentControllerOperations()
@Controller('organizations/:slug/contests')
export class OrganizationContestsController {
  constructor(
    private readonly contests: OrganizationContestsService,
    private readonly submissions: OrganizationSubmissionsService,
  ) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Kỳ thi của tổ chức theo trạng thái, visibility và quyền xem' })
  list(
    @Param('slug') slug: string,
    @Query() query: ListContestsQueryDto,
    @Req() request: OptionalRequest,
  ) {
    return this.contests.list(slug, viewerOf(request), query);
  }

  @Get('problem-options')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Quản lý: danh sách bài đã xuất bản và được cấp quyền dùng trong kỳ thi' })
  listProblemOptions(
    @Param('slug') slug: string,
    @Query() query: OrganizationContestProblemOptionsQueryDto,
    @Req() request: AuthedRequest,
  ) {
    return this.contests.listProblemOptions(slug, request.user, query.search);
  }

  @Get(':contestId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Chi tiết kỳ thi và snapshot bài tập; không trả hidden tests hoặc editorial' })
  get(
    @Param('slug') slug: string,
    @Param('contestId', ParseUUIDPipe) contestId: string,
    @Req() request: OptionalRequest,
  ) {
    return this.contests.get(slug, contestId, viewerOf(request));
  }

  @Get(':contestId/problems/:problemId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Bài tập trong contest; yêu cầu publication, visibility và grant còn hiệu lực' })
  getProblemContent(
    @Param('slug') slug: string,
    @Param('contestId', ParseUUIDPipe) contestId: string,
    @Param('problemId', ParseUUIDPipe) problemId: string,
    @Req() request: OptionalRequest,
  ) {
    return this.contests.getProblemContent(slug, contestId, problemId, viewerOf(request));
  }

  @Get(':contestId/submission-languages/:problemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ngôn ngữ được phép nộp trong kỳ thi Organization đang diễn ra' })
  submissionLanguages(
    @Param('slug') slug: string,
    @Param('contestId', ParseUUIDPipe) contestId: string,
    @Param('problemId', ParseUUIDPipe) problemId: string,
    @Req() request: AuthedRequest,
  ) {
    return this.submissions.listContestLanguages(
      slug,
      contestId,
      problemId,
      viewerOf(request),
    );
  }

  @Post(':contestId/registration')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Đăng ký Organization Contest trước giờ bắt đầu' })
  register(
    @Param('slug') slug: string,
    @Param('contestId', ParseUUIDPipe) contestId: string,
    @Req() request: AuthedRequest,
  ) {
    return this.submissions.register(slug, contestId, viewerOf(request));
  }

  @Delete(':contestId/registration')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hủy đăng ký Organization Contest trước giờ bắt đầu' })
  cancelRegistration(
    @Param('slug') slug: string,
    @Param('contestId', ParseUUIDPipe) contestId: string,
    @Req() request: AuthedRequest,
  ) {
    return this.submissions.cancelRegistration(slug, contestId, viewerOf(request));
  }

  @Post(':contestId/submissions')
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
  @ApiOperation({ summary: 'Nộp bài trong Organization Contest đã đăng ký' })
  submit(
    @Param('slug') slug: string,
    @Param('contestId', ParseUUIDPipe) contestId: string,
    @Body() input: CreateSubmissionDto,
    @Req() request: AuthedRequest,
  ) {
    return this.submissions.createForContest(slug, contestId, viewerOf(request), input);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiBody({
    type: CreateContestDto,
    examples: {
      example: {
        summary: 'Tạo kỳ thi nháp minh họa',
        value: {
          slug: 'algorithm-challenge-example',
          title: 'Kỳ thi thuật toán minh họa',
          description: 'Mô tả kỳ thi dùng làm ví dụ tài liệu.',
          rules: 'Tuân thủ quy chế của kỳ thi.',
          startsAt: '2026-12-01T09:00:00+07:00',
          endsAt: '2026-12-01T12:00:00+07:00',
          visibility: 'PRIVATE',
          allowRegistration: true,
          showLeaderboard: true,
        },
      },
    },
  })
  @ApiOperation({ summary: 'OWNER/Organization ADMIN/System Admin: tạo kỳ thi nháp' })
  create(
    @Param('slug') slug: string,
    @Body() input: CreateContestDto,
    @Req() request: AuthedRequest,
  ) {
    return this.contests.create(slug, request.user, input);
  }

  @Patch(':contestId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'OWNER/Organization ADMIN/System Admin: cập nhật kỳ thi' })
  update(
    @Param('slug') slug: string,
    @Param('contestId', ParseUUIDPipe) contestId: string,
    @Body() input: UpdateContestDto,
    @Req() request: AuthedRequest,
  ) {
    return this.contests.update(slug, contestId, request.user, input);
  }

  @Put(':contestId/problems')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiBody({
    type: ReplaceContestProblemsDto,
    examples: {
      example: {
        summary: 'Thay thế danh sách bài (UUID chỉ là placeholder)',
        description: 'UUID ví dụ không đại diện cho bài tập tồn tại trong cơ sở dữ liệu.',
        value: {
          problems: [
            {
              problemId: '00000000-0000-4000-8000-000000000000',
              maxScore: 100,
            },
          ],
        },
      },
    },
  })
  @ApiOperation({ summary: 'Quản lý: thay thế bài tập, chỉ bài trong scope hợp lệ hoặc có grant' })
  replaceProblems(
    @Param('slug') slug: string,
    @Param('contestId', ParseUUIDPipe) contestId: string,
    @Body() input: ReplaceContestProblemsDto,
    @Req() request: AuthedRequest,
  ) {
    return this.contests.replaceProblems(slug, contestId, request.user, input.problems);
  }

  @Post(':contestId/publish')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Quản lý: xuất bản kỳ thi PUBLIC hoặc PRIVATE sau khi kiểm tra bài tập' })
  publish(
    @Param('slug') slug: string,
    @Param('contestId', ParseUUIDPipe) contestId: string,
    @Req() request: AuthedRequest,
  ) {
    return this.contests.publish(slug, contestId, request.user);
  }

  @Post(':contestId/archive')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Quản lý: lưu trữ kỳ thi' })
  archive(
    @Param('slug') slug: string,
    @Param('contestId', ParseUUIDPipe) contestId: string,
    @Req() request: AuthedRequest,
  ) {
    return this.contests.archive(slug, contestId, request.user);
  }

  @Post(':contestId/restore')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Quản lý: khôi phục kỳ thi' })
  restore(
    @Param('slug') slug: string,
    @Param('contestId', ParseUUIDPipe) contestId: string,
    @Req() request: AuthedRequest,
  ) {
    return this.contests.restore(slug, contestId, request.user);
  }
}
