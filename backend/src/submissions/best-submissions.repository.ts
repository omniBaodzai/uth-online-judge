import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';

export interface BestSubmissionItem {
  rank: number;
  id: string;
  status: string;
  language: string;
  executionTimeMs: number | null;
  memoryUsedKb: number | null;
  codeLength: number;
  submittedAt: string;
  user: { id: string; username: string | null; fullName: string | null; avatarUrl: string | null };
}

export interface BestSubmissionPage {
  problem: { code: string; title: string };
  items: BestSubmissionItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BestSubmissionSource {
  id: string;
  language: string;
  sourceCode: string;
  username: string | null;
}

// Mỗi người dùng chỉ giữ một bài ACCEPTED tốt nhất: thời gian nhỏ nhất, rồi bộ nhớ nhỏ nhất, rồi nộp sớm nhất.
const BEST_PER_USER_SQL = `
  SELECT DISTINCT ON (s.user_id)
         s.id, s.user_id, s.language_id, s.status, s.source_code,
         s.execution_time_ms, s.memory_used_kb, s.submitted_at
  FROM submissions s
  WHERE s.problem_id = $1 AND s.status = 'ACCEPTED'
  ORDER BY s.user_id,
           s.execution_time_ms ASC NULLS LAST,
           s.memory_used_kb ASC NULLS LAST,
           s.submitted_at ASC,
           s.id ASC`;

type PageRow = {
  rank: string;
  id: string;
  status: string;
  language: string;
  execution_time_ms: number | null;
  memory_used_kb: number | null;
  code_length: number;
  submitted_at: Date;
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  total: string;
};

@Injectable()
export class BestSubmissionsRepository {
  constructor(@Inject(DATABASE_POOL) private readonly database: Pool) {}

  async findPublishedProblem(code: string): Promise<{ id: string; code: string; title: string } | null> {
    const result = await this.database.query<{ id: string; problem_code: string; title: string }>(
      `SELECT id, problem_code, title FROM problems WHERE problem_code = $1 AND status = 'PUBLISHED'`,
      [code],
    );
    const row = result.rows[0];
    return row ? { id: row.id, code: row.problem_code, title: row.title } : null;
  }

  async findPage(
    problem: { id: string; code: string; title: string },
    page: number,
    pageSize: number,
  ): Promise<BestSubmissionPage> {
    const offset = (page - 1) * pageSize;
    const result = await this.database.query<PageRow>(
      `WITH best AS (${BEST_PER_USER_SQL})
       SELECT ROW_NUMBER() OVER (ORDER BY b.execution_time_ms ASC NULLS LAST,
                                          b.memory_used_kb ASC NULLS LAST,
                                          b.submitted_at ASC, b.id ASC) AS rank,
              b.id, b.status, l.name AS language, b.execution_time_ms, b.memory_used_kb,
              octet_length(b.source_code) AS code_length, b.submitted_at,
              u.id AS user_id, u.username, u.full_name, u.avatar_url,
              COUNT(*) OVER () AS total
       FROM best b
       JOIN users u ON u.id = b.user_id AND u.is_active = TRUE
       JOIN programming_languages l ON l.id = b.language_id
       ORDER BY rank
       LIMIT $2 OFFSET $3`,
      [problem.id, pageSize, offset],
    );

    return {
      problem: { code: problem.code, title: problem.title },
      total: Number(result.rows[0]?.total ?? 0),
      page,
      pageSize,
      items: result.rows.map((row) => ({
        rank: Number(row.rank),
        id: row.id,
        status: row.status,
        language: row.language,
        executionTimeMs: row.execution_time_ms,
        memoryUsedKb: row.memory_used_kb,
        codeLength: Number(row.code_length),
        submittedAt: row.submitted_at.toISOString(),
        user: {
          id: row.user_id,
          username: row.username,
          fullName: row.full_name,
          avatarUrl: row.avatar_url,
        },
      })),
    };
  }

  // Chỉ trả mã nguồn của đúng bài nộp đang nằm trong danh sách "tốt nhất" của bài tập này.
  async findSource(problemId: string, submissionId: string): Promise<BestSubmissionSource | null> {
    const result = await this.database.query<{
      id: string;
      language: string;
      source_code: string;
      username: string | null;
    }>(
      `WITH best AS (${BEST_PER_USER_SQL})
       SELECT b.id, l.name AS language, b.source_code, u.username
       FROM best b
       JOIN users u ON u.id = b.user_id AND u.is_active = TRUE
       JOIN programming_languages l ON l.id = b.language_id
       WHERE b.id = $2`,
      [problemId, submissionId],
    );
    const row = result.rows[0];
    return row
      ? { id: row.id, language: row.language, sourceCode: row.source_code, username: row.username }
      : null;
  }
}
