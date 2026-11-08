import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrganizationProblemsService } from './organization-problems.service.js';

describe('OrganizationProblemsService', () => {
  const member = { id: 'member-id', role: 'STUDENT' as const };
  const manager = { id: 'manager-id', role: 'STUDENT' as const };

  function createService(access = {
    organizationId: 'organization-id',
    status: 'ACTIVE',
    canManage: false,
  }) {
    const problems = {
      listProblems: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
      findProblem: vi.fn().mockResolvedValue({ status: 'published', editorials: [] }),
      saveProblem: vi.fn().mockResolvedValue({ id: 'problem-id' }),
      setProblemStatus: vi.fn().mockResolvedValue(undefined),
      deleteProblem: vi.fn().mockResolvedValue(undefined),
      listTestCases: vi.fn().mockResolvedValue({ revision: 1, cases: [] }),
      replaceTestCases: vi.fn().mockResolvedValue({ revision: 2, cases: [] }),
    };
    const organizations = {
      getProblemAccess: vi.fn().mockResolvedValue(access),
    };
    return {
      service: new OrganizationProblemsService(problems as never, organizations as never),
      problems,
      organizations,
    };
  }

  it('limits non-managers to published problems and passes the organization scope', async () => {
    const { service, problems } = createService();
    await service.list('uth-cs', member, {
      page: 1,
      pageSize: 20,
      status: 'draft',
    });

    expect(problems.listProblems).toHaveBeenCalledWith(
      { page: 1, pageSize: 20, status: 'published' },
      'organization-id',
    );
  });

  it('does not expose editorials that are not published to regular members', async () => {
    const { service, problems } = createService();
    await service.get('uth-cs', 'problem-id', member);

    expect(problems.findProblem).toHaveBeenCalledWith('problem-id', 'organization-id', false);
  });

  it('hides unpublished problems from non-managers', async () => {
    const { service, problems } = createService();
    problems.findProblem.mockResolvedValue({ status: 'draft' });

    await expect(service.get('uth-cs', 'problem-id', member)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects manager writes for archived organizations', async () => {
    const { service, problems } = createService({
      organizationId: 'organization-id',
      status: 'ARCHIVED',
      canManage: true,
    });

    await expect(service.create('uth-cs', manager, {} as never)).rejects.toBeInstanceOf(ConflictException);
    expect(problems.saveProblem).not.toHaveBeenCalled();
  });

  it('rejects writes from members without management permission', async () => {
    const { service, problems } = createService();

    await expect(service.create('uth-cs', member, {} as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(problems.saveProblem).not.toHaveBeenCalled();
  });

  it('passes the authenticated actor and resolved organization ID to repository writes', async () => {
    const { service, problems } = createService({
      organizationId: 'organization-id',
      status: 'ACTIVE',
      canManage: true,
    });

    await service.create('uth-cs', manager, {} as never);

    expect(problems.saveProblem).toHaveBeenCalledWith(
      {},
      'manager-id',
      undefined,
      'organization-id',
      { userId: 'manager-id', isSystemAdmin: false },
    );
  });

  it('passes System Admin writes through with the resolved organization scope', async () => {
    const { service, problems } = createService({
      organizationId: 'organization-id',
      status: 'ACTIVE',
      canManage: true,
    });

    await service.create('naviwebsite', { id: 'system-admin-id', role: 'ADMIN' }, {} as never);

    expect(problems.saveProblem).toHaveBeenCalledWith(
      {},
      'system-admin-id',
      undefined,
      'organization-id',
      { userId: 'system-admin-id', isSystemAdmin: true },
    );
  });
});
