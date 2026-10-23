import { Inject, Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';
import type { Judge0Verdict } from '../judge0/judge0.types.js';

export interface JudgingContext {
  sourceCode: string;
  judge0LanguageId: number;
  scoringEnabled: boolean;
  maxScore: number;
  testCases: JudgingTestCase[];
}

export interface JudgingTestCase {
  id: string;
  snapshotId: string;
  name: string | null;
  position: number;
  input: string;
  expectedOutput: string;
  points: number;
  cpuTimeLimitSeconds: number;
  memoryLimitKb: number;
  existingResult?: Omit<PersistedTestResult, 'testCase'>;
}

export interface PersistedTestResult {
  testCase: JudgingTestCase;
  verdict: Judge0Verdict;
  executionTimeMs: number | null;
  memoryUsedKb: number | null;
  pointsAwarded: number;
}

@Injectable()
export class JudgingRepository {
  private readonly logger = new Logger(JudgingRepository.name);

  constructor(@Inject(DATABASE_POOL) private readonly database: Pool) {}

  async findRecoverableIds(afterId: string | null, limit: number): Promise<string[]> {
    const result = await this.database.query<{ id: string }>(
      `SELECT s.id
       FROM submissions s
       WHERE s.status IN ('PENDING', 'QUEUED')
         AND ($1::uuid IS NULL OR s.id > $1::uuid)
         AND EXISTS (
           SELECT 1
           FROM submission_test_case_snapshots snapshot
           WHERE snapshot.submission_id = s.id
         )
       ORDER BY s.id
       LIMIT $2`,
      [afterId, limit],
    );
    return result.rows.map((row) => row.id);
  }

  async markQueued(submissionId: string): Promise<void> {
    await this.database.query(
      `UPDATE submissions SET status = 'QUEUED'
       WHERE id = $1 AND status = 'PENDING'`,
      [submissionId],
    );
  }

  async claim(submissionId: string, isRetry: boolean): Promise<boolean> {
    const result = await this.database.query(
      `UPDATE submissions
       SET status = 'RUNNING', error_message = NULL
       WHERE id = $1 AND (
         status IN ('PENDING', 'QUEUED')
         OR ($2 = TRUE AND status = 'RUNNING' AND judged_at IS NULL)
       )`,
      [submissionId, isRetry],
    );
    return result.rowCount === 1;
  }

  async loadContext(submissionId: string): Promise<JudgingContext | null> {
    const startedAt = performance.now();
    const submission = await this.database.query<{
      source_code: string;
      judge0_language_id: number;
      scoring_enabled: boolean;
      max_score: string;
    }>(
      `SELECT s.source_code, l.judge0_language_id, s.scoring_enabled, s.max_score
       FROM submissions s
       JOIN programming_languages l ON l.id = s.language_id
       WHERE s.id = $1 AND s.status = 'RUNNING'`,
      [submissionId],
    );
    const row = submission.rows[0];
    if (!row) return null;

    const casesStartedAt = performance.now();
    const cases = await this.database.query<{
      source_test_case_id: string;
      snapshot_id: string;
      test_name: string | null;
      position: number;
      input_data: string;
      expected_output: string;
      points: string;
      time_limit_ms: number;
      memory_limit_kb: number;
      result_status: Judge0Verdict | null;
      result_execution_time_ms: number | null;
      result_memory_used_kb: number | null;
      result_points_awarded: string | null;
    }>(
      `SELECT snapshot.source_test_case_id, snapshot.id AS snapshot_id,
              snapshot.test_name, snapshot.position, snapshot.input_data,
              snapshot.expected_output, snapshot.points,
              snapshot.time_limit_ms, snapshot.memory_limit_kb,
              result.status AS result_status,
              result.execution_time_ms AS result_execution_time_ms,
              result.memory_used_kb AS result_memory_used_kb,
              result.points_awarded::text AS result_points_awarded
       FROM submission_test_case_snapshots snapshot
       LEFT JOIN submission_test_results result
         ON result.submission_id = snapshot.submission_id
        AND result.test_case_id = snapshot.source_test_case_id
       WHERE snapshot.submission_id = $1
       ORDER BY snapshot.position, snapshot.id`,
      [submissionId],
    );
    this.logger.log(
      `Judging context loaded submission=${submissionId} testCases=${cases.rowCount ?? 0} dbMs=${Math.round(performance.now() - startedAt)} casesQueryMs=${Math.round(performance.now() - casesStartedAt)}`,
    );

    return {
      sourceCode: row.source_code,
      judge0LanguageId: row.judge0_language_id,
      scoringEnabled: row.scoring_enabled,
      maxScore: Number(row.max_score),
      testCases: cases.rows.map((testCase) => {
        const existingResult = testCase.result_status
          ? {
            verdict: testCase.result_status,
            executionTimeMs: testCase.result_execution_time_ms,
            memoryUsedKb: testCase.result_memory_used_kb,
            pointsAwarded: Number(testCase.result_points_awarded ?? 0),
          }
          : undefined;
        return {
          id: testCase.source_test_case_id,
          snapshotId: testCase.snapshot_id,
          name: testCase.test_name,
          position: testCase.position,
          input: testCase.input_data,
          expectedOutput: testCase.expected_output,
          points: Number(testCase.points),
          cpuTimeLimitSeconds: testCase.time_limit_ms / 1000,
          memoryLimitKb: testCase.memory_limit_kb,
          ...(existingResult ? { existingResult } : {}),
        };
      }),
    };
  }

  async persistTestResult(submissionId: string, result: PersistedTestResult): Promise<void> {
    await this.persistTestResults(submissionId, [result]);
  }

  async persistTestResults(submissionId: string, results: PersistedTestResult[]): Promise<void> {
    if (results.length === 0) return;
    const startedAt = performance.now();
    const values: Array<string | number | null> = [];
    const tuples = results.map(({ testCase, verdict, executionTimeMs, memoryUsedKb, pointsAwarded }) => {
      const firstParameter = values.length + 1;
      values.push(
        submissionId,
        testCase.id,
        testCase.snapshotId,
        verdict,
        executionTimeMs,
        memoryUsedKb,
        pointsAwarded,
      );
      return `($${firstParameter}, $${firstParameter + 1}, $${firstParameter + 2}, $${firstParameter + 3}, $${firstParameter + 4}, $${firstParameter + 5}, $${firstParameter + 6})`;
    });
    await this.database.query(
      `INSERT INTO submission_test_results
         (submission_id, test_case_id, snapshot_id, status, execution_time_ms,
          memory_used_kb, points_awarded)
       VALUES ${tuples.join(', ')}
       ON CONFLICT (submission_id, test_case_id)
       DO UPDATE SET snapshot_id = EXCLUDED.snapshot_id,
                     status = EXCLUDED.status,
                     execution_time_ms = EXCLUDED.execution_time_ms,
                     memory_used_kb = EXCLUDED.memory_used_kb,
                     points_awarded = EXCLUDED.points_awarded`,
      values,
    );
    this.logger.log(
      `Judging results persisted submission=${submissionId} count=${results.length} dbMs=${Math.round(performance.now() - startedAt)}`,
    );
  }

  async persistUnjudgedTestResults(submissionId: string): Promise<void> {
    await this.database.query(
      `INSERT INTO submission_test_results
         (submission_id, test_case_id, snapshot_id, status, execution_time_ms,
          memory_used_kb, points_awarded)
       SELECT snapshot.submission_id, snapshot.source_test_case_id, snapshot.id,
              'INTERNAL_ERROR', NULL, NULL, 0
       FROM submission_test_case_snapshots snapshot
       LEFT JOIN submission_test_results result
         ON result.submission_id = snapshot.submission_id
        AND result.test_case_id = snapshot.source_test_case_id
       WHERE snapshot.submission_id = $1
         AND result.submission_id IS NULL
       ON CONFLICT (submission_id, test_case_id) DO NOTHING`,
      [submissionId],
    );
  }

  async persistFinalResult(submissionId: string, failed = false): Promise<void> {
    const startedAt = performance.now();
    await this.database.query(
      `WITH totals AS (
         SELECT
           COALESCE(SUM(points_awarded), 0) AS score,
           SUM(execution_time_ms) AS execution_time_ms,
           MAX(memory_used_kb) AS memory_used_kb
         FROM submission_test_results
         WHERE submission_id = $1
       ), first_failure AS (
         SELECT status
         FROM submission_test_results
         WHERE submission_id = $1 AND status <> 'ACCEPTED'
         ORDER BY (SELECT snapshot.position FROM submission_test_case_snapshots snapshot
                   WHERE snapshot.id = submission_test_results.snapshot_id)
         LIMIT 1
       )
       UPDATE submissions s
       SET status = CASE WHEN $2::boolean THEN 'INTERNAL_ERROR'
                         ELSE COALESCE((SELECT status FROM first_failure), 'ACCEPTED') END,
           score = CASE WHEN s.scoring_enabled THEN totals.score ELSE 0 END,
           execution_time_ms = totals.execution_time_ms,
           memory_used_kb = totals.memory_used_kb,
           error_message = CASE WHEN $2::boolean THEN 'Judging could not be completed.' ELSE NULL END,
           judged_at = CURRENT_TIMESTAMP
       FROM totals
       WHERE s.id = $1 AND s.status = 'RUNNING'
       RETURNING s.status, s.score, s.execution_time_ms, s.memory_used_kb`,
      [submissionId, failed],
    );
    this.logger.log(
      `Judging finalized submission=${submissionId} failed=${failed} dbMs=${Math.round(performance.now() - startedAt)}`,
    );
    // A duplicate failed event may arrive after this submission is already terminal.
  }
}
