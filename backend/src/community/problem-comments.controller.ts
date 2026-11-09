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
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import type { Viewer } from './community.utils.js';
import { CommentInputDto, CreateCommentDto, ReactionInputDto } from './dto/discussions.dto.js';
import { PaginationQueryDto } from './dto/pagination.dto.js';
import { ProblemCommentsService } from './problem-comments.service.js';
import { DocumentControllerOperations } from '../swagger/document-controller-operations.decorator.js';

type UserRequest = Request & { user: Viewer };
type OptionalUserRequest = Request & { user?: Viewer | null };

@ApiTags('Problem comments')
@DocumentControllerOperations()
@Controller()
export class ProblemCommentsController {
  constructor(private readonly comments: ProblemCommentsService) {}

  @Get('problems/:code/comments')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Bình luận của một bài tập đã xuất bản (phân trang theo bình luận gốc)' })
  list(@Param('code') code: string, @Query() query: PaginationQueryDto, @Req() request: OptionalUserRequest) {
    return this.comments.listComments(code, request.user ?? null, query);
  }

  @Post('problems/:code/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gửi bình luận hoặc trả lời (parentId) cho bài tập' })
  @HttpCode(HttpStatus.CREATED)
  async add(@Param('code') code: string, @Body() input: CreateCommentDto, @Req() request: UserRequest) {
    await this.comments.addComment(code, request.user, input.content, input.parentId ?? null);
  }

  @Put('problem-comments/:commentId/reaction')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  setReaction(
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() input: ReactionInputDto,
    @Req() request: UserRequest,
  ) {
    return this.comments.setReaction(commentId, request.user, input.type);
  }

  @Delete('problem-comments/:commentId/reaction')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  removeReaction(@Param('commentId', ParseUUIDPipe) commentId: string, @Req() request: UserRequest) {
    return this.comments.removeReaction(commentId, request.user);
  }

  @Patch('problem-comments/:commentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Bình luận đã được cập nhật; không có nội dung phản hồi.' })
  async edit(
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() input: CommentInputDto,
    @Req() request: UserRequest,
  ) {
    await this.comments.editComment(commentId, request.user, input.content);
  }

  @Delete('problem-comments/:commentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Bình luận đã được xóa; không có nội dung phản hồi.' })
  async remove(@Param('commentId', ParseUUIDPipe) commentId: string, @Req() request: UserRequest) {
    await this.comments.removeComment(commentId, request.user);
  }
}
