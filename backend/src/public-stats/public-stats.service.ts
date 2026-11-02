import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';

type PublicStatsRow = {
  members: string;
  problems: string;
  submissions: string;
};

export type PublicStats = {
  members: number;
  problems: number;
  submissions: number;
};

@Injectable()
export class PublicStatsService {
  constructor(
    @Inject(DATABASE_POOL)
    private readonly database: Pool,
  ) {}

  async getStats(): Promise<PublicStats> {
    const result = await this.database.query<PublicStatsRow>(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE is_active = TRUE)::text AS members,
        (SELECT COUNT(*) FROM problems WHERE status = 'PUBLISHED')::text AS problems,
        (SELECT COUNT(*) FROM submissions)::text AS submissions
    `);
    const row = result.rows[0];
    if (!row) {
      throw new Error('Public statistics query returned no result');
    }

    return {
      members: Number(row.members),
      problems: Number(row.problems),
      submissions: Number(row.submissions),
    };
  }
}
