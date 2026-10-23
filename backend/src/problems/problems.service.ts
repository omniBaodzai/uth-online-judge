import { Injectable, NotFoundException } from '@nestjs/common';
import { ProblemsRepository } from './problems.repository.js';
import type {
  ProblemDetail,
  ProblemListQuery,
  ProblemListResult,
  TagSummary,
} from './problems.types.js';

@Injectable()
export class ProblemsService {
  constructor(private readonly repository: ProblemsRepository) {}

  async list(query: ProblemListQuery, userId: string | null): Promise<ProblemListResult> {
    const { rows, ids, total } = await this.repository.listPublished(query, userId);
    const tags = await this.repository.findTagsForProblems(ids);
    return {
      items: rows.map((row, index) => ({ ...row, tags: tags.get(ids[index]) ?? [] })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  listTags(): Promise<TagSummary[]> {
    return this.repository.listTags();
  }

  async getByCode(code: string, userId: string | null): Promise<ProblemDetail> {
    const found = await this.repository.findPublishedByCode(code, userId);
    // Bài nháp/lưu trữ cũng trả 404 để không lộ sự tồn tại của chúng.
    if (!found) throw new NotFoundException('Không tìm thấy bài tập.');

    const { id, ...problem } = found;
    const [tags, examples, languages] = await Promise.all([
      this.repository.findTagsForProblems([id]),
      this.repository.findSamples(id),
      this.repository.listEnabledLanguages(),
    ]);
    return { ...problem, tags: tags.get(id) ?? [], examples, languages };
  }
}
