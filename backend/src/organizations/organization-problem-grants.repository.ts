import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool, type PoolClient } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';

export type OrganizationProblemGrantScope = 'ORGANIZATION' | 'GLOBAL_CONTESTS';

export type OrganizationProblemGrant = {
  id: string;
  problemId: string;
  scope: OrganizationProblemGrantScope;
  granteeOrganization: { id: string; slug: string; name: string } | null;
  grantedBy: string;
  grantedAt: string;
  revokedBy: string | null;
  revokedAt: string | null;
};

type GrantRow = {
  id: string;
  problem_id: string;
  scope: OrganizationProblemGrantScope;
  grantee_organization_id: string | null;
  grantee_slug: string | null;
  grantee_name: string | null;
  granted_by: string;
  granted_at: Date | string;
  revoked_by: string | null;
  revoked_at: Date | string | null;
};

type GrantActor = { userId: string; isSystemAdmin: boolean };

@Injectable()
export class OrganizationProblemGrantsRepository {
  constructor(@Inject(DATABASE_POOL) private readonly database: Pool) {}

  async list(problemId: string, ownerOrganizationId: string): Promise<OrganizationProblemGrant[]> {
    const problem = await this.database.query(
      'SELECT 1 FROM public.problems WHERE id = $1 AND organization_id = $2',
      [problemId, ownerOrganizationId],
    );
    if (!problem.rowCount) throw new NotFoundException('Không tìm thấy bài tập của tổ chức.');
    const result = await this.database.query<GrantRow>(
      this.grantSelect() + `
       WHERE g.problem_id = $1
       ORDER BY g.granted_at DESC, g.id DESC`,
      [problemId],
    );
    return result.rows.map(mapGrant);
  }

  async create(
    problemId: string,
    ownerOrganizationId: string,
    scope: OrganizationProblemGrantScope,
    granteeOrganizationId: string | null,
    actor: GrantActor,
  ): Promise<OrganizationProblemGrant> {
    if (scope === 'ORGANIZATION' && !granteeOrganizationId) {
      throw new BadRequestException('Cần chọn tổ chức nhận quyền.');
    }
    if (scope === 'GLOBAL_CONTESTS' && granteeOrganizationId) {
      throw new BadRequestException('Grant GLOBAL_CONTESTS không gắn với một tổ chức nhận cụ thể.');
    }
    if (granteeOrganizationId === ownerOrganizationId) {
      throw new BadRequestException('Không cần cấp grant cho chính tổ chức sở hữu bài tập.');
    }

    return this.withTransaction(async (client) => {
      const organizationIds = [ownerOrganizationId, ...(granteeOrganizationId ? [granteeOrganizationId] : [])]
        .sort();
      const organizations = await client.query<{ id: string; status: string }>(
        `SELECT id, status
         FROM public.organizations
         WHERE id = ANY($1::uuid[])
         ORDER BY id
         FOR SHARE`,
        [organizationIds],
      );
      if (organizations.rowCount !== organizationIds.length) {
        throw new NotFoundException('Không tìm thấy tổ chức sở hữu hoặc nhận quyền.');
      }
      if (organizations.rows.some((organization) => organization.status !== 'ACTIVE')) {
        throw new ConflictException('Chỉ tổ chức ACTIVE mới có thể tham gia cấp grant.');
      }
      await this.assertManager(client, ownerOrganizationId, actor);

      const problem = await client.query<{ status: string }>(
        `SELECT status FROM public.problems
         WHERE id = $1 AND organization_id = $2
         FOR SHARE`,
        [problemId, ownerOrganizationId],
      );
      if (!problem.rows[0]) throw new NotFoundException('Không tìm thấy bài tập của tổ chức.');
      if (problem.rows[0].status !== 'PUBLISHED') {
        throw new ConflictException('Chỉ có thể cấp quyền cho bài tập đã xuất bản.');
      }

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO public.organization_problem_grants
           (problem_id, scope, grantee_organization_id, granted_by)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [problemId, scope, granteeOrganizationId, actor.userId],
      );
      const id = inserted.rows[0]?.id;
      if (!id) throw new Error('Problem grant insert did not return an id');
      const grant = await this.findGrant(client, id);
      if (!grant) throw new Error('Problem grant was not available after insert');
      return mapGrant(grant);
    });
  }

  async revoke(
    problemId: string,
    grantId: string,
    ownerOrganizationId: string,
    actor: GrantActor,
  ): Promise<OrganizationProblemGrant> {
    return this.withTransaction(async (client) => {
      const organization = await client.query<{ status: string }>(
        'SELECT status FROM public.organizations WHERE id = $1 FOR SHARE',
        [ownerOrganizationId],
      );
      if (!organization.rows[0]) throw new NotFoundException('Không tìm thấy tổ chức sở hữu.');
      if (organization.rows[0].status !== 'ACTIVE') {
        throw new ConflictException('Không thể thay đổi grant khi tổ chức đã được lưu trữ.');
      }
      await this.assertManager(client, ownerOrganizationId, actor);

      const grant = await client.query<{ revoked_at: Date | string | null }>(
        `SELECT g.revoked_at
         FROM public.organization_problem_grants g
         JOIN public.problems p ON p.id = g.problem_id
         WHERE g.id = $1 AND g.problem_id = $2 AND p.organization_id = $3
         FOR UPDATE OF g`,
        [grantId, problemId, ownerOrganizationId],
      );
      if (!grant.rows[0]) throw new NotFoundException('Không tìm thấy grant của bài tập.');
      if (grant.rows[0].revoked_at !== null) {
        throw new ConflictException('Grant này đã bị thu hồi.');
      }
      await client.query(
        `UPDATE public.organization_problem_grants
         SET revoked_at = CURRENT_TIMESTAMP, revoked_by = $2
         WHERE id = $1 AND revoked_at IS NULL`,
        [grantId, actor.userId],
      );
      const updated = await this.findGrant(client, grantId);
      if (!updated) throw new Error('Revoked problem grant could not be reloaded');
      return mapGrant(updated);
    });
  }

  private async assertManager(client: PoolClient, organizationId: string, actor: GrantActor) {
    if (actor.isSystemAdmin) return;
    const membership = await client.query(
      `SELECT 1 FROM public.organization_members
       WHERE organization_id = $1 AND user_id = $2 AND role IN ('OWNER', 'ADMIN')`,
      [organizationId, actor.userId],
    );
    if (!membership.rowCount) {
      throw new ForbiddenException('Bạn không còn quyền quản lý grant của tổ chức này.');
    }
  }

  private async findGrant(client: PoolClient, id: string) {
    const result = await client.query<GrantRow>(
      this.grantSelect() + ' WHERE g.id = $1',
      [id],
    );
    return result.rows[0];
  }

  private grantSelect() {
    return `SELECT g.id, g.problem_id, g.scope, g.grantee_organization_id,
                   grantee.slug AS grantee_slug, grantee.name AS grantee_name,
                   g.granted_by, g.granted_at, g.revoked_by, g.revoked_at
            FROM public.organization_problem_grants g
            LEFT JOIN public.organizations grantee ON grantee.id = g.grantee_organization_id`;
  }

  private async withTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

function mapGrant(row: GrantRow): OrganizationProblemGrant {
  return {
    id: row.id,
    problemId: row.problem_id,
    scope: row.scope,
    granteeOrganization: row.grantee_organization_id
      ? {
          id: row.grantee_organization_id,
          slug: row.grantee_slug!,
          name: row.grantee_name!,
        }
      : null,
    grantedBy: row.granted_by,
    grantedAt: toIsoString(row.granted_at),
    revokedBy: row.revoked_by,
    revokedAt: row.revoked_at === null ? null : toIsoString(row.revoked_at),
  };
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
