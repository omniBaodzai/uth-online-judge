import { Injectable } from '@nestjs/common';
import { AdminRepository } from './admin.repository.js';
import type { AdminProblemDto } from './dto/admin-problem.dto.js';
import type { AdminTestCaseDto } from './dto/admin-test-case.dto.js';
import type { ListAdminProblemsQueryDto } from './dto/list-admin-problems-query.dto.js';
import type { AdminProblemListQuery } from './admin.types.js';

@Injectable()
export class AdminService {
  constructor(private readonly repository: AdminRepository) {}

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

  dashboard() {
    return this.repository.dashboard();
  }

  listTestCases(problemId: string) {
    return this.repository.listTestCases(problemId);
  }

  saveTestCase(problemId: string, input: AdminTestCaseDto, id?: string) {
    return this.repository.saveTestCase(problemId, input, id);
  }

  deleteTestCase(problemId: string, id: string) {
    return this.repository.deleteTestCase(problemId, id);
  }
}
