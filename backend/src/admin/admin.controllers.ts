import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { Roles, RolesGuard } from '../platform/roles.guard.js';
import { AdminContentService } from './admin-content.service.js';
import { AdminDataService } from './admin-data.service.js';
import { AdminSystemService } from './admin-system.service.js';
import { AdminUsersService } from './admin-users.service.js';
import {
  ChangeRoleDto,
  ImportCsvDto,
  ModerateDto,
  ProblemDto,
  RestoreDto,
  SetStatusDto,
  SettingsDto,
  TicketUpdateDto,
} from './dto.js';

type AuthRequest = Request & { user: { id: string; role: string } };

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('api/admin/users')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(@Query() query: Record<string, string>) {
    return this.users.list(query);
  }

  @Patch(':id/role')
  role(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: ChangeRoleDto) {
    return this.users.changeRole(req.user.id, id, body.role);
  }

  @Patch(':id/status')
  status(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: SetStatusDto) {
    return this.users.setStatus(req.user.id, id, body.isActive);
  }

  @Post(':id/reset-password')
  reset(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.resetPassword(req.user.id, id);
  }

  @Get(':id/activity')
  activity(@Param('id', ParseUUIDPipe) id: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.users.activityOf(id, page, pageSize);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('api/admin')
export class AdminContentController {
  constructor(private readonly content: AdminContentService) {}

  @Get('problems')
  problems(@Query('search') search?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.content.listProblems(search, page, pageSize);
  }

  @Get('problems/:id')
  problem(@Param('id', ParseUUIDPipe) id: string) {
    return this.content.getProblem(id);
  }

  @Post('problems')
  createProblem(@Req() req: AuthRequest, @Body() body: ProblemDto) {
    return this.content.saveProblem(req.user.id, body);
  }

  @Put('problems/:id')
  updateProblem(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: ProblemDto) {
    return this.content.saveProblem(req.user.id, body, id);
  }

  @Delete('problems/:id')
  deleteProblem(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.content.deleteProblem(req.user.id, id);
  }

  @Get('submissions')
  submissions(@Query() query: Record<string, string>) {
    return this.content.listSubmissions(query);
  }

  @Delete('submissions/:id')
  deleteSubmission(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.content.deleteSubmission(req.user.id, id);
  }

  @Post('submissions/:id/rejudge')
  rejudge(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.content.rejudge(req.user.id, id);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MODERATOR')
@Controller('api/admin')
export class AdminModerationController {
  constructor(private readonly content: AdminContentService) {}

  @Get('contributions')
  contributions(@Query() query: Record<string, string>) {
    return this.content.listContributions(query);
  }

  @Patch('contributions/:id')
  moderate(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: ModerateDto) {
    return this.content.moderate(req.user.id, id, body);
  }

  @Delete('contributions/:id')
  remove(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.content.deleteContribution(req.user.id, id);
  }

  @Get('tickets')
  tickets(@Query() query: Record<string, string>) {
    return this.content.listTickets(query);
  }

  @Patch('tickets/:id')
  updateTicket(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: TicketUpdateDto) {
    return this.content.updateTicket(req.user.id, id, body);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('api/admin/data')
export class AdminDataController {
  constructor(private readonly data: AdminDataService) {}

  @Get('export/:table')
  async export(@Req() req: AuthRequest, @Param('table') table: string) {
    const { filename, content } = await this.data.exportCsv(req.user.id, table);
    return new StreamableFile(Buffer.from(content, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Post('import')
  import(@Req() req: AuthRequest, @Body() body: ImportCsvDto) {
    return this.data.importCsv(req.user.id, body.table, body.csv);
  }

  @Get('backups')
  backups() {
    return this.data.listBackups();
  }

  @Post('backups')
  createBackup(@Req() req: AuthRequest) {
    return this.data.createBackup(req.user.id);
  }

  @Post('backups/:name/restore')
  restore(@Req() req: AuthRequest, @Param('name') name: string, @Body() body: RestoreDto) {
    if (body.confirm !== 'RESTORE') throw new BadRequestException('Cần nhập RESTORE để xác nhận.');
    return this.data.restoreBackup(req.user.id, name);
  }

  @Delete('backups/:name')
  deleteBackup(@Req() req: AuthRequest, @Param('name') name: string) {
    return this.data.deleteBackup(req.user.id, name);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('api/admin/system')
export class AdminSystemController {
  constructor(private readonly system: AdminSystemService) {}

  @Get('settings')
  settings() {
    return this.system.getSettings();
  }

  @Put('settings')
  updateSettings(@Req() req: AuthRequest, @Body() body: SettingsDto) {
    return this.system.updateSettings(req.user.id, body);
  }

  @Get('status')
  status() {
    return this.system.status();
  }

  @Get('error-logs')
  errorLogs(@Query() query: Record<string, string>) {
    return this.system.errorLogs(query);
  }

  @Delete('error-logs')
  clearErrorLogs(@Req() req: AuthRequest, @Query('olderThanDays') days?: string) {
    const parsed = Number.parseInt(days ?? '30', 10);
    return this.system.clearErrorLogs(req.user.id, Number.isFinite(parsed) && parsed >= 0 ? parsed : 30);
  }

  @Get('activity')
  activity(@Query() query: Record<string, string>) {
    return this.system.activityFeed(query);
  }
}
