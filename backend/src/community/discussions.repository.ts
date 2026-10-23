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
  isLocked: boolean;
}

export interface DiscussionRecord extends Omit<DiscussionListItem, 'summary'> {
  content: string;
  authorId: string;
  updatedAt: string;
  // Có bình luận của người khác hay không, dùng để quyết định tác giả có được xóa chủ đề.
  hasOthersComments: boolean;
}

export interface CommentRecord {
  id: string;
  discussionId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface PageQuery {
  page: number;
  pageSize: number;
  q?: string;
}

const AUTHOR_NAME = `COALESCE(u.username, 'Ẩn danh')`;
const REPLIES = `(SELECT COUNT(*)::int FROM public.discussion_comments c WHERE c.discussion_id = d.id)`;

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
                WHERE c.discussion_id = d.id AND c.author_id <> d.author_id
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

  async listComments(discussionId: string, query: PageQuery): Promise<PageResult<CommentRecord>> {
    const [list, count] = await Promise.all([
      this.pool.query<CommentRecord>(
        `SELECT c.id, c.discussion_id AS "discussionId", c.author_id AS "authorId",
                ${AUTHOR_NAME} AS "authorName", c.content,
                c.created_at AS "createdAt", c.updated_at AS "updatedAt"
         FROM public.discussion_comments c
         JOIN public.users u ON u.id = c.author_id
         WHERE c.discussion_id = $1
         ORDER BY c.created_at ASC, c.id ASC
         LIMIT $2 OFFSET $3`,
        [discussionId, query.pageSize, (query.page - 1) * query.pageSize],
      ),
      this.pool.query<{ total: number }>(
        'SELECT COUNT(*)::int AS total FROM public.discussion_comments WHERE discussion_id = $1',
        [discussionId],
      ),
    ]);
    return { items: list.rows, total: count.rows[0]?.total ?? 0, page: query.page, pageSize: query.pageSize };
  }

  async createComment(discussionId: string, authorId: string, content: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO public.discussion_comments (discussion_id, author_id, content) VALUES ($1, $2, $3)`,
      [discussionId, authorId, content],
    );
  }

  async findComment(id: string): Promise<{ id: string; authorId: string; isLocked: boolean } | null> {
    const result = await this.pool.query<{ id: string; authorId: string; isLocked: boolean }>(
      `SELECT c.id, c.author_id AS "authorId", d.is_locked AS "isLocked"
       FROM public.discussion_comments c
       JOIN public.discussions d ON d.id = c.discussion_id
       WHERE c.id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async updateComment(id: string, content: string): Promise<void> {
    await this.pool.query(
      `UPDATE public.discussion_comments SET content = $2, updated_at = NOW() WHERE id = $1`,
      [id, content],
    );
  }

  async deleteComment(id: string): Promise<void> {
    await this.pool.query('DELETE FROM public.discussion_comments WHERE id = $1', [id]);
  }
}
