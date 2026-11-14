import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';
import type { ContributorCandidate } from './contributors.types.js';

interface ContributorRow {
  user_id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  contribution_count: number;
  latest_contribution_at: string | null;
}

@Injectable()
export class ContributorsRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findCandidates(): Promise<ContributorCandidate[]> {
    const result = await this.pool.query<ContributorRow>(`
      SELECT u.id AS user_id,
             u.username,
             COALESCE(NULLIF(BTRIM(u.full_name), ''), NULLIF(u.username, ''), 'Người dùng UTH') AS display_name,
             u.avatar_url,
             COUNT(DISTINCT p.id)::int AS contribution_count,
             to_char(
               MAX(p.published_at) AT TIME ZONE 'UTC',
               'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
             ) AS latest_contribution_at
      FROM public.problems p
      JOIN public.users u ON u.id = p.created_by
      WHERE p.status = 'PUBLISHED'
        AND p.organization_id IS NULL
        AND u.role = 'ADMIN'
        AND u.is_active = TRUE
      GROUP BY u.id, u.username, u.full_name, u.avatar_url
    `);

    return result.rows.map((row) => ({
      userId: row.user_id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      contributionCount: Number(row.contribution_count),
      latestContributionAt: row.latest_contribution_at,
    }));
  }
}
