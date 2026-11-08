import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrganizationContestsService } from './organization-contests.service.js';

describe('OrganizationContestsService', () => {
  const member = { id: 'member-id', role: 'STUDENT' as const };

  function createService(overrides: {
    status?: string;
    canManage?: boolean;
    viewerRole?: 'OWNER' | 'ADMIN' | 'MEMBER' | null;
    isSystemAdmin?: boolean;
    contest?: Record<string, unknown>;
    contentAccessible?: boolean;
    sourceArchived?: boolean;
  } = {}) {
    const access = {
      organizationId: 'organization-id',
      status: overrides.status ?? 'ACTIVE',
      canManage: overrides.canManage ?? false,
      viewerRole: overrides.viewerRole ?? null,
      isSystemAdmin: overrides.isSystemAdmin ?? false,
    };
    const contest = {
      id: 'contest-id',
      publicationStatus: 'PUBLISHED',
      visibility: 'PUBLIC',
      problems: [],
      ...overrides.contest,
    };
    const contests = {
      get: vi.fn().mockResolvedValue(contest),
      getContestProblemContentScope: vi.fn().mockResolvedValue({
        problemOrganizationId: 'source-organization-id',
        contentAccessible: overrides.contentAccessible ?? true,
        sourceArchived: overrides.sourceArchived ?? false,
      }),
    };
    const organizations = {
      getContestAccess: vi.fn().mockResolvedValue(access),
    };
    const problems = {
      findProblem: vi.fn().mockResolvedValue({
        id: 'problem-id',
        statement: 'statement',
        editorials: [{ sourceCode: 'private solution' }],
      }),
    };
    return {
      service: new OrganizationContestsService(contests as never, organizations as never, problems as never),
      contests,
      problems,
    };
  }

  it('only serves contest statements while the cross-scope grant is accessible', async () => {
    const { service, problems, contests } = createService({ contentAccessible: false });

    await expect(service.getProblemContent('org', 'contest-id', 'problem-id', member))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(problems.findProblem).not.toHaveBeenCalled();
    expect(contests.getContestProblemContentScope).toHaveBeenCalledWith(
      'contest-id',
      'problem-id',
      'organization-id',
    );
  });

  it('returns statement and sample data without editorial content when the grant is active', async () => {
    const { service, problems } = createService();

    const response = await service.getProblemContent('org', 'contest-id', 'problem-id', member);

    expect(response).toEqual({ id: 'problem-id', statement: 'statement' });
    expect(problems.findProblem).toHaveBeenCalledWith('problem-id', 'source-organization-id', false);
  });

  it('hides cross-organization content when the source organization is archived', async () => {
    const { service, problems } = createService({ sourceArchived: true });

    await expect(service.getProblemContent('org', 'contest-id', 'problem-id', member))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(problems.findProblem).not.toHaveBeenCalled();
  });

  it('allows System Admin to inspect archived source content as history', async () => {
    const admin = { id: 'admin-id', role: 'ADMIN' as const };
    const { service, problems } = createService({
      canManage: true,
      isSystemAdmin: true,
      sourceArchived: true,
    });

    await expect(service.getProblemContent('org', 'contest-id', 'problem-id', admin)).resolves.toMatchObject({
      id: 'problem-id',
    });
    expect(problems.findProblem).toHaveBeenCalled();
  });

  it('rejects organization writes after archive', async () => {
    const { service, contests } = createService({
      status: 'ARCHIVED',
      canManage: true,
      viewerRole: 'OWNER',
    });

    await expect(service.publish('org', 'contest-id', member)).rejects.toBeInstanceOf(ConflictException);
    expect(contests.get).not.toHaveBeenCalled();
  });
});
