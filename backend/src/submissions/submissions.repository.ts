import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';

export interface CreatedSubmission {
  id: string;
  status: string;
  submittedAt: string;
}

export interface TestResultView {
  position: number;
  status: string;
  executionTimeMs: number | null;
  memoryUsedKb: number | null;
  pointsAwarded: number;
}

export interface SubmissionView {
  id: string;
  problemCode: string;
  language: string;
  sourceCode: string;
  status: string;
  score: number;
  executionTimeMs: number | null;
  memoryUsedKb: number | null;
  submittedAt: string;
  judgedAt: string | null;
  testResults: TestResultView[];
}

@Injectable()
export class SubmissionsRepository {
  constructor(
    @Inject(DATABASE_POOL)
    private readonly database: Pool,
  ) {}

  async findPublishedProblemId(code: string): Promise<string | null> {
    const result = await this.database.query<{ id: string }>(
      "SELECT id FROM problems WHERE problem_code = $1 AND status = 'PUBLISHED'",
      [code],
    );
    return result.rows[0]?.id ?? null;
  }

  async findEnabledLanguageId(slug: string): Promise<string | null> {
    const result = await this.database.query<{ id: string }>(
      'SELECT id FROM programming_languages WHERE slug = $1 AND is_enabled = TRUE',
      [slug],
    );
    return result.rows[0]?.id ?? null;
  }

  // Trạng thái không được truyền vào: cột status dùng mặc định 'PENDING' của schema.
  async insert(input: {
    userId: string;
    problemId: string;
    languageId: string;
    sourceCode: string;
  }): Promise<CreatedSubmission> {
    const result = await this.database.query<{ id: string; status: string; submitted_at: Date }>(
      `INSERT INTO submissions (user_id, problem_id, language_id, source_code)
       VALUES ($1, $2, $3, $4)
       RETURNING id, status, submitted_at`,
      [input.userId, input.problemId, input.languageId, input.sourceCode],
    );
    const row = result.rows[0];
    return { id: row.id, status: row.status, submittedAt: row.submitted_at.toISOString() };
  }

  // Điều kiện user_id nằm ngay trong truy vấn: bài nộp của người khác coi như không tồn tại.
  async findOwned(id: string, userId: string): Promise<SubmissionView | null> {
    const submission = await this.database.query<{
      id: string;
      problem_code: string;
      language: string;
      source_code: string;
      status: string;
      score: string;
      execution_time_ms: number | null;
      memory_used_kb: number | null;
      submitted_at: Date;
      judged_at: Date | null;
    }>(
      `SELECT s.id, p.problem_code, l.slug AS language, s.source_code, s.status, s.score,
              s.execution_time_ms, s.memory_used_kb, s.submitted_at, s.judged_at
       FROM submissions s
       JOIN problems p ON p.id = s.problem_id
       JOIN programming_languages l ON l.id = s.language_id
       WHERE s.id = $1 AND s.user_id = $2`,
      [id, userId],
    );
    const row = submission.rows[0];
    if (!row) return null;

    // Không chọn error_message, input_data hay expected_output của test case.
    const results = await this.database.query<{
      position: number;
      status: string;
      execution_time_ms: number | null;
      memory_used_kb: number | null;
      points_awarded: string;
    }>(
      `SELECT tc.position, r.status, r.execution_time_ms, r.memory_used_kb, r.points_awarded
       FROM submission_test_results r
       JOIN problem_test_cases tc ON tc.id = r.test_case_id
       WHERE r.submission_id = $1
       ORDER BY tc.position`,
      [id],
    );

    return {
      id: row.id,
      problemCode: row.problem_code,
      language: row.language,
      sourceCode: row.source_code,
      status: row.status,
      score: Number(row.score),
      executionTimeMs: row.execution_time_ms,
      memoryUsedKb: row.memory_used_kb,
      submittedAt: row.submitted_at.toISOString(),
      judgedAt: row.judged_at?.toISOString() ?? null,
      testResults: results.rows.map((result) => ({
        position: result.position,
        status: result.status,
        executionTimeMs: result.execution_time_ms,
        memoryUsedKb: result.memory_used_kb,
        pointsAwarded: Number(result.points_awarded),
      })),
    };
  }
}
