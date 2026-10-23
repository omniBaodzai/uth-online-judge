import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AdminRoleGuard } from './admin-role.guard.js';
import { AdminUsersService } from './admin-users.service.js';
import { AdminUserRoleDto, AdminUserStatusDto, ListAdminUsersQueryDto } from './dto/admin-user.dto.js';

type AdminRequest = Request & { user: { id: string; role: 'ADMIN' } };

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminRoleGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(@Query() query: ListAdminUsersQueryDto) {
    return this.users.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.get(id);
  }

  @Patch(':id/role')
  setRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AdminUserRoleDto,
    @Req() request: AdminRequest,
  ) {
    return this.users.setRole(id, input.role, request.user.id);
  }

  @Patch(':id/status')
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AdminUserStatusDto,
    @Req() request: AdminRequest,
  ) {
    return this.users.setActive(id, input.isActive, request.user.id);
  }
}
