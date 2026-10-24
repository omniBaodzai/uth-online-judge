import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';

export const REACTION_TYPES = ['LIKE', 'LOVE', 'HELPFUL'] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];
export type ReactionTarget = 'DISCUSSION' | 'COMMENT';

export interface ReactionSummary {
  counts: Record<ReactionType, number>;
  // Cảm xúc của người xem hiện tại (null với khách hoặc khi chưa chọn).
  mine: ReactionType | null;
}

interface ReactionRow {
  targetId: string;
  reactionType: ReactionType;
  count: number;
  mine: boolean;
}

// Tên cột lấy từ hằng số nội bộ, không bao giờ từ dữ liệu người dùng.
const TARGET_COLUMN: Record<ReactionTarget, string> = {
  DISCUSSION: 'discussion_id',
  COMMENT: 'comment_id',
};

export function emptyReactionSummary(): ReactionSummary {
  return { counts: { LIKE: 0, LOVE: 0, HELPFUL: 0 }, mine: null };
}

export function buildReactionSummaries(ids: string[], rows: ReactionRow[]): Map<string, ReactionSummary> {
  const summaries = new Map(ids.map((id) => [id, emptyReactionSummary()] as const));
  for (const row of rows) {
    const summary = summaries.get(row.targetId);
    if (!summary) continue;
    summary.counts[row.reactionType] = row.count;
    if (row.mine) summary.mine = row.reactionType;
  }
  return summaries;
}

@Injectable()
export class ReactionsRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  // Một truy vấn cho cả trang (không N+1): đếm theo loại và đánh dấu cảm xúc của người xem.
  async summaries(
    target: ReactionTarget,
    ids: string[],
    viewerId: string | null,
  ): Promise<Map<string, ReactionSummary>> {
    if (ids.length === 0) return new Map();
    const column = TARGET_COLUMN[target];
    const result = await this.pool.query<ReactionRow>(
      `SELECT ${column} AS "targetId", reaction_type AS "reactionType",
              COUNT(*)::int AS count,
              COALESCE(BOOL_OR(user_id = $2::uuid), FALSE) AS mine
       FROM public.discussion_reactions
       WHERE ${column} = ANY($1::uuid[])
       GROUP BY ${column}, reaction_type`,
      [ids, viewerId],
    );
    return buildReactionSummaries(ids, result.rows);
  }

  // Upsert nguyên tử dựa trên chỉ mục duy nhất: không thể tạo trùng khi có yêu cầu đồng thời.
  async set(target: ReactionTarget, targetId: string, userId: string, type: ReactionType): Promise<void> {
    const column = TARGET_COLUMN[target];
    await this.pool.query(
      `INSERT INTO public.discussion_reactions (user_id, ${column}, reaction_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, ${column}) WHERE ${column} IS NOT NULL
       DO UPDATE SET reaction_type = EXCLUDED.reaction_type, updated_at = NOW()`,
      [userId, targetId, type],
    );
  }

  async remove(target: ReactionTarget, targetId: string, userId: string): Promise<void> {
    const column = TARGET_COLUMN[target];
    await this.pool.query(
      `DELETE FROM public.discussion_reactions WHERE user_id = $1 AND ${column} = $2`,
      [userId, targetId],
    );
  }
}
