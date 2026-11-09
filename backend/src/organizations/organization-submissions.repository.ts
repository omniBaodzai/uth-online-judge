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
import type { CreatedSubmission, SubmissionView } from '../submissions/submissions.repository.js';
import type { OrganizationSubmissionQueryDto } from './organization-submissions.dto.js';

export type OrganizationSubmissionActor = {
  userId: string;
  isSystemAdmin: boolean;
};

export type OrganizationSubmissionItem = {
  id: string;
  status: string;
  submittedAt: string;
  username: string | null;
  problemCode: string | null;
  problemTitle: string | null;
  language: string;
  executionTimeMs: number | null;
  memoryUsedKb: number | null;
  score: number;
  maxScore: number;
  contestId: string | null;
  canViewDetails: boolean;
};

export type OrganizationSubmissionPage = {
  items: OrganizationSubmissionItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type OwnOrganizationSubmissionItem = Omit<
  OrganizationSubmissionItem,
  'username' | 'problemCode' | 'problemTitle' | 'canViewDetails'
>;

export type OwnOrganizationSubmissionPage = {
  items: OwnOrganizationSubmissionItem[];
  total: number;
  page: number;
  pageSize: number;
};

type SubmissionDetailRow = {
  id: string;
  problem_code: string;
  problem_title: string;
  username: string | null;
  language: string;
  source_code: string;
  status: string;
  scoring_enabled: boolean;
  score: string;
  max_score: string;
  execution_time_ms: number | null;
  memory_used_kb: number | null;
  submitted_at: Date;
  judged_at: Date | null;
};

@Injectable()
export class OrganizationSubmissionsRepository {
  constructor(@Inject(DATABASE_POOL) private readonly database: Pool) {}

  async listStandaloneLanguages(
    slug: string,
    problemId: string,
    actor: OrganizationSubmissionActor,
  ): Promise<Array<{ slug: string; name: string }>> {
    const result = await this.database.query<{ slug: string; name: string }>(
      `SELECT DISTINCT language.slug, language.name
       FROM public.organizations organization
       JOIN public.problems problem
         ON problem.organization_id = organization.id
       JOIN public.problem_languages allowed ON allowed.problem_id = problem.id
       JOIN public.programming_languages language
         ON language.id = allowed.language_id AND language.is_enabled = TRUE
       WHERE organization.slug = $1
         AND organization.status = 'ACTIVE'
         AND problem.id = $2
         AND problem.status = 'PUBLISHED'
         AND (
           $3::boolean
           OR organization.problems_visibility = 'PUBLIC'
           OR EXISTS (
             SELECT 1
             FROM public.organization_members member
             WHERE member.organization_id = organization.id
               AND member.user_id = $4
           )
         )
       ORDER BY language.name, language.slug`,
      [slug, problemId, actor.isSystemAdmin, actor.userId],
    );
    return result.rows;
  }

  async listContestLanguages(
    slug: string,
    contestId: string,
    problemId: string,
    actor: OrganizationSubmissionActor,
  ): Promise<Array<{ slug: string; name: string }>> {
    const result = await this.database.query<{ slug: string; name: string }>(
      `SELECT DISTINCT language.slug, language.name
       FROM public.organizations organization
       JOIN public.contests contest
         ON contest.organization_id = organization.id
       JOIN public.contest_problems contest_problem
         ON contest_problem.contest_id = contest.id
        AND contest_problem.problem_id = $3
       JOIN public.problems problem ON problem.id = contest_problem.problem_id
       JOIN public.problem_languages allowed ON allowed.problem_id = problem.id
       JOIN public.programming_languages language
         ON language.id = allowed.language_id AND language.is_enabled = TRUE
       WHERE organization.slug = $1
         AND organization.status = 'ACTIVE'
         AND contest.id = $2
         AND contest.publication_status = 'PUBLISHED'
         AND contest.starts_at <= clock_timestamp()
         AND contest.ends_at > clock_timestamp()
         AND problem.status = 'PUBLISHED'
         AND public.contest_problem_content_accessible(contest.id, problem.id)
         AND (
           (organization.problems_visibility = 'PUBLIC'
            AND organization.contests_visibility = 'PUBLIC'
            AND contest.visibility = 'PUBLIC')
           OR $4::boolean
           OR EXISTS (
             SELECT 1
             FROM public.organization_members member
             WHERE member.organization_id = organization.id
               AND member.user_id = $5
           )
         )
         AND EXISTS (
           SELECT 1
           FROM public.contest_participants participant
           WHERE participant.contest_id = contest.id
             AND participant.user_id = $5
             AND participant.registration_status = 'REGISTERED'
         )
         AND (
           problem.organization_id IS NULL
           OR EXISTS (
             SELECT 1 FROM public.organizations source_organization
             WHERE source_organization.id = problem.organization_id
               AND source_organization.status = 'ACTIVE'
           )
         )
       ORDER BY language.name, language.slug`,
      [slug, contestId, problemId, actor.isSystemAdmin, actor.userId],
    );
    return result.rows;
  }

  async insertStandalone(
    slug: string,
    actor: OrganizationSubmissionActor,
    input: { problemCode: string; language: string; sourceCode: string },
  ): Promise<CreatedSubmission> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const organization = await this.lockOrganizationBySlug(client, slug);
      assertActive(organization.status);
      const member = await this.isMember(client, organization.id, actor.userId);
      if (
        !actor.isSystemAdmin
        && !member
        && organization.problems_visibility !== 'PUBLIC'
      ) {
        throw new ForbiddenException(
          'Bạn cần là thành viên hiện tại của tổ chức để nộp bài tập riêng tư.',
        );
      }

      const problemResult = await client.query<{ id: string }>(
        `SELECT id
         FROM public.problems
         WHERE problem_code = $1
           AND organization_id = $2
           AND status = 'PUBLISHED'
         FOR SHARE`,
        [input.problemCode, organization.id],
      );
      const problem = problemResult.rows[0];
      if (!problem) throw new NotFoundException('Không tìm thấy bài tập.');

      const languageId = await this.findAllowedLanguage(client, problem.id, input.language);
      const submission = await this.insertSubmission(client, {
        userId: actor.userId,
        problemId: problem.id,
        languageId,
        sourceCode: input.sourceCode,
      });
      await this.insertTestCaseSnapshots(client, submission.id, problem.id);
      await client.query('COMMIT');
      return submission;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async registerContest(
    slug: string,
    contestId: string,
    actor: OrganizationSubmissionActor,
  ): Promise<{ contestId: string; registrationStatus: 'REGISTERED'; registeredAt: string }> {
    return this.withTransaction(async (client) => {
      const target = await this.findContestOrganization(client, slug, contestId);
      const organization = await this.lockOrganizationById(client, target.organizationId);
      assertActive(organization.status);

      const contestResult = await client.query<{
        id: string;
        allow_registration: boolean;
        visibility: 'PUBLIC' | 'PRIVATE';
        publication_status: string;
        before_start: boolean;
      }>(
        `SELECT id, allow_registration, starts_at > clock_timestamp() AS before_start,
                visibility, publication_status
         FROM public.contests
         WHERE id = $1 AND organization_id = $2
         FOR UPDATE`,
        [contestId, organization.id],
      );
      const contest = contestResult.rows[0];
      if (!contest || contest.publication_status !== 'PUBLISHED') {
        throw new NotFoundException('Không tìm thấy kỳ thi.');
      }

      const member = await this.isMember(client, organization.id, actor.userId);
      if (
        !actor.isSystemAdmin
        && (organization.contests_visibility !== 'PUBLIC' || contest.visibility !== 'PUBLIC')
        && !member
      ) {
        throw new NotFoundException('Không tìm thấy kỳ thi.');
      }
      if (!contest.allow_registration || !contest.before_start) {
        throw new ConflictException('Đăng ký đã đóng hoặc kỳ thi đã bắt đầu.');
      }

      const current = await client.query<{ registration_status: string }>(
        `SELECT registration_status
         FROM public.contest_participants
         WHERE contest_id = $1 AND user_id = $2
         FOR UPDATE`,
        [contestId, actor.userId],
      );
      if (current.rows[0]?.registration_status === 'REGISTERED') {
        throw new ConflictException('Bạn đã đăng ký kỳ thi này.');
      }
      const registration = current.rows.length > 0
        ? await client.query<{ registered_at: Date }>(
          `UPDATE public.contest_participants
           SET registration_status = 'REGISTERED',
               registered_at = clock_timestamp(),
               cancelled_at = NULL
           WHERE contest_id = $1 AND user_id = $2
             AND registration_status = 'CANCELLED'
             AND EXISTS (
               SELECT 1 FROM public.contests
               WHERE id = $1 AND allow_registration = TRUE
                 AND starts_at > clock_timestamp()
             )
           RETURNING registered_at`,
          [contestId, actor.userId],
        )
        : await client.query<{ registered_at: Date }>(
          `INSERT INTO public.contest_participants
             (contest_id, user_id, registration_status, registered_at, cancelled_at)
           SELECT id, $2, 'REGISTERED', clock_timestamp(), NULL
           FROM public.contests
           WHERE id = $1 AND allow_registration = TRUE
             AND starts_at > clock_timestamp()
           RETURNING registered_at`,
          [contestId, actor.userId],
        );
      const row = registration.rows[0];
      if (!row) throw new ConflictException('Đăng ký đã đóng hoặc kỳ thi vừa bắt đầu.');
      return {
        contestId,
        registrationStatus: 'REGISTERED',
        registeredAt: row.registered_at.toISOString(),
      };
    });
  }

  async cancelContestRegistration(
    slug: string,
    contestId: string,
    actor: OrganizationSubmissionActor,
  ): Promise<{ contestId: string; registrationStatus: 'CANCELLED' }> {
    return this.withTransaction(async (client) => {
      const target = await this.findContestOrganization(client, slug, contestId);
      const organization = await this.lockOrganizationById(client, target.organizationId);
      assertActive(organization.status);
      const contest = await client.query<{ id: string }>(
        `SELECT id FROM public.contests
         WHERE id = $1 AND organization_id = $2
           AND publication_status = 'PUBLISHED'
           AND starts_at > clock_timestamp()
         FOR UPDATE`,
        [contestId, organization.id],
      );
      if (!contest.rowCount) {
        throw new ConflictException('Không thể hủy đăng ký sau khi kỳ thi bắt đầu.');
      }
      const cancelled = await client.query(
        `UPDATE public.contest_participants
         SET registration_status = 'CANCELLED', cancelled_at = clock_timestamp()
         WHERE contest_id = $1 AND user_id = $2
           AND registration_status = 'REGISTERED'`,
        [contestId, actor.userId],
      );
      if (!cancelled.rowCount) {
        throw new ConflictException('Bạn chưa đăng ký kỳ thi này.');
      }
      return { contestId, registrationStatus: 'CANCELLED' };
    });
  }

  async insertContest(
    slug: string,
    contestId: string,
    actor: OrganizationSubmissionActor,
    input: { problemCode: string; language: string; sourceCode: string },
  ): Promise<CreatedSubmission> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const candidate = await client.query<{
        organization_id: string;
        problem_organization_id: string | null;
        problem_id: string;
      }>(
        `SELECT organization.id AS organization_id,
                problem.organization_id AS problem_organization_id,
                problem.id AS problem_id
         FROM public.organizations organization
         JOIN public.contests contest ON contest.organization_id = organization.id
         JOIN public.contest_problems contest_problem ON contest_problem.contest_id = contest.id
         JOIN public.problems problem ON problem.id = contest_problem.problem_id
         WHERE organization.slug = $1
           AND contest.id = $2
           AND contest_problem.problem_code_snapshot = $3`,
        [slug, contestId, input.problemCode],
      );
      const target = candidate.rows[0];
      if (!target) throw new NotFoundException('Không tìm thấy bài tập trong kỳ thi.');

      await this.lockOrganizations(client, [
        target.organization_id,
        ...(target.problem_organization_id ? [target.problem_organization_id] : []),
      ]);
      const organization = await this.getOrganization(client, target.organization_id);
      assertActive(organization.status);

      const member = await this.isMember(client, organization.id, actor.userId);
      if (
        target.problem_organization_id
        && target.problem_organization_id !== organization.id
      ) {
        await client.query(
          `SELECT id
           FROM public.organization_problem_grants
           WHERE problem_id = $1
             AND revoked_at IS NULL
             AND scope = 'ORGANIZATION'
             AND grantee_organization_id = $2
           FOR SHARE`,
          [target.problem_id, organization.id],
        );
      }
      const contestResult = await client.query<{
        id: string;
        visibility: 'PUBLIC' | 'PRIVATE';
        publication_status: string;
        is_ongoing: boolean;
      }>(
        `SELECT id, visibility, publication_status,
                starts_at <= clock_timestamp() AND ends_at > clock_timestamp() AS is_ongoing
         FROM public.contests
         WHERE id = $1 AND organization_id = $2
         FOR SHARE`,
        [contestId, organization.id],
      );
      const contest = contestResult.rows[0];
      if (!contest || contest.publication_status !== 'PUBLISHED') {
        throw new NotFoundException('Không tìm thấy kỳ thi.');
      }
      if (
        !actor.isSystemAdmin
        && (organization.contests_visibility !== 'PUBLIC' || contest.visibility !== 'PUBLIC')
        && !member
      ) {
        throw new NotFoundException('Không tìm thấy kỳ thi.');
      }
      if (!contest.is_ongoing) {
        throw new ConflictException('Kỳ thi chưa bắt đầu hoặc đã kết thúc.');
      }

      const participant = await client.query(
        `SELECT 1
         FROM public.contest_participants
         WHERE contest_id = $1 AND user_id = $2
           AND registration_status = 'REGISTERED'
         FOR SHARE`,
        [contestId, actor.userId],
      );
      if (!participant.rowCount) {
        throw new ForbiddenException('Bạn chưa đăng ký tham gia kỳ thi này.');
      }

      const accessible = await client.query<{ accessible: boolean }>(
        `SELECT public.contest_problem_content_accessible($1, $2) AS accessible`,
        [contestId, target.problem_id],
      );
      if (!accessible.rows[0]?.accessible) {
        throw new NotFoundException('Không tìm thấy bài tập trong kỳ thi.');
      }

      const problemResult = await client.query<{ id: string; organization_id: string | null }>(
        `SELECT id, organization_id
         FROM public.problems
         WHERE id = $1 AND status = 'PUBLISHED'
         FOR SHARE`,
        [target.problem_id],
      );
      const problem = problemResult.rows[0];
      if (!problem) throw new NotFoundException('Không tìm thấy bài tập trong kỳ thi.');
      if (problem.organization_id) {
        const owner = await this.getOrganization(client, problem.organization_id);
        assertActive(owner.status);
      }

      const languageId = await this.findAllowedLanguage(client, problem.id, input.language);
      const submission = await this.insertContestSubmission(client, {
        userId: actor.userId,
        problemId: problem.id,
        languageId,
        sourceCode: input.sourceCode,
        contestId,
      });
      await this.insertTestCaseSnapshots(client, submission.id, problem.id);
      await client.query('COMMIT');
      return submission;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findOwnHistory(
    slug: string,
    userId: string,
    query: OrganizationSubmissionQueryDto,
  ): Promise<OwnOrganizationSubmissionPage> {
    return this.list(slug, query, userId, false);
  }

  async findVisibleHistory(
    organizationId: string,
    viewerId: string | null,
    query: OrganizationSubmissionQueryDto,
    canManage: boolean,
  ): Promise<OrganizationSubmissionPage> {
    const { where, values } = buildFilters(organizationId, query, canManage);
    const offset = (query.page - 1) * query.pageSize;
    const pageValues = [...values, query.pageSize, offset];
    const [pageResult, countResult] = await Promise.all([
      this.database.query<{
        id: string;
        status: string;
        submitted_at: Date;
        username: string | null;
        problem_code: string | null;
        problem_title: string | null;
        language: string;
        execution_time_ms: number | null;
        memory_used_kb: number | null;
        score: string;
        max_score: string;
        contest_id: string | null;
        user_id: string;
      }>(
        `SELECT s.id, s.status, s.submitted_at, account.username,
                CASE
                  WHEN s.contest_id IS NULL THEN problem.problem_code
                  WHEN public.contest_problem_content_accessible(contest.id, problem.id)
                    AND (problem.organization_id IS NULL OR EXISTS (
                      SELECT 1 FROM public.organizations owner
                      WHERE owner.id = problem.organization_id AND owner.status = 'ACTIVE'
                    ))
                  THEN contest_problem.problem_code_snapshot
                  ELSE NULL
                END AS problem_code,
                CASE
                  WHEN s.contest_id IS NULL THEN problem.title
                  WHEN public.contest_problem_content_accessible(contest.id, problem.id)
                    AND (problem.organization_id IS NULL OR EXISTS (
                      SELECT 1 FROM public.organizations owner
                      WHERE owner.id = problem.organization_id AND owner.status = 'ACTIVE'
                    ))
                  THEN contest_problem.problem_title_snapshot
                  ELSE NULL
                END AS problem_title,
                language.name AS language, s.execution_time_ms, s.memory_used_kb,
                s.score, s.max_score, s.contest_id, s.user_id
         FROM public.submissions s
         JOIN public.problems problem ON problem.id = s.problem_id
         LEFT JOIN public.contests contest ON contest.id = s.contest_id
         LEFT JOIN public.contest_problems contest_problem
           ON contest_problem.contest_id = s.contest_id
          AND contest_problem.problem_id = s.problem_id
         JOIN public.programming_languages language ON language.id = s.language_id
         JOIN public.users account ON account.id = s.user_id
         WHERE ${where}
         ORDER BY s.submitted_at DESC, s.id DESC
         LIMIT $${pageValues.length - 1} OFFSET $${pageValues.length}`,
        pageValues,
      ),
      this.database.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total
         FROM public.submissions s
         JOIN public.problems problem ON problem.id = s.problem_id
         LEFT JOIN public.contests contest ON contest.id = s.contest_id
         JOIN public.programming_languages language ON language.id = s.language_id
         JOIN public.users account ON account.id = s.user_id
         WHERE ${where}`,
        values,
      ),
    ]);
    return {
      items: pageResult.rows.map((row) => ({
        id: row.id,
        status: row.status,
        submittedAt: row.submitted_at.toISOString(),
        username: row.username,
        problemCode: row.problem_code,
        problemTitle: row.problem_title,
        language: row.language,
        executionTimeMs: row.execution_time_ms,
        memoryUsedKb: row.memory_used_kb,
        score: Number(row.score),
        maxScore: Number(row.max_score),
        contestId: row.contest_id,
        canViewDetails: row.user_id === viewerId || canManage,
      })),
      total: Number(countResult.rows[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findOwnSubmission(
    slug: string,
    submissionId: string,
    userId: string,
  ): Promise<SubmissionView | null> {
    const result = await this.database.query<SubmissionDetailRow>(
      `${this.detailSelect('organization.slug = $1')}
       WHERE organization.slug = $1 AND submission.id = $2
         AND submission.user_id = $3
         AND (
           (submission.contest_id IS NULL AND problem.organization_id = organization.id)
           OR (submission.contest_id IS NOT NULL AND contest.organization_id = organization.id)
         )`,
      [slug, submissionId, userId],
    );
    return this.mapDetailWithResults(result.rows[0]);
  }

  async findVisibleSubmission(
    organizationId: string,
    submissionId: string,
  ): Promise<SubmissionView | null> {
    const result = await this.database.query<SubmissionDetailRow>(
      `${this.detailSelect('organization.id = $1')}
       WHERE organization.id = $1 AND submission.id = $2
         AND (
           (submission.contest_id IS NULL AND problem.organization_id = organization.id)
           OR (submission.contest_id IS NOT NULL AND contest.organization_id = organization.id)
         )`,
      [organizationId, submissionId],
    );
    return this.mapDetailWithResults(result.rows[0]);
  }

  async findOwnSource(slug: string, submissionId: string, userId: string): Promise<string | null> {
    const result = await this.database.query<{ source_code: string }>(
      `SELECT submission.source_code
       FROM public.submissions submission
       JOIN public.problems problem ON problem.id = submission.problem_id
       JOIN public.organizations organization ON organization.slug = $1
       LEFT JOIN public.contests contest ON contest.id = submission.contest_id
       WHERE submission.id = $2 AND submission.user_id = $3
         AND (
           (submission.contest_id IS NULL AND problem.organization_id = organization.id)
           OR (submission.contest_id IS NOT NULL AND contest.organization_id = organization.id)
         )`,
      [slug, submissionId, userId],
    );
    return result.rows[0]?.source_code ?? null;
  }

  async findVisibleSource(
    organizationId: string,
    submissionId: string,
  ): Promise<string | null> {
    const result = await this.database.query<{ source_code: string }>(
      `SELECT submission.source_code
       FROM public.submissions submission
       JOIN public.problems problem ON problem.id = submission.problem_id
       JOIN public.organizations organization ON organization.id = $1
       LEFT JOIN public.contests contest ON contest.id = submission.contest_id
       WHERE submission.id = $2
         AND (
           (submission.contest_id IS NULL AND problem.organization_id = organization.id)
           OR (submission.contest_id IS NOT NULL AND contest.organization_id = organization.id)
         )`,
      [organizationId, submissionId],
    );
    return result.rows[0]?.source_code ?? null;
  }

  private async list(
    slug: string,
    query: OrganizationSubmissionQueryDto,
    userId: string,
    _canManage: false,
  ): Promise<OwnOrganizationSubmissionPage>;
  private async list(
    slug: string,
    query: OrganizationSubmissionQueryDto,
    userId: string,
    canManage: boolean,
  ): Promise<OrganizationSubmissionPage>;
  private async list(
    slug: string,
    query: OrganizationSubmissionQueryDto,
    userId: string,
    _canManage: boolean,
  ): Promise<OrganizationSubmissionPage> {
    const organization = await this.database.query<{ id: string }>(
      'SELECT id FROM public.organizations WHERE slug = $1',
      [slug],
    );
    const organizationId = organization.rows[0]?.id;
    if (!organizationId) throw new NotFoundException('Không tìm thấy tổ chức.');
    const { where, values } = buildFilters(organizationId, query, false, userId);
    const offset = (query.page - 1) * query.pageSize;
    const pageValues = [...values, query.pageSize, offset];
    const [pageResult, countResult] = await Promise.all([
      this.database.query<{
        id: string;
        status: string;
        submitted_at: Date;
        language: string;
        execution_time_ms: number | null;
        memory_used_kb: number | null;
        score: string;
        max_score: string;
        contest_id: string | null;
      }>(
        `SELECT s.id, s.status, s.submitted_at, language.name AS language,
                s.execution_time_ms, s.memory_used_kb, s.score, s.max_score,
                s.contest_id
         FROM public.submissions s
         JOIN public.problems problem ON problem.id = s.problem_id
         LEFT JOIN public.contests contest ON contest.id = s.contest_id
         JOIN public.programming_languages language ON language.id = s.language_id
         JOIN public.users account ON account.id = s.user_id
         WHERE ${where}
         ORDER BY s.submitted_at DESC, s.id DESC
         LIMIT $${pageValues.length - 1} OFFSET $${pageValues.length}`,
        pageValues,
      ),
      this.database.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total
         FROM public.submissions s
         JOIN public.problems problem ON problem.id = s.problem_id
         LEFT JOIN public.contests contest ON contest.id = s.contest_id
         JOIN public.programming_languages language ON language.id = s.language_id
         JOIN public.users account ON account.id = s.user_id
         WHERE ${where}`,
        values,
      ),
    ]);
    return {
      items: pageResult.rows.map((row) => ({
        id: row.id,
        status: row.status,
        submittedAt: row.submitted_at.toISOString(),
        username: null,
        problemCode: null,
        problemTitle: null,
        language: row.language,
        executionTimeMs: row.execution_time_ms,
        memoryUsedKb: row.memory_used_kb,
        score: Number(row.score),
        maxScore: Number(row.max_score),
        contestId: row.contest_id,
        canViewDetails: true,
      })),
      total: Number(countResult.rows[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  private detailSelect(organizationJoin: string): string {
    return `SELECT submission.id, '' AS problem_code, 'Organization submission' AS problem_title,
                   account.username, language.name AS language, submission.source_code,
                   submission.status, submission.scoring_enabled, submission.score,
                   submission.max_score, submission.execution_time_ms,
                   submission.memory_used_kb, submission.submitted_at, submission.judged_at
            FROM public.submissions submission
            JOIN public.problems problem ON problem.id = submission.problem_id
            JOIN public.users account ON account.id = submission.user_id
            JOIN public.programming_languages language ON language.id = submission.language_id
            JOIN public.organizations organization
              ON ${organizationJoin}
            LEFT JOIN public.contests contest ON contest.id = submission.contest_id`;
  }

  private async mapDetailWithResults(
    row: SubmissionDetailRow | undefined,
  ): Promise<SubmissionView | null> {
    if (!row) return null;
    const results = await this.database.query<{
      position: number;
      status: string | null;
      execution_time_ms: number | null;
      memory_used_kb: number | null;
      points_awarded: string | null;
      max_points: string;
    }>(
      `SELECT snapshot.position, result.status, result.execution_time_ms,
              result.memory_used_kb, result.points_awarded,
              snapshot.points AS max_points
       FROM public.submission_test_case_snapshots snapshot
       LEFT JOIN public.submission_test_results result
         ON result.snapshot_id = snapshot.id
        AND result.submission_id = snapshot.submission_id
       WHERE snapshot.submission_id = $1
       ORDER BY snapshot.position`,
      [row.id],
    );
    return {
      id: row.id,
      problemCode: row.problem_code,
      problemTitle: row.problem_title,
      username: row.username,
      language: row.language,
      sourceCode: row.source_code,
      status: row.status,
      scoringEnabled: row.scoring_enabled,
      score: Number(row.score),
      maxScore: row.scoring_enabled ? Number(row.max_score) : 0,
      cumulativeScore: 0,
      cumulativeMaxScore: 0,
      executionTimeMs: row.execution_time_ms,
      memoryUsedKb: row.memory_used_kb,
      submittedAt: row.submitted_at.toISOString(),
      judgedAt: row.judged_at?.toISOString() ?? null,
      testResults: results.rows.map((result) => ({
        position: result.position,
        status: result.status,
        executionTimeMs: result.execution_time_ms,
        memoryUsedKb: result.memory_used_kb,
        pointsAwarded: row.scoring_enabled ? Number(result.points_awarded ?? 0) : 0,
        maxPoints: row.scoring_enabled ? Number(result.max_points) : 0,
      })),
    };
  }

  private async insertSubmission(
    client: PoolClient,
    input: { userId: string; problemId: string; languageId: string; sourceCode: string },
  ): Promise<CreatedSubmission> {
    const result = await client.query<{ id: string; status: string; submitted_at: Date }>(
      `INSERT INTO public.submissions
         (user_id, problem_id, language_id, source_code, max_score, scoring_enabled)
       SELECT $1, problem.id, $3, $4,
              (SELECT COUNT(*) FROM public.problem_test_cases test_case
               WHERE test_case.problem_id = problem.id AND test_case.is_active = TRUE),
              TRUE
       FROM public.problems problem
       JOIN public.problem_languages allowed
         ON allowed.problem_id = problem.id AND allowed.language_id = $3
       JOIN public.programming_languages language
         ON language.id = allowed.language_id AND language.is_enabled = TRUE
       WHERE problem.id = $2 AND problem.status = 'PUBLISHED'
       RETURNING id, status, submitted_at`,
      [input.userId, input.problemId, input.languageId, input.sourceCode],
    );
    return requireInserted(result.rows[0]);
  }

  private async insertContestSubmission(
    client: PoolClient,
    input: {
      userId: string;
      problemId: string;
      languageId: string;
      sourceCode: string;
      contestId: string;
    },
  ): Promise<CreatedSubmission> {
    const result = await client.query<{ id: string; status: string; submitted_at: Date }>(
      `WITH acceptance_time AS MATERIALIZED (
         SELECT clock_timestamp() AS submitted_at
       )
       INSERT INTO public.submissions
         (user_id, problem_id, language_id, source_code, max_score, scoring_enabled,
          contest_id, contest_max_score_snapshot, submitted_at)
       SELECT $1, problem.id, $4,
              $5,
              (SELECT COUNT(*) FROM public.problem_test_cases test_case
               WHERE test_case.problem_id = problem.id AND test_case.is_active = TRUE),
              TRUE, contest.id, contest_problem.max_score, acceptance_time.submitted_at
       FROM public.contests contest
       JOIN public.contest_participants participant
         ON participant.contest_id = contest.id
        AND participant.user_id = $1
        AND participant.registration_status = 'REGISTERED'
       JOIN public.problems problem ON problem.id = $2 AND problem.status = 'PUBLISHED'
       JOIN public.contest_problems contest_problem
         ON contest_problem.contest_id = contest.id
        AND contest_problem.problem_id = problem.id
       JOIN public.problem_languages allowed
         ON allowed.problem_id = problem.id AND allowed.language_id = $4
       JOIN public.programming_languages language
         ON language.id = allowed.language_id AND language.is_enabled = TRUE
       CROSS JOIN acceptance_time
       WHERE contest.id = $3
         AND contest.publication_status = 'PUBLISHED'
         AND contest.starts_at <= acceptance_time.submitted_at
         AND acceptance_time.submitted_at < contest.ends_at
         AND public.contest_problem_content_accessible(contest.id, problem.id)
       RETURNING id, status, submitted_at`,
      [
        input.userId,
        input.problemId,
        input.contestId,
        input.languageId,
        input.sourceCode,
      ],
    );
    return requireInserted(result.rows[0]);
  }

  private async insertTestCaseSnapshots(
    client: PoolClient,
    submissionId: string,
    problemId: string,
  ): Promise<void> {
    const snapshots = await client.query(
      `INSERT INTO public.submission_test_case_snapshots
         (submission_id, source_test_case_id, test_name, input_data, expected_output,
          points, position, time_limit_ms, memory_limit_kb)
       SELECT $1, test_case.id, test_case.test_name, test_case.input_data,
              test_case.expected_output, 1, test_case.position,
              problem.time_limit_ms, problem.memory_limit_mb * 1024
       FROM public.problem_test_cases test_case
       JOIN public.problems problem ON problem.id = test_case.problem_id
       WHERE test_case.problem_id = $2 AND test_case.is_active = TRUE
       ORDER BY test_case.position`,
      [submissionId, problemId],
    );
    if (!snapshots.rowCount) {
      throw new ConflictException('Bài tập chưa có test case đang hoạt động.');
    }
  }

  private async findAllowedLanguage(
    client: PoolClient,
    problemId: string,
    slug: string,
  ): Promise<string> {
    const result = await client.query<{ id: string }>(
      `SELECT language.id
       FROM public.programming_languages language
       JOIN public.problem_languages allowed ON allowed.language_id = language.id
       WHERE allowed.problem_id = $1
         AND language.slug = $2
         AND language.is_enabled = TRUE`,
      [problemId, slug],
    );
    const language = result.rows[0];
    if (!language) throw new BadRequestException('Ngôn ngữ không được hỗ trợ cho bài tập này.');
    return language.id;
  }

  private async lockOrganizationBySlug(
    client: PoolClient,
    slug: string,
  ): Promise<{
    id: string;
    status: string;
    contests_visibility: string;
    problems_visibility: string;
  }> {
    const result = await client.query<{
      id: string;
      status: string;
      contests_visibility: string;
      problems_visibility: string;
    }>(
      `SELECT id, status, contests_visibility, problems_visibility
       FROM public.organizations
       WHERE slug = $1
       FOR SHARE`,
      [slug],
    );
    const organization = result.rows[0];
    if (!organization) throw new NotFoundException('Không tìm thấy tổ chức.');
    return organization;
  }

  private async lockOrganizationById(
    client: PoolClient,
    organizationId: string,
  ): Promise<{ id: string; status: string; contests_visibility: string }> {
    const result = await client.query<{ id: string; status: string; contests_visibility: string }>(
      `SELECT id, status, contests_visibility
       FROM public.organizations
       WHERE id = $1
       FOR SHARE`,
      [organizationId],
    );
    const organization = result.rows[0];
    if (!organization) throw new NotFoundException('Không tìm thấy tổ chức.');
    return organization;
  }

  private async lockOrganizations(client: PoolClient, ids: string[]): Promise<void> {
    const uniqueIds = [...new Set(ids)].sort();
    if (!uniqueIds.length) return;
    const result = await client.query<{ id: string }>(
      `SELECT id
       FROM public.organizations
       WHERE id = ANY($1::uuid[])
       ORDER BY id
       FOR SHARE`,
      [uniqueIds],
    );
    if (result.rowCount !== uniqueIds.length) {
      throw new NotFoundException('Không tìm thấy tổ chức.');
    }
  }

  private async getOrganization(
    client: PoolClient,
    organizationId: string,
  ): Promise<{ id: string; status: string; contests_visibility: string }> {
    const result = await client.query<{ id: string; status: string; contests_visibility: string }>(
      `SELECT id, status, contests_visibility
       FROM public.organizations
       WHERE id = $1`,
      [organizationId],
    );
    const organization = result.rows[0];
    if (!organization) throw new NotFoundException('Không tìm thấy tổ chức.');
    return organization;
  }

  private async findContestOrganization(
    client: PoolClient,
    slug: string,
    contestId: string,
  ): Promise<{ organizationId: string }> {
    const result = await client.query<{ organization_id: string }>(
      `SELECT organization.id AS organization_id
       FROM public.organizations organization
       JOIN public.contests contest ON contest.organization_id = organization.id
       WHERE organization.slug = $1 AND contest.id = $2`,
      [slug, contestId],
    );
    const target = result.rows[0];
    if (!target) throw new NotFoundException('Không tìm thấy kỳ thi.');
    return { organizationId: target.organization_id };
  }

  private async isMember(
    client: PoolClient,
    organizationId: string,
    userId: string,
  ): Promise<boolean> {
    const result = await client.query(
      `SELECT 1
       FROM public.organization_members
       WHERE organization_id = $1 AND user_id = $2
       FOR SHARE`,
      [organizationId, userId],
    );
    return result.rowCount !== 0;
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

function assertActive(status: string): void {
  if (status !== 'ACTIVE') {
    throw new ConflictException('Tổ chức đã lưu trữ; không thể đăng ký hoặc nộp bài.');
  }
}

function requireInserted(
  row: { id: string; status: string; submitted_at: Date } | undefined,
): CreatedSubmission {
  if (!row) throw new ConflictException('Bài nộp không còn hợp lệ.');
  return {
    id: row.id,
    status: row.status,
    submittedAt: row.submitted_at.toISOString(),
  };
}

function buildFilters(
  organizationId: string,
  query: OrganizationSubmissionQueryDto,
  canManage: boolean,
  ownerUserId?: string,
): { where: string; values: unknown[] } {
  const values: unknown[] = [organizationId];
  const conditions = [
    `((s.contest_id IS NULL AND problem.organization_id = $1)
      OR (s.contest_id IS NOT NULL AND contest.organization_id = $1))`,
  ];
  if (ownerUserId) {
    values.push(ownerUserId);
    conditions.push(`s.user_id = $${values.length}`);
  } else if (query.userId && canManage) {
    values.push(query.userId);
    conditions.push(`s.user_id = $${values.length}`);
  }
  if (query.problemId) {
    values.push(query.problemId);
    conditions.push(`s.problem_id = $${values.length}`);
  }
  if (query.contestId) {
    values.push(query.contestId);
    conditions.push(`s.contest_id = $${values.length}`);
  }
  if (query.status) {
    values.push(query.status);
    conditions.push(`s.status = $${values.length}`);
  }
  if (query.language) {
    values.push(query.language);
    conditions.push(`language.slug = $${values.length}`);
  }
  if (query.from) {
    values.push(query.from);
    conditions.push(`s.submitted_at >= $${values.length}::timestamptz`);
  }
  if (query.to) {
    values.push(query.to);
    conditions.push(`s.submitted_at < $${values.length}::timestamptz`);
  }
  if (!ownerUserId && query.username) {
    values.push(`%${escapeLike(query.username)}%`);
    conditions.push(`account.username ILIKE $${values.length} ESCAPE '\\'`);
  }
  return { where: conditions.join(' AND '), values };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
