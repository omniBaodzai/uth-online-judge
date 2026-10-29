import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Pool, type PoolClient } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';
import { testCaseFingerprint } from '../scoring/test-case-fingerprint.js';
import {
  buildGlobalStatistics,
  escapeLikePattern,
  type GlobalSubmissionItem,
  type GlobalSubmissionPage,
  type GlobalSubmissionQuery,
} from './global-submissions.js';

export interface CreatedSubmission {
  id: string;
  status: string;
  submittedAt: string;
}

export interface TestResultView {
  position: number;
  status: string | null;
  executionTimeMs: number | null;
  memoryUsedKb: number | null;
  pointsAwarded: number;
  maxPoints: number;
}

export interface SubmissionView {
  id: string;
  problemCode: string;
  problemTitle: string;
  username: string | null;
  language: string;
  sourceCode: string;
  status: string;
  scoringEnabled: boolean;
  score: number;
  maxScore: number;
  cumulativeScore: number;
  cumulativeMaxScore: number;
  executionTimeMs: number | null;
  memoryUsedKb: number | null;
  submittedAt: string;
  judgedAt: string | null;
  testResults: TestResultView[];
}

export interface ProblemSubmissionListItem {
  id: string;
  status: string;
  language: string;
  scoringEnabled: boolean;
  score: number | null;
  maxScore: number | null;
  executionTimeMs: number | null;
  memoryUsedKb: number | null;
  submittedAt: string;
}

export interface ProblemSubmissionStatistics {
  total: number;
  accepted: number;
  wrongAnswer: number;
  compilationError: number;
  acceptanceRate: number;
  verdictCounts: Record<string, number>;
  languages: string[];
}

export interface ProblemSubmissionPage {
  problem: {
    code: string;
    title: string;
    scoringEnabled: boolean;
    cumulativeScore: number;
    totalTestCases: number;
  };
  items: ProblemSubmissionListItem[];
  total: number;
  statistics: ProblemSubmissionStatistics;
}

interface GlobalSubmissionRow {
  id: string;
  status: string;
  submitted_at: string;
  username: string | null;
  problem_code: string;
  problem_title: string;
  language: string;
  execution_time_ms: number | null;
  memory_used_kb: number | null;
  is_owner: boolean;
}

@Injectable()
export class SubmissionsRepository {
  constructor(
    @Inject(DATABASE_POOL)
    private readonly database: Pool,
  ) {}

  private async findCumulativeProgress(
    userId: string,
    problemId: string,
  ): Promise<{ score: number; total: number }> {
    const testCases = await this.database.query<{
      id: string;
      input_data: string;
      expected_output: string;
    }>(
      `SELECT id, input_data, expected_output
       FROM problem_test_cases
       WHERE problem_id = $1 AND is_active = TRUE`,
      [problemId],
    );
    if (testCases.rows.length === 0) return { score: 0, total: 0 };

    const currentCases = testCases.rows.map((testCase) => ({
      id: testCase.id,
      fingerprint: testCaseFingerprint(
        testCase.input_data,
        testCase.expected_output,
      ),
    }));
    const progress = await this.database.query<{ score: number }>(
      `SELECT COUNT(DISTINCT candidate.test_case_id)::int AS score
       FROM unnest($3::uuid[], $4::text[]) AS candidate(test_case_id, content_fingerprint)
       JOIN student_test_case_progress passed
         ON passed.test_case_id = candidate.test_case_id
        AND passed.content_fingerprint = candidate.content_fingerprint
       WHERE passed.user_id = $1 AND passed.problem_id = $2`,
      [
        userId,
        problemId,
        currentCases.map(({ id }) => id),
        currentCases.map(({ fingerprint }) => fingerprint),
      ],
    );
    return {
      score: Number(progress.rows[0]?.score ?? 0),
      total: currentCases.length,
    };
  }

  async findPublishedProblemId(code: string): Promise<string | null> {
    const result = await this.database.query<{ id: string }>(
      "SELECT id FROM problems WHERE problem_code = $1 AND status = 'PUBLISHED'",
      [code],
    );
    return result.rows[0]?.id ?? null;
  }

  // Ngôn ngữ phải được bật và nằm trong danh sách cho phép của chính bài tập này.
  async findAllowedLanguageId(
    problemId: string,
    slug: string,
  ): Promise<string | null> {
    const result = await this.database.query<{ id: string }>(
      `SELECT l.id
       FROM programming_languages l
       JOIN problem_languages pl ON pl.language_id = l.id
       WHERE pl.problem_id = $1 AND l.slug = $2 AND l.is_enabled = TRUE`,
      [problemId, slug],
    );
    return result.rows[0]?.id ?? null;
  }

  // Capture the active tests and limits in the same transaction as the submission.
  async insert(input: {
    userId: string;
    problemId: string;
    languageId: string;
    sourceCode: string;
  }): Promise<CreatedSubmission> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      await lockPublishedProblem(client, input.problemId);
      const result = await client.query<{
        id: string;
        status: string;
        submitted_at: Date;
      }>(
        `INSERT INTO submissions
           (user_id, problem_id, language_id, source_code, max_score, scoring_enabled)
         SELECT $1, p.id, $3, $4,
                (SELECT COUNT(*) FROM problem_test_cases tc
                 WHERE tc.problem_id = p.id AND tc.is_active = TRUE),
                TRUE
         FROM problems p
         JOIN problem_languages pl ON pl.problem_id = p.id AND pl.language_id = $3
         JOIN programming_languages l ON l.id = pl.language_id AND l.is_enabled = TRUE
         WHERE p.id = $2 AND p.status = 'PUBLISHED'
         RETURNING id, status, submitted_at`,
        [input.userId, input.problemId, input.languageId, input.sourceCode],
      );
      const row = result.rows[0];
      if (!row)
        throw new BadRequestException(
          'Bài tập không còn được phép nhận bài nộp.',
        );

      const snapshots = await client.query(
        `INSERT INTO submission_test_case_snapshots
           (submission_id, source_test_case_id, test_name, input_data, expected_output,
            points, position, time_limit_ms, memory_limit_kb)
         SELECT $1, tc.id, tc.test_name, tc.input_data, tc.expected_output,
                1,
                tc.position, p.time_limit_ms, p.memory_limit_mb * 1024
         FROM problem_test_cases tc
         JOIN problems p ON p.id = tc.problem_id
         WHERE tc.problem_id = $2 AND tc.is_active = TRUE
         ORDER BY tc.position`,
        [row.id, input.problemId],
      );
      if (snapshots.rowCount === 0) {
        throw new BadRequestException(
          'Bài tập chưa có test case đang hoạt động.',
        );
      }

      await client.query('COMMIT');
      return {
        id: row.id,
        status: row.status,
        submittedAt: row.submitted_at.toISOString(),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async markQueued(id: string): Promise<void> {
    await this.database.query(
      `UPDATE submissions SET status = 'QUEUED'
       WHERE id = $1 AND status = 'PENDING'`,
      [id],
    );
  }

  // Điều kiện user_id nằm ngay trong truy vấn: bài nộp của người khác coi như không tồn tại.
  async findOwned(id: string, userId: string): Promise<SubmissionView | null> {
    const submission = await this.database.query<{
      id: string;
      user_id: string;
      problem_id: string;
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
    }>(
      `SELECT s.id, s.user_id, s.problem_id, p.problem_code, p.title AS problem_title, u.username,
              l.name AS language,
              s.source_code, s.status, s.scoring_enabled, s.score, s.max_score,
              s.execution_time_ms, s.memory_used_kb, s.submitted_at, s.judged_at
       FROM submissions s
       JOIN problems p ON p.id = s.problem_id
       JOIN programming_languages l ON l.id = s.language_id
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1 AND s.user_id = $2`,
      [id, userId],
    );
    const row = submission.rows[0];
    if (!row) return null;

    // Không chọn error_message, input_data hay expected_output của test case.
    const results = await this.database.query<{
      position: number;
      status: string | null;
      execution_time_ms: number | null;
      memory_used_kb: number | null;
      points_awarded: string | null;
      max_points: string;
    }>(
      `SELECT snapshot.position, r.status, r.execution_time_ms, r.memory_used_kb,
              r.points_awarded, snapshot.points AS max_points
       FROM submission_test_case_snapshots snapshot
       LEFT JOIN submission_test_results r
         ON r.snapshot_id = snapshot.id AND r.submission_id = snapshot.submission_id
       WHERE snapshot.submission_id = $1
       ORDER BY snapshot.position`,
      [id],
    );
    const cumulative = await this.findCumulativeProgress(
      row.user_id,
      row.problem_id,
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
      cumulativeScore: cumulative.score,
      cumulativeMaxScore: cumulative.total,
      executionTimeMs: row.execution_time_ms,
      memoryUsedKb: row.memory_used_kb,
      submittedAt: row.submitted_at.toISOString(),
      judgedAt: row.judged_at?.toISOString() ?? null,
      testResults: results.rows.map((result) => ({
        position: result.position,
        status: result.status,
        executionTimeMs: result.execution_time_ms,
        memoryUsedKb: result.memory_used_kb,
        pointsAwarded: row.scoring_enabled
          ? Number(result.points_awarded ?? 0)
          : 0,
        maxPoints: row.scoring_enabled ? Number(result.max_points) : 0,
      })),
    };
  }

  // Chỉ bài nộp của bài tập đã PUBLISHED mới xuất hiện; không bao giờ trả mã nguồn,
  // test ẩn, judge0_token hay thông tin cá nhân ngoài username.
  async findGlobalSubmissions(
    viewerId: string | null,
    query: GlobalSubmissionQuery,
  ): Promise<GlobalSubmissionPage | null> {
    let problem: { code: string; title: string } | null = null;
    if (query.problemCode) {
      const found = await this.database.query<{
        problem_code: string;
        title: string;
      }>(
        `SELECT problem_code, title FROM problems
         WHERE UPPER(problem_code) = UPPER($1) AND status = 'PUBLISHED'`,
        [query.problemCode],
      );
      const row = found.rows[0];
      if (!row) return null;
      problem = { code: row.problem_code, title: row.title };
    }

    const search = query.q ? `%${escapeLikePattern(query.q)}%` : null;
    const offset = (query.page - 1) * query.pageSize;
    const problemCode = problem?.code ?? null;

    const [listResult, statisticsResult, languagesResult] = await Promise.all([
      this.database.query<{ items: GlobalSubmissionRow[]; total: number }>(
        `WITH filtered AS (
           SELECT s.id, s.status, s.submitted_at, s.user_id, u.username,
                  p.problem_code, p.title AS problem_title, l.name AS language,
                  s.execution_time_ms, s.memory_used_kb
           FROM submissions s
           JOIN problems p ON p.id = s.problem_id AND p.status = 'PUBLISHED'
           JOIN users u ON u.id = s.user_id
           JOIN programming_languages l ON l.id = s.language_id
           WHERE ($1::text IS NULL OR s.status = $1)
             AND ($2::text IS NULL OR l.name = $2)
             AND ($7::text IS NULL OR p.problem_code = $7)
             AND ($3::text IS NULL
                  OR p.problem_code ILIKE $3 ESCAPE '\\'
                  OR p.title ILIKE $3 ESCAPE '\\'
                  OR u.username ILIKE $3 ESCAPE '\\')
         ),
         page_rows AS (
           SELECT * FROM filtered
           ORDER BY submitted_at DESC, id DESC
           LIMIT $4 OFFSET $5
         )
         SELECT
           COALESCE(
             (SELECT json_agg(
                json_build_object(
                  'id', id, 'status', status, 'submitted_at', submitted_at,
                  'username', username, 'problem_code', problem_code,
                  'problem_title', problem_title, 'language', language,
                  'execution_time_ms', execution_time_ms,
                  'memory_used_kb', memory_used_kb,
                  'is_owner', COALESCE(user_id = $6::uuid, FALSE)
                ) ORDER BY submitted_at DESC, id DESC)
              FROM page_rows),
             '[]'::json
           ) AS items,
           (SELECT COUNT(*)::int FROM filtered) AS total`,
        [
          query.status ?? null,
          query.language ?? null,
          search,
          query.pageSize,
          offset,
          viewerId,
          problemCode,
        ],
      ),
      this.database.query<{ status: string; count: number }>(
        `SELECT s.status, COUNT(*)::int AS count
         FROM submissions s
         JOIN problems p ON p.id = s.problem_id AND p.status = 'PUBLISHED'
         WHERE ($1::text IS NULL OR p.problem_code = $1)
         GROUP BY s.status`,
        [problemCode],
      ),
      this.database.query<{ name: string }>(
        `SELECT DISTINCT l.name
         FROM submissions s
         JOIN problems p ON p.id = s.problem_id AND p.status = 'PUBLISHED'
         JOIN programming_languages l ON l.id = s.language_id
         WHERE ($1::text IS NULL OR p.problem_code = $1)
         ORDER BY l.name`,
        [problemCode],
      ),
    ]);

    const list = listResult.rows[0];
    if (!list) throw new Error('Không thể tải danh sách bài nộp.');

    const items: GlobalSubmissionItem[] = list.items.map((row) => ({
      id: row.id,
      status: row.status,
      submittedAt: row.submitted_at,
      username: row.username,
      problemCode: row.problem_code,
      problemTitle: row.problem_title,
      language: row.language,
      executionTimeMs: row.execution_time_ms,
      memoryUsedKb: row.memory_used_kb,
      canViewDetails: row.is_owner,
    }));

    return {
      items,
      total: Number(list.total),
      page: query.page,
      pageSize: query.pageSize,
      statistics: buildGlobalStatistics(statisticsResult.rows),
      filters: { languages: languagesResult.rows.map((row) => row.name) },
      problem,
    };
  }

  async findProblemSubmissions(
    userId: string,
    problemCode: string,
    page: number,
    pageSize: number,
    status?: string,
    language?: string,
  ): Promise<ProblemSubmissionPage | null> {
    const problemResult = await this.database.query<{
      id: string;
      problem_code: string;
      title: string;
      scoring_enabled: boolean;
    }>(
      `SELECT id, problem_code, title, scoring_enabled
       FROM problems
       WHERE UPPER(problem_code) = UPPER($1) AND status = 'PUBLISHED'`,
      [problemCode],
    );
    const problem = problemResult.rows[0];
    if (!problem) return null;
    const cumulative = await this.findCumulativeProgress(userId, problem.id);

    const offset = (page - 1) * pageSize;
    const [listResult, statisticsResult] = await Promise.all([
      this.database.query<{
        items: Array<{
          id: string;
          status: string;
          language: string;
          scoring_enabled: boolean;
          score: number;
          max_score: number;
          execution_time_ms: number | null;
          memory_used_kb: number | null;
          submitted_at: string;
        }>;
        total: number;
      }>(
        `WITH filtered AS (
           SELECT s.id, s.status, l.name AS language, s.scoring_enabled,
                  s.score, s.max_score, s.execution_time_ms, s.memory_used_kb,
                  s.submitted_at
           FROM submissions s
           JOIN programming_languages l ON l.id = s.language_id
           WHERE s.problem_id = $1 AND s.user_id = $2
             AND ($3::text IS NULL OR s.status = $3)
             AND ($4::text IS NULL OR l.name = $4)
         ),
         page_rows AS (
           SELECT * FROM filtered
           ORDER BY submitted_at DESC, id DESC
           LIMIT $5 OFFSET $6
         )
         SELECT
           COALESCE(
             (SELECT json_agg(to_jsonb(page_rows) ORDER BY submitted_at DESC, id DESC)
              FROM page_rows),
             '[]'::json
           ) AS items,
           (SELECT COUNT(*)::int FROM filtered) AS total`,
        [
          problem.id,
          userId,
          status ?? null,
          language ?? null,
          pageSize,
          offset,
        ],
      ),
      this.database.query<{
        total: number;
        accepted: number;
        wrong_answer: number;
        compilation_error: number;
        verdict_counts: Record<string, number>;
        languages: string[];
      }>(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE s.status = 'ACCEPTED')::int AS accepted,
                COUNT(*) FILTER (WHERE s.status = 'WRONG_ANSWER')::int AS wrong_answer,
                COUNT(*) FILTER (WHERE s.status = 'COMPILATION_ERROR')::int AS compilation_error,
                COALESCE(
                  (SELECT json_object_agg(status, status_count)
                   FROM (
                     SELECT counted.status, COUNT(*)::int AS status_count
                     FROM submissions counted
                     JOIN programming_languages counted_language
                       ON counted_language.id = counted.language_id
                     WHERE counted.problem_id = $1 AND counted.user_id = $2
                     GROUP BY counted.status
                   ) counts),
                  '{}'::json
                ) AS verdict_counts,
                COALESCE(
                  ARRAY_AGG(DISTINCT l.name ORDER BY l.name),
                  ARRAY[]::text[]
                ) AS languages
         FROM submissions s
         JOIN programming_languages l ON l.id = s.language_id
         WHERE s.problem_id = $1 AND s.user_id = $2`,
        [problem.id, userId],
      ),
    ]);

    const list = listResult.rows[0];
    const statistics = statisticsResult.rows[0];
    if (!list || !statistics) {
      throw new Error('Không thể tải danh sách bài nộp.');
    }

    const total = Number(statistics.total);
    const accepted = Number(statistics.accepted);

    return {
      problem: {
        code: problem.problem_code,
        title: problem.title,
        scoringEnabled: problem.scoring_enabled,
        cumulativeScore: cumulative.score,
        totalTestCases: cumulative.total,
      },
      items: list.items.map((item) => ({
        id: item.id,
        status: item.status,
        language: item.language,
        scoringEnabled: item.scoring_enabled,
        score: item.scoring_enabled ? Number(item.score) : null,
        maxScore: item.scoring_enabled ? Number(item.max_score) : null,
        executionTimeMs: item.execution_time_ms,
        memoryUsedKb: item.memory_used_kb,
        submittedAt: item.submitted_at,
      })),
      total: Number(list.total),
      statistics: {
        total,
        accepted,
        wrongAnswer: Number(statistics.wrong_answer),
        compilationError: Number(statistics.compilation_error),
        acceptanceRate:
          total === 0 ? 0 : Math.round((accepted / total) * 1000) / 10,
        verdictCounts: Object.fromEntries(
          Object.entries(statistics.verdict_counts).map(([status, count]) => [
            status,
            Number(count),
          ]),
        ),
        languages: statistics.languages,
      },
    };
  }
}

async function lockPublishedProblem(
  client: Pick<PoolClient, 'query'>,
  problemId: string,
): Promise<void> {
  const published = await client.query(
    "SELECT id FROM problems WHERE id = $1 AND status = 'PUBLISHED' FOR SHARE",
    [problemId],
  );
  if (!published.rowCount) {
    throw new BadRequestException('Bài tập không còn được phép nhận bài nộp.');
  }
}
