import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';
import { insertNotification } from '../notifications/notification-writer.js';
import type { PageResult } from './community.utils.js';
import { buildReactionSummaries, type ReactionSummary, type ReactionType } from './reactions.repository.js';

export interface ProblemCommentRecord {
  id: string;
  problemId: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  authorUsername: string | null;
  avatarUrl: string | null;
  content: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProblemCommentLookup {
  id: string;
  authorId: string;
  problemId: string;
  parentId: string | null;
  isDeleted: boolean;
}

export interface ProblemCommentPageQuery {
  page: number;
  pageSize: number;
}

const COMMENT_COLUMNS = `c.id, c.problem_id AS "problemId", c.parent_id AS "parentId",
                c.author_id AS "authorId", COALESCE(u.username, 'Ẩn danh') AS "authorName",
                u.username AS "authorUsername", u.avatar_url AS "avatarUrl", c.content,
                (c.deleted_at IS NOT NULL) AS "isDeleted",
                c.created_at AS "createdAt", c.updated_at AS "updatedAt"`;

async function findIdempotentComment(
  client: PoolClient,
  problemId: string,
  authorId: string,
  idempotencyKey: string,
): Promise<{ id: string; content: string; parentId: string | null } | null> {
  const result = await client.query<{ id: string; content: string; parentId: string | null }>(
    `SELECT id, content, parent_id AS "parentId"
     FROM public.problem_comments
     WHERE problem_id = $1 AND author_id = $2 AND idempotency_key = $3`,
    [problemId, authorId, idempotencyKey],
  );
  return result.rows[0] ?? null;
}

function assertSameCommentRequest(
  existing: { content: string; parentId: string | null },
  content: string,
  parentId: string | null,
): void {
  if (existing.content !== content || existing.parentId !== parentId) {
    throw new ConflictException('Idempotency-Key đã được dùng cho một bình luận khác.');
  }
}

async function rollback(client: PoolClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    // Keep the original database error.
  }
}

@Injectable()
export class ProblemCommentsRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  // Chỉ bài tập đã xuất bản mới cho phép xem/bình luận, giống quy tắc của trang chi tiết bài tập.
  async findPublishedProblemId(code: string): Promise<string | null> {
    const result = await this.pool.query<{ id: string }>(
      `SELECT id FROM public.problems
       WHERE problem_code = $1 AND status = 'PUBLISHED'
         AND organization_id IS NULL`,
      [code],
    );
    return result.rows[0]?.id ?? null;
  }

  // Phân trang theo bình luận gốc; phản hồi lấy riêng cho cả trang (không N+1).
  async listComments(problemId: string, query: ProblemCommentPageQuery): Promise<PageResult<ProblemCommentRecord>> {
    const [list, count] = await Promise.all([
      this.pool.query<ProblemCommentRecord>(
        `SELECT ${COMMENT_COLUMNS}
         FROM public.problem_comments c
         JOIN public.users u ON u.id = c.author_id
         WHERE c.problem_id = $1 AND c.parent_id IS NULL
         ORDER BY c.created_at ASC, c.id ASC
         LIMIT $2 OFFSET $3`,
        [problemId, query.pageSize, (query.page - 1) * query.pageSize],
      ),
      this.pool.query<{ total: number }>(
        'SELECT COUNT(*)::int AS total FROM public.problem_comments WHERE problem_id = $1 AND parent_id IS NULL',
        [problemId],
      ),
    ]);
    return { items: list.rows, total: count.rows[0]?.total ?? 0, page: query.page, pageSize: query.pageSize };
  }

  async listReplies(parentIds: string[]): Promise<ProblemCommentRecord[]> {
    if (parentIds.length === 0) return [];
    const result = await this.pool.query<ProblemCommentRecord>(
      `WITH RECURSIVE descendants(id) AS (
         SELECT c.id
         FROM public.problem_comments c
         WHERE c.parent_id = ANY($1::uuid[])
         UNION
         SELECT child.id
         FROM public.problem_comments child
         JOIN descendants parent ON child.parent_id = parent.id
       )
       SELECT ${COMMENT_COLUMNS}
       FROM public.problem_comments c
       JOIN descendants d ON d.id = c.id
       JOIN public.users u ON u.id = c.author_id
       ORDER BY c.created_at ASC, c.id ASC`,
      [parentIds],
    );
    return result.rows;
  }

  async createComment(
    problemCode: string,
    authorId: string,
    content: string,
    parentId: string | null = null,
    idempotencyKey: string | null = null,
  ): Promise<string> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const problemResult = await client.query<{ id: string; title: string }>(
        `SELECT id, title
         FROM public.problems
         WHERE problem_code = $1 AND status = 'PUBLISHED'
           AND organization_id IS NULL
         FOR SHARE`,
        [problemCode],
      );
      const problem = problemResult.rows[0];
      if (!problem) throw new NotFoundException('Không tìm thấy bài tập.');

      if (idempotencyKey) {
        const existing = await findIdempotentComment(client, problem.id, authorId, idempotencyKey);
        if (existing) {
          assertSameCommentRequest(existing, content, parentId);
          await client.query('COMMIT');
          return existing.id;
        }
      }

      let parentAuthorId: string | null = null;
      let rootCommentId: string | null = null;
      if (parentId) {
        const parentResult = await client.query<{ authorId: string; isDeleted: boolean }>(
          `SELECT author_id AS "authorId", (deleted_at IS NOT NULL) AS "isDeleted"
           FROM public.problem_comments
           WHERE id = $1 AND problem_id = $2
           FOR SHARE`,
          [parentId, problem.id],
        );
        const parent = parentResult.rows[0];
        if (!parent) throw new NotFoundException('Không tìm thấy bình luận.');
        if (parent.isDeleted) throw new BadRequestException('Bình luận này đã bị xóa nên không thể trả lời.');
        parentAuthorId = parent.authorId;

        const rootResult = await client.query<{ id: string }>(
          `WITH RECURSIVE ancestors(id, parent_id) AS (
             SELECT id, parent_id
             FROM public.problem_comments
             WHERE id = $1 AND problem_id = $2
             UNION ALL
             SELECT parent.id, parent.parent_id
             FROM public.problem_comments parent
             JOIN ancestors child ON parent.id = child.parent_id
             WHERE parent.problem_id = $2
           )
           SELECT id FROM ancestors WHERE parent_id IS NULL LIMIT 1`,
          [parentId, problem.id],
        );
        rootCommentId = rootResult.rows[0]?.id ?? parentId;
      }

      const recipientIds = parentAuthorId ? [parentAuthorId] : [];
      const lockedUserIds = [...new Set([authorId, ...recipientIds])].sort();
      const users = await client.query<{ id: string; name: string }>(
        `SELECT id, COALESCE(NULLIF(full_name, ''), NULLIF(username, ''), 'Người dùng') AS name
         FROM public.users
         WHERE id = ANY($1::uuid[]) AND is_active = TRUE
         ORDER BY id
         FOR SHARE`,
        [lockedUserIds],
      );
      const actorName = users.rows.find((user) => user.id === authorId)?.name;
      if (!actorName) throw new NotFoundException('Không tìm thấy tài khoản người bình luận.');

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO public.problem_comments
           (problem_id, author_id, content, parent_id, idempotency_key)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (problem_id, author_id, idempotency_key)
           WHERE idempotency_key IS NOT NULL
         DO NOTHING
         RETURNING id`,
        [problem.id, authorId, content, parentId, idempotencyKey],
      );
      let commentId = inserted.rows[0]?.id;
      if (!commentId && idempotencyKey) {
        const existing = await findIdempotentComment(client, problem.id, authorId, idempotencyKey);
        if (existing) {
          assertSameCommentRequest(existing, content, parentId);
          await client.query('COMMIT');
          return existing.id;
        }
      }
      if (!commentId) throw new Error('Problem comment insert returned no record.');

      const recipient = users.rows.find((user) => user.id === parentAuthorId && user.id !== authorId);
      if (parentId && recipient) {
        await insertNotification(client, {
          recipientUserId: recipient.id,
          actorUserId: authorId,
          type: 'PROBLEM_REPLY',
          title: 'Có phản hồi mới',
          content: `${actorName} đã trả lời bình luận của bạn trong bài tập "${problem.title}".`,
          referenceId: null,
          sourceType: 'PROBLEM_COMMENT',
          sourceId: commentId,
          targetType: 'PROBLEM_COMMENT',
          targetId: commentId,
          metadata: {
            problemCode,
            problemId: problem.id,
            commentId,
            rootCommentId: rootCommentId ?? commentId,
          },
        });
      }

      await client.query('COMMIT');
      return commentId;
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async findComment(id: string): Promise<ProblemCommentLookup | null> {
    const result = await this.pool.query<ProblemCommentLookup>(
      `SELECT c.id, c.author_id AS "authorId", c.problem_id AS "problemId",
              c.parent_id AS "parentId", (c.deleted_at IS NOT NULL) AS "isDeleted"
       FROM public.problem_comments c
       JOIN public.problems p ON p.id = c.problem_id
                            AND p.status = 'PUBLISHED'
                            AND p.organization_id IS NULL
       WHERE c.id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async updateComment(id: string, content: string): Promise<void> {
    await this.pool.query(
      `UPDATE public.problem_comments SET content = $2, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [id, content],
    );
  }

  // Bình luận còn phản hồi được xóa mềm; khi xóa lá, dọn các cha đã xóa mềm nếu chúng hết phản hồi.
  async deleteComment(id: string): Promise<void> {
    const soft = await this.pool.query(
      `UPDATE public.problem_comments c
       SET deleted_at = NOW(), content = '', updated_at = NOW()
       WHERE c.id = $1 AND EXISTS (SELECT 1 FROM public.problem_comments r WHERE r.parent_id = c.id)`,
      [id],
    );
    if ((soft.rowCount ?? 0) > 0) return;

    const removed = await this.pool.query<{ parentId: string | null }>(
      `DELETE FROM public.problem_comments c
       WHERE c.id = $1 AND NOT EXISTS (SELECT 1 FROM public.problem_comments r WHERE r.parent_id = c.id)
       RETURNING c.parent_id AS "parentId"`,
      [id],
    );
    let parentId = removed.rows[0]?.parentId;
    while (parentId) {
      const cleanup = await this.pool.query<{ parentId: string | null }>(
        `DELETE FROM public.problem_comments p
         WHERE p.id = $1 AND p.deleted_at IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM public.problem_comments r WHERE r.parent_id = p.id)
         RETURNING p.parent_id AS "parentId"`,
        [parentId],
      );
      parentId = cleanup.rows[0]?.parentId ?? null;
    }
  }

  async reactionSummaries(ids: string[], viewerId: string | null): Promise<Map<string, ReactionSummary>> {
    if (ids.length === 0) return new Map();
    const result = await this.pool.query(
      `SELECT comment_id AS "targetId", reaction_type AS "reactionType",
              COUNT(*)::int AS count,
              COALESCE(BOOL_OR(user_id = $2::uuid), FALSE) AS mine
       FROM public.problem_comment_reactions
       WHERE comment_id = ANY($1::uuid[])
       GROUP BY comment_id, reaction_type`,
      [ids, viewerId],
    );
    return buildReactionSummaries(ids, result.rows);
  }

  async setReaction(commentId: string, userId: string, type: ReactionType): Promise<void> {
    await this.pool.query(
      `INSERT INTO public.problem_comment_reactions (user_id, comment_id, reaction_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, comment_id) WHERE comment_id IS NOT NULL
       DO UPDATE SET reaction_type = EXCLUDED.reaction_type, updated_at = NOW()`,
      [userId, commentId, type],
    );
  }

  async removeReaction(commentId: string, userId: string): Promise<void> {
    await this.pool.query(
      'DELETE FROM public.problem_comment_reactions WHERE user_id = $1 AND comment_id = $2',
      [userId, commentId],
    );
  }
}
