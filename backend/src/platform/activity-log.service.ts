import { Inject, Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(@Inject(DATABASE_POOL) private readonly database: Pool) {}

  /** Ghi nhật ký hoạt động; không bao giờ làm hỏng luồng nghiệp vụ chính. */
  async log(input: {
    userId: string | null;
    action: string;
    actorId?: string | null;
    detail?: Record<string, unknown>;
    ip?: string | null;
  }): Promise<void> {
    try {
      await this.database.query(
        `INSERT INTO activity_logs (user_id, actor_id, action, detail, ip)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          input.userId,
          input.actorId ?? null,
          input.action,
          input.detail ? JSON.stringify(input.detail) : null,
          input.ip?.slice(0, 64) ?? null,
        ],
      );
    } catch (error) {
      this.logger.warn(`Không ghi được activity log: ${(error as Error).message}`);
    }
  }
}
