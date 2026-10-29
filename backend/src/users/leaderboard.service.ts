import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';

export type LeaderboardSort = 'score' | 'contributions';

export interface LeaderboardItem {
  rank: number;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
  rating: number | null;
  totalScore: number;
  solvedCount: number;
  contributions: number;
}

export interface LeaderboardPage {
  items: LeaderboardItem[];
  total: number;
  page: number;
  pageSize: number;
}

type Row = {
  rank: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  total_score: string;
  solved_count: string;
  contributions: string;
  total: string;
};

@Injectable()
export class LeaderboardService {
  constructor(@Inject(DATABASE_POOL) private readonly database: Pool) {}

  async getLeaderboard(query: {
    page: number;
    pageSize: number;
    q?: string;
    sort: LeaderboardSort;
  }): Promise<LeaderboardPage> {
    const search = query.q ? `%${query.q.replace(/[\\%_]/g, '\\$&')}%` : null;
    // Hạng được tính trên toàn bộ thành viên trước khi lọc tìm kiếm để không đổi khi tìm.
    const orderBy =
      query.sort === 'contributions'
        ? 'contributions DESC, total_score DESC, username ASC'
        : 'total_score DESC, solved_count DESC, username ASC';

    const result = await this.database.query<Row>(
      `WITH per_problem AS (
         SELECT s.user_id, s.problem_id, MAX(s.score) AS best,
                BOOL_OR(s.status = 'ACCEPTED') AS solved
         FROM submissions s
         JOIN problems p ON p.id = s.problem_id AND p.status = 'PUBLISHED'
         GROUP BY s.user_id, s.problem_id
       ),
       totals AS (
         SELECT user_id, SUM(best) AS total_score, COUNT(*) FILTER (WHERE solved) AS solved_count
         FROM per_problem GROUP BY user_id
       ),
       members AS (
         SELECT u.id, u.username, u.full_name, u.avatar_url,
                COALESCE(t.total_score, 0) AS total_score,
                COALESCE(t.solved_count, 0) AS solved_count,
                (SELECT COUNT(*) FROM problem_editorials e
                   JOIN problems ep ON ep.id = e.problem_id AND ep.status = 'PUBLISHED'
                  WHERE e.author_id = u.id AND e.is_published)
                + (SELECT COUNT(*) FROM problems cp
                    WHERE cp.created_by = u.id AND cp.status = 'PUBLISHED') AS contributions
         FROM users u
         LEFT JOIN totals t ON t.user_id = u.id
         WHERE u.is_active = TRUE AND u.username IS NOT NULL
       ),
       ranked AS (
         SELECT *, ROW_NUMBER() OVER (ORDER BY ${orderBy}) AS rank FROM members
       )
       SELECT rank, username, full_name, avatar_url, total_score, solved_count, contributions,
              COUNT(*) OVER () AS total
       FROM ranked
       WHERE $1::text IS NULL OR username ILIKE $1 ESCAPE '\\'
       ORDER BY rank
       LIMIT $2 OFFSET $3`,
      [search, query.pageSize, (query.page - 1) * query.pageSize],
    );

    return {
      page: query.page,
      pageSize: query.pageSize,
      total: Number(result.rows[0]?.total ?? 0),
      items: result.rows.map((row) => ({
        rank: Number(row.rank),
        username: row.username,
        fullName: row.full_name,
        avatarUrl: row.avatar_url,
        // Chưa có module cuộc thi nên chưa có rating.
        rating: null,
        totalScore: Number(row.total_score),
        solvedCount: Number(row.solved_count),
        contributions: Number(row.contributions),
      })),
    };
  }
}
