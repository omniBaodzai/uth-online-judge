import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateSubmissionDto } from './dto/create-submission.dto.js';
import { SubmissionsService } from './submissions.service.js';

type AuthenticatedRequest = Request & { user: { id: string } };

@ApiTags('Submissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Ghi nhận bài nộp (trạng thái PENDING, chưa chấm)' })
  create(@Body() dto: CreateSubmissionDto, @Req() request: AuthenticatedRequest) {
    // userId lấy từ token, không bao giờ từ body.
    return this.submissions.create(request.user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem bài nộp của chính mình' })
  get(@Param('id', new ParseUUIDPipe()) id: string, @Req() request: AuthenticatedRequest) {
    return this.submissions.getOwned(id, request.user.id);
  }
}
