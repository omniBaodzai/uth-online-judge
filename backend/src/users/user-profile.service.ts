import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';

export interface UserProfile {
  username: string;
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  bio: string | null;
  school: string | null;
  createdAt: string;
  solvedCount: number;
  rank: number | null;
  totalScore: number;
  contributions: number;
  submissionCount: number;
  contests: {
    attended: number;
    rank: number | null;
    currentRating: number | null;
    minRating: number | null;
    maxRating: number | null;
    badgeTitle: string | null;
  };
  heatmap: { date: string; count: number }[];
  ratingHistory: { contestName: string; date: string; rating: number }[];
}

type ProfileRow = {
  id: string;
  username: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  school: string | null;
  created_at: Date;
  solved_count: string | null;
  total_score: string | null;
  rank: string | null;
  contributions: string;
  submission_count: string;
};

@Injectable()
export class UserProfileService {
  constructor(@Inject(DATABASE_POOL) private readonly database: Pool) {}

  async getProfile(
    username: string,
    viewer: { id: string; role?: string } | null,
  ): Promise<UserProfile> {
    // Hạng xếp theo tổng điểm (điểm cao nhất của từng bài đã công bố), hòa thì xét số bài đã giải.
    const result = await this.database.query<ProfileRow>(
      `WITH per_problem AS (
         SELECT s.user_id, s.problem_id,
                MAX(s.score) AS best,
                BOOL_OR(s.status = 'ACCEPTED') AS solved
         FROM submissions s
         JOIN problems p ON p.id = s.problem_id AND p.status = 'PUBLISHED'
         GROUP BY s.user_id, s.problem_id
       ),
       totals AS (
         SELECT pp.user_id,
                SUM(pp.best) AS total_score,
                COUNT(*) FILTER (WHERE pp.solved) AS solved_count
         FROM per_problem pp
         JOIN users tu ON tu.id = pp.user_id AND tu.is_active = TRUE
         GROUP BY pp.user_id
       ),
       ranked AS (
         SELECT user_id, total_score, solved_count,
                RANK() OVER (ORDER BY total_score DESC, solved_count DESC) AS rank
         FROM totals
       )
       SELECT u.id, u.username, u.full_name, u.email, u.avatar_url, u.bio, u.school, u.created_at,
              r.solved_count, r.total_score, r.rank,
              (SELECT COUNT(*) FROM problem_editorials e
                 JOIN problems ep ON ep.id = e.problem_id AND ep.status = 'PUBLISHED'
                WHERE e.author_id = u.id AND e.is_published)
              + (SELECT COUNT(*) FROM problems cp
                  WHERE cp.created_by = u.id AND cp.status = 'PUBLISHED') AS contributions,
              (SELECT COUNT(*) FROM submissions ss WHERE ss.user_id = u.id) AS submission_count
       FROM users u
       LEFT JOIN ranked r ON r.user_id = u.id
       WHERE lower(u.username) = lower($1) AND u.is_active = TRUE`,
      [username],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Không tìm thấy người dùng.');

    const heatmap = await this.database.query<{ date: string; count: string }>(
      `SELECT to_char((submitted_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'YYYY-MM-DD') AS date,
              COUNT(*) AS count
       FROM submissions
       WHERE user_id = $1
         AND submitted_at >= (CURRENT_DATE - INTERVAL '364 days')
       GROUP BY 1
       ORDER BY 1`,
      [row.id],
    );

    const canSeeEmail = viewer !== null && (viewer.id === row.id || viewer.role === 'ADMIN');

    return {
      username: row.username,
      fullName: row.full_name,
      email: canSeeEmail ? row.email : null,
      avatarUrl: row.avatar_url,
      bio: row.bio,
      school: row.school,
      createdAt: row.created_at.toISOString(),
      solvedCount: Number(row.solved_count ?? 0),
      rank: row.rank === null ? null : Number(row.rank),
      totalScore: Number(row.total_score ?? 0),
      contributions: Number(row.contributions),
      submissionCount: Number(row.submission_count),
      // Hệ thống chưa có module cuộc thi/rating nên các chỉ số này để trống.
      contests: {
        attended: 0,
        rank: null,
        currentRating: null,
        minRating: null,
        maxRating: null,
        badgeTitle: null,
      },
      heatmap: heatmap.rows.map((item) => ({ date: item.date, count: Number(item.count) })),
      ratingHistory: [],
    };
  }

  async updateAbout(userId: string, input: { bio?: string | null; school?: string | null }) {
    const clean = (value: string | null | undefined) => (value?.trim() ? value.trim() : null);
    const result = await this.database.query<{ bio: string | null; school: string | null }>(
      `UPDATE users
       SET bio = CASE WHEN $2::boolean THEN $3 ELSE bio END,
           school = CASE WHEN $4::boolean THEN $5 ELSE school END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING bio, school`,
      [
        userId,
        Object.hasOwn(input, 'bio'),
        clean(input.bio),
        Object.hasOwn(input, 'school'),
        clean(input.school),
      ],
    );
    return result.rows[0];
  }
}
