import { InjectQueue } from '@nestjs/bullmq';
import { HttpService } from '@nestjs/axios';
import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { loadavg } from 'node:os';
import { Pool } from 'pg';
import { firstValueFrom } from 'rxjs';
import { DATABASE_POOL } from '../databases/database.module.js';
import { ActivityLogService } from '../platform/activity-log.service.js';
import { SettingsService, type SystemSettings } from '../platform/settings.service.js';
import { JUDGE_QUEUE } from '../submissions/submission.constants.js';
import { pageParams } from './admin-users.service.js';
import type { SettingsDto } from './dto.js';

async function probe<T>(task: () => Promise<T>) {
  const started = performance.now();
  try {
    const value = await task();
    return { ok: true as const, latencyMs: Math.round(performance.now() - started), value };
  } catch (error) {
    return { ok: false as const, latencyMs: Math.round(performance.now() - started), error: (error as Error).message };
  }
}

@Injectable()
export class AdminSystemService {
  constructor(
    @Inject(DATABASE_POOL) private readonly database: Pool,
    @InjectQueue(JUDGE_QUEUE) private readonly judgeQueue: Queue,
    private readonly http: HttpService,
    private readonly settings: SettingsService,
    private readonly activity: ActivityLogService,
  ) {}

  async getSettings() {
    return { ...(await this.settings.get()), smtpPasswordSet: await this.settings.hasSmtpPassword() };
  }

  async updateSettings(actorId: string, input: SettingsDto) {
    const { smtpPassword, ...rest } = input;
    const next: SystemSettings = { ...rest, features: { ...rest.features } };
    await this.settings.update(next, smtpPassword);
    await this.activity.log({ userId: null, actorId, action: 'SETTINGS_UPDATED', detail: { features: next.features, appName: next.appName } });
    return this.getSettings();
  }

  async status() {
    const judge0Url = process.env.JUDGE0_URL ?? 'http://localhost:2358';
    const [db, redis, judge0] = await Promise.all([
      probe(async () => {
        const result = await this.database.query<{ size: string; connections: number; version: string }>(
          `SELECT pg_database_size(current_database())::text AS size,
                  (SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database()) AS connections,
                  version() AS version`,
        );
        return result.rows[0]!;
      }),
      probe(async () => this.judgeQueue.getJobCounts('waiting', 'active', 'failed', 'delayed', 'completed')),
      probe(async () => {
        await firstValueFrom(this.http.get(`${judge0Url}/about`, { timeout: 3000 }));
        return true;
      }),
    ]);

    const counts = await this.database.query(
      `SELECT (SELECT count(*)::int FROM users) AS users,
              (SELECT count(*)::int FROM users WHERE is_active = FALSE) AS "lockedUsers",
              (SELECT count(*)::int FROM problems) AS problems,
              (SELECT count(*)::int FROM submissions) AS submissions,
              (SELECT count(*)::int FROM submissions WHERE status IN ('PENDING','JUDGING')) AS "pendingSubmissions",
              (SELECT count(*)::int FROM support_tickets WHERE status IN ('OPEN','IN_PROGRESS')) AS "openTickets",
              (SELECT count(*)::int FROM contributions WHERE status = 'PENDING') AS "pendingContributions",
              (SELECT count(*)::int FROM error_logs WHERE created_at > now() - interval '24 hours') AS "errors24h"`,
    );
    const traffic = await this.database.query(
      `SELECT to_char(d::date, 'YYYY-MM-DD') AS day,
              (SELECT count(*)::int FROM activity_logs a WHERE a.action = 'LOGIN' AND a.created_at::date = d::date) AS logins,
              (SELECT count(*)::int FROM activity_logs a WHERE a.action = 'SUBMIT' AND a.created_at::date = d::date) AS submissions,
              (SELECT count(*)::int FROM activity_logs a WHERE a.action = 'REGISTER' AND a.created_at::date = d::date) AS registrations
       FROM generate_series(current_date - 13, current_date, interval '1 day') d ORDER BY d`,
    );
    const memory = process.memoryUsage();
    return {
      generatedAt: new Date().toISOString(),
      database: db.ok ? { ok: true, latencyMs: db.latencyMs, sizeBytes: Number(db.value.size), connections: db.value.connections, version: db.value.version.split(' ').slice(0, 2).join(' ') } : { ok: false, error: db.error },
      redis: redis.ok ? { ok: true, latencyMs: redis.latencyMs, queue: redis.value } : { ok: false, error: redis.error },
      judge0: judge0.ok ? { ok: true, latencyMs: judge0.latencyMs } : { ok: false, error: judge0.error },
      process: {
        uptimeSeconds: Math.round(process.uptime()),
        rssMb: Math.round(memory.rss / 1048576),
        heapUsedMb: Math.round(memory.heapUsed / 1048576),
        nodeVersion: process.version,
        loadAverage: loadavg().map((value) => Number(value.toFixed(2))),
      },
      counts: counts.rows[0],
      traffic: traffic.rows,
    };
  }

  async errorLogs(query: { source?: string; level?: string; search?: string; page?: string; pageSize?: string }) {
    const p = pageParams(query.page, query.pageSize);
    const where: string[] = [];
    const values: unknown[] = [];
    if (query.source === 'BACKEND' || query.source === 'FRONTEND') { values.push(query.source); where.push(`source = $${values.length}`); }
    if (query.level === 'ERROR' || query.level === 'WARN') { values.push(query.level); where.push(`level = $${values.length}`); }
    if (query.search?.trim()) { values.push(`%${query.search.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`); where.push(`message ILIKE $${values.length}`); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await this.database.query(
      `SELECT id, source, level, message, stack, path, method, status_code AS "statusCode", created_at AS "createdAt"
       FROM error_logs ${clause} ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, p.pageSize, p.offset],
    );
    const total = await this.database.query<{ count: string }>(`SELECT count(*) FROM error_logs ${clause}`, values);
    return { items: rows.rows, total: Number(total.rows[0]?.count ?? 0), page: p.page, pageSize: p.pageSize };
  }

  async clearErrorLogs(actorId: string, olderThanDays: number) {
    const result = await this.database.query(`DELETE FROM error_logs WHERE created_at < now() - make_interval(days => $1)`, [olderThanDays]);
    await this.activity.log({ userId: null, actorId, action: 'ERROR_LOGS_CLEARED', detail: { olderThanDays, deleted: result.rowCount } });
    return { deleted: result.rowCount ?? 0 };
  }

  async activityFeed(query: { action?: string; page?: string; pageSize?: string }) {
    const p = pageParams(query.page, query.pageSize);
    const values: unknown[] = [];
    let clause = '';
    if (query.action) { values.push(query.action); clause = 'WHERE a.action = $1'; }
    const rows = await this.database.query(
      `SELECT a.id, a.action, a.detail, a.ip, a.created_at AS "createdAt", u.username, actor.username AS "actorUsername"
       FROM activity_logs a LEFT JOIN users u ON u.id = a.user_id LEFT JOIN users actor ON actor.id = a.actor_id
       ${clause} ORDER BY a.created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, p.pageSize, p.offset],
    );
    const total = await this.database.query<{ count: string }>(`SELECT count(*) FROM activity_logs a ${clause}`, values);
    return { items: rows.rows, total: Number(total.rows[0]?.count ?? 0), page: p.page, pageSize: p.pageSize };
  }
}
