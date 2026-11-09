import { describe, expect, it, vi } from 'vitest';
import { OrganizationLeaderboardService } from './organization-leaderboard.service.js';
import type { OrganizationLeaderboardRepository } from './organization-leaderboard.repository.js';
import type { OrganizationsService } from './organizations.service.js';

describe('OrganizationLeaderboardService', () => {
  it('authorizes organization visibility before requesting the paginated ranking', async () => {
    const repository = { findLeaderboard: vi.fn().mockResolvedValue({ items: [], total: 0, page: 2, pageSize: 5 }) };
    const organizations = { getLeaderboardAccess: vi.fn().mockResolvedValue({ organizationId: 'org-id' }) };
    const service = new OrganizationLeaderboardService(
      repository as unknown as OrganizationLeaderboardRepository,
      organizations as unknown as OrganizationsService,
    );
    const query = { page: 2, pageSize: 5 };

    await expect(service.get('my-org', null, query)).resolves.toEqual({
      items: [],
      total: 0,
      page: 2,
      pageSize: 5,
    });
    expect(organizations.getLeaderboardAccess).toHaveBeenCalledWith('my-org', null);
    expect(repository.findLeaderboard).toHaveBeenCalledWith('org-id', query);
  });

  it('does not query ranking data when organization access is denied', async () => {
    const repository = { findLeaderboard: vi.fn() };
    const organizations = { getLeaderboardAccess: vi.fn().mockRejectedValue({ status: 404 }) };
    const service = new OrganizationLeaderboardService(
      repository as unknown as OrganizationLeaderboardRepository,
      organizations as unknown as OrganizationsService,
    );

    await expect(service.get('archived-org', { id: 'student', role: 'STUDENT' }, { page: 1, pageSize: 20 }))
      .rejects.toMatchObject({ status: 404 });
    expect(repository.findLeaderboard).not.toHaveBeenCalled();
  });
});
