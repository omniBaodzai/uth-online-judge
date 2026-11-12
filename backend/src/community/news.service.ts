import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { slugify, type PageResult } from './community.utils.js';
import type { NewsInputDto, NewsPatchDto, NewsStatus } from './dto/news.dto.js';
import {
  isNewsRichDocument,
  NEWS_RICH_CONTENT_FORMAT,
  newsRichDocumentToMarkdown,
  type NewsContentFormat,
} from './news-rich-content.js';
import {
  NewsRepository,
  type NewsArticle,
  type NewsListItem,
  type NewsListQuery,
  type NewsPatchInput,
  type NewsWriteInput,
} from './news.repository.js';

const NOT_FOUND = 'Không tìm thấy bài viết.';

@Injectable()
export class NewsService {
  constructor(private readonly news: NewsRepository) {}

  listPublished(query: NewsListQuery): Promise<PageResult<NewsListItem>> {
    // Công khai không bao giờ nhận trạng thái từ client.
    return this.news.listPublished({ page: query.page, pageSize: query.pageSize, q: query.q });
  }

  async getPublished(slug: string): Promise<NewsArticle> {
    const article = await this.news.findPublishedBySlug(slug);
    if (!article) throw new NotFoundException(NOT_FOUND);
    return article;
  }

  listForAdmin(query: NewsListQuery) {
    return this.news.listForAdmin(query);
  }

  async getForAdmin(id: string): Promise<NewsArticle> {
    const article = await this.news.findById(id);
    if (!article) throw new NotFoundException(NOT_FOUND);
    return article;
  }

  async create(authorId: string, input: NewsInputDto): Promise<NewsArticle> {
    const content = this.createContent(input);
    const id = await this.news.create(authorId, {
      title: input.title,
      slug: this.slugForCreate(input),
      category: input.category,
      summary: input.summary,
      ...content,
    });
    return this.getForAdmin(id);
  }

  async update(id: string, input: NewsPatchDto): Promise<NewsArticle> {
    const content = this.patchContent(input);
    const patch: NewsPatchInput = {
      title: input.title,
      slug: input.slug ?? (input.title ? slugify(input.title) : undefined),
      category: input.category,
      summary: input.summary,
      ...content,
    };
    if (!(await this.news.update(id, patch))) throw new NotFoundException(NOT_FOUND);
    return this.getForAdmin(id);
  }

  async setStatus(id: string, status: NewsStatus): Promise<NewsArticle> {
    if (!(await this.news.setStatus(id, status))) throw new NotFoundException(NOT_FOUND);
    return this.getForAdmin(id);
  }

  async remove(id: string): Promise<void> {
    if (!(await this.news.delete(id))) throw new NotFoundException(NOT_FOUND);
  }

  private slugForCreate(input: NewsInputDto): string {
    const slug = input.slug || slugify(input.title);
    return slug || `bai-viet-${Date.now().toString(36)}`;
  }

  private createContent(input: NewsInputDto): Pick<NewsWriteInput, 'content' | 'contentFormat' | 'contentJson'> {
    const contentFormat: NewsContentFormat = input.contentFormat ?? 'markdown';
    if (contentFormat === NEWS_RICH_CONTENT_FORMAT) {
      if (input.content !== undefined) {
        throw new BadRequestException('Với Rich Text, content được tạo từ contentJson và không nhận từ client.');
      }
      if (!isNewsRichDocument(input.contentJson)) {
        throw new BadRequestException('Cấu trúc nội dung Rich Text không hợp lệ.');
      }
      return {
        content: newsRichDocumentToMarkdown(input.contentJson),
        contentFormat,
        contentJson: input.contentJson,
      };
    }

    if (input.contentJson !== undefined || typeof input.content !== 'string') {
      throw new BadRequestException('Nội dung Markdown phải được cung cấp dưới dạng content.');
    }
    return { content: input.content.trim(), contentFormat: 'markdown', contentJson: null };
  }

  private patchContent(input: NewsPatchDto): Pick<NewsPatchInput, 'content' | 'contentFormat' | 'contentJson'> {
    if (input.contentFormat === NEWS_RICH_CONTENT_FORMAT) {
      if (input.content !== undefined) {
        throw new BadRequestException('Với Rich Text, content được tạo từ contentJson và không nhận từ client.');
      }
      if (!isNewsRichDocument(input.contentJson)) {
        throw new BadRequestException('Cấu trúc nội dung Rich Text không hợp lệ.');
      }
      return {
        content: newsRichDocumentToMarkdown(input.contentJson),
        contentFormat: NEWS_RICH_CONTENT_FORMAT,
        contentJson: input.contentJson,
      };
    }

    if (input.contentFormat === 'markdown') {
      if (typeof input.content !== 'string' || input.contentJson !== undefined) {
        throw new BadRequestException('Nội dung Markdown phải được cung cấp dưới dạng content.');
      }
      return { content: input.content.trim(), contentFormat: 'markdown', contentJson: null };
    }

    if (input.contentJson !== undefined) {
      throw new BadRequestException('contentJson cần đi kèm contentFormat=tiptap-json.');
    }
    if (input.content !== undefined) {
      return { content: input.content.trim() };
    }
    return {};
  }
}
