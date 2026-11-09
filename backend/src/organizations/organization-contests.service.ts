import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ContestsService } from '../contests/contests.service.js';
import { AdminRepository } from '../admin/admin.repository.js';
import type {
  ContestDetail,
  ContestListQuery,
  CreateContestInput,
  ReplaceContestProblemInput,
  UpdateContestInput,
} from '../contests/contests.types.js';
import { OrganizationsService } from './organizations.service.js';
import type { Viewer } from './organizations.types.js';

@Injectable()
export class OrganizationContestsService {
  constructor(
    private readonly contests: ContestsService,
    private readonly organizations: OrganizationsService,
    private readonly problems: AdminRepository,
  ) {}

  async list(slug: string, viewer: Viewer, query: ContestListQuery) {
    const access = await this.organizations.getContestAccess(slug, viewer);
    const normalized: ContestListQuery = access.canManage
      ? query
      : {
          ...query,
          publicationStatus: 'PUBLISHED',
          ...(!access.viewerRole ? { visibility: 'PUBLIC' } : {}),
        };
    return this.contests.list(normalized, access.organizationId);
  }

  async listProblemOptions(slug: string, viewer: Viewer, search?: string) {
    const access = await this.requireManager(slug, viewer);
    return this.contests.listProblemOptions(access.organizationId, search);
  }

  async get(slug: string, contestId: string, viewer: Viewer): Promise<ContestDetail> {
    const access = await this.organizations.getContestAccess(slug, viewer);
    const contest = await this.contests.get(contestId, access.organizationId);
    this.assertContestVisible(contest, access);
    return contest;
  }

  async getProblemContent(
    slug: string,
    contestId: string,
    problemId: string,
    viewer: Viewer,
  ) {
    const access = await this.organizations.getContestAccess(slug, viewer);
    const contest = await this.contests.get(contestId, access.organizationId);
    this.assertContestVisible(contest, access);
    const scope = await this.contests.getContestProblemContentScope(
      contestId,
      problemId,
      access.organizationId,
    );
    if (!scope.contentAccessible || (scope.sourceArchived && !access.isSystemAdmin)) {
      throw new NotFoundException('Không tìm thấy bài tập trong kỳ thi.');
    }
    const content = await this.problems.findProblem(
      problemId,
      scope.problemOrganizationId,
      false,
    );
    const { editorials: _editorials, ...publicContent } = content;
    return publicContent;
  }

  async create(slug: string, viewer: Viewer, input: CreateContestInput) {
    const { actor, ...access } = await this.requireManager(slug, viewer);
    return this.contests.create(input, actor.userId, access.organizationId, actor);
  }

  async update(slug: string, contestId: string, viewer: Viewer, input: UpdateContestInput) {
    const { actor, ...access } = await this.requireManager(slug, viewer);
    return this.contests.update(contestId, input, actor.userId, access.organizationId, actor);
  }

  async replaceProblems(
    slug: string,
    contestId: string,
    viewer: Viewer,
    problems: ReplaceContestProblemInput[],
  ) {
    const { actor, ...access } = await this.requireManager(slug, viewer);
    return this.contests.replaceProblems(contestId, problems, access.organizationId, actor);
  }

  async publish(slug: string, contestId: string, viewer: Viewer) {
    const { actor, ...access } = await this.requireManager(slug, viewer);
    return this.contests.publish(contestId, access.organizationId, actor);
  }

  async archive(slug: string, contestId: string, viewer: Viewer) {
    const { actor, ...access } = await this.requireManager(slug, viewer);
    return this.contests.archive(contestId, access.organizationId, actor);
  }

  async restore(slug: string, contestId: string, viewer: Viewer) {
    const { actor, ...access } = await this.requireManager(slug, viewer);
    return this.contests.restore(contestId, access.organizationId, actor);
  }

  private async requireManager(slug: string, viewer: Viewer) {
    const access = await this.organizations.getContestAccess(slug, viewer);
    if (!access.canManage) {
      throw new ForbiddenException('Chỉ OWNER, Organization ADMIN hoặc System Admin được quản lý kỳ thi.');
    }
    if (access.status !== 'ACTIVE') {
      throw new ConflictException('Tổ chức đã được lưu trữ; không thể thay đổi kỳ thi.');
    }
    if (!viewer) throw new UnauthorizedException('Vui lòng đăng nhập.');
    return {
      ...access,
      actor: { userId: viewer.id, isSystemAdmin: viewer.role === 'ADMIN' },
    };
  }

  private assertContestVisible(
    contest: ContestDetail,
    access: Awaited<ReturnType<OrganizationsService['getContestAccess']>>,
  ) {
    if (!access.canManage && (
      contest.publicationStatus !== 'PUBLISHED'
      || (contest.visibility === 'PRIVATE' && !access.viewerRole)
    )) {
      throw new NotFoundException('Không tìm thấy kỳ thi.');
    }
  }
}
