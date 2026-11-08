import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { SubmissionsService } from '../submissions/submissions.service.js';
import {
  OrganizationSubmissionsRepository,
  type OrganizationSubmissionActor,
} from './organization-submissions.repository.js';
import type { OrganizationSubmissionQueryDto } from './organization-submissions.dto.js';
import { OrganizationsService } from './organizations.service.js';
import type { Viewer } from './organizations.types.js';

@Injectable()
export class OrganizationSubmissionsService {
  constructor(
    private readonly repository: OrganizationSubmissionsRepository,
    private readonly submissions: SubmissionsService,
    private readonly organizations: OrganizationsService,
  ) {}

  async create(
    slug: string,
    viewer: Viewer,
    input: { problemCode: string; language: string; sourceCode: string },
  ) {
    const actor = toActor(viewer);
    const created = await this.repository.insertStandalone(slug, actor, input);
    return this.submissions.enqueueCreatedSubmission(created);
  }

  listStandaloneLanguages(slug: string, problemId: string, viewer: Viewer) {
    return this.repository.listStandaloneLanguages(
      slug,
      problemId,
      toActor(viewer),
    );
  }

  listContestLanguages(
    slug: string,
    contestId: string,
    problemId: string,
    viewer: Viewer,
  ) {
    return this.repository.listContestLanguages(
      slug,
      contestId,
      problemId,
      toActor(viewer),
    );
  }

  async createForContest(
    slug: string,
    contestId: string,
    viewer: Viewer,
    input: { problemCode: string; language: string; sourceCode: string },
  ) {
    const actor = toActor(viewer);
    const created = await this.repository.insertContest(slug, contestId, actor, input);
    return this.submissions.enqueueCreatedSubmission(created);
  }

  register(slug: string, contestId: string, viewer: Viewer) {
    return this.repository.registerContest(slug, contestId, toActor(viewer));
  }

  cancelRegistration(slug: string, contestId: string, viewer: Viewer) {
    return this.repository.cancelContestRegistration(slug, contestId, toActor(viewer));
  }

  async list(
    slug: string,
    viewer: Viewer,
    query: OrganizationSubmissionQueryDto,
  ) {
    const access = await this.organizations.getSubmissionAccess(slug, viewer);
    if (!access.canViewSubmissions) {
      throw new NotFoundException('Không tìm thấy danh sách bài nộp.');
    }
    if (query.userId && !access.canManage) {
      throw new ForbiddenException('Chỉ người quản lý tổ chức được lọc theo tài khoản.');
    }
    return this.repository.findVisibleHistory(
      access.organizationId,
      viewer?.id ?? null,
      query,
      access.canManage,
    );
  }

  async mine(slug: string, viewer: Viewer, query: OrganizationSubmissionQueryDto) {
    const actor = toActor(viewer);
    if (query.userId || query.username) {
      throw new BadRequestException('Không hỗ trợ lọc bài nộp cá nhân theo tài khoản khác.');
    }
    return this.repository.findOwnHistory(slug, actor.userId, query);
  }

  async get(
    slug: string,
    submissionId: string,
    viewer: Viewer,
  ) {
    if (viewer) {
      const owned = await this.repository.findOwnSubmission(slug, submissionId, viewer.id);
      if (owned) return stripSourceCode(owned);
    }

    const access = await this.organizations.getSubmissionAccess(slug, viewer);
    if (!access.canViewSubmissions) {
      throw new NotFoundException('Không tìm thấy bài nộp.');
    }
    const submission = await this.repository.findVisibleSubmission(
      access.organizationId,
      submissionId,
    );
    if (!submission) throw new NotFoundException('Không tìm thấy bài nộp.');
    return stripSourceCode(submission);
  }

  async source(
    slug: string,
    submissionId: string,
    viewer: Viewer,
  ): Promise<{ sourceCode: string }> {
    const actor = toActor(viewer);
    const owned = await this.repository.findOwnSource(slug, submissionId, actor.userId);
    if (owned !== null) return { sourceCode: owned };

    const access = await this.organizations.getSubmissionAccess(slug, viewer);
    if (!access.canManage) {
      throw new NotFoundException('Không tìm thấy mã nguồn bài nộp.');
    }
    const sourceCode = await this.repository.findVisibleSource(
      access.organizationId,
      submissionId,
    );
    if (sourceCode === null) {
      throw new NotFoundException('Không tìm thấy mã nguồn bài nộp.');
    }
    return { sourceCode };
  }
}

function toActor(viewer: Viewer): OrganizationSubmissionActor {
  if (!viewer) throw new UnauthorizedException('Vui lòng đăng nhập.');
  return { userId: viewer.id, isSystemAdmin: viewer.role === 'ADMIN' };
}

function stripSourceCode<T extends { sourceCode: string }>(submission: T) {
  const { sourceCode: _sourceCode, ...safe } = submission;
  return safe;
}
