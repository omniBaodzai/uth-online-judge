import { BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { OrganizationSubmissionsService } from './organization-submissions.service.js';

describe('OrganizationSubmissionsService', () => {
  const repository = {
    insertStandalone: vi.fn(),
    insertContest: vi.fn(),
    listStandaloneLanguages: vi.fn(),
    listContestLanguages: vi.fn(),
    registerContest: vi.fn(),
    cancelContestRegistration: vi.fn(),
    findVisibleHistory: vi.fn(),
    findOwnHistory: vi.fn(),
    findOwnSubmission: vi.fn(),
    findVisibleSubmission: vi.fn(),
    findOwnSource: vi.fn(),
    findVisibleSource: vi.fn(),
  };
  const submissions = { enqueueCreatedSubmission: vi.fn() };
  const organizations = { getSubmissionAccess: vi.fn() };
  const service = new OrganizationSubmissionsService(
    repository as never,
    submissions as never,
    organizations as never,
  );

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('only filters visible history by another user for managers', async () => {
    organizations.getSubmissionAccess.mockResolvedValue({
      organizationId: 'org-id',
      canViewSubmissions: true,
      canManage: false,
    });
    await expect(service.list('org', { id: 'member-id', role: 'STUDENT' }, {
      page: 1,
      pageSize: 10,
      userId: 'other-id',
    } as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.findVisibleHistory).not.toHaveBeenCalled();
  });

  it('keeps personal history available for former members without accepting another user filter', async () => {
    repository.findOwnHistory.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 });
    await expect(service.mine('archived-org', { id: 'former-member', role: 'STUDENT' }, {
      page: 1,
      pageSize: 10,
    } as never)).resolves.toMatchObject({ items: [], total: 0 });
    expect(repository.findOwnHistory).toHaveBeenCalledWith(
      'archived-org',
      'former-member',
      expect.objectContaining({ page: 1 }),
    );
    await expect(service.mine('archived-org', { id: 'former-member', role: 'STUDENT' }, {
      page: 1,
      pageSize: 10,
      userId: 'another-user',
    } as never)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows a submitter to view their saved result after leaving without returning source in details', async () => {
    repository.findOwnSubmission.mockResolvedValue({
      id: 'submission-id',
      problemTitle: 'Historical metadata',
      sourceCode: 'private source',
    });

    await expect(service.get(
      'archived-org',
      'submission-id',
      { id: 'former-member', role: 'STUDENT' },
    )).resolves.toEqual({
      id: 'submission-id',
      problemTitle: 'Historical metadata',
    });
    expect(organizations.getSubmissionAccess).not.toHaveBeenCalled();
  });

  it('allows the submitter to retrieve their own source without restoring organization membership', async () => {
    repository.findOwnSource.mockResolvedValue('saved source');

    await expect(service.source(
      'archived-org',
      'submission-id',
      { id: 'former-member', role: 'STUDENT' },
    )).resolves.toEqual({ sourceCode: 'saved source' });
    expect(organizations.getSubmissionAccess).not.toHaveBeenCalled();
  });

  it('does not disclose another user’s source to non-managers', async () => {
    repository.findOwnSource.mockResolvedValue(null);
    organizations.getSubmissionAccess.mockResolvedValue({
      organizationId: 'org-id',
      canManage: false,
    });

    await expect(service.source(
      'org',
      'submission-id',
      { id: 'other-user', role: 'STUDENT' },
    )).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findVisibleSource).not.toHaveBeenCalled();
  });

  it('allows current managers and System Admin to access a visible source', async () => {
    repository.findOwnSource.mockResolvedValue(null);
    organizations.getSubmissionAccess.mockResolvedValue({
      organizationId: 'org-id',
      canManage: true,
    });
    repository.findVisibleSource.mockResolvedValue('managed source');

    await expect(service.source(
      'org',
      'submission-id',
      { id: 'admin-id', role: 'ADMIN' },
    )).resolves.toEqual({ sourceCode: 'managed source' });
    expect(repository.findVisibleSource).toHaveBeenCalledWith('org-id', 'submission-id');
  });

  it('requires authentication for personal history and source', async () => {
    await expect(service.mine('org', null, { page: 1, pageSize: 10 } as never))
      .rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.source('org', 'submission-id', null))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects anonymous standalone submissions before reaching the repository', async () => {
    await expect(service.create(
      'public-org',
      null,
      { problemCode: 'UTH001', language: 'cpp', sourceCode: 'code' },
    )).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repository.insertStandalone).not.toHaveBeenCalled();
  });
});
