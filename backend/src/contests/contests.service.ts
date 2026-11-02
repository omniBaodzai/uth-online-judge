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

  list(query: ContestListQuery): Promise<ContestPage> {
    return this.withDatabaseErrors(() => this.repository.list(query));
  }

  overview(): Promise<ContestOverview> {
    return this.withDatabaseErrors(() => this.repository.overview());
  }

  get(id: string): Promise<ContestDetail> {
    return this.withDatabaseErrors(() => this.repository.findById(id));
  }

  create(input: CreateContestInput, adminId: string): Promise<ContestDetail> {
    validateTimeWindow(input.startsAt, input.endsAt);
    return this.withDatabaseErrors(() => this.repository.create(input, adminId));
  }

  update(
    id: string,
    input: UpdateContestInput,
    adminId: string,
  ): Promise<ContestDetail> {
    if (input.startsAt !== undefined && input.endsAt !== undefined) {
      validateTimeWindow(input.startsAt, input.endsAt);
    }
    if (Object.keys(input).length === 0) {
      throw new BadRequestException('Cần cung cấp ít nhất một trường để cập nhật.');
    }
    return this.withDatabaseErrors(() => this.repository.update(id, input, adminId));
  }

  replaceProblems(
    id: string,
    problems: ReplaceContestProblemInput[],
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
    return this.withDatabaseErrors(() => this.repository.replaceProblems(id, problems));
  }

  publish(id: string): Promise<ContestDetail> {
    return this.withDatabaseErrors(() => this.repository.publish(id));
  }

  archive(id: string): Promise<ContestDetail> {
    return this.withDatabaseErrors(() => this.repository.archive(id));
  }

  restore(id: string): Promise<ContestDetail> {
    return this.withDatabaseErrors(() => this.repository.restore(id));
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
