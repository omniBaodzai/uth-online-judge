import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool, type PoolClient } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';
import type {
  ContestRegistration,
  StudentContestDetail,
  StudentContestLeaderboardEntry,
  StudentContestLeaderboardPage,
  StudentContestLeaderboardQuery,
  StudentContestListItem,
  StudentContestListQuery,
  StudentContestParticipantsPage,
  StudentContestParticipantsQuery,
  StudentContestPage,
  StudentContestProblem,
  StudentContestStatistics,
  StudentContestSubmissionItem,
  StudentContestSubmissionsPage,
  StudentContestSubmissionsQuery,
  StudentContestTimeStatus,
  StudentRegistrationStatus,
} from './student-contests.types.js';

type PublicContestRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  rules?: string | null;
  starts_at: Date | string;
  ends_at: Date | string;
  allow_registration: boolean;
  time_status: StudentContestTimeStatus;
  can_register: boolean;
  participant_count: number;
  is_registered?: boolean;
  registration_status?: StudentRegistrationStatus | null;
  database_now?: Date | string;
};

type ProblemRow = {
  problem_id: string;
  problem_code_snapshot: string;
  problem_title_snapshot: string;
  position: number;
  max_score: string | number;
};

type ContestStatisticsRow = {
  total_participants: number | string;
  total_problems: number | string;
  total_submissions: number | string;
  accepted_submissions: number | string;
  wrong_answer_submissions: number | string;
  time_limit_submissions: number | string;
  runtime_error_submissions: number | string;
  pending_submissions: number | string;
  other_submissions: number | string;
  active_submitters: number | string;
  solved_participants: number | string;
  status_counts: Array<{ status: string; count: number | string }> | null;
  problem_statistics: Array<{
    problem_id: string;
    problem_code: string;
    problem_title: string;
    total_submissions: number | string;
    accepted_submissions: number | string;
    status_counts: Array<{ status: string; count: number | string }>;
  }> | null;
  language_statistics: Array<{
    language_id: string;
    language_name: string;
    total_submissions: number | string;
    accepted_submissions: number | string;
    status_counts: Array<{ status: string; count: number | string }>;
  }> | null;
};

type ContestLeaderboardRow = {
  contest_exists: boolean;
  total: number | string;
  total_participants: number | string;
  items: Array<{
    rank: number | string;
    userId: string;
    username: string | null;
    avatarUrl: string | null;
    totalScore: number | string;
    acceptedProblems: number | string;
    totalProblems: number | string;
    elapsedSeconds: number | string | null;
  }> | null;
};

type ContestSubmissionsRow = {
  contest_exists: boolean;
  total: number | string;
  items: Array<{
    id: string;
    status: string;
    submittedAt: Date | string;
    username: string | null;
    problemCode: string;
    problemTitle: string;
    language: string;
    executionTimeMs: number | null;
    memoryUsedKb: number | null;
    canViewDetails: boolean;
  }> | null;
  status_counts: Array<{ status: string; count: number | string }> | null;
  languages: string[] | null;
};

type ContestParticipantsRow = {
  contest_exists: boolean;
  total: number | string;
  participant_count: number | string;
  items: Array<{
    userId: string;
    username: string;
    avatarUrl: string | null;
    registeredAt: Date | string;
    status: 'registered' | 'participated';
  }> | null;
};

const SORT_SQL: Record<StudentContestListQuery['sort'], string> = {
  startsAt: 'starts_at',
  endsAt: 'ends_at',
  title: 'title',
  participantCount: 'participant_count',
};

const PUBLIC_CONTEST_CONDITION =
  "c.organization_id IS NULL AND c.publication_status = 'PUBLISHED' AND c.visibility = 'PUBLIC'";

@Injectable()
export class StudentContestsRepository {
  constructor(@Inject(DATABASE_POOL) private readonly database: Pool) {}

  async list(
    query: StudentContestListQuery,
    userId: string | null,
  ): Promise<StudentContestPage> {
    return this.withReadTransaction(async (client) => {
      const clockResult = await client.query<{ now: Date | string }>(
        'SELECT clock_timestamp() AS now',
      );
      const databaseNow = clockResult.rows[0]!.now;
      const filterValues: unknown[] = [];
      const conditions = [PUBLIC_CONTEST_CONDITION];

      if (query.search) {
        filterValues.push(`%${escapeLike(query.search)}%`);
        conditions.push(
          `(c.title ILIKE $${filterValues.length} ESCAPE '\\' OR c.slug ILIKE $${filterValues.length} ESCAPE '\\')`,
        );
      }

      if (query.timeStatus) {
        filterValues.push(databaseNow);
        const timeParameter = `$${filterValues.length}::timestamptz`;
        const statusSql: Record<StudentContestTimeStatus, string> = {
          UPCOMING: `c.starts_at > ${timeParameter}`,
          ONGOING: `c.starts_at <= ${timeParameter} AND c.ends_at > ${timeParameter}`,
          ENDED: `c.ends_at <= ${timeParameter}`,
        };
        conditions.push(`(${statusSql[query.timeStatus]})`);
      }

      const where = `WHERE ${conditions.join(' AND ')}`;
      const countResult = await client.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total
         FROM public.contests c
         ${where}`,
        filterValues,
      );

      const pageValues = [
        userId,
        databaseNow,
        ...filterValues,
        query.pageSize,
        (query.page - 1) * query.pageSize,
      ];
      const pageWhere = where.replace(/\$(\d+)/g, (_, parameter: string) =>
        `$${Number(parameter) + 2}`,
      );
      const direction = query.order.toUpperCase();
      const result = await client.query<PublicContestRow>(
        `SELECT c.id, c.slug, c.title, c.description, c.starts_at, c.ends_at,
                c.allow_registration,
                CASE
                  WHEN c.starts_at > $2::timestamptz THEN 'UPCOMING'
                  WHEN c.ends_at > $2::timestamptz THEN 'ONGOING'
                  ELSE 'ENDED'
                END AS time_status,
                (c.allow_registration
                 AND c.starts_at > $2::timestamptz
                 AND registration.user_id IS NULL) AS can_register,
                (registration.user_id IS NOT NULL) AS is_registered,
                (SELECT COUNT(*)::int
                 FROM public.contest_participants participant
                 JOIN public.users account ON account.id = participant.user_id
                 WHERE participant.contest_id = c.id
                   AND participant.registration_status = 'REGISTERED'
                   AND (c.ends_at <= $2::timestamptz OR account.is_active = TRUE)) AS participant_count
         FROM public.contests c
         LEFT JOIN public.contest_participants registration
           ON registration.contest_id = c.id
          AND registration.user_id = $1::uuid
          AND registration.registration_status = 'REGISTERED'
         ${pageWhere}
         ORDER BY ${SORT_SQL[query.sort]} ${direction} NULLS LAST, c.id ASC
         LIMIT $${pageValues.length - 1} OFFSET $${pageValues.length}`,
        pageValues,
      );

      return {
        items: result.rows.map(mapListItem),
        total: Number(countResult.rows[0]?.total ?? 0),
        page: query.page,
        pageSize: query.pageSize,
      };
    });
  }

  async findPublic(identifier: string, userId: string | null): Promise<StudentContestDetail> {
    const uuid = isUuid(identifier) ? identifier : null;
    return this.withReadTransaction(async (client) => {
      const result = await client.query<PublicContestRow>(
        `WITH db_clock AS (SELECT clock_timestamp() AS now)
         SELECT c.id, c.slug, c.title, c.description, c.rules,
                c.starts_at, c.ends_at, c.allow_registration,
                db_clock.now AS database_now,
                CASE
                  WHEN c.starts_at > db_clock.now THEN 'UPCOMING'
                  WHEN c.ends_at > db_clock.now THEN 'ONGOING'
                  ELSE 'ENDED'
                END AS time_status,
                (c.allow_registration AND c.starts_at > db_clock.now) AS can_register,
                (SELECT COUNT(*)::int
                 FROM public.contest_participants participant
                 JOIN public.users account ON account.id = participant.user_id
                 WHERE participant.contest_id = c.id
                   AND participant.registration_status = 'REGISTERED'
                   AND (c.ends_at <= db_clock.now OR account.is_active = TRUE)) AS participant_count,
                COALESCE(registration.registration_status = 'REGISTERED', FALSE) AS is_registered,
                registration.registration_status
         FROM public.contests c
         CROSS JOIN db_clock
         LEFT JOIN public.contest_participants registration
           ON registration.contest_id = c.id
          AND registration.user_id = $3::uuid
         WHERE ${PUBLIC_CONTEST_CONDITION}
           AND (c.id = $1::uuid OR c.slug = $2)`,
        [uuid, identifier, userId],
      );
      const row = result.rows[0];
      if (!row) throw new NotFoundException('Không tìm thấy cuộc thi.');

      const problemAccessAvailable =
        row.is_registered === true && row.time_status === 'ONGOING';
      const problems = problemAccessAvailable
        ? await this.loadPublicProblems(client, row.id)
        : [];
      return {
        ...mapListItem(row),
        canRegister: row.can_register && !row.is_registered,
        rules: row.rules ?? null,
        isRegistered: row.is_registered ?? false,
        registrationStatus: row.registration_status ?? null,
        problems,
      };
    });
  }

  async findPublicStatistics(identifier: string): Promise<StudentContestStatistics> {
    const uuid = isUuid(identifier) ? identifier : null;
    return this.withReadTransaction(async (client) => {
      const result = await client.query<ContestStatisticsRow>(
        `WITH public_contest AS MATERIALIZED (
          SELECT c.id, c.ends_at
           FROM public.contests c
           WHERE ${PUBLIC_CONTEST_CONDITION}
             AND (c.id = $1::uuid OR c.slug = $2)
           ORDER BY (c.id = $1::uuid) DESC
           LIMIT 1
         ),
         submission_groups AS (
           SELECT GROUPING(s.problem_id) = 0 AS by_problem,
                  GROUPING(s.language_id) = 0 AS by_language,
                  GROUPING(s.status) = 1 AS is_total,
                  s.problem_id,
                  s.language_id,
                  s.status,
                  COUNT(*)::int AS status_count,
                  COUNT(*) FILTER (WHERE s.status = 'ACCEPTED')::int AS accepted_submissions,
                  COUNT(*) FILTER (WHERE s.status = 'WRONG_ANSWER')::int AS wrong_answer_submissions,
                  COUNT(*) FILTER (WHERE s.status = 'TIME_LIMIT_EXCEEDED')::int AS time_limit_submissions,
                  COUNT(*) FILTER (WHERE s.status = 'RUNTIME_ERROR')::int AS runtime_error_submissions,
                  COUNT(*) FILTER (WHERE s.status IN ('PENDING', 'QUEUED', 'RUNNING'))::int AS pending_submissions,
                  COUNT(DISTINCT s.user_id)::int AS active_submitters,
                  COUNT(DISTINCT s.user_id)
                    FILTER (WHERE s.status = 'ACCEPTED')::int AS solved_participants
           FROM public.submissions s
           WHERE s.contest_id = (SELECT id FROM public_contest)
             AND EXISTS (
               SELECT 1
               FROM public.problems p
               JOIN public.contest_problems contest_problem
                 ON contest_problem.contest_id = s.contest_id
                AND contest_problem.problem_id = p.id
               WHERE p.id = s.problem_id
                 AND p.status = 'PUBLISHED'
                 AND (p.organization_id IS NULL OR EXISTS (
                   SELECT 1 FROM public.organizations owner
                   WHERE owner.id = p.organization_id AND owner.status = 'ACTIVE'
                 ))
                 AND public.contest_problem_content_accessible(s.contest_id, p.id)
             )
           GROUP BY GROUPING SETS (
             (s.status),
             (s.problem_id, s.status),
             (s.language_id, s.status),
             ()
           )
         ),
         submission_rollup AS (
           SELECT COALESCE(MAX(status_count) FILTER (WHERE is_total), 0)::int AS total_submissions,
                  COALESCE(MAX(accepted_submissions) FILTER (WHERE is_total), 0)::int AS accepted_submissions,
                  COALESCE(MAX(wrong_answer_submissions) FILTER (WHERE is_total), 0)::int AS wrong_answer_submissions,
                  COALESCE(MAX(time_limit_submissions) FILTER (WHERE is_total), 0)::int AS time_limit_submissions,
                  COALESCE(MAX(runtime_error_submissions) FILTER (WHERE is_total), 0)::int AS runtime_error_submissions,
                  COALESCE(MAX(pending_submissions) FILTER (WHERE is_total), 0)::int AS pending_submissions,
                  COALESCE(MAX(active_submitters) FILTER (WHERE is_total), 0)::int AS active_submitters,
                  COALESCE(MAX(solved_participants) FILTER (WHERE is_total), 0)::int AS solved_participants,
                  COALESCE(
                    jsonb_agg(
                      jsonb_build_object('status', status, 'count', status_count)
                      ORDER BY status
                    ) FILTER (
                      WHERE NOT by_problem AND NOT by_language AND NOT is_total
                    ),
                    '[]'::jsonb
                  ) AS status_counts
           FROM submission_groups
         ),
         problem_rollup AS (
           SELECT problem_id,
                  SUM(status_count)::int AS total_submissions,
                  COALESCE(SUM(status_count) FILTER (WHERE status = 'ACCEPTED'), 0)::int AS accepted_submissions,
                  jsonb_agg(
                    jsonb_build_object('status', status, 'count', status_count)
                    ORDER BY status
                  ) AS status_counts
           FROM submission_groups
           WHERE by_problem
           GROUP BY problem_id
         ),
         language_rollup AS (
           SELECT language_id,
                  SUM(status_count)::int AS total_submissions,
                  COALESCE(SUM(status_count) FILTER (WHERE status = 'ACCEPTED'), 0)::int AS accepted_submissions,
                  jsonb_agg(
                    jsonb_build_object('status', status, 'count', status_count)
                    ORDER BY status
                  ) AS status_counts
           FROM submission_groups
           WHERE by_language
           GROUP BY language_id
         )
         SELECT
           (SELECT COUNT(*)::int
            FROM public.contest_participants participant
            JOIN public.users account ON account.id = participant.user_id
            WHERE participant.contest_id = contest.id
              AND participant.registration_status = 'REGISTERED'
              AND (contest.ends_at <= CURRENT_TIMESTAMP OR account.is_active = TRUE)) AS total_participants,
           (SELECT COUNT(*)::int
            FROM public.contest_problems contest_problem
            JOIN public.problems problem ON problem.id = contest_problem.problem_id
            WHERE contest_problem.contest_id = contest.id
              AND problem.status = 'PUBLISHED'
              AND (problem.organization_id IS NULL OR EXISTS (
                SELECT 1 FROM public.organizations owner
                WHERE owner.id = problem.organization_id AND owner.status = 'ACTIVE'
              ))
              AND public.contest_problem_content_accessible(
                contest_problem.contest_id, contest_problem.problem_id
              )) AS total_problems,
           submission_rollup.total_submissions,
           submission_rollup.accepted_submissions,
           submission_rollup.wrong_answer_submissions,
           submission_rollup.time_limit_submissions,
           submission_rollup.runtime_error_submissions,
           submission_rollup.pending_submissions,
           (submission_rollup.total_submissions
             - submission_rollup.accepted_submissions
             - submission_rollup.wrong_answer_submissions
             - submission_rollup.time_limit_submissions
             - submission_rollup.runtime_error_submissions
             - submission_rollup.pending_submissions)::int AS other_submissions,
           submission_rollup.active_submitters,
           submission_rollup.solved_participants,
           submission_rollup.status_counts,
           (
             SELECT COALESCE(
               jsonb_agg(
                 jsonb_build_object(
                   'problem_id', contest_problem.problem_id,
                   'problem_code', contest_problem.problem_code_snapshot,
                   'problem_title', contest_problem.problem_title_snapshot,
                   'total_submissions', COALESCE(problem_rollup.total_submissions, 0),
                   'accepted_submissions', COALESCE(problem_rollup.accepted_submissions, 0),
                   'status_counts', COALESCE(problem_rollup.status_counts, '[]'::jsonb)
                 )
                 ORDER BY contest_problem.position
               ),
               '[]'::jsonb
             )
             FROM public.contest_problems contest_problem
             JOIN public.problems problem ON problem.id = contest_problem.problem_id
             LEFT JOIN problem_rollup
               ON problem_rollup.problem_id = contest_problem.problem_id
             WHERE contest_problem.contest_id = contest.id
               AND problem.status = 'PUBLISHED'
               AND (problem.organization_id IS NULL OR EXISTS (
                 SELECT 1 FROM public.organizations owner
                 WHERE owner.id = problem.organization_id AND owner.status = 'ACTIVE'
               ))
               AND public.contest_problem_content_accessible(
                 contest_problem.contest_id, contest_problem.problem_id
               )
           ) AS problem_statistics,
           (
             SELECT COALESCE(
               jsonb_agg(
                 jsonb_build_object(
                   'language_id', language.id,
                   'language_name', language.name,
                   'total_submissions', language_rollup.total_submissions,
                   'accepted_submissions', language_rollup.accepted_submissions,
                   'status_counts', language_rollup.status_counts
                 )
                 ORDER BY language.name
               ),
               '[]'::jsonb
             )
             FROM language_rollup
             JOIN public.programming_languages language
               ON language.id = language_rollup.language_id
           ) AS language_statistics
         FROM public_contest contest
         CROSS JOIN submission_rollup
         `,
        [uuid, identifier],
      );
      const row = result.rows[0];
      if (!row) throw new NotFoundException('Không tìm thấy cuộc thi.');
      return {
        totalParticipants: Number(row.total_participants),
        totalProblems: Number(row.total_problems),
        totalSubmissions: Number(row.total_submissions),
        acceptedSubmissions: Number(row.accepted_submissions),
        wrongAnswerSubmissions: Number(row.wrong_answer_submissions),
        timeLimitSubmissions: Number(row.time_limit_submissions),
        runtimeErrorSubmissions: Number(row.runtime_error_submissions),
        pendingSubmissions: Number(row.pending_submissions),
        otherSubmissions: Number(row.other_submissions),
        activeSubmitters: Number(row.active_submitters),
        solvedParticipants: Number(row.solved_participants),
        statusCounts: (row.status_counts ?? []).map(({ status, count }) => ({
          status,
          count: Number(count),
        })),
        problemStatistics: (row.problem_statistics ?? []).map((problem) => ({
          problemId: problem.problem_id,
          problemCode: problem.problem_code,
          problemTitle: problem.problem_title,
          totalSubmissions: Number(problem.total_submissions),
          acceptedSubmissions: Number(problem.accepted_submissions),
          statusCounts: problem.status_counts.map(({ status, count }) => ({
            status,
            count: Number(count),
          })),
        })),
        languageStatistics: (row.language_statistics ?? []).map((language) => ({
          languageId: language.language_id,
          languageName: language.language_name,
          totalSubmissions: Number(language.total_submissions),
          acceptedSubmissions: Number(language.accepted_submissions),
          statusCounts: language.status_counts.map(({ status, count }) => ({
            status,
            count: Number(count),
          })),
        })),
      };
    });
  }

  async findPublicLeaderboard(
    identifier: string,
    query: StudentContestLeaderboardQuery,
  ): Promise<StudentContestLeaderboardPage> {
    const uuid = isUuid(identifier) ? identifier : null;
    const search = query.search
      ? `%${escapeLike(query.search)}%`
      : null;

    return this.withReadTransaction(async (client) => {
      const result = await client.query<ContestLeaderboardRow>(
        `WITH public_contest AS MATERIALIZED (
           SELECT c.id, c.starts_at, c.ends_at
           FROM public.contests c
           WHERE ${PUBLIC_CONTEST_CONDITION}
             AND c.show_leaderboard = TRUE
             AND (c.id = $1::uuid OR c.slug = $2)
           ORDER BY (c.id = $1::uuid) DESC
           LIMIT 1
         ),
         participants AS MATERIALIZED (
           SELECT participant.user_id, account.username, account.avatar_url
           FROM public.contest_participants participant
           JOIN public.users account ON account.id = participant.user_id
           JOIN public_contest contest ON contest.id = participant.contest_id
           WHERE participant.registration_status = 'REGISTERED'
             AND (contest.ends_at <= CURRENT_TIMESTAMP OR account.is_active = TRUE)
         ),
         scored_submissions AS (
           SELECT submission.id,
                  submission.user_id,
                  submission.problem_id,
                  submission.status,
                  submission.submitted_at,
                  submission.contest_max_score_snapshot,
                  COALESCE(SUM(snapshot.points), 0)::numeric AS possible_points,
                  COALESCE(SUM(result.points_awarded), 0)::numeric AS earned_points
           FROM public.submissions submission
           JOIN public_contest contest ON contest.id = submission.contest_id
           JOIN public.problems problem ON problem.id = submission.problem_id
           AND problem.status = 'PUBLISHED'
           AND (problem.organization_id IS NULL OR EXISTS (
             SELECT 1 FROM public.organizations owner
             WHERE owner.id = problem.organization_id AND owner.status = 'ACTIVE'
           ))
           JOIN public.contest_problems contest_problem
             ON contest_problem.contest_id = contest.id
            AND contest_problem.problem_id = submission.problem_id
           JOIN participants participant ON participant.user_id = submission.user_id
           LEFT JOIN public.submission_test_case_snapshots snapshot
             ON snapshot.submission_id = submission.id
           LEFT JOIN public.submission_test_results result
             ON result.submission_id = submission.id
            AND result.snapshot_id = snapshot.id
           WHERE submission.submitted_at >= contest.starts_at
             AND submission.submitted_at < contest.ends_at
             AND public.contest_problem_content_accessible(contest.id, problem.id)
             AND submission.status IN (
               'ACCEPTED',
               'WRONG_ANSWER',
               'TIME_LIMIT_EXCEEDED',
               'MEMORY_LIMIT_EXCEEDED',
               'COMPILATION_ERROR',
               'RUNTIME_ERROR'
             )
             AND submission.judged_at IS NOT NULL
           GROUP BY submission.id
           HAVING COUNT(snapshot.id) > 0
              AND COUNT(result.snapshot_id) = COUNT(snapshot.id)
         ),
         submission_scores AS (
           SELECT id, user_id, problem_id, status, submitted_at,
                  CASE
                    WHEN possible_points > 0 THEN
                      LEAST(
                        contest_max_score_snapshot,
                        GREATEST(
                          0,
                          ROUND(
                            earned_points / possible_points
                              * contest_max_score_snapshot,
                            2
                          )
                        )
                      )
                    ELSE 0::numeric
                  END AS contest_score
           FROM scored_submissions
         ),
         problem_max_scores AS (
           SELECT user_id,
                  problem_id,
                  MAX(contest_score) AS best_score,
                  BOOL_OR(status = 'ACCEPTED') AS has_accepted
           FROM submission_scores
           GROUP BY user_id, problem_id
         ),
         problem_best_attempts AS (
           SELECT best.user_id,
                  best.problem_id,
                  best.best_score,
                  best.has_accepted,
                  MIN(submission.submitted_at)
                    FILTER (WHERE submission.contest_score = best.best_score)
                    AS score_reached_at
           FROM problem_max_scores best
           JOIN submission_scores submission
             ON submission.user_id = best.user_id
            AND submission.problem_id = best.problem_id
           GROUP BY best.user_id, best.problem_id, best.best_score, best.has_accepted
         ),
         participant_totals AS (
           SELECT participant.user_id,
                  participant.username,
                  participant.avatar_url,
                  COALESCE(SUM(problem.best_score), 0)::numeric AS total_score,
                  COUNT(problem.problem_id)
                    FILTER (WHERE problem.has_accepted)::int AS accepted_problems,
                  (SELECT COUNT(*)::int
                   FROM public.contest_problems contest_problem
                  JOIN public_contest contest ON contest.id = contest_problem.contest_id
                  JOIN public.problems problem ON problem.id = contest_problem.problem_id
                  WHERE problem.status = 'PUBLISHED'
                    AND (problem.organization_id IS NULL OR EXISTS (
                      SELECT 1 FROM public.organizations owner
                      WHERE owner.id = problem.organization_id AND owner.status = 'ACTIVE'
                    ))
                    AND public.contest_problem_content_accessible(
                      contest_problem.contest_id, contest_problem.problem_id
                    ))
                    AS total_problems,
                  MAX(problem.score_reached_at)
                    FILTER (WHERE problem.best_score > 0) AS best_score_at,
                  contest.starts_at
           FROM participants participant
           CROSS JOIN public_contest contest
           LEFT JOIN problem_best_attempts problem
             ON problem.user_id = participant.user_id
           GROUP BY participant.user_id,
                    participant.username,
                    participant.avatar_url,
                    contest.starts_at
         ),
         participant_results AS (
           SELECT user_id,
                  username,
                  avatar_url,
                  total_score,
                  accepted_problems,
                  total_problems,
                  CASE
                    WHEN best_score_at IS NULL THEN NULL
                    ELSE FLOOR(EXTRACT(EPOCH FROM (best_score_at - starts_at)))::bigint
                  END AS elapsed_seconds
           FROM participant_totals
         ),
         ranked AS (
           SELECT RANK() OVER (
                    ORDER BY total_score DESC, elapsed_seconds ASC NULLS LAST
                  )::int AS rank,
                  user_id,
                  username,
                  avatar_url,
                  total_score,
                  accepted_problems,
                  total_problems,
                  elapsed_seconds
           FROM participant_results
         ),
         filtered AS (
           SELECT *
           FROM ranked
           WHERE $3::text IS NULL OR username ILIKE $3 ESCAPE '\\'
         ),
         filtered_count AS (
           SELECT COUNT(*)::int AS total FROM filtered
         ),
         page AS (
           SELECT *
           FROM filtered
           ORDER BY rank, username NULLS LAST, user_id
           LIMIT $4 OFFSET $5
         )
         SELECT EXISTS (SELECT 1 FROM public_contest) AS contest_exists,
                filtered_count.total,
                (SELECT COUNT(*)::int FROM participant_results) AS total_participants,
                COALESCE(
                  jsonb_agg(
                    jsonb_build_object(
                      'rank', page.rank,
                      'userId', page.user_id,
                      'username', page.username,
                      'avatarUrl', page.avatar_url,
                      'totalScore', page.total_score,
                      'acceptedProblems', page.accepted_problems,
                      'totalProblems', page.total_problems,
                      'elapsedSeconds', page.elapsed_seconds
                    )
                    ORDER BY page.rank, page.username NULLS LAST, page.user_id
                  ) FILTER (WHERE page.user_id IS NOT NULL),
                  '[]'::jsonb
                ) AS items
         FROM filtered_count
         LEFT JOIN page ON TRUE
         GROUP BY filtered_count.total`,
        [
          uuid,
          identifier,
          search,
          query.pageSize,
          (query.page - 1) * query.pageSize,
        ],
      );

      const row = result.rows[0];
      if (!row?.contest_exists) {
        throw new NotFoundException('Không tìm thấy cuộc thi.');
      }

      return {
        items: (row.items ?? []).map(mapLeaderboardEntry),
        total: Number(row.total),
        totalParticipants: Number(row.total_participants),
        page: query.page,
        pageSize: query.pageSize,
      };
    });
  }

  async findPublicParticipants(
    identifier: string,
    query: StudentContestParticipantsQuery,
  ): Promise<StudentContestParticipantsPage> {
    const uuid = isUuid(identifier) ? identifier : null;
    const search = query.search ? `%${escapeLike(query.search)}%` : null;

    return this.withReadTransaction(async (client) => {
      const result = await client.query<ContestParticipantsRow>(
        `WITH public_contest AS MATERIALIZED (
           SELECT c.id, c.starts_at, c.ends_at
           FROM public.contests c
           WHERE ${PUBLIC_CONTEST_CONDITION}
             AND (c.id = $1::uuid OR c.slug = $2)
           ORDER BY (c.id = $1::uuid) DESC
           LIMIT 1
         ),
         registered_participants AS MATERIALIZED (
           SELECT participant.user_id,
                  participant.registered_at,
                  account.username,
                  account.avatar_url,
                  CASE
                    WHEN EXISTS (
                      SELECT 1
                      FROM public.submissions submission
                      JOIN public_contest contest
                        ON contest.id = submission.contest_id
                      JOIN public.problems problem
                        ON problem.id = submission.problem_id
                      JOIN public.contest_problems contest_problem
                        ON contest_problem.contest_id = contest.id
                       AND contest_problem.problem_id = problem.id
                      WHERE submission.user_id = participant.user_id
                        AND problem.status = 'PUBLISHED'
                        AND (problem.organization_id IS NULL OR EXISTS (
                          SELECT 1 FROM public.organizations owner
                          WHERE owner.id = problem.organization_id AND owner.status = 'ACTIVE'
                        ))
                        AND public.contest_problem_content_accessible(contest.id, problem.id)
                        AND submission.submitted_at >= contest.starts_at
                        AND submission.submitted_at < contest.ends_at
                    ) THEN 'participated'
                    ELSE 'registered'
                  END AS status
           FROM public.contest_participants participant
           JOIN public_contest contest ON contest.id = participant.contest_id
           JOIN public.users account ON account.id = participant.user_id
           WHERE participant.registration_status = 'REGISTERED'
             AND (contest.ends_at <= CURRENT_TIMESTAMP OR account.is_active = TRUE)
         ),
         filtered AS MATERIALIZED (
           SELECT *
           FROM registered_participants
           WHERE ($3::text IS NULL OR username ILIKE $3 ESCAPE '\\')
             AND ($4::text = 'all' OR status = $4)
         ),
         page_rows AS (
           SELECT *
           FROM filtered
           ORDER BY registered_at ASC, user_id ASC
           LIMIT $5 OFFSET $6
         )
         SELECT EXISTS (SELECT 1 FROM public_contest) AS contest_exists,
                (SELECT COUNT(*)::int FROM filtered) AS total,
                (SELECT COUNT(*)::int FROM registered_participants) AS participant_count,
                COALESCE(
                  (
                    SELECT jsonb_agg(
                      jsonb_build_object(
                        'userId', page.user_id,
                        'username', page.username,
                        'avatarUrl', page.avatar_url,
                        'registeredAt', page.registered_at,
                        'status', page.status
                      )
                      ORDER BY page.registered_at ASC, page.user_id ASC
                    )
                    FROM page_rows page
                  ),
                  '[]'::jsonb
                ) AS items`,
        [
          uuid,
          identifier,
          search,
          query.status,
          query.pageSize,
          (query.page - 1) * query.pageSize,
        ],
      );

      const row = result.rows[0];
      if (!row?.contest_exists) {
        throw new NotFoundException('Không tìm thấy cuộc thi.');
      }

      return {
        items: (row.items ?? []).map((item) => ({
          ...item,
          registeredAt: toIsoString(item.registeredAt),
        })),
        total: Number(row.total),
        participantCount: Number(row.participant_count),
        page: query.page,
        pageSize: query.pageSize,
      };
    });
  }

  async findPublicSubmissions(
    identifier: string,
    query: StudentContestSubmissionsQuery,
    viewerId: string | null,
  ): Promise<StudentContestSubmissionsPage> {
    const uuid = isUuid(identifier) ? identifier : null;
    const search = query.search ? `%${escapeLike(query.search)}%` : null;

    return this.withReadTransaction(async (client) => {
      const result = await client.query<ContestSubmissionsRow>(
        `WITH public_contest AS MATERIALIZED (
           SELECT c.id
           FROM public.contests c
           WHERE ${PUBLIC_CONTEST_CONDITION}
             AND (c.id = $1::uuid OR c.slug = $2)
           ORDER BY (c.id = $1::uuid) DESC
           LIMIT 1
         ),
         contest_submissions AS MATERIALIZED (
           SELECT submission.id,
                  submission.status,
                  submission.submitted_at,
                  submission.user_id,
                  account.username,
                  contest_problem.problem_code_snapshot AS problem_code,
                  contest_problem.problem_title_snapshot AS problem_title,
                  language.name AS language,
                  submission.execution_time_ms,
                  submission.memory_used_kb
           FROM public.submissions submission
           JOIN public_contest contest ON contest.id = submission.contest_id
           JOIN public.problems problem ON problem.id = submission.problem_id
           AND problem.status = 'PUBLISHED'
           AND (problem.organization_id IS NULL OR EXISTS (
             SELECT 1 FROM public.organizations owner
             WHERE owner.id = problem.organization_id AND owner.status = 'ACTIVE'
           ))
           JOIN public.contest_problems contest_problem
             ON contest_problem.contest_id = contest.id
            AND contest_problem.problem_id = submission.problem_id
           JOIN public.users account ON account.id = submission.user_id
           JOIN public.programming_languages language
             ON language.id = submission.language_id
           WHERE public.contest_problem_content_accessible(contest.id, problem.id)
         ),
         filtered AS MATERIALIZED (
           SELECT *
           FROM contest_submissions
           WHERE ($3::text IS NULL OR status = $3)
             AND ($4::text IS NULL OR language = $4)
             AND ($5::text IS NULL
                  OR problem_code ILIKE $5 ESCAPE '\\'
                  OR problem_title ILIKE $5 ESCAPE '\\'
                  OR username ILIKE $5 ESCAPE '\\')
         ),
         page_rows AS (
           SELECT *
           FROM filtered
           ORDER BY submitted_at DESC, id DESC
           LIMIT $6 OFFSET $7
         ),
         status_counts AS (
           SELECT status, COUNT(*)::int AS count
           FROM filtered
           GROUP BY status
         ),
         language_options AS (
           SELECT DISTINCT language
           FROM contest_submissions
           ORDER BY language
         )
         SELECT EXISTS (SELECT 1 FROM public_contest) AS contest_exists,
                (SELECT COUNT(*)::int FROM filtered) AS total,
                COALESCE(
                  (
                    SELECT jsonb_agg(
                      jsonb_build_object(
                        'id', page.id,
                        'status', page.status,
                        'submittedAt', page.submitted_at,
                        'username', page.username,
                        'problemCode', page.problem_code,
                        'problemTitle', page.problem_title,
                        'language', page.language,
                        'executionTimeMs', page.execution_time_ms,
                        'memoryUsedKb', page.memory_used_kb,
                        'canViewDetails', COALESCE(page.user_id = $8::uuid, FALSE)
                      )
                      ORDER BY page.submitted_at DESC, page.id DESC
                    )
                    FROM page_rows page
                  ),
                  '[]'::jsonb
                ) AS items,
                COALESCE(
                  (
                    SELECT jsonb_agg(
                      jsonb_build_object('status', status, 'count', count)
                      ORDER BY status
                    )
                    FROM status_counts
                  ),
                  '[]'::jsonb
                ) AS status_counts,
                COALESCE(
                  (SELECT array_agg(language ORDER BY language) FROM language_options),
                  ARRAY[]::text[]
                ) AS languages`,
        [
          uuid,
          identifier,
          query.status ?? null,
          query.language ?? null,
          search,
          query.pageSize,
          (query.page - 1) * query.pageSize,
          viewerId,
        ],
      );

      const row = result.rows[0];
      if (!row?.contest_exists) {
        throw new NotFoundException('Không tìm thấy cuộc thi.');
      }

      const statusCounts = row.status_counts ?? [];
      const verdictCounts = Object.fromEntries(
        statusCounts.map(({ status, count }) => [status, Number(count)]),
      );
      const total = Number(row.total);
      const accepted = verdictCounts.ACCEPTED ?? 0;
      const items: StudentContestSubmissionItem[] = (row.items ?? []).map((item) => ({
        ...item,
        submittedAt: toIsoString(item.submittedAt),
      }));

      return {
        items,
        total,
        page: query.page,
        pageSize: query.pageSize,
        statistics: {
          total,
          accepted,
          acceptanceRate: total === 0 ? 0 : Math.round((accepted / total) * 1000) / 10,
          verdictCounts,
        },
        filters: { languages: row.languages ?? [] },
      };
    });
  }

  async register(contestId: string, userId: string): Promise<ContestRegistration> {
    return this.withTransaction(async (client) => {
      const contest = await this.lockPublicContest(client, contestId);
      await this.assertBeforeStart(client, contest.id, true);

      const current = await client.query<{
        registration_status: StudentRegistrationStatus;
      }>(
        `SELECT registration_status
         FROM public.contest_participants
         WHERE contest_id = $1 AND user_id = $2
         FOR UPDATE`,
        [contest.id, userId],
      );
      if (current.rows[0]?.registration_status === 'REGISTERED') {
        throw new ConflictException('Bạn đã đăng ký cuộc thi này.');
      }

      const result = current.rows.length > 0
        ? await client.query<RegistrationRow>(
          `UPDATE public.contest_participants participant
           SET registration_status = 'REGISTERED',
               registered_at = clock_timestamp(),
               cancelled_at = NULL
           WHERE participant.contest_id = $1
             AND participant.user_id = $2
             AND participant.registration_status = 'CANCELLED'
             AND EXISTS (
               SELECT 1 FROM public.contests c
               WHERE c.id = participant.contest_id
                 AND c.publication_status = 'PUBLISHED'
                 AND c.visibility = 'PUBLIC'
                 AND c.organization_id IS NULL
                 AND c.allow_registration = TRUE
                 AND c.starts_at > clock_timestamp()
             )
           RETURNING contest_id, registration_status, registered_at`,
          [contest.id, userId],
        )
        : await client.query<RegistrationRow>(
          `INSERT INTO public.contest_participants
             (contest_id, user_id, registered_at, registration_status, cancelled_at)
           SELECT c.id, $2, clock_timestamp(), 'REGISTERED', NULL
           FROM public.contests c
           WHERE c.id = $1
             AND c.publication_status = 'PUBLISHED'
             AND c.visibility = 'PUBLIC'
             AND c.organization_id IS NULL
             AND c.allow_registration = TRUE
             AND c.starts_at > clock_timestamp()
           RETURNING contest_id, registration_status, registered_at`,
          [contest.id, userId],
        );

      const registration = result.rows[0];
      if (!registration) {
        throw new ConflictException('Đăng ký đã đóng hoặc cuộc thi vừa bắt đầu.');
      }
      return mapRegistration(registration);
    });
  }

  async cancel(contestId: string, userId: string): Promise<ContestRegistration> {
    return this.withTransaction(async (client) => {
      const contest = await this.lockPublicContest(client, contestId);
      await this.assertBeforeStart(client, contest.id, false);

      const result = await client.query<RegistrationRow>(
        `UPDATE public.contest_participants participant
         SET registration_status = 'CANCELLED',
             cancelled_at = clock_timestamp()
         WHERE participant.contest_id = $1
           AND participant.user_id = $2
           AND participant.registration_status = 'REGISTERED'
           AND EXISTS (
             SELECT 1 FROM public.contests c
             WHERE c.id = participant.contest_id
               AND c.publication_status = 'PUBLISHED'
               AND c.visibility = 'PUBLIC'
               AND c.organization_id IS NULL
               AND c.starts_at > clock_timestamp()
           )
         RETURNING contest_id, registration_status, registered_at`,
        [contest.id, userId],
      );
      const registration = result.rows[0];
      if (!registration) {
        throw new ConflictException(
          'Không thể hủy đăng ký: bạn chưa đăng ký hoặc cuộc thi đã bắt đầu.',
        );
      }
      return mapRegistration(registration);
    });
  }

  private async lockPublicContest(client: PoolClient, id: string): Promise<{ id: string }> {
    const uuid = isUuid(id) ? id : null;
    const result = await client.query<{ id: string }>(
      `SELECT c.id
       FROM public.contests c
       WHERE (c.id = $1::uuid OR c.slug = $2)
         AND ${PUBLIC_CONTEST_CONDITION}
       ORDER BY (c.id = $1::uuid) DESC
       LIMIT 1
       FOR UPDATE`,
      [uuid, id],
    );
    const contest = result.rows[0];
    if (!contest) throw new NotFoundException('Không tìm thấy cuộc thi.');
    return contest;
  }

  private async assertBeforeStart(
    client: PoolClient,
    contestId: string,
    requireRegistration: boolean,
  ): Promise<void> {
    const result = await client.query<{
      before_start: boolean;
      allow_registration: boolean;
    }>(
      `SELECT starts_at > clock_timestamp() AS before_start,
              allow_registration
       FROM public.contests
       WHERE id = $1 AND organization_id IS NULL`,
      [contestId],
    );
    const row = result.rows[0];
    if (!row?.before_start) {
      throw new ConflictException('Không thể thay đổi đăng ký sau khi cuộc thi bắt đầu.');
    }
    if (requireRegistration && !row.allow_registration) {
      throw new ConflictException('Cuộc thi hiện không cho phép đăng ký.');
    }
  }

  private async loadPublicProblems(
    client: Pick<PoolClient, 'query'>,
    contestId: string,
  ): Promise<StudentContestProblem[]> {
    const result = await client.query<ProblemRow>(
      `SELECT cp.problem_id, cp.problem_code_snapshot, cp.problem_title_snapshot, cp.position, cp.max_score
       FROM public.contest_problems cp
       JOIN public.problems p ON p.id = cp.problem_id
       WHERE cp.contest_id = $1
         AND p.status = 'PUBLISHED'
         AND (p.organization_id IS NULL OR EXISTS (
           SELECT 1 FROM public.organizations owner
           WHERE owner.id = p.organization_id AND owner.status = 'ACTIVE'
         ))
         AND public.contest_problem_content_accessible(cp.contest_id, cp.problem_id)
       ORDER BY cp.position ASC`,
      [contestId],
    );
    return result.rows.map((row) => ({
      problemId: row.problem_id,
      problemCode: row.problem_code_snapshot,
      problemTitle: row.problem_title_snapshot,
      position: row.position,
      maxScore: Number(row.max_score),
    }));
  }

  private async withReadTransaction<T>(
    operation: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    return this.withTransaction(operation, 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  }

  private async withTransaction<T>(
    operation: (client: PoolClient) => Promise<T>,
    beginStatement = 'BEGIN',
  ): Promise<T> {
    const client = await this.database.connect();
    try {
      await client.query(beginStatement);
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

type RegistrationRow = {
  contest_id: string;
  registration_status: StudentRegistrationStatus;
  registered_at: Date | string;
};

function mapListItem(row: PublicContestRow): StudentContestListItem {
  const startsAt = toIsoString(row.starts_at);
  const endsAt = toIsoString(row.ends_at);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    startsAt,
    endsAt,
    timeStatus: row.time_status,
    allowRegistration: row.allow_registration,
    canRegister: row.can_register,
    isRegistered: row.is_registered ?? false,
    participantCount: Number(row.participant_count),
  };
}

function mapRegistration(row: RegistrationRow): ContestRegistration {
  return {
    contestId: row.contest_id,
    registrationStatus: row.registration_status,
    registeredAt: toIsoString(row.registered_at),
  };
}

function mapLeaderboardEntry(
  row: NonNullable<ContestLeaderboardRow['items']>[number],
): StudentContestLeaderboardEntry {
  return {
    rank: Number(row.rank),
    userId: row.userId,
    username: row.username,
    avatarUrl: row.avatarUrl,
    totalScore: Number(row.totalScore),
    acceptedProblems: Number(row.acceptedProblems),
    totalProblems: Number(row.totalProblems),
    elapsedSeconds: row.elapsedSeconds === null ? null : Number(row.elapsedSeconds),
  };
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
