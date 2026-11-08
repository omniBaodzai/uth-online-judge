import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool, type PoolClient } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';
import type {
  Contest,
  ContestDetail,
  ContestOverview,
  ContestPage,
  ContestProblem,
  ContestProblemOption,
  ContestPublicationStatus,
  ContestTimeStatus,
  ContestVisibility,
  CreateContestInput,
  ContestListQuery,
  ReplaceContestProblemInput,
  UpdateContestInput,
} from './contests.types.js';

type ContestRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  rules: string | null;
  starts_at: Date | string;
  ends_at: Date | string;
  publication_status: ContestPublicationStatus;
  visibility: ContestVisibility;
  allow_registration: boolean;
  show_leaderboard: boolean;
  created_by: string;
  updated_by: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  published_at: Date | string | null;
};

type ContestProblemRow = {
  problem_id: string;
  problem_code_snapshot: string;
  problem_title_snapshot: string;
  position: number;
  max_score: string | number;
  test_case_revision: number;
};

const CONTEST_SELECT = `
  c.id, c.slug, c.title, c.description, c.rules, c.starts_at, c.ends_at,
  c.publication_status, c.visibility, c.allow_registration, c.show_leaderboard,
  c.created_by, c.updated_by, c.created_at, c.updated_at, c.published_at`;

const UPDATE_FIELDS: Record<keyof UpdateContestInput, string> = {
  slug: 'slug',
  title: 'title',
  description: 'description',
  rules: 'rules',
  startsAt: 'starts_at',
  endsAt: 'ends_at',
  visibility: 'visibility',
  allowRegistration: 'allow_registration',
  showLeaderboard: 'show_leaderboard',
};

@Injectable()
export class ContestsRepository {
  constructor(@Inject(DATABASE_POOL) private readonly database: Pool) {}

  async list(query: ContestListQuery, organizationId: string | null = null): Promise<ContestPage> {
    const { where, values } = buildListWhere(query, organizationId);
    const countResult = await this.database.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM public.contests c ${where}`,
      values,
    );
    const pageValues = [...values, query.pageSize, (query.page - 1) * query.pageSize];
    const rows = await this.database.query<ContestRow & {
      time_status: ContestTimeStatus;
      problem_count: number;
      participant_count: number;
    }>(
      `SELECT ${CONTEST_SELECT},
              CASE
                WHEN c.publication_status <> 'PUBLISHED' THEN 'UNPUBLISHED'
                WHEN c.starts_at > clock_timestamp() THEN 'UPCOMING'
                WHEN c.ends_at > clock_timestamp() THEN 'ONGOING'
                ELSE 'ENDED'
              END AS time_status,
              (SELECT COUNT(*)::int
               FROM public.contest_problems cp
               WHERE cp.contest_id = c.id) AS problem_count,
              (SELECT COUNT(*)::int
               FROM public.contest_participants participant
               WHERE participant.contest_id = c.id
                 AND participant.registration_status = 'REGISTERED') AS participant_count
       FROM public.contests c
       ${where}
       ORDER BY c.created_at DESC, c.id ASC
       LIMIT $${pageValues.length - 1} OFFSET $${pageValues.length}`,
      pageValues,
    );

    return {
      items: rows.rows.map((row) => ({
        ...mapContest(row),
        timeStatus: row.time_status,
        problemCount: Number(row.problem_count),
        participantCount: Number(row.participant_count),
      })),
      total: Number(countResult.rows[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async overview(): Promise<ContestOverview> {
    const result = await this.database.query<{
      total: string;
      draft: string;
      published: string;
      archived: string;
      upcoming: string;
      ongoing: string;
      ended: string;
    }>(
      `SELECT COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE publication_status = 'DRAFT')::text AS draft,
              COUNT(*) FILTER (WHERE publication_status = 'PUBLISHED')::text AS published,
              COUNT(*) FILTER (WHERE publication_status = 'ARCHIVED')::text AS archived,
              COUNT(*) FILTER (
                WHERE publication_status = 'PUBLISHED'
                  AND starts_at > clock_timestamp()
              )::text AS upcoming,
              COUNT(*) FILTER (
                WHERE publication_status = 'PUBLISHED'
                  AND starts_at <= clock_timestamp()
                  AND ends_at > clock_timestamp()
              )::text AS ongoing,
              COUNT(*) FILTER (
                WHERE publication_status = 'PUBLISHED'
                  AND ends_at <= clock_timestamp()
              )::text AS ended
       FROM public.contests
       WHERE organization_id IS NULL`,
    );
    const row = result.rows[0];
    return {
      total: Number(row?.total ?? 0),
      draft: Number(row?.draft ?? 0),
      published: Number(row?.published ?? 0),
      archived: Number(row?.archived ?? 0),
      upcoming: Number(row?.upcoming ?? 0),
      ongoing: Number(row?.ongoing ?? 0),
      ended: Number(row?.ended ?? 0),
    };
  }

  async findById(id: string, organizationId: string | null = null): Promise<ContestDetail> {
    return this.loadDetail(this.database, id, organizationId);
  }

  async listProblemOptions(organizationId: string, search?: string): Promise<ContestProblemOption[]> {
    const values: unknown[] = [organizationId];
    let searchCondition = '';
    if (search?.trim()) {
      values.push(`%${escapeLike(search.trim())}%`);
      searchCondition = `AND (p.problem_code ILIKE $2 ESCAPE '\\' OR p.title ILIKE $2 ESCAPE '\\')`;
    }
    const result = await this.database.query<{
      id: string;
      problem_code: string;
      title: string;
      organization_name: string | null;
    }>(
      `SELECT p.id, p.problem_code, p.title, source_org.name AS organization_name
       FROM public.problems p
       LEFT JOIN public.organizations source_org ON source_org.id = p.organization_id
       WHERE p.status = 'PUBLISHED'
         AND (
           p.organization_id IS NULL
           OR p.organization_id = $1::uuid
           OR (
             source_org.status = 'ACTIVE'
             AND EXISTS (
               SELECT 1 FROM public.organization_problem_grants g
               WHERE g.problem_id = p.id AND g.revoked_at IS NULL
                 AND g.scope = 'ORGANIZATION' AND g.grantee_organization_id = $1::uuid
             )
           )
         )
         ${searchCondition}
       ORDER BY p.problem_code ASC
       LIMIT 100`,
      values,
    );
    return result.rows.map((row) => ({
      id: row.id,
      code: row.problem_code,
      title: row.title,
      organizationName: row.organization_name,
    }));
  }

  async findContestProblemContentScope(
    contestId: string,
    problemId: string,
    organizationId: string,
  ): Promise<{ problemOrganizationId: string | null; contentAccessible: boolean; sourceArchived: boolean }> {
    const result = await this.database.query<{
      problem_organization_id: string | null;
      content_accessible: boolean;
      source_archived: boolean;
    }>(
      `SELECT p.organization_id AS problem_organization_id,
              public.contest_problem_content_accessible(c.id, p.id) AS content_accessible,
              COALESCE(source_org.status = 'ARCHIVED', FALSE) AS source_archived
       FROM public.contests c
       JOIN public.contest_problems cp ON cp.contest_id = c.id
       JOIN public.problems p ON p.id = cp.problem_id
       LEFT JOIN public.organizations source_org ON source_org.id = p.organization_id
       WHERE c.id = $1 AND c.organization_id IS NOT DISTINCT FROM $3::uuid
         AND p.id = $2 AND p.status = 'PUBLISHED'`,
      [contestId, problemId, organizationId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Không tìm thấy bài tập đã xuất bản trong kỳ thi.');
    return {
      problemOrganizationId: row.problem_organization_id,
      contentAccessible: row.content_accessible,
      sourceArchived: row.source_archived,
    };
  }

  async create(
    input: CreateContestInput,
    adminId: string,
    organizationId: string | null = null,
    actor?: { userId: string; isSystemAdmin: boolean },
  ): Promise<ContestDetail> {
    return this.withTransaction(async (client) => {
      if (organizationId) await this.lockActiveOrganizations(client, organizationId, actor);
      const result = await client.query<{ id: string }>(
        `INSERT INTO public.contests
           (slug, title, description, rules, starts_at, ends_at, visibility,
            allow_registration, show_leaderboard, created_by, updated_by, organization_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $11::uuid)
         RETURNING id`,
        [
          input.slug,
          input.title,
          input.description ?? null,
          input.rules ?? null,
          input.startsAt,
          input.endsAt,
          input.visibility ?? 'PUBLIC',
          input.allowRegistration ?? true,
          input.showLeaderboard ?? true,
          adminId,
          organizationId,
        ],
      );
      return this.loadDetail(client, result.rows[0]!.id, organizationId);
    });
  }

  async update(
    id: string,
    input: UpdateContestInput,
    adminId: string,
    organizationId: string | null = null,
    actor?: { userId: string; isSystemAdmin: boolean },
  ): Promise<ContestDetail> {
    return this.withTransaction(async (client) => {
      if (organizationId) await this.lockActiveOrganizations(client, organizationId, actor);
      const current = await this.lockContest(client, id, organizationId);
      if (current.publication_status === 'ARCHIVED') {
        throw new ConflictException('Khôi phục cuộc thi trước khi chỉnh sửa.');
      }

      const nextStartsAt = input.startsAt ?? current.starts_at;
      const nextEndsAt = input.endsAt ?? current.ends_at;
      if (new Date(nextStartsAt).getTime() >= new Date(nextEndsAt).getTime()) {
        throw new BadRequestException('Thời gian bắt đầu phải trước thời gian kết thúc.');
      }
      if (!organizationId && input.visibility === 'PRIVATE' && current.publication_status === 'PUBLISHED') {
        throw new BadRequestException('Không thể chuyển cuộc thi đã xuất bản sang PRIVATE trong V1.');
      }
      if (
        current.published_at !== null
        && input.slug !== undefined
        && input.slug !== current.slug
      ) {
        throw new ConflictException('Không thể đổi slug sau khi cuộc thi đã xuất bản.');
      }

      const values: unknown[] = [id];
      const assignments: string[] = [];
      for (const [key, column] of Object.entries(UPDATE_FIELDS) as Array<[keyof UpdateContestInput, string]>) {
        const value = input[key];
        if (value === undefined) continue;
        values.push(key === 'startsAt' || key === 'endsAt' ? value : value);
        assignments.push(`${column} = $${values.length}`);
      }
      if (assignments.length === 0) {
        throw new BadRequestException('Cần cung cấp ít nhất một trường để cập nhật.');
      }
      values.push(adminId);
      assignments.push(`updated_by = $${values.length}`, 'updated_at = CURRENT_TIMESTAMP');
      values.push(organizationId);

      await client.query(
        `UPDATE public.contests
         SET ${assignments.join(', ')}
         WHERE id = $1 AND organization_id IS NOT DISTINCT FROM $${values.length}::uuid`,
        values,
      );
      return this.loadDetail(client, id, organizationId);
    });
  }

  async replaceProblems(
    contestId: string,
    problems: ReplaceContestProblemInput[],
    organizationId: string | null = null,
    actor?: { userId: string; isSystemAdmin: boolean },
  ): Promise<ContestProblem[]> {
    return this.withTransaction(async (client) => {
      const sourceOrganizations = problems.length
        ? await client.query<{ organization_id: string | null }>(
            `SELECT DISTINCT organization_id
             FROM public.problems
             WHERE id = ANY($1::uuid[])`,
            [problems.map((problem) => problem.problemId)],
          )
        : { rows: [] as Array<{ organization_id: string | null }> };
      await this.lockActiveOrganizations(
        client,
        organizationId,
        actor,
        sourceOrganizations.rows.flatMap((row) => row.organization_id ? [row.organization_id] : []),
      );
      const contest = await this.lockContest(client, contestId, organizationId);
      if (contest.publication_status === 'ARCHIVED') {
        throw new ConflictException('Không thể thay đổi bài tập của cuộc thi đã lưu trữ.');
      }
      const startState = await client.query<{ started: boolean }>(
        `SELECT starts_at <= clock_timestamp() AS started
         FROM public.contests
        WHERE id = $1 AND organization_id IS NOT DISTINCT FROM $2::uuid`,
        [contestId, organizationId],
      );
      if (startState.rows[0]?.started) {
        throw new ConflictException('Không thể thay đổi bài tập sau khi cuộc thi bắt đầu.');
      }

      if (problems.length > 0) {
        const ids = problems.map((problem) => problem.problemId);
        await client.query(
          `SELECT id
           FROM public.problems
           WHERE id = ANY($1::uuid[])
           ORDER BY id
           FOR SHARE`,
          [ids],
        );
        await client.query(
          `SELECT g.id
           FROM public.organization_problem_grants g
           JOIN public.problems p ON p.id = g.problem_id
           WHERE g.problem_id = ANY($1::uuid[])
             AND g.revoked_at IS NULL
             AND p.organization_id IS NOT NULL
             AND p.organization_id IS DISTINCT FROM $2::uuid
             AND (
               ($2::uuid IS NULL AND g.scope = 'GLOBAL_CONTESTS')
               OR ($2::uuid IS NOT NULL AND g.scope = 'ORGANIZATION'
                   AND g.grantee_organization_id = $2::uuid)
             )
           ORDER BY g.id
           FOR SHARE OF g`,
          [ids, organizationId],
        );
        const available = await client.query<{
          id: string;
          problem_code: string;
          title: string;
          test_case_revision: number;
          active_test_cases: number;
        }>(
          `SELECT p.id, p.problem_code, p.title, p.test_case_revision,
                  COUNT(tc.id)::int AS active_test_cases
           FROM public.problems p
           LEFT JOIN public.problem_test_cases tc
             ON tc.problem_id = p.id AND tc.is_active = TRUE
           WHERE p.id = ANY($1::uuid[]) AND p.status = 'PUBLISHED'
             AND (
               p.organization_id IS NULL
               OR p.organization_id IS NOT DISTINCT FROM $2::uuid
               OR EXISTS (
                 SELECT 1 FROM public.organization_problem_grants grant_row
                 WHERE grant_row.problem_id = p.id
                   AND grant_row.revoked_at IS NULL
                   AND (
                     ( $2::uuid IS NULL AND grant_row.scope = 'GLOBAL_CONTESTS' )
                     OR ( $2::uuid IS NOT NULL AND grant_row.scope = 'ORGANIZATION'
                          AND grant_row.grantee_organization_id = $2::uuid )
                   )
               )
             )
           GROUP BY p.id`,
          [ids, organizationId],
        );
        if (available.rows.length !== problems.length) {
          throw new BadRequestException('Một hoặc nhiều bài không tồn tại hoặc chưa được xuất bản.');
        }
        if (available.rows.some((problem) => problem.active_test_cases === 0)) {
          throw new BadRequestException('Mỗi bài trong cuộc thi phải có ít nhất một test case đang hoạt động.');
        }

        const byId = new Map(available.rows.map((problem) => [problem.id, problem]));
        await client.query(
          'DELETE FROM public.contest_problems WHERE contest_id = $1',
          [contestId],
        );
        for (const [index, item] of problems.entries()) {
          const problem = byId.get(item.problemId);
          if (!problem) {
            throw new BadRequestException('Bài tập không hợp lệ.');
          }
          await client.query(
            `INSERT INTO public.contest_problems
               (contest_id, problem_id, position, max_score,
                problem_code_snapshot, problem_title_snapshot, test_case_revision)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              contestId,
              item.problemId,
              index + 1,
              item.maxScore,
              problem.problem_code,
              problem.title,
              problem.test_case_revision,
            ],
          );
        }
      } else {
        await client.query(
          'DELETE FROM public.contest_problems WHERE contest_id = $1',
          [contestId],
        );
      }
      return this.loadProblems(client, contestId);
    });
  }

  async publish(
    id: string,
    organizationId: string | null = null,
    actor?: { userId: string; isSystemAdmin: boolean },
  ): Promise<ContestDetail> {
    return this.withTransaction(async (client) => {
      if (organizationId) await this.lockActiveOrganizations(client, organizationId, actor);
      const contest = await this.lockContest(client, id, organizationId);
      if (contest.publication_status !== 'DRAFT') {
        throw new ConflictException('Chỉ cuộc thi bản nháp mới có thể xuất bản.');
      }
      if (!organizationId && contest.visibility !== 'PUBLIC') {
        throw new BadRequestException('V1 chưa hỗ trợ xuất bản cuộc thi PRIVATE.');
      }

      await client.query(
        `SELECT p.id
         FROM public.contest_problems cp
         JOIN public.problems p ON p.id = cp.problem_id
         WHERE cp.contest_id = $1
         ORDER BY p.id
         FOR SHARE OF p`,
        [id],
      );
      const validation = await client.query<{
        starts_in_future: boolean;
        ends_in_future: boolean;
        problem_count: number;
        invalid_problem_count: number;
      }>(
        `SELECT c.starts_at > clock_timestamp() AS starts_in_future,
                c.ends_at > clock_timestamp() AS ends_in_future,
                COUNT(cp.problem_id)::int AS problem_count,
                COUNT(cp.problem_id) FILTER (
                  WHERE p.id IS NULL
                     OR p.status <> 'PUBLISHED'
                     OR NOT public.contest_problem_content_accessible(c.id, p.id)
                     OR p.test_case_revision <> cp.test_case_revision
                     OR COALESCE(test_cases.active_count, 0) = 0
                )::int AS invalid_problem_count
         FROM public.contests c
         LEFT JOIN public.contest_problems cp ON cp.contest_id = c.id
         LEFT JOIN public.problems p ON p.id = cp.problem_id
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::int AS active_count
           FROM public.problem_test_cases tc
           WHERE tc.problem_id = cp.problem_id AND tc.is_active = TRUE
         ) test_cases ON TRUE
         WHERE c.id = $1 AND c.organization_id IS NOT DISTINCT FROM $2::uuid
         GROUP BY c.id`,
        [id, organizationId],
      );
      const row = validation.rows[0];
      if (!row?.starts_in_future || !row.ends_in_future) {
        throw new BadRequestException('Chỉ có thể xuất bản cuộc thi có thời gian kết thúc trong tương lai và chưa bắt đầu.');
      }
      if (row.problem_count === 0) {
        throw new BadRequestException('Thêm ít nhất một bài tập trước khi xuất bản cuộc thi.');
      }
      if (row.invalid_problem_count > 0) {
        throw new ConflictException('Danh sách bài tập hoặc test case đã thay đổi; hãy đồng bộ lại trước khi xuất bản.');
      }

      await client.query(
        `UPDATE public.contests
         SET publication_status = 'PUBLISHED',
             published_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND organization_id IS NOT DISTINCT FROM $2::uuid`,
        [id, organizationId],
      );
      return this.loadDetail(client, id, organizationId);
    });
  }

  async archive(
    id: string,
    organizationId: string | null = null,
    actor?: { userId: string; isSystemAdmin: boolean },
  ): Promise<ContestDetail> {
    return this.withTransaction(async (client) => {
      if (organizationId) await this.lockActiveOrganizations(client, organizationId, actor);
      const contest = await this.lockContest(client, id, organizationId);
      if (contest.publication_status !== 'PUBLISHED') {
        throw new ConflictException('Chỉ cuộc thi đã xuất bản mới có thể lưu trữ.');
      }
      await client.query(
        `UPDATE public.contests
         SET publication_status = 'ARCHIVED', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND organization_id IS NOT DISTINCT FROM $2::uuid`,
        [id, organizationId],
      );
      return this.loadDetail(client, id, organizationId);
    });
  }

  async restore(
    id: string,
    organizationId: string | null = null,
    actor?: { userId: string; isSystemAdmin: boolean },
  ): Promise<ContestDetail> {
    return this.withTransaction(async (client) => {
      if (organizationId) await this.lockActiveOrganizations(client, organizationId, actor);
      const contest = await this.lockContest(client, id, organizationId);
      if (contest.publication_status !== 'ARCHIVED') {
        throw new ConflictException('Chỉ cuộc thi đã lưu trữ mới có thể khôi phục.');
      }
      if (!organizationId && contest.visibility !== 'PUBLIC') {
        throw new ConflictException('Không thể khôi phục cuộc thi PRIVATE thành đã xuất bản trong V1.');
      }
      await client.query(
        `UPDATE public.contests
         SET publication_status = 'PUBLISHED', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND organization_id IS NOT DISTINCT FROM $2::uuid`,
        [id, organizationId],
      );
      return this.loadDetail(client, id, organizationId);
    });
  }

  private async lockContest(
    client: PoolClient,
    id: string,
    organizationId: string | null = null,
  ): Promise<ContestRow> {
    const result = await client.query<ContestRow>(
      `SELECT ${CONTEST_SELECT}
       FROM public.contests c
       WHERE c.id = $1 AND c.organization_id IS NOT DISTINCT FROM $2::uuid
       FOR UPDATE`,
      [id, organizationId],
    );
    const contest = result.rows[0];
    if (!contest) throw new NotFoundException('Không tìm thấy cuộc thi.');
    return contest;
  }

  private async loadDetail(
    client: Pick<PoolClient, 'query'>,
    id: string,
    organizationId: string | null = null,
  ): Promise<ContestDetail> {
    const result = await client.query<ContestRow & { participant_count: number }>(
      `SELECT ${CONTEST_SELECT},
              (SELECT COUNT(*)::int
               FROM public.contest_participants participant
               WHERE participant.contest_id = c.id
                 AND participant.registration_status = 'REGISTERED') AS participant_count
       FROM public.contests c
       WHERE c.id = $1 AND c.organization_id IS NOT DISTINCT FROM $2::uuid`,
      [id, organizationId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Không tìm thấy cuộc thi.');
    const problems = await this.loadProblems(client, id);
    return {
      ...mapContest(row),
      participantCount: Number(row.participant_count),
      problems,
    };
  }

  private async loadProblems(
    client: Pick<PoolClient, 'query'>,
    contestId: string,
  ): Promise<ContestProblem[]> {
    const result = await client.query<ContestProblemRow>(
      `SELECT problem_id, problem_code_snapshot, problem_title_snapshot,
              position, max_score, test_case_revision
       FROM public.contest_problems
       WHERE contest_id = $1
       ORDER BY position ASC`,
      [contestId],
    );
    return result.rows.map(mapContestProblem);
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

  private async lockActiveOrganizations(
    client: PoolClient,
    organizationId: string | null,
    actor?: { userId: string; isSystemAdmin: boolean },
    relatedOrganizationIds: string[] = [],
  ): Promise<void> {
    const ids = [...new Set([
      ...(organizationId ? [organizationId] : []),
      ...relatedOrganizationIds,
    ])].sort();
    if (ids.length === 0) return;
    const organizations = await client.query<{ id: string; status: string }>(
      `SELECT id, status
       FROM public.organizations
       WHERE id = ANY($1::uuid[])
       ORDER BY id
       FOR SHARE`,
      [ids],
    );
    if (organizations.rowCount !== ids.length) {
      throw new NotFoundException('Không tìm thấy tổ chức trong phạm vi bài tập.');
    }
    if (organizations.rows.some((organization) => organization.status !== 'ACTIVE')) {
      throw new ConflictException('Tổ chức đã được lưu trữ; không thể thay đổi kỳ thi hoặc thêm bài tập.');
    }
    if (!organizationId) return;
    if (!actor) throw new ForbiddenException('Thiếu danh tính người thao tác.');
    if (!actor.isSystemAdmin) {
      const membership = await client.query(
        `SELECT 1 FROM public.organization_members
         WHERE organization_id = $1 AND user_id = $2 AND role IN ('OWNER', 'ADMIN')`,
        [organizationId, actor.userId],
      );
      if (!membership.rowCount) {
        throw new ForbiddenException('Bạn không còn quyền quản lý kỳ thi của tổ chức này.');
      }
    }
  }
}

function buildListWhere(
  query: ContestListQuery,
  organizationId: string | null = null,
): { where: string; values: unknown[] } {
  const conditions: string[] = ['c.organization_id IS NOT DISTINCT FROM $1::uuid'];
  const values: unknown[] = [organizationId];
  if (query.search?.trim()) {
    values.push(`%${escapeLike(query.search.trim())}%`);
    conditions.push(`(c.title ILIKE $${values.length} ESCAPE '\\' OR c.slug ILIKE $${values.length} ESCAPE '\\')`);
  }
  if (query.publicationStatus) {
    values.push(query.publicationStatus);
    conditions.push(`c.publication_status = $${values.length}`);
  }
  if (query.visibility) {
    values.push(query.visibility);
    conditions.push(`c.visibility = $${values.length}`);
  }
  if (query.timeStatus) {
    const now = 'clock_timestamp()';
    const statusCondition: Record<NonNullable<ContestListQuery['timeStatus']>, string> = {
      UPCOMING: `c.publication_status = 'PUBLISHED' AND c.starts_at > ${now}`,
      ONGOING: `c.publication_status = 'PUBLISHED' AND c.starts_at <= ${now} AND c.ends_at > ${now}`,
      ENDED: `c.publication_status = 'PUBLISHED' AND c.ends_at <= ${now}`,
    };
    conditions.push(`(${statusCondition[query.timeStatus]})`);
  }
  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    values,
  };
}

function mapContest(row: ContestRow): Contest {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    rules: row.rules,
    startsAt: toIsoString(row.starts_at),
    endsAt: toIsoString(row.ends_at),
    publicationStatus: row.publication_status,
    visibility: row.visibility,
    allowRegistration: row.allow_registration,
    showLeaderboard: row.show_leaderboard,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    publishedAt: row.published_at === null ? null : toIsoString(row.published_at),
  };
}

function mapContestProblem(row: ContestProblemRow): ContestProblem {
  return {
    problemId: row.problem_id,
    problemCode: row.problem_code_snapshot,
    problemTitle: row.problem_title_snapshot,
    position: row.position,
    maxScore: Number(row.max_score),
    testCaseRevision: row.test_case_revision,
  };
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}
