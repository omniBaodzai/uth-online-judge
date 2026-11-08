import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';
import type { OrganizationLeaderboardQueryDto } from './organization-leaderboard.dto.js';

export interface OrganizationLeaderboardItem {
  rank: number;
  userId: string;
  username: string | null;
  solvedCount: number;
}

export interface OrganizationLeaderboardPage {
  items: OrganizationLeaderboardItem[];
  total: number;
  page: number;
  pageSize: number;
}

interface OrganizationLeaderboardRow {
  rank: number | null;
  user_id: string | null;
  username: string | null;
  solved_count: number | null;
  total: number;
}

@Injectable()
export class OrganizationLeaderboardRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findLeaderboard(
    organizationId: string,
    query: OrganizationLeaderboardQueryDto,
  ): Promise<OrganizationLeaderboardPage> {
    const result = await this.pool.query<OrganizationLeaderboardRow>(
      `WITH valid_accepted_submissions AS (
         SELECT s.user_id, s.problem_id
           FROM public.submissions s
           JOIN public.problems problem
             ON problem.id = s.problem_id
            AND problem.status = 'PUBLISHED'
           LEFT JOIN public.contests contest ON contest.id = s.contest_id
           JOIN public.submission_test_case_snapshots snapshot
             ON snapshot.submission_id = s.id
           LEFT JOIN public.submission_test_results test_result
             ON test_result.submission_id = s.id
            AND test_result.snapshot_id = snapshot.id
          WHERE s.status = 'ACCEPTED'
            AND s.judged_at IS NOT NULL
            AND (
              (s.contest_id IS NULL AND problem.organization_id = $1)
              OR (
                s.contest_id IS NOT NULL
                AND contest.organization_id = $1
                AND contest.ends_at <= CURRENT_TIMESTAMP
              )
            )
          GROUP BY s.id, s.user_id, s.problem_id
         HAVING COUNT(DISTINCT snapshot.id) > 0
            AND COUNT(DISTINCT snapshot.id) = COUNT(DISTINCT test_result.id)
            AND COUNT(DISTINCT snapshot.id) = COUNT(DISTINCT test_result.id)
              FILTER (WHERE test_result.status = 'ACCEPTED')
       ),
       solved_counts AS (
         SELECT user_id, COUNT(DISTINCT problem_id)::int AS solved_count
           FROM valid_accepted_submissions
          GROUP BY user_id
       ),
       ranked_members AS (
         SELECT ROW_NUMBER() OVER (
                  ORDER BY COALESCE(solved_counts.solved_count, 0) DESC,
                           account.username ASC,
                           account.id ASC
                )::int AS rank,
                account.id AS user_id,
                account.username,
                COALESCE(solved_counts.solved_count, 0)::int AS solved_count
           FROM public.organization_members membership
           JOIN public.users account ON account.id = membership.user_id
           LEFT JOIN solved_counts ON solved_counts.user_id = membership.user_id
          WHERE membership.organization_id = $1
       ),
       page_items AS (
         SELECT rank, user_id, username, solved_count
           FROM ranked_members
          ORDER BY rank
          LIMIT $2 OFFSET $3
       )
       SELECT (SELECT COUNT(*)::int FROM ranked_members) AS total,
              page_items.rank, page_items.user_id, page_items.username,
              page_items.solved_count
         FROM (SELECT 1) anchor
         LEFT JOIN page_items ON TRUE`,
      [organizationId, query.pageSize, (query.page - 1) * query.pageSize],
    );

    const first = result.rows[0];
    return {
      items: result.rows.flatMap((row) =>
        row.user_id === null || row.rank === null || row.solved_count === null
          ? []
          : [{
              rank: row.rank,
              userId: row.user_id,
              username: row.username,
              solvedCount: row.solved_count,
            }],
      ),
      total: first?.total ?? 0,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
