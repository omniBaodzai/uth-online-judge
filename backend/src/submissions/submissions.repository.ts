import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';
import type { SubmissionStatus } from './submission.constants.js';

type SubmissionRow = {
  id: string;
  user_id: string;
  problem_code: string;
  source_code?: string;
  language_id: number;
  status: SubmissionStatus;
  execution_time: number | null;
  memory_used: number | null;
  score: number;
  passed_tests: number;
  total_tests: number;
  compile_output: string | null;
  created_at: Date;
  username?: string | null;
};

export type SubmissionView = {
  id: string;
  userId: string;
  username: string | null;
  problemCode: string;
  sourceCode?: string;
  languageId: number;
  status: SubmissionStatus;
  executionTime: number | null;
  memoryUsed: number | null;
  score: number;
  passedTests: number;
  totalTests: number;
  compileOutput: string | null;
  createdAt: string;
};

export type JudgeProblem = {
  id: string;
  timeLimitSeconds: number;
  memoryLimitMb: number;
  totalScore: number;
};

export type JudgeTestCase = { input: string; expectedOutput: string };

export type JudgeResult = {
  status: SubmissionStatus;
  executionTime: number | null;
  memoryUsed: number | null;
  score: number;
  passedTests: number;
  totalTests: number;
  compileOutput: string | null;
};

const COLUMNS = `s.id, s.user_id, s.problem_code, s.language_id, s.status, s.execution_time,
  s.memory_used, s.score, s.passed_tests, s.total_tests, s.compile_output, s.created_at, u.username`;

function toView(row: SubmissionRow): SubmissionView {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username ?? null,
    problemCode: row.problem_code,
    ...(row.source_code === undefined ? {} : { sourceCode: row.source_code }),
    languageId: row.language_id,
    status: row.status,
    executionTime: row.execution_time,
    memoryUsed: row.memory_used,
    score: row.score,
    passedTests: row.passed_tests,
    totalTests: row.total_tests,
    compileOutput: row.compile_output,
    createdAt: row.created_at.toISOString(),
  };
}

@Injectable()
export class SubmissionsRepository {
  constructor(
    @Inject(DATABASE_POOL)
    private readonly database: Pool,
  ) {}

  async findProblemByCode(code: string): Promise<{ id: string; code: string } | null> {
    const result = await this.database.query<{ id: string; code: string }>(
      `SELECT id, code FROM problems WHERE upper(code) = upper($1)`,
      [code],
    );
    return result.rows[0] ?? null;
  }

  async create(input: {
    userId: string;
    problemId: string;
    problemCode: string;
    sourceCode: string;
    languageId: number;
  }): Promise<SubmissionView> {
    const result = await this.database.query<{ id: string }>(
      `INSERT INTO submissions (user_id, problem_id, problem_code, source_code, language_id, status)
       VALUES ($1, $2, $3, $4, $5, 'PENDING')
       RETURNING id`,
      [input.userId, input.problemId, input.problemCode, input.sourceCode, input.languageId],
    );
    return (await this.findById(result.rows[0].id, true))!;
  }

  async findById(id: string, includeSource = false): Promise<SubmissionView | null> {
    const result = await this.database.query<SubmissionRow>(
      `SELECT ${COLUMNS}${includeSource ? ', s.source_code' : ''}
       FROM submissions s JOIN users u ON u.id = s.user_id
       WHERE s.id = $1`,
      [id],
    );
    return result.rows[0] ? toView(result.rows[0]) : null;
  }

  async list(filters: { userId?: string; problemCode?: string; limit: number; offset: number }) {
    const result = await this.database.query<SubmissionRow & { total: string }>(
      `SELECT ${COLUMNS}, count(*) OVER() AS total
       FROM submissions s JOIN users u ON u.id = s.user_id
       WHERE ($1::uuid IS NULL OR s.user_id = $1)
         AND ($2::text IS NULL OR upper(s.problem_code) = upper($2))
       ORDER BY s.created_at DESC
       LIMIT $3 OFFSET $4`,
      [filters.userId ?? null, filters.problemCode ?? null, filters.limit, filters.offset],
    );
    return {
      items: result.rows.map(toView),
      total: Number(result.rows[0]?.total ?? 0),
    };
  }

  async getForJudging(id: string) {
    const result = await this.database.query<{
      source_code: string;
      language_id: number;
      problem_id: string;
    }>(`SELECT source_code, language_id, problem_id FROM submissions WHERE id = $1`, [id]);
    const row = result.rows[0];
    if (!row) return null;

    const problem = await this.database.query<{
      time_limit_seconds: string;
      memory_limit_mb: number;
      total_score: number;
    }>(`SELECT time_limit_seconds, memory_limit_mb, total_score FROM problems WHERE id = $1`, [
      row.problem_id,
    ]);
    const tests = await this.database.query<{ input: string; expected_output: string }>(
      `SELECT input, expected_output FROM test_cases WHERE problem_id = $1 ORDER BY position, id`,
      [row.problem_id],
    );
    return {
      sourceCode: row.source_code,
      languageId: row.language_id,
      problem: {
        id: row.problem_id,
        timeLimitSeconds: Number(problem.rows[0].time_limit_seconds),
        memoryLimitMb: problem.rows[0].memory_limit_mb,
        totalScore: problem.rows[0].total_score,
      } satisfies JudgeProblem,
      testCases: tests.rows.map((test) => ({
        input: test.input,
        expectedOutput: test.expected_output,
      })) satisfies JudgeTestCase[],
    };
  }

  async markJudging(id: string): Promise<void> {
    await this.database.query(`UPDATE submissions SET status = 'JUDGING' WHERE id = $1`, [id]);
  }

  async saveResult(id: string, result: JudgeResult): Promise<void> {
    await this.database.query(
      `UPDATE submissions
       SET status = $2, execution_time = $3, memory_used = $4, score = $5,
           passed_tests = $6, total_tests = $7, compile_output = $8
       WHERE id = $1`,
      [
        id,
        result.status,
        result.executionTime,
        result.memoryUsed,
        result.score,
        result.passedTests,
        result.totalTests,
        result.compileOutput,
      ],
    );
  }
}
