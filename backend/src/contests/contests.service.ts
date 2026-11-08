import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { ContestsRepository } from './contests.repository.js';
import type {
  ContestDetail,
  ContestOverview,
  ContestPage,
  ContestListQuery,
  CreateContestInput,
  ReplaceContestProblemInput,
  UpdateContestInput,
} from './contests.types.js';

@Injectable()
export class ContestsService {
  constructor(private readonly repository: ContestsRepository) {}

  list(query: ContestListQuery, organizationId: string | null = null): Promise<ContestPage> {
    return this.withDatabaseErrors(() => this.repository.list(query, organizationId));
  }

  overview(): Promise<ContestOverview> {
    return this.withDatabaseErrors(() => this.repository.overview());
  }

  get(id: string, organizationId: string | null = null): Promise<ContestDetail> {
    return this.withDatabaseErrors(() => this.repository.findById(id, organizationId));
  }

  getContestProblemContentScope(contestId: string, problemId: string, organizationId: string) {
    return this.withDatabaseErrors(() =>
      this.repository.findContestProblemContentScope(contestId, problemId, organizationId),
    );
  }

  listProblemOptions(organizationId: string, search?: string) {
    return this.withDatabaseErrors(() => this.repository.listProblemOptions(organizationId, search));
  }

  create(
    input: CreateContestInput,
    adminId: string,
    organizationId: string | null = null,
    actor?: { userId: string; isSystemAdmin: boolean },
  ): Promise<ContestDetail> {
    validateTimeWindow(input.startsAt, input.endsAt);
    return this.withDatabaseErrors(() => this.repository.create(input, adminId, organizationId, actor));
  }

  update(
    id: string,
    input: UpdateContestInput,
    adminId: string,
    organizationId: string | null = null,
    actor?: { userId: string; isSystemAdmin: boolean },
  ): Promise<ContestDetail> {
    if (input.startsAt !== undefined && input.endsAt !== undefined) {
      validateTimeWindow(input.startsAt, input.endsAt);
    }
    if (Object.keys(input).length === 0) {
      throw new BadRequestException('Cần cung cấp ít nhất một trường để cập nhật.');
    }
    return this.withDatabaseErrors(() => this.repository.update(id, input, adminId, organizationId, actor));
  }

  replaceProblems(
    id: string,
    problems: ReplaceContestProblemInput[],
    organizationId: string | null = null,
    actor?: { userId: string; isSystemAdmin: boolean },
  ) {
    const seen = new Set<string>();
    for (const problem of problems) {
      if (seen.has(problem.problemId)) {
        throw new BadRequestException('Không thể thêm trùng bài tập vào cuộc thi.');
      }
      seen.add(problem.problemId);
      if (!Number.isFinite(problem.maxScore) || problem.maxScore <= 0) {
        throw new BadRequestException('Điểm tối đa của mỗi bài phải lớn hơn 0.');
      }
    }
    return this.withDatabaseErrors(() => this.repository.replaceProblems(id, problems, organizationId, actor));
  }

  publish(
    id: string,
    organizationId: string | null = null,
    actor?: { userId: string; isSystemAdmin: boolean },
  ): Promise<ContestDetail> {
    return this.withDatabaseErrors(() => this.repository.publish(id, organizationId, actor));
  }

  archive(
    id: string,
    organizationId: string | null = null,
    actor?: { userId: string; isSystemAdmin: boolean },
  ): Promise<ContestDetail> {
    return this.withDatabaseErrors(() => this.repository.archive(id, organizationId, actor));
  }

  restore(
    id: string,
    organizationId: string | null = null,
    actor?: { userId: string; isSystemAdmin: boolean },
  ): Promise<ContestDetail> {
    return this.withDatabaseErrors(() => this.repository.restore(id, organizationId, actor));
  }

  private async withDatabaseErrors<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const code = postgresErrorCode(error);
      if (code === '23505') {
        throw new ConflictException('Slug hoặc dữ liệu cuộc thi bị trùng.');
      }
      if (code === '23503') {
        throw new ConflictException('Dữ liệu đang được sử dụng bởi cuộc thi hoặc bài nộp.');
      }
      if (code === '23514' || code === '22P02') {
        throw new BadRequestException('Dữ liệu không hợp lệ theo các ràng buộc của cuộc thi.');
      }
      if (code === '55000' || code === '40001') {
        throw new ConflictException('Dữ liệu cuộc thi đã bị khóa hoặc thay đổi đồng thời. Hãy tải lại và thử lại.');
      }
      throw error;
    }
  }
}

function validateTimeWindow(startsAt: string, endsAt: string): void {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    throw new BadRequestException('Thời gian bắt đầu phải trước thời gian kết thúc.');
  }
}

function postgresErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
}
