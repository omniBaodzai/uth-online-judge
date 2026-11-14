import { BadRequestException, ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import { NewsPatchDto, NewsInputDto } from './dto/news.dto.js';
import { NewsRepository, type NewsArticle } from './news.repository.js';
import { NewsService } from './news.service.js';
import {
  NEWS_RICH_CONTENT_FORMAT,
  NEWS_RICH_DOCUMENT_FORMAT,
  NEWS_RICH_DOCUMENT_VERSION,
  type NewsRichDocument,
} from './news-rich-content.js';

const richDocument: NewsRichDocument = {
  format: NEWS_RICH_DOCUMENT_FORMAT,
  version: NEWS_RICH_DOCUMENT_VERSION,
  document: {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Rich title', marks: [{ type: 'bold' }] }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: '<script>alert(1)</script>' }],
      },
    ],
  },
};
const richDocumentWithImage: NewsRichDocument = {
  ...richDocument,
  document: {
    type: 'doc',
    content: [{
      type: 'image',
      attrs: {
        src: '/news/media/c4a4b748-a323-4d3a-8f76-3d72d1cb9812',
        alt: 'Campus',
        width: 100,
        align: 'center',
      },
    }],
  },
};

const savedArticle = (patch: Partial<NewsArticle> = {}): NewsArticle => ({
  id: 'article-id',
  slug: 'article',
  title: 'Article',
  summary: 'Summary',
  category: 'News',
  authorName: 'Admin',
  publishedAt: null,
  content: 'Legacy markdown',
  contentFormat: 'markdown',
  contentJson: null,
  status: 'DRAFT',
  createdAt: '',
  updatedAt: '',
  ...patch,
});

describe('NewsService content compatibility', () => {
  it('keeps the existing Markdown DTO contract and permits an explicit Rich JSON payload', async () => {
    const markdownErrors = await validate(
      plainToInstance(NewsInputDto, {
        title: 'Legacy article',
        category: 'News',
        summary: 'Summary',
        content: '# Original Markdown',
      }),
    );
    const richErrors = await validate(
      plainToInstance(NewsInputDto, {
        title: 'Rich article',
        category: 'News',
        summary: 'Summary',
        contentFormat: NEWS_RICH_CONTENT_FORMAT,
        contentJson: richDocument,
      }),
    );

    expect(markdownErrors).toHaveLength(0);
    expect(richErrors).toHaveLength(0);
  });

  it('validates the Rich DTO recursively and supports a metadata-only PATCH', async () => {
    const unsafeRichErrors = await validate(
      plainToInstance(NewsInputDto, {
        title: 'Rich article',
        category: 'News',
        summary: 'Summary',
        contentFormat: NEWS_RICH_CONTENT_FORMAT,
        contentJson: {
          ...richDocument,
          document: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: 'click',
                    marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
                  },
                ],
              },
            ],
          },
        },
      }),
    );
    const patchErrors = await validate(plainToInstance(NewsPatchDto, { title: 'Only metadata' }));

    expect(unsafeRichErrors).not.toHaveLength(0);
    expect(patchErrors).toHaveLength(0);
  });

  it('creates Markdown using the current API shape and persists a null JSON document', async () => {
    const create = vi.fn().mockResolvedValue('article-id');
    const service = new NewsService({
      create,
      findById: vi.fn().mockResolvedValue(savedArticle()),
    } as never);

    await service.create('admin-id', {
      title: 'Legacy article',
      category: 'News',
      summary: 'Summary',
      content: '# Original Markdown',
    } as NewsInputDto);

    expect(create.mock.calls[0][1]).toMatchObject({
      content: '# Original Markdown',
      contentFormat: 'markdown',
      contentJson: null,
    });
  });

  it('creates Rich Text with a server-generated Markdown fallback', async () => {
    const create = vi.fn().mockResolvedValue('article-id');
    const service = new NewsService({
      create,
      findById: vi.fn().mockResolvedValue(
        savedArticle({
          content: '# **Rich title**\n\n<script>alert(1)</script>',
          contentFormat: NEWS_RICH_CONTENT_FORMAT,
          contentJson: richDocument,
        }),
      ),
    } as never);

    await service.create('admin-id', {
      title: 'Rich article',
      category: 'News',
      summary: 'Summary',
      contentFormat: NEWS_RICH_CONTENT_FORMAT,
      contentJson: richDocument,
    } as NewsInputDto);

    expect(create.mock.calls[0][1]).toMatchObject({
      content: '# **Rich title**\n\n<\u200Bscript＞alert(1)<\u200B/script＞',
      contentFormat: NEWS_RICH_CONTENT_FORMAT,
      contentJson: richDocument,
    });
  });

  it('preserves Rich JSON on a metadata-only PATCH', async () => {
    const update = vi.fn().mockResolvedValue(true);
    const service = new NewsService({
      update,
      findById: vi.fn().mockResolvedValue(savedArticle()),
    } as never);

    await service.update('article-id', { title: 'New title' } as NewsPatchDto);

    expect(update).toHaveBeenCalledWith('article-id', {
      title: 'New title',
      slug: 'new-title',
      category: undefined,
      summary: undefined,
    });
  });

  it('does not silently downgrade Rich Text from an old Markdown-only PATCH', async () => {
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT content_format')) {
          return Promise.resolve({ rows: [{ content_format: NEWS_RICH_CONTENT_FORMAT }] });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      }),
      release: vi.fn(),
    };
    const repository = new NewsRepository({ connect: vi.fn().mockResolvedValue(client) } as never);

    await expect(repository.update('article-id', { content: 'old client content' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query.mock.calls.some(([sql]) => String(sql).startsWith('UPDATE'))).toBe(false);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rejects a partial PATCH that changes format without supplying its content', async () => {
    const service = new NewsService({ update: vi.fn() } as never);

    await expect(
      service.update('article-id', { contentFormat: 'markdown' } as NewsPatchDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.update('article-id', { contentJson: richDocument } as NewsPatchDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps status changes separate from content writes', async () => {
    const setStatus = vi.fn().mockResolvedValue(true);
    const service = new NewsService({
      setStatus,
      findById: vi.fn().mockResolvedValue(savedArticle()),
    } as never);

    await service.setStatus('article-id', 'PUBLISHED');

    expect(setStatus).toHaveBeenCalledWith('article-id', 'PUBLISHED');
    expect(setStatus.mock.calls[0]).toHaveLength(2);
  });
});

describe('NewsRepository Rich Text persistence', () => {
  it('saves media references transactionally with a Rich Text article', async () => {
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('INSERT INTO public.news_articles')) return Promise.resolve({ rows: [{ id: 'article-id' }] });
        if (sql.includes('FROM public.news_media')) {
          return Promise.resolve({ rows: [{ id: 'c4a4b748-a323-4d3a-8f76-3d72d1cb9812' }] });
        }
        return Promise.resolve({ rows: [], rowCount: 1 });
      }),
      release: vi.fn(),
    };
    const repository = new NewsRepository({ connect: vi.fn().mockResolvedValue(client) } as never);

    await repository.create('admin-id', {
      title: 'Image article',
      slug: 'image-article',
      category: 'News',
      summary: 'Summary',
      content: 'Image: Campus',
      contentFormat: NEWS_RICH_CONTENT_FORMAT,
      contentJson: richDocumentWithImage,
    });

    const sql = client.query.mock.calls.map(([statement]) => String(statement));
    expect(sql.some((statement) => statement.includes('FROM public.news_media'))).toBe(true);
    expect(sql.some((statement) => statement.includes('INSERT INTO public.news_article_media'))).toBe(true);
    expect(sql.some((statement) => statement.includes('SET orphaned_at = NULL'))).toBe(true);
    expect(sql.at(-1)).toBe('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('stores the versioned JSON envelope and reads it back as JSONB', async () => {
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('INSERT INTO public.news_articles')) return Promise.resolve({ rows: [{ id: 'article-id' }] });
        return Promise.resolve({ rows: [] });
      }),
      release: vi.fn(),
    };
    const query = vi.fn().mockImplementation(() => {
      return Promise.resolve({ rows: [savedArticle({ contentFormat: NEWS_RICH_CONTENT_FORMAT, contentJson: richDocument })] });
    });
    const repository = new NewsRepository({ connect: vi.fn().mockResolvedValue(client), query } as never);

    await repository.create('admin-id', {
      title: 'Rich article',
      slug: 'rich-article',
      category: 'News',
      summary: 'Summary',
      content: 'fallback',
      contentFormat: NEWS_RICH_CONTENT_FORMAT,
      contentJson: richDocument,
    });
    const result = await repository.findById('article-id');

    expect(client.query.mock.calls[1][0]).toContain('content_format, content_json');
    expect(client.query.mock.calls[1][1][6]).toBe(NEWS_RICH_CONTENT_FORMAT);
    expect(client.query.mock.calls[1][1][7]).toBe(JSON.stringify(richDocument));
    expect(query.mock.calls[0][0]).toContain('n.content_json AS "contentJson"');
    expect(result?.contentJson).toEqual(richDocument);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('leaves both content columns untouched for a metadata-only PATCH', async () => {
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT content_format')) {
          return Promise.resolve({
            rows: [{ content_format: NEWS_RICH_CONTENT_FORMAT, content_json: richDocumentWithImage }],
          });
        }
        if (sql.startsWith('UPDATE')) return Promise.resolve({ rows: [], rowCount: 1 });
        return Promise.resolve({ rows: [] });
      }),
      release: vi.fn(),
    };
    const repository = new NewsRepository({ connect: vi.fn().mockResolvedValue(client) } as never);

    await expect(repository.update('article-id', { title: 'Updated title' })).resolves.toBe(true);

    const [updateSql, params] = client.query.mock.calls.find(([sql]) => String(sql).startsWith('UPDATE')) as [
      string,
      unknown[],
    ];
    expect(updateSql).toContain('content = CASE WHEN $10 THEN $11 ELSE content END');
    expect(updateSql).toContain('content_json = CASE WHEN $10 THEN $13::jsonb ELSE content_json END');
    expect(params[9]).toBe(false);
    expect(params[10]).toBeNull();
    expect(params[11]).toBeNull();
    expect(params[12]).toBeNull();
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('public.news_article_media'))).toBe(false);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('updates Rich JSON and its Markdown fallback together in one transaction', async () => {
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT content_format')) {
          return Promise.resolve({ rows: [{ content_format: 'markdown' }] });
        }
        if (sql.startsWith('UPDATE')) return Promise.resolve({ rows: [], rowCount: 1 });
        return Promise.resolve({ rows: [] });
      }),
      release: vi.fn(),
    };
    const repository = new NewsRepository({ connect: vi.fn().mockResolvedValue(client) } as never);

    await repository.update('article-id', {
      content: '# **Rich title**',
      contentFormat: NEWS_RICH_CONTENT_FORMAT,
      contentJson: richDocument,
    });

    const [, params] = client.query.mock.calls.find(([sql]) => String(sql).startsWith('UPDATE')) as [
      string,
      unknown[],
    ];
    expect(params[9]).toBe(true);
    expect(params[10]).toBe('# **Rich title**');
    expect(params[11]).toBe(NEWS_RICH_CONTENT_FORMAT);
    expect(params[12]).toBe(JSON.stringify(richDocument));
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('allows an explicit Markdown downgrade and clears only the rich JSON column', async () => {
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT content_format')) {
          return Promise.resolve({ rows: [{ content_format: NEWS_RICH_CONTENT_FORMAT }] });
        }
        if (sql.startsWith('UPDATE')) return Promise.resolve({ rows: [], rowCount: 1 });
        return Promise.resolve({ rows: [] });
      }),
      release: vi.fn(),
    };
    const repository = new NewsRepository({ connect: vi.fn().mockResolvedValue(client) } as never);

    await repository.update('article-id', {
      content: 'Markdown body',
      contentFormat: 'markdown',
      contentJson: null,
    });

    const [, params] = client.query.mock.calls.find(([sql]) => String(sql).startsWith('UPDATE')) as [
      string,
      unknown[],
    ];
    expect(params[10]).toBe('Markdown body');
    expect(params[11]).toBe('markdown');
    expect(params[12]).toBeNull();
  });
});
