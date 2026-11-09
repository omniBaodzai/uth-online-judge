import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AdminRepository } from '../admin/admin.repository.js';
import type { AdminProblemDto } from '../admin/dto/admin-problem.dto.js';
import type { AdminTestCaseDto } from '../admin/dto/admin-test-case.dto.js';
import type { ListAdminProblemsQueryDto } from '../admin/dto/list-admin-problems-query.dto.js';
import type { AdminProblemListQuery } from '../admin/admin.types.js';
import { OrganizationsService } from './organizations.service.js';
import type { Viewer } from './organizations.types.js';

@Injectable()
export class OrganizationProblemsService {
  constructor(
    private readonly problems: AdminRepository,
    private readonly organizations: OrganizationsService,
  ) {}

  async list(slug: string, viewer: Viewer, query: ListAdminProblemsQueryDto) {
    const access = await this.organizations.getProblemAccess(slug, viewer);
    const normalized: AdminProblemListQuery = {
      page: query.page,
      pageSize: query.pageSize,
      ...(query.search ? { search: query.search } : {}),
      ...(access.canManage && query.status ? { status: query.status } : {}),
      ...(query.difficulty ? { difficulty: query.difficulty } : {}),
      ...(!access.canManage ? { status: 'published' as const } : {}),
    };
    return this.problems.listProblems(normalized, access.organizationId);
  }

  async get(slug: string, problemId: string, viewer: Viewer) {
    const access = await this.organizations.getProblemAccess(slug, viewer);
    const problem = await this.problems.findProblem(
      problemId,
      access.organizationId,
      access.canManage,
    );
    if (!access.canManage && problem.status !== 'published') {
      throw new NotFoundException('Không tìm thấy bài tập.');
    }
    return problem;
  }

  async create(slug: string, viewer: Viewer, input: AdminProblemDto) {
    const { actor, ...access } = await this.requireManager(slug, viewer, true);
    return this.problems.saveProblem(input, actor.userId, undefined, access.organizationId, actor);
  }

  async update(slug: string, problemId: string, viewer: Viewer, input: AdminProblemDto) {
    const { actor, ...access } = await this.requireManager(slug, viewer, true);
    return this.problems.saveProblem(input, actor.userId, problemId, access.organizationId, actor);
  }

  async setStatus(
    slug: string,
    problemId: string,
    viewer: Viewer,
    status: AdminProblemDto['status'],
  ) {
    const { actor, ...access } = await this.requireManager(slug, viewer, true);
    await this.problems.setProblemStatus(problemId, status ?? 'draft', access.organizationId, actor);
    return this.problems.findProblem(problemId, access.organizationId);
  }

  async delete(slug: string, problemId: string, viewer: Viewer) {
    const { actor, ...access } = await this.requireManager(slug, viewer, true);
    return this.problems.deleteProblem(problemId, access.organizationId, actor);
  }

  async listTestCases(slug: string, problemId: string, viewer: Viewer) {
    const { actor, ...access } = await this.requireManager(slug, viewer, false);
    return this.problems.listTestCases(problemId, access.organizationId, actor);
  }

  async replaceTestCases(
    slug: string,
    problemId: string,
    viewer: Viewer,
    expectedRevision: number,
    testCases: AdminTestCaseDto[],
  ) {
    const { actor, ...access } = await this.requireManager(slug, viewer, true);
    return this.problems.replaceTestCases(
      problemId,
      expectedRevision,
      testCases,
      access.organizationId,
      actor,
    );
  }

  private async requireManager(slug: string, viewer: Viewer, requireActive: boolean) {
    const access = await this.organizations.getProblemAccess(slug, viewer);
    if (!access.canManage) {
      throw new ForbiddenException('Chỉ OWNER, Organization ADMIN hoặc System Admin được quản lý bài tập.');
    }
    if (requireActive && access.status !== 'ACTIVE') {
      throw new ConflictException('Tổ chức đã được lưu trữ; không thể thay đổi bài tập.');
    }
    if (!viewer) throw new UnauthorizedException('Vui lòng đăng nhập.');
    return {
      ...access,
      actor: { userId: viewer.id, isSystemAdmin: viewer.role === 'ADMIN' },
    };
  }
}
