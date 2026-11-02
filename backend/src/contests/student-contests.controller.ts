import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiServiceUnavailableResponse,
  ApiUnauthorizedResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import { CreateSubmissionDto } from '../submissions/dto/create-submission.dto.js';
import { SubmissionsService } from '../submissions/submissions.service.js';
import { ContestRegistrationResponseDto, StudentContestDetailResponseDto, StudentContestPageResponseDto } from './dto/student-contests-response.dto.js';
import { ListStudentContestsQueryDto } from './dto/student-contests.dto.js';
import { StudentContestsService } from './student-contests.service.js';

type OptionalUserRequest = Request & { user?: { id: string } | null };
type AuthenticatedUserRequest = Request & { user: { id: string } };

@ApiTags('Student Contests')
@Controller('contests')
export class StudentContestsController {
  constructor(
    private readonly contests: StudentContestsService,
    private readonly submissions: SubmissionsService,
  ) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Danh sách cuộc thi công khai đã xuất bản',
    description: 'Hỗ trợ tìm kiếm, lọc trạng thái thời gian, sắp xếp và phân trang.',
  })
  @ApiQuery({ type: ListStudentContestsQueryDto })
  @ApiBadRequestResponse({ description: 'Bộ lọc, phân trang hoặc sắp xếp không hợp lệ.' })
  @ApiOkResponse({ type: StudentContestPageResponseDto })
  list(
    @Query() query: ListStudentContestsQueryDto,
    @Req() request: OptionalUserRequest,
  ) {
    return this.contests.list(query, request.user?.id ?? null);
  }

  @Get(':identifier')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Chi tiết cuộc thi công khai theo UUID hoặc slug',
    description:
      'Danh sách bài và điểm chỉ hiển thị cho người đã đăng ký trong thời gian diễn ra cuộc thi.',
  })
  @ApiNotFoundResponse({ description: 'Cuộc thi không tồn tại hoặc không công khai.' })
  @ApiOkResponse({ type: StudentContestDetailResponseDto })
  get(
    @Param('identifier') identifier: string,
    @Req() request: OptionalUserRequest,
  ) {
    return this.contests.get(identifier, request.user?.id ?? null);
  }

  @Post(':identifier/registration')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Đăng ký tham gia cuộc thi',
    description: 'Chỉ tài khoản đăng nhập được đăng ký trước thời điểm bắt đầu.',
  })
  @ApiUnauthorizedResponse({ description: 'Thiếu hoặc access token không hợp lệ.' })
  @ApiNotFoundResponse({ description: 'Cuộc thi không tồn tại hoặc không công khai.' })
  @ApiConflictResponse({ description: 'Đã đăng ký, đăng ký đã đóng hoặc cuộc thi đã bắt đầu.' })
  @ApiCreatedResponse({ type: ContestRegistrationResponseDto })
  register(
    @Param('identifier') identifier: string,
    @Req() request: AuthenticatedUserRequest,
  ) {
    return this.contests.register(identifier, request.user.id);
  }

  @Delete(':identifier/registration')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Hủy đăng ký tham gia cuộc thi',
    description: 'Có thể đăng ký lại trước khi cuộc thi bắt đầu.',
  })
  @ApiUnauthorizedResponse({ description: 'Thiếu hoặc access token không hợp lệ.' })
  @ApiNotFoundResponse({ description: 'Cuộc thi không tồn tại hoặc không công khai.' })
  @ApiConflictResponse({ description: 'Chưa đăng ký hoặc cuộc thi đã bắt đầu.' })
  @ApiOkResponse({ type: ContestRegistrationResponseDto })
  cancel(
    @Param('identifier') identifier: string,
    @Req() request: AuthenticatedUserRequest,
  ) {
    return this.contests.cancel(identifier, request.user.id);
  }

  @Post(':identifier/submissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Nộp bài trong cuộc thi',
    description:
      'Yêu cầu người dùng đã đăng ký, cuộc thi đang diễn ra và bài tập/ngôn ngữ hợp lệ. Bài nộp được xếp vào pipeline chấm hiện có.',
  })
  @ApiBadRequestResponse({ description: 'Request không hợp lệ hoặc ngôn ngữ không được hỗ trợ.' })
  @ApiUnauthorizedResponse({ description: 'Thiếu hoặc access token không hợp lệ.' })
  @ApiForbiddenResponse({ description: 'Người dùng chưa đăng ký hoặc đã hủy đăng ký.' })
  @ApiNotFoundResponse({ description: 'Cuộc thi hoặc bài tập trong cuộc thi không tồn tại/công khai.' })
  @ApiConflictResponse({ description: 'Cuộc thi chưa bắt đầu hoặc đã kết thúc.' })
  @ApiServiceUnavailableResponse({
    description:
      'Bài nộp đã được lưu nhưng chưa xác nhận được trạng thái hàng đợi; response có submissionId để kiểm tra lại.',
  })
  @ApiCreatedResponse({
    description: 'Bài nộp đã được lưu và đưa vào hàng đợi chấm.',
    schema: {
      example: {
        id: 'a246b1f2-c8bb-4b43-b2e1-b50dc6001e11',
        status: 'QUEUED',
        submittedAt: '2026-10-31T08:15:00.000Z',
      },
    },
  })
  submit(
    @Param('identifier') identifier: string,
    @Body() dto: CreateSubmissionDto,
    @Req() request: AuthenticatedUserRequest,
  ) {
    return this.submissions.createForContest(request.user.id, identifier, dto);
  }
}
