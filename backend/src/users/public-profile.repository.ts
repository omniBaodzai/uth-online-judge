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
    const result = await this.pool.query<{ date: Date | string; count: number }>(
      `SELECT submitted_at::date AS date, COUNT(*)::int AS count
       FROM public.submissions
       WHERE user_id = $1
         AND submitted_at >= CURRENT_DATE - INTERVAL '370 days'
       GROUP BY submitted_at::date
       ORDER BY date DESC`,
      [userId],
    );
    return result.rows.map((row) => ({
      date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0, 10),
      count: Number(row.count),
    }));
  }
}