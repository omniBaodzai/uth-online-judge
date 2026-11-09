import { Injectable } from '@nestjs/common';
import { OrganizationsService } from './organizations.service.js';
import { OrganizationLeaderboardRepository } from './organization-leaderboard.repository.js';
import type { OrganizationLeaderboardQueryDto } from './organization-leaderboard.dto.js';
import type { Viewer } from './organizations.types.js';

@Injectable()
export class OrganizationLeaderboardService {
  constructor(
    private readonly repository: OrganizationLeaderboardRepository,
    private readonly organizations: OrganizationsService,
  ) {}

  async get(slug: string, viewer: Viewer, query: OrganizationLeaderboardQueryDto) {
    const access = await this.organizations.getLeaderboardAccess(slug, viewer);
    return this.repository.findLeaderboard(access.organizationId, query);
  }
}
