import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';
import { escapeLikePattern } from '../submissions/global-submissions.js';
import {
  assertCanAddMember,
  assertCanChangeRole,
  assertCanRemoveMember,
  type AssignableRole,
} from './organization-member-policy.js';
import { slugify } from './organization-slug.js';
import type {
  AdminOrganizationRecord,
  AdminOrganizationRequestPage,
  AdminOrganizationRequestRecord,
  OrganizationMemberRecord,
  OrganizationMemberRole,
  OrganizationRecord,
  OrganizationRequestRecord,
  OrganizationRequestStatistics,
  OrganizationRequestStatus,
  OrganizationStatus,
  OrganizationVisibility,
  Page,
} from './organizations.types.js';

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

export type OrganizationInfoInput = {
  name: string;
  slug?: string;
  description?: string | null;
  websiteUrl?: string | null;
  ownerIdentifier?: string | null;
};

export type OrganizationInfoPatch = Partial<
  Pick<OrganizationInfoInput, 'name' | 'slug' | 'description' | 'websiteUrl'>
>;

export type VisibilityPatch = {
  problemsVisibility?: OrganizationVisibility;
  contestsVisibility?: OrganizationVisibility;
  submissionsVisibility?: OrganizationVisibility;
};

export type OrganizationListQuery = {
  page: number;
  pageSize: number;
  q?: string;
  sort: 'members' | 'newest' | 'name';
  status?: OrganizationStatus;
};

export type MemberListQuery = { page: number; pageSize: number; q?: string; role?: OrganizationMemberRole };

export type AdminRequestListQuery = {
  page: number;
  pageSize: number;
  q?: string;
  status?: OrganizationRequestStatus;
  sort: 'newest' | 'oldest';
};

export type NewOrganizationRequest = {
  fullName: string;
  workplace: string;
  position: string;
  phoneNumber: string;
  motivation: string;
};

export type ApproveRequestInput = {
  name?: string;
  slug?: string;
  description?: string | null;
  websiteUrl?: string | null;
  ownerIdentifier?: string | null;
  reviewNote?: string | null;
};

const SLUG_CONSTRAINT = 'uq_organizations_slug';
const PENDING_CONSTRAINT = 'uq_org_requests_one_pending_per_requester';

const SLUG_TAKEN_MESSAGE = 'Slug đã được sử dụng. Vui lòng chọn slug khác.';
const OWNER_NOT_FOUND_MESSAGE = 'Không tìm thấy tài khoản đang hoạt động với username hoặc email đã nhập.';

const PROFILE_JSON = (alias: string) => `
  CASE WHEN ${alias}.id IS NULL THEN NULL ELSE json_build_object(
    'id', ${alias}.id,
    'username', ${alias}.username,
    'fullName', ${alias}.full_name,
    'avatarUrl', ${alias}.avatar_url
  ) END`;

const ORGANIZATION_COLUMNS = `
  o.id,
  o.slug,
  o.name,
  o.description,
  o.website_url AS "websiteUrl",
  o.status,
  o.problems_visibility AS "problemsVisibility",
  o.contests_visibility AS "contestsVisibility",
  o.submissions_visibility AS "submissionsVisibility",
  o.archived_at AS "archivedAt",
  o.created_at AS "createdAt",
  o.updated_at AS "updatedAt",
  (SELECT COUNT(*)::int
     FROM public.organization_members m
     JOIN public.users mu ON mu.id = m.user_id AND mu.is_active = TRUE
    WHERE m.organization_id = o.id) AS "memberCount",
  ${PROFILE_JSON('ou')} AS owner`;

const ORGANIZATION_FROM = `
  FROM public.organizations o
  LEFT JOIN public.users ou ON ou.id = o.owner_id`;

const ADMIN_ORGANIZATION_COLUMNS = `${ORGANIZATION_COLUMNS},
  ${PROFILE_JSON('au')} AS "archivedBy"`;

const ADMIN_ORGANIZATION_FROM = `${ORGANIZATION_FROM}
  LEFT JOIN public.users au ON au.id = o.archived_by`;

const REQUEST_COLUMNS = `
  r.id,
  r.full_name AS "fullName",
  r.workplace,
  r.position,
  r.phone_number AS "phoneNumber",
  r.motivation,
  r.status,
  r.review_note AS "reviewNote",
  r.reviewed_at AS "reviewedAt",
  r.created_at AS "createdAt",
  r.updated_at AS "updatedAt",
  CASE WHEN co.id IS NULL THEN NULL ELSE json_build_object(
    'id', co.id, 'slug', co.slug, 'name', co.name
  ) END AS "createdOrganization"`;

const REQUEST_FROM = `
  FROM public.organization_creation_requests r
  LEFT JOIN public.organizations co ON co.id = r.created_organization_id`;

const ORGANIZATION_ORDER: Record<OrganizationListQuery['sort'], string> = {
  members: `"memberCount" DESC, o.name ASC, o.id ASC`,
  newest: `o.created_at DESC, o.id DESC`,
  name: `o.name ASC, o.id ASC`,
};

@Injectable()
export class OrganizationsRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  // ---------- Yêu cầu tạo tổ chức ----------

  async countRecentRequests(requesterId: string, hours: number): Promise<number> {
    const result = await this.pool.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
         FROM public.organization_creation_requests
        WHERE requester_id = $1
          AND created_at > CURRENT_TIMESTAMP - make_interval(hours => $2)`,
      [requesterId, hours],
    );
    return result.rows[0]?.count ?? 0;
  }

  async createRequest(requesterId: string, input: NewOrganizationRequest): Promise<OrganizationRequestRecord> {
    try {
      const result = await this.pool.query<{ id: string }>(
        `INSERT INTO public.organization_creation_requests
           (requester_id, full_name, workplace, position, phone_number, motivation)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [requesterId, input.fullName, input.workplace, input.position, input.phoneNumber, input.motivation],
      );
      const created = await this.findOwnRequest(requesterId, result.rows[0]!.id);
      return created!;
    } catch (error) {
      if (isConstraintViolation(error, PENDING_CONSTRAINT)) {
        throw new ConflictException('Bạn đã có một yêu cầu đang chờ xử lý.');
      }
      throw error;
    }
  }

  private async findOwnRequest(requesterId: string, id: string): Promise<OrganizationRequestRecord | null> {
    const result = await this.pool.query<OrganizationRequestRecord>(
      `SELECT ${REQUEST_COLUMNS} ${REQUEST_FROM} WHERE r.id = $1 AND r.requester_id = $2`,
      [id, requesterId],
    );
    return result.rows[0] ?? null;
  }

  async listOwnRequests(requesterId: string, page: number, pageSize: number): Promise<Page<OrganizationRequestRecord>> {
    const [items, total] = await Promise.all([
      this.pool.query<OrganizationRequestRecord>(
        `SELECT ${REQUEST_COLUMNS} ${REQUEST_FROM}
          WHERE r.requester_id = $1
          ORDER BY r.created_at DESC, r.id DESC
          LIMIT $2 OFFSET $3`,
        [requesterId, pageSize, (page - 1) * pageSize],
      ),
      this.pool.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM public.organization_creation_requests WHERE requester_id = $1`,
        [requesterId],
      ),
    ]);
    return { items: items.rows, total: total.rows[0]?.total ?? 0, page, pageSize };
  }

  async listAdminRequests(query: AdminRequestListQuery): Promise<AdminOrganizationRequestPage> {
    const keyword = query.q?.trim() ? `%${escapeLikePattern(query.q.trim())}%` : null;
    const filters = `
      WHERE ($1::varchar IS NULL OR r.status = $1)
        AND ($2::text IS NULL OR r.full_name ILIKE $2 OR r.workplace ILIKE $2 OR r.position ILIKE $2
             OR rq.username ILIKE $2 OR rq.email ILIKE $2)`;
    const direction = query.sort === 'oldest' ? 'ASC' : 'DESC';
    const [items, total, stats] = await Promise.all([
      this.pool.query<AdminOrganizationRequestRecord>(
        `SELECT ${ADMIN_REQUEST_COLUMNS} ${ADMIN_REQUEST_FROM} ${filters}
          ORDER BY r.created_at ${direction}, r.id ${direction}
          LIMIT $3 OFFSET $4`,
        [query.status ?? null, keyword, query.pageSize, (query.page - 1) * query.pageSize],
      ),
      this.pool.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total ${ADMIN_REQUEST_FROM} ${filters}`,
        [query.status ?? null, keyword],
      ),
      this.pool.query<{ status: OrganizationRequestStatus; count: number }>(
        `SELECT status, COUNT(*)::int AS count
           FROM public.organization_creation_requests GROUP BY status`,
      ),
    ]);
    return {
      items: items.rows,
      total: total.rows[0]?.total ?? 0,
      page: query.page,
      pageSize: query.pageSize,
      statistics: buildRequestStatistics(stats.rows),
    };
  }

  async findAdminRequest(id: string, db: Queryable = this.pool): Promise<AdminOrganizationRequestRecord | null> {
    const result = await db.query<AdminOrganizationRequestRecord>(
      `SELECT ${ADMIN_REQUEST_COLUMNS} ${ADMIN_REQUEST_FROM} WHERE r.id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async rejectRequest(id: string, reviewerId: string, reviewNote: string | null): Promise<AdminOrganizationRequestRecord> {
    // Một câu lệnh UPDATE có điều kiện PENDING: hai Admin thao tác đồng thời thì chỉ một bên thành công.
    const result = await this.pool.query(
      `UPDATE public.organization_creation_requests
          SET status = 'REJECTED', reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP,
              review_note = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND status = 'PENDING'`,
      [id, reviewerId, reviewNote],
    );
    if (result.rowCount === 0) {
      const existing = await this.findAdminRequest(id);
      if (!existing) throw new NotFoundException('Không tìm thấy yêu cầu tạo tổ chức.');
      throw new ConflictException('Yêu cầu này đã được xử lý.');
    }
    return (await this.findAdminRequest(id))!;
  }

  async approveRequest(
    id: string,
    reviewerId: string,
    input: ApproveRequestInput,
  ): Promise<AdminOrganizationRequestRecord> {
    return this.transaction(async (client) => {
      const locked = await client.query<{ status: OrganizationRequestStatus; workplace: string }>(
        `SELECT status, workplace FROM public.organization_creation_requests WHERE id = $1 FOR UPDATE`,
        [id],
      );
      const request = locked.rows[0];
      if (!request) throw new NotFoundException('Không tìm thấy yêu cầu tạo tổ chức.');
      if (request.status !== 'PENDING') throw new ConflictException('Yêu cầu này đã được xử lý.');

      const organizationId = await this.insertOrganization(client, {
        name: input.name ?? request.workplace.slice(0, 150),
        slug: input.slug,
        description: input.description,
        websiteUrl: input.websiteUrl,
        ownerIdentifier: input.ownerIdentifier,
      });
      await client.query(
        `UPDATE public.organization_creation_requests
            SET status = 'APPROVED', reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP,
                review_note = $3, created_organization_id = $4, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1`,
        [id, reviewerId, input.reviewNote ?? null, organizationId],
      );
      return (await this.findAdminRequest(id, client))!;
    });
  }

  // ---------- Tổ chức ----------

  async listOrganizations(query: OrganizationListQuery): Promise<Page<OrganizationRecord>> {
    return this.listBy(ORGANIZATION_COLUMNS, ORGANIZATION_FROM, { ...query, status: 'ACTIVE' });
  }

  async listAdminOrganizations(query: OrganizationListQuery): Promise<Page<AdminOrganizationRecord>> {
    return this.listBy(ADMIN_ORGANIZATION_COLUMNS, ADMIN_ORGANIZATION_FROM, query);
  }

  private async listBy<T extends QueryResultRow>(
    columns: string,
    from: string,
    query: OrganizationListQuery,
  ): Promise<Page<T>> {
    const keyword = query.q?.trim() ? `%${escapeLikePattern(query.q.trim())}%` : null;
    const filters = `
      WHERE ($1::varchar IS NULL OR o.status = $1)
        AND ($2::text IS NULL OR o.name ILIKE $2 OR o.slug ILIKE $2)`;
    const [items, total] = await Promise.all([
      this.pool.query<T>(
        `SELECT ${columns} ${from} ${filters}
          ORDER BY ${ORGANIZATION_ORDER[query.sort]}
          LIMIT $3 OFFSET $4`,
        [query.status ?? null, keyword, query.pageSize, (query.page - 1) * query.pageSize],
      ),
      this.pool.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total ${from} ${filters}`,
        [query.status ?? null, keyword],
      ),
    ]);
    return { items: items.rows, total: total.rows[0]?.total ?? 0, page: query.page, pageSize: query.pageSize };
  }

  async findBySlug(slug: string): Promise<AdminOrganizationRecord | null> {
    const result = await this.pool.query<AdminOrganizationRecord>(
      `SELECT ${ADMIN_ORGANIZATION_COLUMNS} ${ADMIN_ORGANIZATION_FROM} WHERE o.slug = $1`,
      [slug],
    );
    return result.rows[0] ?? null;
  }

  async findById(id: string, db: Queryable = this.pool): Promise<AdminOrganizationRecord | null> {
    const result = await db.query<AdminOrganizationRecord>(
      `SELECT ${ADMIN_ORGANIZATION_COLUMNS} ${ADMIN_ORGANIZATION_FROM} WHERE o.id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async findSourceRequestId(organizationId: string): Promise<string | null> {
    const result = await this.pool.query<{ id: string }>(
      `SELECT id FROM public.organization_creation_requests WHERE created_organization_id = $1 LIMIT 1`,
      [organizationId],
    );
    return result.rows[0]?.id ?? null;
  }

  async findMemberRole(organizationId: string, userId: string): Promise<OrganizationMemberRole | null> {
    const result = await this.pool.query<{ role: OrganizationMemberRole }>(
      `SELECT role FROM public.organization_members WHERE organization_id = $1 AND user_id = $2`,
      [organizationId, userId],
    );
    return result.rows[0]?.role ?? null;
  }

  async listMembers(organizationId: string, query: MemberListQuery): Promise<Page<OrganizationMemberRecord>> {
    const keyword = query.q?.trim() ? `%${escapeLikePattern(query.q.trim())}%` : null;
    const from = `
      FROM public.organization_members m
      JOIN public.users u ON u.id = m.user_id AND u.is_active = TRUE
      WHERE m.organization_id = $1
        AND ($2::varchar IS NULL OR m.role = $2)
        AND ($3::text IS NULL OR u.username ILIKE $3 OR u.full_name ILIKE $3)`;
    const values = [organizationId, query.role ?? null, keyword];
    const [items, total] = await Promise.all([
      this.pool.query<OrganizationMemberRecord>(
        `SELECT u.id, u.username, u.full_name AS "fullName", u.avatar_url AS "avatarUrl",
                m.role, m.joined_at AS "joinedAt"
           ${from}
          ORDER BY CASE m.role WHEN 'OWNER' THEN 0 WHEN 'ADMIN' THEN 1 ELSE 2 END,
                   m.joined_at ASC, u.id ASC
          LIMIT $4 OFFSET $5`,
        [...values, query.pageSize, (query.page - 1) * query.pageSize],
      ),
      this.pool.query<{ total: number }>(`SELECT COUNT(*)::int AS total ${from}`, values),
    ]);
    return { items: items.rows, total: total.rows[0]?.total ?? 0, page: query.page, pageSize: query.pageSize };
  }

  async createOrganization(input: OrganizationInfoInput): Promise<AdminOrganizationRecord> {
    return this.transaction(async (client) => {
      const id = await this.insertOrganization(client, input);
      return (await this.findById(id, client))!;
    });
  }

  async updateInfo(id: string, patch: OrganizationInfoPatch): Promise<AdminOrganizationRecord> {
    const columns: Array<[string, unknown]> = [];
    if (patch.name !== undefined) columns.push(['name', patch.name]);
    if (patch.slug !== undefined) columns.push(['slug', patch.slug]);
    if (patch.description !== undefined) columns.push(['description', patch.description]);
    if (patch.websiteUrl !== undefined) columns.push(['website_url', patch.websiteUrl]);
    return this.updateActive(id, columns);
  }

  async updateVisibility(id: string, patch: VisibilityPatch): Promise<AdminOrganizationRecord> {
    const columns: Array<[string, unknown]> = [];
    if (patch.problemsVisibility) columns.push(['problems_visibility', patch.problemsVisibility]);
    if (patch.contestsVisibility) columns.push(['contests_visibility', patch.contestsVisibility]);
    if (patch.submissionsVisibility) columns.push(['submissions_visibility', patch.submissionsVisibility]);
    return this.updateActive(id, columns);
  }

  // Tên cột lấy từ danh sách cố định ở trên; giá trị luôn đi qua tham số.
  private async updateActive(id: string, columns: Array<[string, unknown]>): Promise<AdminOrganizationRecord> {
    return this.transaction(async (client) => {
      await this.lockActiveOrganization(client, id);
      if (columns.length > 0) {
        const assignments = columns.map(([column], index) => `${column} = $${index + 2}`);
        try {
          await client.query(
            `UPDATE public.organizations SET ${assignments.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [id, ...columns.map(([, value]) => value)],
          );
        } catch (error) {
          if (isConstraintViolation(error, SLUG_CONSTRAINT)) throw new ConflictException(SLUG_TAKEN_MESSAGE);
          throw error;
        }
      }
      return (await this.findById(id, client))!;
    });
  }

  async changeOwner(
    id: string,
    ownerIdentifier: string | null,
    previousOwnerRole: Exclude<OrganizationMemberRole, 'OWNER'>,
  ): Promise<AdminOrganizationRecord> {
    return this.transaction(async (client) => {
      const organization = await this.lockActiveOrganization(client, id);
      const newOwnerId = ownerIdentifier ? await this.resolveOwner(client, ownerIdentifier) : null;
      if (newOwnerId === organization.owner_id) return (await this.findById(id, client))!;

      // Hạ OWNER cũ trước để không vi phạm UNIQUE INDEX một OWNER (kiểm tra ngay lập tức).
      if (organization.owner_id) {
        await client.query(
          `UPDATE public.organization_members SET role = $3 WHERE organization_id = $1 AND user_id = $2`,
          [id, organization.owner_id, previousOwnerRole],
        );
      }
      if (newOwnerId) {
        await client.query(
          `INSERT INTO public.organization_members (organization_id, user_id, role)
           VALUES ($1, $2, 'OWNER')
           ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'OWNER'`,
          [id, newOwnerId],
        );
      }
      // Các FK owner là DEFERRABLE: tính nhất quán được kiểm tra khi COMMIT.
      await client.query(
        `UPDATE public.organizations SET owner_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [id, newOwnerId],
      );
      return (await this.findById(id, client))!;
    });
  }

  async archive(id: string, adminId: string): Promise<AdminOrganizationRecord> {
    return this.transaction(async (client) => {
      const organization = await this.lockOrganization(client, id);
      if (organization.status === 'ARCHIVED') throw new ConflictException('Tổ chức đã được lưu trữ.');
      await client.query(
        `UPDATE public.organizations
            SET status = 'ARCHIVED', archived_at = CURRENT_TIMESTAMP, archived_by = $2,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = $1`,
        [id, adminId],
      );
      return (await this.findById(id, client))!;
    });
  }

  async restore(id: string): Promise<AdminOrganizationRecord> {
    return this.transaction(async (client) => {
      const organization = await this.lockOrganization(client, id);
      if (organization.status === 'ACTIVE') throw new ConflictException('Tổ chức đang hoạt động.');
      await client.query(
        `UPDATE public.organizations
            SET status = 'ACTIVE', archived_at = NULL, archived_by = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1`,
        [id],
      );
      return (await this.findById(id, client))!;
    });
  }

  // ---------- Thành viên ----------
  // Mọi thay đổi membership khóa dòng organizations (FOR UPDATE) nên được tuần tự hóa theo tổ chức,
  // cùng với archive/restore và đổi OWNER; quyền của người thao tác được đọc lại trong transaction.

  async joinOrganization(id: string, userId: string): Promise<void> {
    await this.transaction(async (client) => {
      await this.lockMemberableOrganization(client, id);
      const inserted = await client.query(
        `INSERT INTO public.organization_members (organization_id, user_id, role)
         VALUES ($1, $2, 'MEMBER') ON CONFLICT (organization_id, user_id) DO NOTHING`,
        [id, userId],
      );
      if (inserted.rowCount === 0) throw new ConflictException('Bạn đã là thành viên của tổ chức này.');
    });
  }

  async leaveOrganization(id: string, userId: string): Promise<void> {
    await this.transaction(async (client) => {
      await this.lockMemberableOrganization(client, id);
      const role = await this.memberRole(client, id, userId);
      if (!role) throw new NotFoundException('Bạn không phải thành viên của tổ chức này.');
      if (role === 'OWNER') {
        throw new ConflictException('OWNER không thể tự rời tổ chức. Hãy nhờ Quản trị viên hệ thống chuyển hoặc gỡ OWNER trước.');
      }
      await client.query(`DELETE FROM public.organization_members WHERE organization_id = $1 AND user_id = $2`, [id, userId]);
    });
  }

  async addMember(
    id: string,
    actor: { id: string; isSystemAdmin: boolean },
    identifier: string,
    role: AssignableRole,
  ): Promise<OrganizationMemberRecord> {
    return this.transaction(async (client) => {
      await this.lockMemberableOrganization(client, id);
      assertCanAddMember(await this.actorOf(client, id, actor), role);
      const userId = await this.resolveOwner(client, identifier);
      const inserted = await client.query(
        `INSERT INTO public.organization_members (organization_id, user_id, role)
         VALUES ($1, $2, $3) ON CONFLICT (organization_id, user_id) DO NOTHING`,
        [id, userId, role],
      );
      if (inserted.rowCount === 0) throw new ConflictException('Tài khoản này đã là thành viên của tổ chức.');
      return (await this.getMember(client, id, userId))!;
    });
  }

  async changeMemberRole(
    id: string,
    actor: { id: string; isSystemAdmin: boolean },
    userId: string,
    role: AssignableRole,
  ): Promise<OrganizationMemberRecord> {
    return this.transaction(async (client) => {
      await this.lockMemberableOrganization(client, id);
      const targetRole = await this.memberRole(client, id, userId);
      if (!targetRole) throw new NotFoundException('Không tìm thấy thành viên.');
      assertCanChangeRole(await this.actorOf(client, id, actor), targetRole);
      await client.query(
        `UPDATE public.organization_members SET role = $3 WHERE organization_id = $1 AND user_id = $2`,
        [id, userId, role],
      );
      return (await this.getMember(client, id, userId))!;
    });
  }

  async removeMember(id: string, actor: { id: string; isSystemAdmin: boolean }, userId: string): Promise<void> {
    await this.transaction(async (client) => {
      await this.lockMemberableOrganization(client, id);
      if (userId === actor.id) {
        throw new BadRequestException('Hãy dùng chức năng "Rời tổ chức" để tự rời khỏi tổ chức.');
      }
      const targetRole = await this.memberRole(client, id, userId);
      if (!targetRole) throw new NotFoundException('Không tìm thấy thành viên.');
      assertCanRemoveMember(await this.actorOf(client, id, actor), targetRole);
      await client.query(`DELETE FROM public.organization_members WHERE organization_id = $1 AND user_id = $2`, [id, userId]);
    });
  }

  private async lockMemberableOrganization(client: PoolClient, id: string) {
    const organization = await this.lockOrganization(client, id);
    if (organization.status === 'ARCHIVED') {
      throw new ConflictException('Tổ chức đã được lưu trữ nên không thể thay đổi thành viên.');
    }
    return organization;
  }

  private async memberRole(client: PoolClient, orgId: string, userId: string): Promise<OrganizationMemberRole | null> {
    const result = await client.query<{ role: OrganizationMemberRole }>(
      `SELECT role FROM public.organization_members WHERE organization_id = $1 AND user_id = $2`,
      [orgId, userId],
    );
    return result.rows[0]?.role ?? null;
  }

  private async actorOf(client: PoolClient, orgId: string, actor: { id: string; isSystemAdmin: boolean }) {
    return { isSystemAdmin: actor.isSystemAdmin, role: await this.memberRole(client, orgId, actor.id) };
  }

  private async getMember(client: PoolClient, orgId: string, userId: string): Promise<OrganizationMemberRecord | null> {
    const result = await client.query<OrganizationMemberRecord>(
      `SELECT u.id, u.username, u.full_name AS "fullName", u.avatar_url AS "avatarUrl", m.role, m.joined_at AS "joinedAt"
         FROM public.organization_members m JOIN public.users u ON u.id = m.user_id
        WHERE m.organization_id = $1 AND m.user_id = $2`,
      [orgId, userId],
    );
    return result.rows[0] ?? null;
  }

  // ---------- Hàm nội bộ ----------

  private async insertOrganization(client: PoolClient, input: OrganizationInfoInput): Promise<string> {
    const slug = input.slug ?? slugify(input.name);
    if (!slug) {
      throw new BadRequestException('Không thể sinh slug từ tên tổ chức. Vui lòng nhập slug thủ công.');
    }
    const ownerId = input.ownerIdentifier ? await this.resolveOwner(client, input.ownerIdentifier) : null;
    let organizationId: string;
    try {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO public.organizations (slug, name, description, website_url, owner_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [slug, input.name, input.description ?? null, input.websiteUrl ?? null, ownerId],
      );
      organizationId = inserted.rows[0]!.id;
    } catch (error) {
      if (isConstraintViolation(error, SLUG_CONSTRAINT)) throw new ConflictException(SLUG_TAKEN_MESSAGE);
      throw error;
    }
    if (ownerId) {
      await client.query(
        `INSERT INTO public.organization_members (organization_id, user_id, role) VALUES ($1, $2, 'OWNER')`,
        [organizationId, ownerId],
      );
    }
    return organizationId;
  }

  private async resolveOwner(client: PoolClient, identifier: string): Promise<string> {
    const column = identifier.includes('@') ? 'email' : 'username';
    const result = await client.query<{ id: string }>(
      `SELECT id FROM public.users WHERE is_active = TRUE AND lower(${column}) = lower($1)`,
      [identifier],
    );
    const owner = result.rows[0];
    if (!owner) throw new BadRequestException(OWNER_NOT_FOUND_MESSAGE);
    return owner.id;
  }

  private async lockOrganization(
    client: PoolClient,
    id: string,
  ): Promise<{ id: string; status: OrganizationStatus; owner_id: string | null }> {
    const result = await client.query<{ id: string; status: OrganizationStatus; owner_id: string | null }>(
      `SELECT id, status, owner_id FROM public.organizations WHERE id = $1 FOR UPDATE`,
      [id],
    );
    const organization = result.rows[0];
    if (!organization) throw new NotFoundException('Không tìm thấy tổ chức.');
    return organization;
  }

  private async lockActiveOrganization(client: PoolClient, id: string) {
    const organization = await this.lockOrganization(client, id);
    if (organization.status === 'ARCHIVED') {
      throw new ConflictException('Tổ chức đã được lưu trữ. Hãy khôi phục trước khi chỉnh sửa.');
    }
    return organization;
  }

  private async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}

const ADMIN_REQUEST_COLUMNS = `${REQUEST_COLUMNS},
  CASE WHEN rq.id IS NULL THEN NULL ELSE json_build_object(
    'id', rq.id, 'username', rq.username, 'fullName', rq.full_name,
    'avatarUrl', rq.avatar_url, 'email', rq.email
  ) END AS requester,
  ${PROFILE_JSON('rv')} AS reviewer,
  CASE WHEN co.id IS NULL THEN NULL ELSE json_build_object(
    'id', co.id,
    'slug', co.slug,
    'name', co.name,
    'status', co.status,
    'owner', ${PROFILE_JSON('cou')}
  ) END AS "createdOrganizationDetails"`;

const ADMIN_REQUEST_FROM = `${REQUEST_FROM}
  LEFT JOIN public.users rq ON rq.id = r.requester_id
  LEFT JOIN public.users rv ON rv.id = r.reviewed_by
  LEFT JOIN public.users cou ON cou.id = co.owner_id`;

function buildRequestStatistics(
  rows: Array<{ status: OrganizationRequestStatus; count: number }>,
): OrganizationRequestStatistics {
  const statistics: OrganizationRequestStatistics = { total: 0, PENDING: 0, APPROVED: 0, REJECTED: 0 };
  for (const row of rows) {
    statistics[row.status] = row.count;
    statistics.total += row.count;
  }
  return statistics;
}

function isConstraintViolation(error: unknown, constraint: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === '23505' &&
    (error as { constraint?: string }).constraint === constraint
  );
}
