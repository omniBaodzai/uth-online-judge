import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { Pool, type PoolClient } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';
import { escapeLikePattern } from '../submissions/global-submissions.js';
import type { NewsStatus } from './dto/news.dto.js';
import type { PageResult } from './community.utils.js';
import {
  NEWS_RICH_CONTENT_FORMAT,
  newsRichImageIds,
  type NewsContentFormat,
  type NewsRichDocument,
} from './news-rich-content.js';

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
  contentFormat: NewsContentFormat;
  contentJson: NewsRichDocument | null;
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
  contentFormat: NewsContentFormat;
  contentJson: NewsRichDocument | null;
}

export interface NewsPatchInput {
  title?: string;
  slug?: string;
  category?: string;
  summary?: string;
  content?: string;
  contentFormat?: NewsContentFormat;
  contentJson?: NewsRichDocument | null;
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
  n.content, n.content_format AS "contentFormat", n.content_json AS "contentJson", n.status,
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
    const client = await this.pool.connect();
    let transactionStarted = false;
    try {
      await client.query('BEGIN');
      transactionStarted = true;
      const result = await client.query<{ id: string }>(
        `INSERT INTO public.news_articles
           (title, slug, summary, content, category, author_id, status, content_format, content_json)
         VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT', $7, $8::jsonb)
         RETURNING id`,
        [
          input.title,
          input.slug,
          input.summary,
          input.content,
          input.category,
          authorId,
          input.contentFormat,
          input.contentJson === null ? null : JSON.stringify(input.contentJson),
        ],
      );
      const id = result.rows[0]?.id;
      if (!id) throw new Error('News article insert did not return an id');
      const mediaIds =
        input.contentFormat === NEWS_RICH_CONTENT_FORMAT && input.contentJson
          ? newsRichImageIds(input.contentJson)
          : [];
      if (mediaIds.length > 0) await this.syncMediaReferences(client, id, mediaIds);
      await client.query('COMMIT');
      transactionStarted = false;
      return id;
    } catch (error) {
      if (transactionStarted) await client.query('ROLLBACK').catch(() => undefined);
      throw this.translateError(error);
    } finally {
      client.release();
    }
  }

  async update(id: string, input: NewsPatchInput): Promise<boolean> {
    const client = await this.pool.connect();
    let transactionStarted = false;
    try {
      await client.query('BEGIN');
      transactionStarted = true;
      const current = await client.query<{
        content_format: NewsContentFormat;
        content_json: NewsRichDocument | null;
      }>(
        `SELECT content_format, content_json
         FROM public.news_articles
         WHERE id = $1
         FOR UPDATE`,
        [id],
      );
      if (!current.rows[0]) {
        await client.query('ROLLBACK');
        transactionStarted = false;
        return false;
      }

      const hasContentPatch =
        input.contentFormat !== undefined || input.content !== undefined || input.contentJson !== undefined;
      const implicitMarkdownWrite = input.contentFormat === undefined && input.content !== undefined;
      if (current.rows[0].content_format === NEWS_RICH_CONTENT_FORMAT && implicitMarkdownWrite) {
        throw new ConflictException(
          'Bài viết đang dùng Rich Text; cần tải và gửi lại contentJson hoặc chuyển định dạng rõ ràng sang Markdown.',
        );
      }

      const contentFormat = input.contentFormat ?? (implicitMarkdownWrite ? 'markdown' : undefined);
      const contentJson = contentFormat === NEWS_RICH_CONTENT_FORMAT ? input.contentJson : null;
      if (hasContentPatch) {
        const nextMediaIds =
          contentFormat === NEWS_RICH_CONTENT_FORMAT && input.contentJson
            ? newsRichImageIds(input.contentJson)
            : [];
        const currentMediaIds =
          current.rows[0].content_format === NEWS_RICH_CONTENT_FORMAT && current.rows[0].content_json
            ? newsRichImageIds(current.rows[0].content_json)
            : [];
        if (nextMediaIds.length > 0 || currentMediaIds.length > 0) {
          await this.syncMediaReferences(client, id, nextMediaIds, currentMediaIds);
        }
      }
      const result = await client.query(
        `UPDATE public.news_articles
         SET title = CASE WHEN $2 THEN $3 ELSE title END,
             slug = CASE WHEN $4 THEN $5 ELSE slug END,
             summary = CASE WHEN $6 THEN $7 ELSE summary END,
             category = CASE WHEN $8 THEN $9 ELSE category END,
             content = CASE WHEN $10 THEN $11 ELSE content END,
             content_format = CASE WHEN $10 THEN $12 ELSE content_format END,
             content_json = CASE WHEN $10 THEN $13::jsonb ELSE content_json END,
             updated_at = NOW()
         WHERE id = $1`,
        [
          id,
          input.title !== undefined,
          input.title ?? null,
          input.slug !== undefined,
          input.slug ?? null,
          input.summary !== undefined,
          input.summary ?? null,
          input.category !== undefined,
          input.category ?? null,
          hasContentPatch,
          input.content ?? null,
          contentFormat ?? null,
          contentJson === null || contentJson === undefined ? null : JSON.stringify(contentJson),
        ],
      );
      await client.query('COMMIT');
      transactionStarted = false;
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      if (transactionStarted) await client.query('ROLLBACK').catch(() => undefined);
      throw this.translateError(error);
    } finally {
      client.release();
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

  private async syncMediaReferences(
    client: PoolClient,
    articleId: string,
    mediaIds: string[],
    previousMediaIds: string[] = [],
  ): Promise<void> {
    const idsToLock = [...new Set([...mediaIds, ...previousMediaIds])].sort();
    if (idsToLock.length > 0) {
      const available = await client.query<{ id: string }>(
        `SELECT id
         FROM public.news_media
         WHERE id = ANY($1::uuid[])
         ORDER BY id
         FOR UPDATE`,
        [idsToLock],
      );
      const availableIds = new Set(available.rows.map((row) => row.id.toLowerCase()));
      if (mediaIds.some((mediaId) => !availableIds.has(mediaId.toLowerCase()))) {
        throw new BadRequestException('Một hoặc nhiều ảnh tin tức không tồn tại hoặc đã hết hạn. Hãy tải lại ảnh trước khi lưu.');
      }
    }

    await client.query(
      `DELETE FROM public.news_article_media
       WHERE news_article_id = $1
         AND NOT (news_media_id = ANY($2::uuid[]))`,
      [articleId, mediaIds],
    );
    if (mediaIds.length === 0) return;

    await client.query(
      `INSERT INTO public.news_article_media (news_article_id, news_media_id)
       SELECT $1, image_id
       FROM unnest($2::uuid[]) AS ids(image_id)
       ON CONFLICT (news_article_id, news_media_id) DO NOTHING`,
      [articleId, mediaIds],
    );
    await client.query(
      `UPDATE public.news_media
       SET orphaned_at = NULL
       WHERE id = ANY($1::uuid[])`,
      [mediaIds],
    );
  }

  private translateError(error: unknown): unknown {
    if (typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505') {
      return new ConflictException('Đường dẫn này đã được dùng cho bài viết khác. Hãy chọn đường dẫn khác.');
    }
    return error;
  }
}
