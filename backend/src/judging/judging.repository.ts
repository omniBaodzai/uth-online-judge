import { Inject, Injectable, Logger } from '@nestjs/common';
import { Pool, type PoolClient } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';
import { Judge0Verdict } from '../judge0/judge0.types.js';
import { testCaseFingerprint } from '../scoring/test-case-fingerprint.js';

export interface JudgingContext {
  sourceCode: string;
  judge0LanguageId: number;
  scoringEnabled: boolean;
  maxScore: number;
  hasSnapshots: boolean;
  compilationFailed: boolean;
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
  private readonly claimClients = new Map<string, PoolClient>();

  constructor(@Inject(DATABASE_POOL) private readonly database: Pool) {}

  async findRecoverableIds(
    afterId: string | null,
    limit: number,
  ): Promise<string[]> {
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
    const client = await this.database.connect();
    let lockAcquired = false;
    try {
      await client.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [
        submissionId,
      ]);
      lockAcquired = true;

      const result = await client.query(
        `UPDATE submissions
         SET status = 'RUNNING', error_message = NULL
         WHERE id = $1 AND (
           status IN ('PENDING', 'QUEUED')
           OR ($2 = TRUE AND status = 'RUNNING' AND judged_at IS NULL)
         )`,
        [submissionId, isRetry],
      );
      if (result.rowCount !== 1) {
        const unlock = await client.query<{ released: boolean }>(
          'SELECT pg_advisory_unlock(hashtextextended($1, 0)) AS released',
          [submissionId],
        );
        if (unlock.rows[0]?.released !== true) {
          throw new Error(
            `Could not release unsuccessful judging claim for ${submissionId}.`,
          );
        }
        lockAcquired = false;
        client.release();
        return false;
      }

      this.claimClients.set(submissionId, client);
      return true;
    } catch (error) {
      let destroyConnection = !lockAcquired;
      if (lockAcquired) {
        try {
          const unlock = await client.query<{ released: boolean }>(
            'SELECT pg_advisory_unlock(hashtextextended($1, 0)) AS released',
            [submissionId],
          );
          destroyConnection = unlock.rows[0]?.released !== true;
        } catch {
          destroyConnection = true;
        }
      }
      client.release(
        destroyConnection
          ? error instanceof Error
            ? error
            : new Error(String(error))
          : undefined,
      );
      throw error;
    }
  }

  async releaseClaim(submissionId: string): Promise<void> {
    const client = this.claimClients.get(submissionId);
    if (!client) return;
    this.claimClients.delete(submissionId);

    let releaseError: unknown;
    try {
      const result = await client.query<{ released: boolean }>(
        'SELECT pg_advisory_unlock(hashtextextended($1, 0)) AS released',
        [submissionId],
      );
      if (result.rows[0]?.released !== true) {
        throw new Error(`Could not release judging claim for ${submissionId}.`);
      }
    } catch (error) {
      releaseError = error;
    } finally {
      client.release(releaseError instanceof Error ? releaseError : undefined);
    }
    if (releaseError) throw releaseError;
  }

  async loadContext(
    submissionId: string,
    limit: number,
    afterPosition: number | null = null,
    testCaseIds?: string[],
  ): Promise<JudgingContext | null> {
    const startedAt = performance.now();
    const submission = await this.database.query<{
      source_code: string;
      judge0_language_id: number;
      scoring_enabled: boolean;
      max_score: string;
      has_snapshots: boolean;
      compilation_failed: boolean;
    }>(
      `SELECT s.source_code, l.judge0_language_id, s.scoring_enabled, s.max_score,
                EXISTS (
                  SELECT 1 FROM submission_test_case_snapshots snapshot
                  WHERE snapshot.submission_id = s.id
                ) AS has_snapshots,
                EXISTS (
                  SELECT 1 FROM submission_test_results result
                  WHERE result.submission_id = s.id
                    AND result.status = 'COMPILATION_ERROR'
                ) AS compilation_failed
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
         AND (
           (
             $3::uuid[] IS NULL
             AND ($2::integer IS NULL OR snapshot.position > $2)
             AND result.submission_id IS NULL
           )
           OR snapshot.source_test_case_id = ANY($3::uuid[])
         )
       ORDER BY snapshot.position, snapshot.id
       LIMIT CASE
         WHEN $3::uuid[] IS NULL THEN $4
         ELSE cardinality($3::uuid[])
       END`,
      [submissionId, afterPosition, testCaseIds ?? null, limit],
    );
    this.logger.log(
      `Judging context loaded submission=${submissionId} testCases=${cases.rowCount ?? 0} dbMs=${Math.round(performance.now() - startedAt)} casesQueryMs=${Math.round(performance.now() - casesStartedAt)}`,
    );

    return {
      sourceCode: row.source_code,
      judge0LanguageId: row.judge0_language_id,
      scoringEnabled: row.scoring_enabled,
      maxScore: Number(row.max_score),
      hasSnapshots: row.has_snapshots,
      compilationFailed: row.compilation_failed,
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

  async persistTestResult(
    submissionId: string,
    result: PersistedTestResult,
  ): Promise<void> {
    await this.persistTestResults(submissionId, [result]);
  }

  async persistTestResults(
    submissionId: string,
    results: PersistedTestResult[],
  ): Promise<void> {
    if (results.length === 0) return;
    const startedAt = performance.now();
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const running = await client.query(
        `SELECT id FROM submissions
         WHERE id = $1 AND status = 'RUNNING'
         FOR SHARE`,
        [submissionId],
      );
      if (!running.rowCount) {
        await client.query('COMMIT');
        return;
      }

      const values: Array<string | number | null> = [];
      const tuples = results.map(
        ({
          testCase,
          verdict,
          executionTimeMs,
          memoryUsedKb,
          pointsAwarded,
        }) => {
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
        },
      );
      await client.query(
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
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    this.logger.log(
      `Judging results persisted submission=${submissionId} count=${results.length} dbMs=${Math.round(performance.now() - startedAt)}`,
    );
  }

  async persistUnjudgedTestResults(
    submissionId: string,
    verdict: Judge0Verdict = Judge0Verdict.InternalError,
  ): Promise<void> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const running = await client.query(
        `SELECT id FROM submissions
         WHERE id = $1 AND status = 'RUNNING'
         FOR SHARE`,
        [submissionId],
      );
      if (!running.rowCount) {
        await client.query('COMMIT');
        return;
      }
      await client.query(
        `INSERT INTO submission_test_results
         (submission_id, test_case_id, snapshot_id, status, execution_time_ms,
          memory_used_kb, points_awarded)
       SELECT snapshot.submission_id, snapshot.source_test_case_id, snapshot.id,
              $2, NULL, NULL, 0
       FROM submission_test_case_snapshots snapshot
       LEFT JOIN submission_test_results result
         ON result.submission_id = snapshot.submission_id
        AND result.test_case_id = snapshot.source_test_case_id
       WHERE snapshot.submission_id = $1
         AND result.submission_id IS NULL
       ON CONFLICT (submission_id, test_case_id) DO NOTHING`,
        [submissionId, verdict],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async persistFinalResult(
    submissionId: string,
    failed = false,
  ): Promise<void> {
    const startedAt = performance.now();
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const submission = await client.query<{
        user_id: string;
        problem_id: string;
      }>(
        `SELECT user_id, problem_id
         FROM submissions
         WHERE id = $1 AND status = 'RUNNING'
         FOR UPDATE`,
        [submissionId],
      );
      const owner = submission.rows[0];
      if (!owner) {
        await client.query('COMMIT');
        return;
      }

      const totals = await client.query<{
        snapshot_count: string;
        result_count: string;
        score: string;
        execution_time_ms: string | null;
        memory_used_kb: number | null;
      }>(
        `SELECT COUNT(snapshot.id)::text AS snapshot_count,
                COUNT(result.submission_id)::text AS result_count,
                COALESCE(SUM(result.points_awarded), 0)::text AS score,
                SUM(result.execution_time_ms)::text AS execution_time_ms,
                MAX(result.memory_used_kb) AS memory_used_kb
         FROM submission_test_case_snapshots snapshot
         LEFT JOIN submission_test_results result
           ON result.submission_id = snapshot.submission_id
          AND result.test_case_id = snapshot.source_test_case_id
         WHERE snapshot.submission_id = $1`,
        [submissionId],
      );
      const counts = totals.rows[0];
      if (!counts)
        throw new Error('Could not aggregate submission judging results.');
      const complete =
        Number(counts.snapshot_count) > 0 &&
        counts.snapshot_count === counts.result_count;
      if (!failed && complete) {
        const acceptedCases = await client.query<{
          test_case_id: string;
          input_data: string;
          expected_output: string;
        }>(
          `SELECT snapshot.source_test_case_id AS test_case_id,
                  snapshot.input_data, snapshot.expected_output
           FROM submission_test_case_snapshots snapshot
           JOIN submission_test_results result
             ON result.submission_id = snapshot.submission_id
            AND result.test_case_id = snapshot.source_test_case_id
           WHERE snapshot.submission_id = $1 AND result.status = 'ACCEPTED'
           ORDER BY snapshot.source_test_case_id`,
          [submissionId],
        );
        if (acceptedCases.rows.length > 0) {
          const values: Array<string> = [];
          const tuples = acceptedCases.rows.map((testCase) => {
            const index = values.length + 1;
            values.push(
              owner.user_id,
              owner.problem_id,
              testCase.test_case_id,
              testCaseFingerprint(
                testCase.input_data,
                testCase.expected_output,
              ),
            );
            return `($${index}, $${index + 1}, $${index + 2}, $${index + 3})`;
          });
          await client.query(
            `INSERT INTO student_test_case_progress
               (user_id, problem_id, test_case_id, content_fingerprint)
             VALUES ${tuples.join(', ')}
             ON CONFLICT (user_id, problem_id, test_case_id, content_fingerprint)
             DO NOTHING`,
            values,
          );
        }
      }

      await client.query(
        `WITH first_failure AS (
           SELECT result.status
           FROM submission_test_results result
           JOIN submission_test_case_snapshots snapshot
             ON snapshot.id = result.snapshot_id
           WHERE result.submission_id = $1 AND result.status <> 'ACCEPTED'
           ORDER BY snapshot.position, snapshot.id
           LIMIT 1
         )
         UPDATE submissions s
         SET status = CASE WHEN $2::boolean OR NOT $3::boolean THEN 'INTERNAL_ERROR'
                           ELSE COALESCE((SELECT status FROM first_failure), 'ACCEPTED') END,
             score = CASE WHEN s.scoring_enabled THEN $4::numeric ELSE 0 END,
             execution_time_ms = $5,
             memory_used_kb = $6,
             error_message = CASE WHEN $2::boolean OR NOT $3::boolean
                                  THEN 'Judging could not be completed.' ELSE NULL END,
             judged_at = CURRENT_TIMESTAMP
         WHERE s.id = $1 AND s.status = 'RUNNING'`,
        [
          submissionId,
          failed,
          complete,
          counts.score,
          counts.execution_time_ms,
          counts.memory_used_kb,
        ],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    this.logger.log(
      `Judging finalized submission=${submissionId} failed=${failed} dbMs=${Math.round(performance.now() - startedAt)}`,
    );
    // A duplicate failed event may arrive after this submission is already terminal.
  }
}
