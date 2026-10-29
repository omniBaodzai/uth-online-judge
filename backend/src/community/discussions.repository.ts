import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';
import { escapeLikePattern } from '../submissions/global-submissions.js';
import type { PageResult } from './community.utils.js';

export interface DiscussionListItem {
  id: string;
  title: string;
  summary: string;
  authorName: string;
  createdAt: string;
  replies: number;
  reactionCount: number;
  isLocked: boolean;
}

export interface DiscussionRecord extends Omit<DiscussionListItem, 'summary' | 'reactionCount'> {
  content: string;
  authorId: string;
  updatedAt: string;
  // Có bình luận của người khác hay không, dùng để quyết định tác giả có được xóa chủ đề.
  hasOthersComments: boolean;
}

export interface CommentRecord {
  id: string;
  discussionId: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  content: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommentLookup {
  id: string;
  authorId: string;
  discussionId: string;
  parentId: string | null;
  isDeleted: boolean;
  isLocked: boolean;
}

export interface PageQuery {
  page: number;
  pageSize: number;
  q?: string;
}

const AUTHOR_NAME = `COALESCE(u.username, 'Ẩn danh')`;
const REPLIES = `(SELECT COUNT(*)::int FROM public.discussion_comments c WHERE c.discussion_id = d.id AND c.deleted_at IS NULL)`;
const REACTION_COUNT = `(SELECT COUNT(*)::int FROM public.discussion_reactions r WHERE r.discussion_id = d.id)`;
const COMMENT_COLUMNS = `c.id, c.discussion_id AS "discussionId", c.parent_id AS "parentId",
                c.author_id AS "authorId", ${AUTHOR_NAME} AS "authorName", c.content,
                (c.deleted_at IS NOT NULL) AS "isDeleted",
                c.created_at AS "createdAt", c.updated_at AS "updatedAt"`;

@Injectable()
export class DiscussionsRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async list(query: PageQuery): Promise<PageResult<DiscussionListItem>> {
    const pattern = query.q ? `%${escapeLikePattern(query.q)}%` : null;
    const filter = `($1::text IS NULL OR d.title ILIKE $1 ESCAPE '\\' OR d.content ILIKE $1 ESCAPE '\\')`;
    const [list, count] = await Promise.all([
      this.pool.query<DiscussionListItem>(
        `SELECT d.id, d.title,
                regexp_replace(LEFT(d.content, 300), '\\s+', ' ', 'g') AS summary,
                ${AUTHOR_NAME} AS "authorName",
                d.created_at AS "createdAt",
                ${REPLIES} AS replies,
                ${REACTION_COUNT} AS "reactionCount",
                d.is_locked AS "isLocked"
         FROM public.discussions d
         JOIN public.users u ON u.id = d.author_id
         WHERE ${filter}
         ORDER BY d.created_at DESC, d.id DESC
         LIMIT $2 OFFSET $3`,
        [pattern, query.pageSize, (query.page - 1) * query.pageSize],
      ),
      this.pool.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM public.discussions d WHERE ${filter}`,
        [pattern],
      ),
    ]);
    return { items: list.rows, total: count.rows[0]?.total ?? 0, page: query.page, pageSize: query.pageSize };
  }

  async findById(id: string): Promise<DiscussionRecord | null> {
    const result = await this.pool.query<DiscussionRecord>(
      `SELECT d.id, d.title, d.content, d.author_id AS "authorId",
              ${AUTHOR_NAME} AS "authorName",
              d.created_at AS "createdAt", d.updated_at AS "updatedAt",
              ${REPLIES} AS replies,
              d.is_locked AS "isLocked",
              EXISTS (
                SELECT 1 FROM public.discussion_comments c
                WHERE c.discussion_id = d.id AND c.author_id <> d.author_id AND c.deleted_at IS NULL
              ) AS "hasOthersComments"
       FROM public.discussions d
       JOIN public.users u ON u.id = d.author_id
       WHERE d.id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async create(authorId: string, title: string, content: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO public.discussions (title, content, author_id) VALUES ($1, $2, $3) RETURNING id`,
      [title, content, authorId],
    );
    return result.rows[0].id;
  }

  async update(id: string, title: string, content: string): Promise<void> {
    await this.pool.query(
      `UPDATE public.discussions SET title = $2, content = $3, updated_at = NOW() WHERE id = $1`,
      [id, title, content],
    );
  }

  async setLocked(id: string, isLocked: boolean): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE public.discussions SET is_locked = $2, updated_at = NOW() WHERE id = $1`,
      [id, isLocked],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM public.discussions WHERE id = $1', [id]);
  }

  // Phân trang theo bình luận gốc; phản hồi được lấy riêng bằng listReplies cho cả trang (không N+1).
  async listComments(discussionId: string, query: PageQuery): Promise<PageResult<CommentRecord>> {
    const [list, count] = await Promise.all([
      this.pool.query<CommentRecord>(
        `SELECT ${COMMENT_COLUMNS}
         FROM public.discussion_comments c
         JOIN public.users u ON u.id = c.author_id
         WHERE c.discussion_id = $1 AND c.parent_id IS NULL
         ORDER BY c.created_at ASC, c.id ASC
         LIMIT $2 OFFSET $3`,
        [discussionId, query.pageSize, (query.page - 1) * query.pageSize],
      ),
      this.pool.query<{ total: number }>(
        'SELECT COUNT(*)::int AS total FROM public.discussion_comments WHERE discussion_id = $1 AND parent_id IS NULL',
        [discussionId],
      ),
    ]);
    return { items: list.rows, total: count.rows[0]?.total ?? 0, page: query.page, pageSize: query.pageSize };
  }

  async listReplies(parentIds: string[]): Promise<CommentRecord[]> {
    if (parentIds.length === 0) return [];
    const result = await this.pool.query<CommentRecord>(
      `WITH RECURSIVE descendants(id) AS (
         SELECT c.id
         FROM public.discussion_comments c
         WHERE c.parent_id = ANY($1::uuid[])
         UNION
         SELECT child.id
         FROM public.discussion_comments child
         JOIN descendants parent ON child.parent_id = parent.id
       )
       SELECT ${COMMENT_COLUMNS}
       FROM public.discussion_comments c
       JOIN descendants d ON d.id = c.id
       JOIN public.users u ON u.id = c.author_id
       ORDER BY c.created_at ASC, c.id ASC`,
      [parentIds],
    );
    return result.rows;
  }

  async createComment(
    discussionId: string,
    authorId: string,
    content: string,
    parentId: string | null = null,
  ): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO public.discussion_comments (discussion_id, author_id, content, parent_id)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [discussionId, authorId, content, parentId],
    );
    return result.rows[0].id;
  }

  async findComment(id: string): Promise<CommentLookup | null> {
    const result = await this.pool.query<CommentLookup>(
      `SELECT c.id, c.author_id AS "authorId", c.discussion_id AS "discussionId",
              c.parent_id AS "parentId", (c.deleted_at IS NOT NULL) AS "isDeleted",
              d.is_locked AS "isLocked"
       FROM public.discussion_comments c
       JOIN public.discussions d ON d.id = c.discussion_id
       WHERE c.id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async updateComment(id: string, content: string): Promise<void> {
    await this.pool.query(
      `UPDATE public.discussion_comments SET content = $2, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [id, content],
    );
  }

  // Bình luận còn phản hồi được xóa mềm; khi xóa lá, dọn các cha đã xóa mềm nếu chúng hết phản hồi.
  async deleteComment(id: string): Promise<void> {
    const soft = await this.pool.query(
      `UPDATE public.discussion_comments c
       SET deleted_at = NOW(), content = '', updated_at = NOW()
       WHERE c.id = $1 AND EXISTS (SELECT 1 FROM public.discussion_comments r WHERE r.parent_id = c.id)`,
      [id],
    );
    if ((soft.rowCount ?? 0) > 0) return;

    const removed = await this.pool.query<{ parentId: string | null }>(
      `DELETE FROM public.discussion_comments c
       WHERE c.id = $1 AND NOT EXISTS (SELECT 1 FROM public.discussion_comments r WHERE r.parent_id = c.id)
       RETURNING c.parent_id AS "parentId"`,
      [id],
    );
    let parentId = removed.rows[0]?.parentId;
    while (parentId) {
      const cleanup = await this.pool.query<{ parentId: string | null }>(
        `DELETE FROM public.discussion_comments p
         WHERE p.id = $1 AND p.deleted_at IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM public.discussion_comments r WHERE r.parent_id = p.id)
         RETURNING p.parent_id AS "parentId"`,
        [parentId],
      );
      parentId = cleanup.rows[0]?.parentId ?? null;
    }
  }
}
