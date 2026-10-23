import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';
import { escapeLikePattern } from '../submissions/global-submissions.js';
import type { NewsStatus } from './dto/news.dto.js';
import type { PageResult } from './community.utils.js';

export interface NewsListItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  authorName: string;
  publishedAt: string | null;
}

export interface NewsArticle extends NewsListItem {
  content: string;
  status: NewsStatus;
  createdAt: string;
  updatedAt: string;
}

export interface NewsWriteInput {
  title: string;
  slug: string;
  category: string;
  summary: string;
  content: string;
}

export interface NewsListQuery {
  page: number;
  pageSize: number;
  q?: string;
  status?: NewsStatus;
}

const AUTHOR_NAME = `COALESCE(NULLIF(u.full_name, ''), u.username, 'Ban quản trị')`;

const LIST_COLUMNS = `
  n.id, n.slug, n.title, n.summary, n.category,
  ${AUTHOR_NAME} AS "authorName",
  n.published_at AS "publishedAt"`;

const FULL_COLUMNS = `${LIST_COLUMNS},
  n.content, n.status,
  n.created_at AS "createdAt", n.updated_at AS "updatedAt"`;

const SEARCH_FILTER = `
  ($1::text IS NULL
    OR n.title ILIKE $1 ESCAPE '\\'
    OR n.summary ILIKE $1 ESCAPE '\\'
    OR n.category ILIKE $1 ESCAPE '\\')`;

function searchPattern(q?: string): string | null {
  return q ? `%${escapeLikePattern(q)}%` : null;
}

@Injectable()
export class NewsRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  // Công khai: chỉ bài PUBLISHED, mới nhất trước, thứ tự xác định nhờ id.
  async listPublished(query: NewsListQuery): Promise<PageResult<NewsListItem>> {
    const filter = `n.status = 'PUBLISHED' AND ${SEARCH_FILTER}`;
    const pattern = searchPattern(query.q);
    const [list, count] = await Promise.all([
      this.pool.query<NewsListItem>(
        `SELECT ${LIST_COLUMNS}
         FROM public.news_articles n
         LEFT JOIN public.users u ON u.id = n.author_id
         WHERE ${filter}
         ORDER BY n.published_at DESC, n.id DESC
         LIMIT $2 OFFSET $3`,
        [pattern, query.pageSize, (query.page - 1) * query.pageSize],
      ),
      this.pool.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM public.news_articles n WHERE ${filter}`,
        [pattern],
      ),
    ]);
    return { items: list.rows, total: count.rows[0]?.total ?? 0, page: query.page, pageSize: query.pageSize };
  }

  async findPublishedBySlug(slug: string): Promise<NewsArticle | null> {
    const result = await this.pool.query<NewsArticle>(
      `SELECT ${FULL_COLUMNS}
       FROM public.news_articles n
       LEFT JOIN public.users u ON u.id = n.author_id
       WHERE n.slug = $1 AND n.status = 'PUBLISHED'`,
      [slug],
    );
    return result.rows[0] ?? null;
  }

  async listForAdmin(query: NewsListQuery): Promise<PageResult<NewsListItem & { status: NewsStatus; updatedAt: string }>> {
    const filter = `${SEARCH_FILTER} AND ($2::text IS NULL OR n.status = $2)`;
    const pattern = searchPattern(query.q);
    const [list, count] = await Promise.all([
      this.pool.query(
        `SELECT ${LIST_COLUMNS}, n.status, n.updated_at AS "updatedAt"
         FROM public.news_articles n
         LEFT JOIN public.users u ON u.id = n.author_id
         WHERE ${filter}
         ORDER BY n.updated_at DESC, n.id DESC
         LIMIT $3 OFFSET $4`,
        [pattern, query.status ?? null, query.pageSize, (query.page - 1) * query.pageSize],
      ),
      this.pool.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM public.news_articles n WHERE ${filter}`,
        [pattern, query.status ?? null],
      ),
    ]);
    return { items: list.rows, total: count.rows[0]?.total ?? 0, page: query.page, pageSize: query.pageSize };
  }

  async findById(id: string): Promise<NewsArticle | null> {
    const result = await this.pool.query<NewsArticle>(
      `SELECT ${FULL_COLUMNS}
       FROM public.news_articles n
       LEFT JOIN public.users u ON u.id = n.author_id
       WHERE n.id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async create(authorId: string, input: NewsWriteInput): Promise<string> {
    try {
      const result = await this.pool.query<{ id: string }>(
        `INSERT INTO public.news_articles (title, slug, summary, content, category, author_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT')
         RETURNING id`,
        [input.title, input.slug, input.summary, input.content, input.category, authorId],
      );
      return result.rows[0].id;
    } catch (error) {
      throw this.translateError(error);
    }
  }

  async update(id: string, input: NewsWriteInput): Promise<boolean> {
    try {
      const result = await this.pool.query(
        `UPDATE public.news_articles
         SET title = $2, slug = $3, summary = $4, content = $5, category = $6, updated_at = NOW()
         WHERE id = $1`,
        [id, input.title, input.slug, input.summary, input.content, input.category],
      );
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      throw this.translateError(error);
    }
  }

  // Lần xuất bản đầu tiên ghi published_at; hủy xuất bản vẫn giữ mốc cũ để xuất bản lại không đổi thứ tự.
  async setStatus(id: string, status: NewsStatus): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE public.news_articles
       SET status = $2::text,
           published_at = CASE WHEN $2::text = 'PUBLISHED' THEN COALESCE(published_at, NOW()) ELSE published_at END,
           updated_at = NOW()
       WHERE id = $1`,
      [id, status],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM public.news_articles WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  private translateError(error: unknown): unknown {
    if (typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505') {
      return new ConflictException('Đường dẫn này đã được dùng cho bài viết khác. Hãy chọn đường dẫn khác.');
    }
    return error;
  }
}
