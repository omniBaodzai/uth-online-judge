import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';

export interface PublicProfileRecord {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  cover_image_url: string | null;
  cover_crop: import('./users.service.js').CoverCropMetadata | null;
  bio: string | null;
  organization: string | null;
  created_at: Date | string;
  submission_count: number;
  contribution_count: number;
}

export interface ProfileActivityDay {
  date: string;
  count: number;
}

@Injectable()
export class PublicProfileRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findByUsername(username: string): Promise<PublicProfileRecord | null> {
    const result = await this.pool.query<PublicProfileRecord>(
      `SELECT u.id, u.username, u.full_name, u.avatar_url,
              u.cover_image_url, u.cover_crop, u.bio, u.organization, u.created_at,
              (SELECT COUNT(*)::int FROM public.submissions s WHERE s.user_id = u.id) AS submission_count,
              ((SELECT COUNT(*) FROM public.discussions d WHERE d.author_id = u.id) +
               (SELECT COUNT(*) FROM public.discussion_comments c WHERE c.author_id = u.id))::int AS contribution_count
       FROM public.users u
       WHERE LOWER(u.username) = LOWER($1) AND u.is_active = TRUE
       LIMIT 1`,
      [username],
    );
    return result.rows[0] ?? null;
  }

  async findById(id: string): Promise<PublicProfileRecord | null> {
    const result = await this.pool.query<PublicProfileRecord>(
      `SELECT u.id, u.username, u.full_name, u.avatar_url,
              u.cover_image_url, u.cover_crop, u.bio, u.organization, u.created_at,
              (SELECT COUNT(*)::int FROM public.submissions s WHERE s.user_id = u.id) AS submission_count,
              ((SELECT COUNT(*) FROM public.discussions d WHERE d.author_id = u.id) +
               (SELECT COUNT(*) FROM public.discussion_comments c WHERE c.author_id = u.id))::int AS contribution_count
       FROM public.users u
       WHERE u.id = $1 AND u.is_active = TRUE
       LIMIT 1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async listActivity(userId: string): Promise<ProfileActivityDay[]> {
    const result = await this.pool.query<{ date: string; count: number }>(
      `WITH local_date AS (
         SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS today
       )
       SELECT TO_CHAR(
                (s.submitted_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
                'YYYY-MM-DD'
              ) AS date,
              COUNT(*)::int AS count
       FROM public.submissions s
       CROSS JOIN local_date
       WHERE s.user_id = $1
         AND s.submitted_at >= (
               (local_date.today - INTERVAL '370 days')::timestamp
               AT TIME ZONE 'Asia/Ho_Chi_Minh'
             )
         AND s.submitted_at < CURRENT_TIMESTAMP
       GROUP BY (s.submitted_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
       ORDER BY date DESC`,
      [userId],
    );
    return result.rows.map((row) => ({
      date: row.date,
      count: Number(row.count),
    }));
  }
}