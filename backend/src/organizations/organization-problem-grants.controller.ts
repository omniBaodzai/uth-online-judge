import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateOrganizationProblemGrantDto } from './organization-problem-grants.dto.js';
import { OrganizationProblemGrantsService } from './organization-problem-grants.service.js';
import type { Viewer } from './organizations.types.js';
import { DocumentControllerOperations } from '../swagger/document-controller-operations.decorator.js';

type AuthedRequest = Request & { user: { id: string; role: 'STUDENT' | 'ADMIN' } };
const viewerOf = (request: AuthedRequest): Viewer => ({
  id: request.user.id,
  role: request.user.role,
});

@ApiTags('Organization problem grants')
@DocumentControllerOperations()
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('organizations/:slug/problems/:problemId/grants')
export class OrganizationProblemGrantsController {
  constructor(private readonly grants: OrganizationProblemGrantsService) {}

  @Get()
  @ApiOperation({ summary: 'Quản lý: xem lịch sử grant của bài tập tổ chức' })
  list(
    @Param('slug') slug: string,
    @Param('problemId', ParseUUIDPipe) problemId: string,
    @Req() request: AuthedRequest,
  ) {
    return this.grants.list(slug, problemId, viewerOf(request));
  }

  @Post()
  @ApiOperation({ summary: 'Quản lý: cấp ORGANIZATION hoặc GLOBAL_CONTESTS grant' })
  create(
    @Param('slug') slug: string,
    @Param('problemId', ParseUUIDPipe) problemId: string,
    @Body() input: CreateOrganizationProblemGrantDto,
    @Req() request: AuthedRequest,
  ) {
    return this.grants.create(
      slug,
      problemId,
      viewerOf(request),
      input.scope,
      input.granteeOrganizationId ?? null,
    );
  }

  @Delete(':grantId')
  @ApiOperation({ summary: 'Quản lý: thu hồi grant còn hiệu lực; actor lấy từ JWT' })
  revoke(
    @Param('slug') slug: string,
    @Param('problemId', ParseUUIDPipe) problemId: string,
    @Param('grantId', ParseUUIDPipe) grantId: string,
    @Req() request: AuthedRequest,
  ) {
    return this.grants.revoke(slug, problemId, grantId, viewerOf(request));
  }
}
