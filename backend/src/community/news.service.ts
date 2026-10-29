import { Injectable, NotFoundException } from '@nestjs/common';
import { slugify, type PageResult } from './community.utils.js';
import type { NewsInputDto, NewsStatus } from './dto/news.dto.js';
import {
  NewsRepository,
  type NewsArticle,
  type NewsListItem,
  type NewsListQuery,
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
    const id = await this.news.create(authorId, this.toWriteInput(input));
    return this.getForAdmin(id);
  }

  async update(id: string, input: NewsInputDto): Promise<NewsArticle> {
    if (!(await this.news.update(id, this.toWriteInput(input)))) throw new NotFoundException(NOT_FOUND);
    return this.getForAdmin(id);
  }

  async setStatus(id: string, status: NewsStatus): Promise<NewsArticle> {
    if (!(await this.news.setStatus(id, status))) throw new NotFoundException(NOT_FOUND);
    return this.getForAdmin(id);
  }

  async remove(id: string): Promise<void> {
    if (!(await this.news.delete(id))) throw new NotFoundException(NOT_FOUND);
  }

  private toWriteInput(input: NewsInputDto): NewsWriteInput {
    const slug = input.slug || slugify(input.title);
    return {
      title: input.title,
      slug: slug || `bai-viet-${Date.now().toString(36)}`,
      category: input.category,
      summary: input.summary,
      content: input.content,
    };
  }
}
