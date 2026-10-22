import { Body, Controller, Get, HttpCode, Inject, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Pool } from 'pg';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ClientErrorDto, CreateContributionDto, CreateTicketDto } from '../admin/dto.js';
import { DATABASE_POOL } from '../databases/database.module.js';
import { ActivityLogService } from '../platform/activity-log.service.js';
import { ErrorLogService } from '../platform/error-log.service.js';

type AuthRequest = Request & { user: { id: string } };

const clientHits = new Map<string, { count: number; resetAt: number }>();
function allowClientLog(ip: string) {
  const now = Date.now();
  const hit = clientHits.get(ip);
  if (!hit || hit.resetAt < now) {
    if (clientHits.size > 5000) clientHits.clear();
    clientHits.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  hit.count += 1;
  return hit.count <= 20;
}

@ApiTags('support')
@Controller('api')
export class SupportController {
  constructor(
    @Inject(DATABASE_POOL) private readonly database: Pool,
    private readonly activity: ActivityLogService,
    private readonly errors: ErrorLogService,
  ) {}

  @Post('logs/client')
  @HttpCode(204)
  async clientLog(@Req() req: Request, @Body() body: ClientErrorDto) {
    if (!allowClientLog(req.ip ?? 'unknown')) return;
    await this.errors.record({ source: 'FRONTEND', level: body.level, message: body.message, stack: body.stack, path: body.path });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('support/tickets')
  async createTicket(@Req() req: AuthRequest, @Body() body: CreateTicketDto) {
    const result = await this.database.query(
      `INSERT INTO support_tickets (user_id, subject, message, priority) VALUES ($1, $2, $3, $4)
       RETURNING id, subject, message, status, priority, created_at AS "createdAt"`,
      [req.user.id, body.subject.trim(), body.message.trim(), body.priority ?? 'NORMAL'],
    );
    await this.activity.log({ userId: req.user.id, action: 'TICKET_CREATED', detail: { subject: body.subject } });
    return result.rows[0];
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('support/tickets')
  async myTickets(@Req() req: AuthRequest) {
    const result = await this.database.query(
      `SELECT id, subject, message, status, priority, admin_reply AS "adminReply", created_at AS "createdAt"
       FROM support_tickets WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [req.user.id],
    );
    return result.rows;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('contributions')
  async contribute(@Req() req: AuthRequest, @Body() body: CreateContributionDto) {
    const result = await this.database.query(
      `INSERT INTO contributions (user_id, kind, problem_code, title, body) VALUES ($1, $2, $3, $4, $5)
       RETURNING id, kind, status, created_at AS "createdAt"`,
      [req.user.id, body.kind, body.problemCode?.toUpperCase() ?? null, body.title?.trim() ?? null, body.body.trim()],
    );
    await this.activity.log({ userId: req.user.id, action: 'CONTRIBUTION_CREATED', detail: { kind: body.kind } });
    return result.rows[0];
  }

  @Get('contributions')
  async approved(@Query('problemCode') problemCode?: string) {
    const result = await this.database.query(
      `SELECT c.id, c.kind, c.problem_code AS "problemCode", c.title, c.body, c.created_at AS "createdAt", u.username
       FROM contributions c JOIN users u ON u.id = c.user_id
       WHERE c.status = 'APPROVED' AND ($1::text IS NULL OR c.problem_code = $1)
       ORDER BY c.created_at DESC LIMIT 100`,
      [problemCode?.toUpperCase() ?? null],
    );
    return result.rows;
  }
}
