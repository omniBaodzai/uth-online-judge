import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminRoleGuard } from '../admin/admin-role.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import { PaginationQueryDto } from '../community/dto/pagination.dto.js';
import {
  ContactReplyDto,
  CreateContactMessageDto,
  CreateProblemReportDto,
  ListContactMessagesQueryDto,
  ListNotificationsQueryDto,
  UpdateContactMessageStatusDto,
  validateIdempotencyKey,
} from './contact.dto.js';
import { ContactService } from './contact.service.js';
import { DocumentControllerOperations } from '../swagger/document-controller-operations.decorator.js';

type ContactRequest = Request & { user?: { id: string; role: 'STUDENT' | 'ADMIN' } | null };
type AuthenticatedContactRequest = Request & { user: { id: string; role: 'STUDENT' | 'ADMIN' } };

@ApiTags('Contact messages')
@DocumentControllerOperations()
@Controller('contact-messages')
export class PublicContactMessagesController {
  constructor(private readonly contact: ContactService) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Gửi yêu cầu liên hệ công khai' })
  @ApiCreatedResponse({ description: 'Yêu cầu đã được tiếp nhận; Guest không thể theo dõi trực tuyến.' })
  create(@Body() input: CreateContactMessageDto, @Req() request: ContactRequest) {
    const ipAddress = request.ip || request.socket.remoteAddress || 'unknown';
    return this.contact.createMessage(input, request.user?.id ?? null, ipAddress);
  }
}

@ApiTags('Problem reports')
@DocumentControllerOperations()
@Controller('problems/:code/reports')
export class ProblemReportsController {
  constructor(private readonly contact: ContactService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Gửi báo cáo vấn đề của bài tập vào hộp thư liên hệ của Admin' })
  @ApiCreatedResponse({ description: 'Báo cáo đã được lưu với trạng thái NEW.' })
  create(
    @Param('code') code: string,
    @Body() input: CreateProblemReportDto,
    @Req() request: AuthenticatedContactRequest,
  ) {
    return this.contact.createProblemReport(code, request.user.id, input);
  }
}

@ApiTags('Admin contact messages')
@DocumentControllerOperations()
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminRoleGuard)
@Controller('admin/contact-messages')
export class AdminContactMessagesController {
  constructor(private readonly contact: ContactService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách yêu cầu liên hệ và thống kê trạng thái' })
  list(@Query() query: ListContactMessagesQueryDto) {
    return this.contact.listAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết yêu cầu liên hệ và lịch sử trao đổi' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.contact.getAdminMessage(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Cập nhật trạng thái yêu cầu liên hệ' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateContactMessageStatusDto,
  ) {
    return this.contact.updateStatus(id, input.status);
  }

  @Post(':id/replies')
  @HttpCode(HttpStatus.CREATED)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'UUID v4 tùy chọn để nhận diện yêu cầu lặp lại.',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiOperation({ summary: 'Admin phản hồi yêu cầu liên hệ' })
  reply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ContactReplyDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: AuthenticatedContactRequest,
  ) {
    return this.contact.createReply({
      contactMessageId: id,
      senderUserId: request.user.id,
      senderRole: 'ADMIN',
      content: input.content,
      idempotencyKey: validateIdempotencyKey(idempotencyKey),
    });
  }
}

@ApiTags('My contact messages')
@DocumentControllerOperations()
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('my/contact-messages')
export class MyContactMessagesController {
  constructor(private readonly contact: ContactService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách yêu cầu liên hệ của tài khoản hiện tại' })
  list(@Query() query: PaginationQueryDto, @Req() request: AuthenticatedContactRequest) {
    return this.contact.listUserMessages(request.user.id, query.page, query.pageSize);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết yêu cầu liên hệ do tài khoản hiện tại sở hữu' })
  get(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedContactRequest,
  ) {
    return this.contact.getUserMessage(request.user.id, id);
  }

  @Post(':id/replies')
  @HttpCode(HttpStatus.CREATED)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'UUID v4 tùy chọn để nhận diện yêu cầu lặp lại.',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiOperation({ summary: 'Chủ sở hữu phản hồi yêu cầu chưa được xử lý' })
  reply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ContactReplyDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: AuthenticatedContactRequest,
  ) {
    if (request.user.role !== 'STUDENT') {
      throw new ForbiddenException('Chỉ tài khoản người dùng mới được phản hồi yêu cầu tại đây.');
    }
    return this.contact.createReply({
      contactMessageId: id,
      senderUserId: request.user.id,
      senderRole: 'USER',
      content: input.content,
      idempotencyKey: validateIdempotencyKey(idempotencyKey),
      requireOwner: true,
    });
  }
}

@ApiTags('My notifications')
@DocumentControllerOperations()
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('my/notifications')
export class MyNotificationsController {
  constructor(private readonly contact: ContactService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách thông báo của tài khoản hiện tại' })
  list(@Query() query: ListNotificationsQueryDto, @Req() request: AuthenticatedContactRequest) {
    return this.contact.listNotifications(request.user.id, query.page, query.pageSize);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Số thông báo chưa đọc của tài khoản hiện tại' })
  unreadCount(@Req() request: AuthenticatedContactRequest) {
    return this.contact.unreadNotificationCount(request.user.id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Đánh dấu đã đọc toàn bộ thông báo của tài khoản hiện tại' })
  markAllRead(@Req() request: AuthenticatedContactRequest) {
    return this.contact.markAllNotificationsRead(request.user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Đánh dấu thông báo đã đọc' })
  markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedContactRequest,
  ) {
    return this.contact.markNotificationRead(request.user.id, id);
  }
}
