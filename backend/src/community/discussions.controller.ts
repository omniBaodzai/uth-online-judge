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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminRoleGuard } from '../admin/admin-role.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import type { Viewer } from './community.utils.js';
import {
  CommentInputDto,
  CreateCommentDto,
  DiscussionInputDto,
  DiscussionLockDto,
  ReactionInputDto,
} from './dto/discussions.dto.js';
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
  async addComment(@Param('id', ParseUUIDPipe) id: string, @Body() input: CreateCommentDto, @Req() request: UserRequest) {
    await this.discussions.addComment(id, request.user, input.content, input.parentId ?? null);
  }

  // Cảm xúc: người dùng luôn lấy từ token, không nhận userId từ client.
  @Put('discussions/:id/reaction')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  setDiscussionReaction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ReactionInputDto,
    @Req() request: UserRequest,
  ) {
    return this.discussions.setReaction('DISCUSSION', id, request.user, input.type);
  }

  @Delete('discussions/:id/reaction')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  removeDiscussionReaction(@Param('id', ParseUUIDPipe) id: string, @Req() request: UserRequest) {
    return this.discussions.removeReaction('DISCUSSION', id, request.user);
  }

  @Put('discussion-comments/:commentId/reaction')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  setCommentReaction(
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() input: ReactionInputDto,
    @Req() request: UserRequest,
  ) {
    return this.discussions.setReaction('COMMENT', commentId, request.user, input.type);
  }

  @Delete('discussion-comments/:commentId/reaction')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  removeCommentReaction(@Param('commentId', ParseUUIDPipe) commentId: string, @Req() request: UserRequest) {
    return this.discussions.removeReaction('COMMENT', commentId, request.user);
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
