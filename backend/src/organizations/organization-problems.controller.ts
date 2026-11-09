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
import { ApiBearerAuth, ApiBody, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import { AdminProblemDto, AdminProblemStatusDto } from '../admin/dto/admin-problem.dto.js';
import { AdminTestCaseCollectionDto } from '../admin/dto/admin-test-case.dto.js';
import { ListAdminProblemsQueryDto } from '../admin/dto/list-admin-problems-query.dto.js';
import { OrganizationProblemsService } from './organization-problems.service.js';
import type { Viewer } from './organizations.types.js';
import { DocumentControllerOperations } from '../swagger/document-controller-operations.decorator.js';

type OptionalRequest = Request & { user?: { id: string; role: 'STUDENT' | 'ADMIN' } | null };
type AuthedRequest = Request & { user: { id: string; role: 'STUDENT' | 'ADMIN' } };

const viewerOf = (request: OptionalRequest): Viewer =>
  request.user ? { id: request.user.id, role: request.user.role } : null;

@ApiTags('Organization problems')
@DocumentControllerOperations()
@Controller('organizations/:slug/problems')
export class OrganizationProblemsController {
  constructor(private readonly problems: OrganizationProblemsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Bài tập của tổ chức theo visibility và quyền xem' })
  list(
    @Param('slug') slug: string,
    @Query() query: ListAdminProblemsQueryDto,
    @Req() request: OptionalRequest,
  ) {
    return this.problems.list(slug, viewerOf(request), query);
  }

  @Get(':problemId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Chi tiết bài tập đã xuất bản hoặc chi tiết quản trị' })
  get(
    @Param('slug') slug: string,
    @Param('problemId', ParseUUIDPipe) problemId: string,
    @Req() request: OptionalRequest,
  ) {
    return this.problems.get(slug, problemId, viewerOf(request));
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiBody({
    type: AdminProblemDto,
    examples: {
      example: {
        summary: 'Tạo bài tập nháp minh họa',
        description: 'Mã bài và ngôn ngữ là giá trị ví dụ; ngôn ngữ phải được cấu hình trong hệ thống.',
        value: {
          code: 'problem_code',
          title: 'Bài tập minh họa',
          statement: 'Viết chương trình xử lý dữ liệu đầu vào theo yêu cầu.',
          tags: ['demo'],
          languages: ['cpp'],
          timeLimitSeconds: 1,
          memoryLimitMb: 256,
          status: 'draft',
          difficulty: 'easy',
        },
      },
    },
  })
  @ApiOperation({ summary: 'OWNER/Organization ADMIN/System Admin: tạo bài tập' })
  create(
    @Param('slug') slug: string,
    @Body() input: AdminProblemDto,
    @Req() request: AuthedRequest,
  ) {
    return this.problems.create(slug, request.user, input);
  }

  @Patch(':problemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiBody({
    type: AdminProblemDto,
    examples: {
      example: {
        summary: 'Cập nhật bài tập minh họa',
        description: 'Các trường theo hợp đồng AdminProblemDto; giá trị ví dụ, không gắn với bản ghi tồn tại.',
        value: {
          code: 'problem_code',
          title: 'Bài tập minh họa',
          statement: 'Viết chương trình xử lý dữ liệu đầu vào theo yêu cầu.',
          tags: ['demo'],
          languages: ['cpp'],
          timeLimitSeconds: 1,
          memoryLimitMb: 256,
          status: 'draft',
          difficulty: 'easy',
        },
      },
    },
  })
  @ApiOperation({ summary: 'OWNER/Organization ADMIN/System Admin: cập nhật bài tập' })
  update(
    @Param('slug') slug: string,
    @Param('problemId', ParseUUIDPipe) problemId: string,
    @Body() input: AdminProblemDto,
    @Req() request: AuthedRequest,
  ) {
    return this.problems.update(slug, problemId, request.user, input);
  }

  @Patch(':problemId/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'OWNER/Organization ADMIN/System Admin: đổi trạng thái xuất bản' })
  setStatus(
    @Param('slug') slug: string,
    @Param('problemId', ParseUUIDPipe) problemId: string,
    @Body() input: AdminProblemStatusDto,
    @Req() request: AuthedRequest,
  ) {
    return this.problems.setStatus(slug, problemId, request.user, input.status);
  }

  @Delete(':problemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Bài tập nháp đã được xóa; không có nội dung phản hồi.' })
  @ApiOperation({ summary: 'OWNER/Organization ADMIN/System Admin: xóa bài tập nháp' })
  delete(
    @Param('slug') slug: string,
    @Param('problemId', ParseUUIDPipe) problemId: string,
    @Req() request: AuthedRequest,
  ) {
    return this.problems.delete(slug, problemId, request.user);
  }

  @Get(':problemId/test-cases')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Quản lý: xem test case mẫu và ẩn' })
  listTestCases(
    @Param('slug') slug: string,
    @Param('problemId', ParseUUIDPipe) problemId: string,
    @Req() request: AuthedRequest,
  ) {
    return this.problems.listTestCases(slug, problemId, request.user);
  }

  @Put(':problemId/test-cases')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Quản lý: thay thế test case theo revision' })
  replaceTestCases(
    @Param('slug') slug: string,
    @Param('problemId', ParseUUIDPipe) problemId: string,
    @Body() input: AdminTestCaseCollectionDto,
    @Req() request: AuthedRequest,
  ) {
    return this.problems.replaceTestCases(
      slug,
      problemId,
      request.user,
      input.expectedRevision,
      input.testCases,
    );
  }
}
