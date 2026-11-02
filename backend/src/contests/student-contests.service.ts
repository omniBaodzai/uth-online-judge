import {
  ConflictException,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { StudentContestsRepository } from './student-contests.repository.js';
import type {
  StudentContestDetail,
  StudentContestLeaderboardPage,
  StudentContestLeaderboardQuery,
  StudentContestListQuery,
  StudentContestParticipantsPage,
  StudentContestParticipantsQuery,
  StudentContestPage,
  StudentContestStatistics,
  StudentContestSubmissionsPage,
  StudentContestSubmissionsQuery,
} from './student-contests.types.js';

@Injectable()
export class StudentContestsService {
  constructor(private readonly repository: StudentContestsRepository) {}

  list(query: StudentContestListQuery, userId: string | null): Promise<StudentContestPage> {
    return this.withDatabaseErrors(() => this.repository.list(query, userId));
  }

  get(identifier: string, userId: string | null): Promise<StudentContestDetail> {
    return this.withDatabaseErrors(() => this.repository.findPublic(identifier, userId));
  }

  statistics(identifier: string): Promise<StudentContestStatistics> {
    return this.withDatabaseErrors(() => this.repository.findPublicStatistics(identifier));
  }

  leaderboard(
    identifier: string,
    query: StudentContestLeaderboardQuery,
  ): Promise<StudentContestLeaderboardPage> {
    return this.withDatabaseErrors(() =>
      this.repository.findPublicLeaderboard(identifier, query),
    );
  }

  participants(
    identifier: string,
    query: StudentContestParticipantsQuery,
  ): Promise<StudentContestParticipantsPage> {
    return this.withDatabaseErrors(() =>
      this.repository.findPublicParticipants(identifier, query),
    );
  }

  submissions(
    identifier: string,
    query: StudentContestSubmissionsQuery,
    viewerId: string | null,
  ): Promise<StudentContestSubmissionsPage> {
    return this.withDatabaseErrors(() =>
      this.repository.findPublicSubmissions(identifier, query, viewerId),
    );
  }

  register(contestId: string, userId: string) {
    return this.withDatabaseErrors(() => this.repository.register(contestId, userId));
  }

  cancel(contestId: string, userId: string) {
    return this.withDatabaseErrors(() => this.repository.cancel(contestId, userId));
  }

  private async withDatabaseErrors<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const code = postgresErrorCode(error);
      if (code === '55000' || code === '23505' || code === '40001') {
        throw new ConflictException(
          'Trạng thái đăng ký đã thay đổi hoặc thời hạn đăng ký đã kết thúc.',
        );
      }
      if (code === '23503') {
        throw new ConflictException('Tài khoản hoặc cuộc thi không còn hợp lệ.');
      }
      throw error;
    }
  }
}

function postgresErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
}
