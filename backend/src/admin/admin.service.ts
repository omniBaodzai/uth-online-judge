import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Judge0ConfigError, Judge0Error, Judge0TimeoutError } from '../judge0/judge0.errors.js';
import { Judge0Service } from '../judge0/judge0.service.js';
import { AdminRepository } from './admin.repository.js';
import type { AdminProblemDto } from './dto/admin-problem.dto.js';
import type { AdminTestCaseDto } from './dto/admin-test-case.dto.js';
import type { ListAdminProblemsQueryDto } from './dto/list-admin-problems-query.dto.js';
import type { AdminProblemListQuery } from './admin.types.js';

@Injectable()
export class AdminService {
  constructor(
    private readonly repository: AdminRepository,
    private readonly judge0: Judge0Service,
  ) {}

  listProblems(query: ListAdminProblemsQueryDto) {
    const normalized: AdminProblemListQuery = {
      page: query.page,
      pageSize: query.pageSize,
      ...(query.search ? { search: query.search } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.difficulty ? { difficulty: query.difficulty } : {}),
    };
    return this.repository.listProblems(normalized);
  }

  getProblem(id: string) {
    return this.repository.findProblem(id);
  }

  saveProblem(input: AdminProblemDto, userId: string, id?: string) {
    return this.repository.saveProblem(input, userId, id);
  }

  async setProblemStatus(id: string, status: AdminProblemDto['status']) {
    await this.repository.setProblemStatus(id, status ?? 'draft');
    return this.repository.findProblem(id);
  }

  deleteProblem(id: string) {
    return this.repository.deleteProblem(id);
  }

  listTags() {
    return this.repository.listTags();
  }

  listLanguages() {
    return this.repository.listLanguages();
  }

  async listJudge0Languages() {
    const [available, configured] = await Promise.all([
      this.fromJudge0(() => this.judge0.getLanguages()),
      this.repository.listConfiguredJudge0Ids(),
    ]);
    return available.map((language) => ({ ...language, configured: configured.has(language.id) }));
  }

  async addJudge0Language(judge0LanguageId: number) {
    // The id must exist on the live Judge0 server; ids are never invented locally.
    const available = await this.fromJudge0(() => this.judge0.getLanguages());
    const language = available.find((item) => item.id === judge0LanguageId);
    if (!language) throw new BadRequestException('Judge0 không có ngôn ngữ với mã này.');
    return this.repository.enableLanguage(language.id, language.name);
  }

  private async fromJudge0<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (error instanceof Judge0TimeoutError) {
        throw new GatewayTimeoutException('Judge0 phản hồi quá chậm. Vui lòng thử lại.');
      }
      if (error instanceof Judge0ConfigError) {
        throw new ServiceUnavailableException('Chưa cấu hình JUDGE0_API_URL cho máy chủ.');
      }
      if (error instanceof Judge0Error) {
        throw new BadGatewayException('Không thể kết nối tới Judge0. Vui lòng kiểm tra máy chủ chấm bài.');
      }
      throw error;
    }
  }

  dashboard() {
    return this.repository.dashboard();
  }

  listTestCases(problemId: string) {
    return this.repository.listTestCases(problemId);
  }

  saveTestCase(problemId: string, input: AdminTestCaseDto, id?: string) {
    return this.repository.saveTestCase(problemId, input, id);
  }

  distributeTestCasePoints(problemId: string) {
    return this.repository.distributeTestCasePoints(problemId);
  }

  deleteTestCase(problemId: string, id: string) {
    return this.repository.deleteTestCase(problemId, id);
  }
}
