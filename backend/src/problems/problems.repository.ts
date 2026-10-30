import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';
import type {
  Difficulty,
  LanguageSummary,
  ProblemDetail,
  ProblemExample,
  ProblemListItem,
  ProblemListQuery,
  ProblemSortField,
  TagSummary,
  UserProblemStatus,
} from './problems.types.js';

export type EditorialSolution = {
  id: string;
  title: string;
  language: string;
  sourceCode: string;
};

// Chỉ các giá trị trong bảng này được ghép vào ORDER BY; dữ liệu người dùng không bao giờ vào SQL.
const SORT_SQL: Record<ProblemSortField, string> = {
  code: 'problem_code',
  title: 'title',
  points: 'score',
  difficulty: "CASE difficulty WHEN 'EASY' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END",
  publishedAt: 'published_at',
  createdAt: 'created_at',
};

// Bài đã chấm xong (loại trừ các trạng thái chưa có kết luận).
const JUDGED_STATUSES = "('PENDING', 'QUEUED', 'RUNNING', 'INTERNAL_ERROR')";

// $1 luôn là id người dùng (có thể NULL với khách).
const USER_STATUS_SQL = `
  CASE
    WHEN $1::uuid IS NULL THEN 'unsolved'
    WHEN EXISTS (SELECT 1 FROM submissions s
                 WHERE s.problem_id = p.id AND s.user_id = $1::uuid AND s.status = 'ACCEPTED') THEN 'solved'
    WHEN EXISTS (SELECT 1 FROM submissions s
                 WHERE s.problem_id = p.id AND s.user_id = $1::uuid AND s.status NOT IN ${JUDGED_STATUSES}) THEN 'wrong'
    ELSE 'unsolved'
  END`;

const HAS_SOLUTION_SQL = `
  EXISTS (SELECT 1 FROM problem_editorials e WHERE e.problem_id = p.id AND e.is_published = TRUE)`;

const LIST_BASE_SQL = `
  WITH base AS (
    SELECT p.id, p.problem_code, p.title, p.difficulty, p.scoring_enabled,
           p.score, p.published_at, p.created_at,
           COALESCE(st.ac_users, 0) AS ac_count,
           CASE WHEN COALESCE(st.judged, 0) = 0 THEN 0
                ELSE ROUND(100.0 * st.accepted / st.judged, 1) END AS acceptance_rate,
           ${HAS_SOLUTION_SQL} AS has_solution,
           ${USER_STATUS_SQL} AS user_status
    FROM problems p
    LEFT JOIN (
      SELECT problem_id,
             COUNT(*) FILTER (WHERE status = 'ACCEPTED') AS accepted,
             COUNT(*) FILTER (WHERE status NOT IN ${JUDGED_STATUSES}) AS judged,
             COUNT(DISTINCT user_id) FILTER (WHERE status = 'ACCEPTED') AS ac_users
      FROM submissions
      GROUP BY problem_id
    ) st ON st.problem_id = p.id
    WHERE p.status = 'PUBLISHED'
  )`;

type ListRow = {
  id: string;
  problem_code: string;
  title: string;
  difficulty: Difficulty;
  scoring_enabled: boolean;
  score: string;
  published_at: Date | null;
  ac_count: string;
  acceptance_rate: string;
  has_solution: boolean;
  user_status: UserProblemStatus;
};

type DetailRow = {
  id: string;
  problem_code: string;
  title: string;
  statement: string;
  input_description: string | null;
  output_description: string | null;
  constraints_text: string | null;
  illustration_url: string | null;
  illustration_width: number;
  illustration_aspect_ratio: ProblemDetail['illustrationAspectRatio'];
  illustration_alignment: ProblemDetail['illustrationAlignment'];
  difficulty: Difficulty;
  scoring_enabled: boolean;
  score: string;
  time_limit_ms: number;
  memory_limit_mb: number;
  published_at: Date | null;
  author: string | null;
  has_solution: boolean;
  user_status: UserProblemStatus;
};

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

@Injectable()
export class ProblemsRepository {
  constructor(
    @Inject(DATABASE_POOL)
    private readonly database: Pool,
  ) {}

  async listPublished(
    query: ProblemListQuery,
    userId: string | null,
  ): Promise<{ rows: Omit<ProblemListItem, 'tags'>[]; ids: string[]; total: number }> {
    const values: unknown[] = [userId];
    const conditions: string[] = [];

    if (query.search) {
      values.push(`%${escapeLike(query.search)}%`);
      conditions.push(
        `(title ILIKE $${values.length} ESCAPE '\\' OR problem_code ILIKE $${values.length} ESCAPE '\\')`,
      );
    }
    if (query.tags?.length) {
      values.push(query.tags);
      conditions.push(`EXISTS (
        SELECT 1 FROM problem_tags pt JOIN tags t ON t.id = pt.tag_id
        WHERE pt.problem_id = base.id AND t.slug = ANY($${values.length}::text[]))`);
    }
    if (query.status) {
      values.push(query.status);
      conditions.push(`user_status = $${values.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const count = await this.database.query<{ total: string }>(
      `${LIST_BASE_SQL} SELECT COUNT(*) AS total FROM base ${where}`,
      values,
    );

    const direction = query.order === 'desc' ? 'DESC' : 'ASC';
    const pageValues = [...values, query.pageSize, (query.page - 1) * query.pageSize];
    const result = await this.database.query<ListRow>(
      `${LIST_BASE_SQL}
       SELECT * FROM base ${where}
       ORDER BY ${SORT_SQL[query.sort]} ${direction} NULLS LAST, id DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      pageValues,
    );

    return {
      total: Number(count.rows[0]?.total ?? 0),
      ids: result.rows.map((row) => row.id),
      rows: result.rows.map((row) => ({
        code: row.problem_code,
        title: row.title,
        difficulty: row.difficulty,
        scoringEnabled: row.scoring_enabled,
        points: Number(row.score),
        acceptanceRate: Number(row.acceptance_rate),
        acCount: Number(row.ac_count),
        status: row.user_status,
        hasSolution: row.has_solution,
        publishedAt: row.published_at?.toISOString() ?? null,
      })),
    };
  }

  async findTagsForProblems(problemIds: string[]): Promise<Map<string, TagSummary[]>> {
    const byProblem = new Map<string, TagSummary[]>();
    if (problemIds.length === 0) return byProblem;

    const result = await this.database.query<{ problem_id: string; name: string; slug: string }>(
      `SELECT pt.problem_id, t.name, t.slug
       FROM problem_tags pt JOIN tags t ON t.id = pt.tag_id
       WHERE pt.problem_id = ANY($1::uuid[])
       ORDER BY t.name`,
      [problemIds],
    );
    for (const row of result.rows) {
      const tags = byProblem.get(row.problem_id) ?? [];
      tags.push({ name: row.name, slug: row.slug });
      byProblem.set(row.problem_id, tags);
    }
    return byProblem;
  }

  async listTags(): Promise<TagSummary[]> {
    const result = await this.database.query<TagSummary>(
      'SELECT name, slug FROM tags ORDER BY name',
    );
    return result.rows;
  }

  async findPublishedProblemForEditorial(
    code: string,
  ): Promise<{ id: string; code: string; title: string } | null> {
    const result = await this.database.query<{ id: string; code: string; title: string }>(
      `SELECT id, problem_code AS code, title
       FROM problems
       WHERE problem_code = $1 AND status = 'PUBLISHED'`,
      [code],
    );
    return result.rows[0] ?? null;
  }

  async hasFinalizedSubmission(problemId: string, userId: string): Promise<boolean> {
    const result = await this.database.query<{ eligible: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM submissions
         WHERE problem_id = $1 AND user_id = $2
           AND status NOT IN ('PENDING', 'QUEUED', 'RUNNING', 'PROCESSING')
       ) AS eligible`,
      [problemId, userId],
    );
    return result.rows[0]?.eligible ?? false;
  }

  async findPublishedEditorials(problemId: string): Promise<EditorialSolution[]> {
    const result = await this.database.query<{
      id: string;
      title: string;
      language: string;
      source_code: string;
    }>(
      `SELECT id, title, language,
              COALESCE(NULLIF(source_code, ''), content_markdown) AS source_code
       FROM problem_editorials
       WHERE problem_id = $1 AND is_published = TRUE
       ORDER BY created_at ASC, id ASC`,
      [problemId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      language: row.language,
      sourceCode: row.source_code,
    }));
  }

  async findPublishedByCode(
    code: string,
    userId: string | null,
  ): Promise<Omit<ProblemDetail, 'tags' | 'examples' | 'languages'> & { id: string } | null> {
    const result = await this.database.query<DetailRow>(
      `SELECT p.id, p.problem_code, p.title, p.statement, p.input_description, p.output_description,
              p.constraints_text, p.illustration_url, p.illustration_width,
              p.illustration_aspect_ratio, p.illustration_alignment,
              p.difficulty, p.scoring_enabled, p.score,
              p.time_limit_ms, p.memory_limit_mb,
              p.published_at,
              COALESCE(u.username, u.full_name) AS author,
              ${HAS_SOLUTION_SQL} AS has_solution,
              ${USER_STATUS_SQL} AS user_status
       FROM problems p
       JOIN users u ON u.id = p.created_by
       WHERE p.problem_code = $2 AND p.status = 'PUBLISHED'`,
      [userId, code],
    );
    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      code: row.problem_code,
      title: row.title,
      statement: row.statement,
      inputDescription: row.input_description,
      outputDescription: row.output_description,
      constraints: row.constraints_text,
      illustrationUrl: row.illustration_url,
      illustrationWidth: row.illustration_width ?? 100,
      illustrationAspectRatio: row.illustration_aspect_ratio ?? 'auto',
      illustrationAlignment: row.illustration_alignment ?? 'center',
      difficulty: row.difficulty,
      scoringEnabled: row.scoring_enabled,
      points: Number(row.score),
      timeLimitMs: row.time_limit_ms,
      memoryLimitMb: row.memory_limit_mb,
      author: row.author,
      publishedAt: row.published_at?.toISOString() ?? null,
      status: row.user_status,
      hasSolution: row.has_solution,
    };
  }

  // Chỉ chọn đúng hai cột của test case mẫu; test ẩn bị loại bởi is_sample.
  async findSamples(problemId: string): Promise<ProblemExample[]> {
    const result = await this.database.query<{ input_data: string; expected_output: string }>(
      `SELECT input_data, expected_output
       FROM problem_test_cases
       WHERE problem_id = $1 AND is_sample = TRUE AND is_active = TRUE
       ORDER BY position`,
      [problemId],
    );
    return result.rows.map((row) => ({ input: row.input_data, output: row.expected_output }));
  }

  async listProblemLanguages(problemId: string): Promise<LanguageSummary[]> {
    const result = await this.database.query<LanguageSummary>(
      `SELECT l.slug, l.name, l.version
       FROM problem_languages pl
       JOIN programming_languages l ON l.id = pl.language_id
       WHERE pl.problem_id = $1 AND l.is_enabled = TRUE
       ORDER BY l.name`,
      [problemId],
    );
    return result.rows;
  }
}
