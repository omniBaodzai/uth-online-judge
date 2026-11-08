import {
  Body,
  Controller,
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
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AdminRoleGuard } from '../admin/admin-role.guard.js';
import {
  CreateContestDto,
  ListContestsQueryDto,
  ReplaceContestProblemsDto,
  UpdateContestDto,
} from './dto/contest.dto.js';
import {
  ContestDetailResponseDto,
  ContestOverviewResponseDto,
  ContestPageResponseDto,
  ContestProblemResponseDto,
} from './dto/contest-response.dto.js';
import { ContestsService } from './contests.service.js';
import { DocumentControllerOperations } from '../swagger/document-controller-operations.decorator.js';

type AdminRequest = Request & { user: { id: string; role: 'ADMIN' } };

@ApiTags('Admin Contests')
@DocumentControllerOperations()
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminRoleGuard)
@Controller('admin/contests')
export class ContestsController {
  constructor(private readonly contests: ContestsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Thống kê tổng quan cuộc thi dành cho Admin' })
  @ApiOkResponse({ type: ContestOverviewResponseDto })
  overview() {
    return this.contests.overview();
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách cuộc thi với tìm kiếm, lọc và phân trang' })
  @ApiOkResponse({ type: ContestPageResponseDto })
  list(@Query() query: ListContestsQueryDto) {
    return this.contests.list(query);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo cuộc thi ở trạng thái bản nháp' })
  @ApiCreatedResponse({ type: ContestDetailResponseDto })
  create(@Body() input: CreateContestDto, @Req() request: AdminRequest) {
    return this.contests.create(input, request.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết cuộc thi và danh sách bài tập' })
  @ApiOkResponse({ type: ContestDetailResponseDto })
  get(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.contests.get(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin cuộc thi trước khi lưu trữ' })
  @ApiOkResponse({ type: ContestDetailResponseDto })
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdateContestDto,
    @Req() request: AdminRequest,
  ) {
    return this.contests.update(id, input, request.user.id);
  }

  @Put(':id/problems')
  @ApiOperation({ summary: 'Thay thế danh sách bài tập trong cuộc thi' })
  @ApiOkResponse({ type: ContestProblemResponseDto, isArray: true })
  replaceProblems(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: ReplaceContestProblemsDto,
  ) {
    return this.contests.replaceProblems(id, input.problems);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xuất bản cuộc thi PUBLIC đã cấu hình hợp lệ' })
  @ApiOkResponse({ type: ContestDetailResponseDto })
  publish(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.contests.publish(id);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lưu trữ cuộc thi đã xuất bản' })
  @ApiOkResponse({ type: ContestDetailResponseDto })
  archive(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.contests.archive(id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Khôi phục cuộc thi PUBLIC đã lưu trữ' })
  @ApiOkResponse({ type: ContestDetailResponseDto })
  restore(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.contests.restore(id);
  }
}
