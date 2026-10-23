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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminRoleGuard } from '../admin/admin-role.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import type { Viewer } from './community.utils.js';
import { CommentInputDto, DiscussionInputDto, DiscussionLockDto } from './dto/discussions.dto.js';
import { PaginationQueryDto } from './dto/pagination.dto.js';
import { DiscussionsService } from './discussions.service.js';

type UserRequest = Request & { user: Viewer };
type OptionalUserRequest = Request & { user?: Viewer | null };

@ApiTags('Discussions')
@Controller()
export class DiscussionsController {
  constructor(private readonly discussions: DiscussionsService) {}

  // Đọc công khai; token (nếu có) chỉ dùng để tính quyền sửa/xóa hiển thị cho người xem.
  @Get('discussions')
  @ApiOperation({ summary: 'Danh sách chủ đề thảo luận mới nhất' })
  list(@Query() query: PaginationQueryDto) {
    return this.discussions.list(query);
  }

  @Post('discussions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() input: DiscussionInputDto, @Req() request: UserRequest) {
    return this.discussions.create(request.user, input.title, input.content);
  }

  @Get('discussions/:id')
  @UseGuards(OptionalJwtAuthGuard)
  get(@Param('id', ParseUUIDPipe) id: string, @Req() request: OptionalUserRequest) {
    return this.discussions.get(id, request.user ?? null);
  }

  @Patch('discussions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  update(@Param('id', ParseUUIDPipe) id: string, @Body() input: DiscussionInputDto, @Req() request: UserRequest) {
    return this.discussions.update(id, request.user, input.title, input.content);
  }

  @Delete('discussions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Req() request: UserRequest) {
    await this.discussions.remove(id, request.user);
  }

  @Patch('discussions/:id/lock')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @ApiBearerAuth()
  lock(@Param('id', ParseUUIDPipe) id: string, @Body() input: DiscussionLockDto, @Req() request: UserRequest) {
    return this.discussions.setLocked(id, request.user, input.isLocked);
  }

  @Get('discussions/:id/comments')
  @UseGuards(OptionalJwtAuthGuard)
  listComments(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
    @Req() request: OptionalUserRequest,
  ) {
    return this.discussions.listComments(id, request.user ?? null, query);
  }

  @Post('discussions/:id/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  async addComment(@Param('id', ParseUUIDPipe) id: string, @Body() input: CommentInputDto, @Req() request: UserRequest) {
    await this.discussions.addComment(id, request.user, input.content);
  }

  @Patch('discussion-comments/:commentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  async editComment(
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() input: CommentInputDto,
    @Req() request: UserRequest,
  ) {
    await this.discussions.editComment(commentId, request.user, input.content);
  }

  @Delete('discussion-comments/:commentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeComment(@Param('commentId', ParseUUIDPipe) commentId: string, @Req() request: UserRequest) {
    await this.discussions.removeComment(commentId, request.user);
  }
}
