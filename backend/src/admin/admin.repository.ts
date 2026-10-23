import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { Inject } from '@nestjs/common';
import { DATABASE_POOL } from '../databases/database.module.js';
import type { AdminProblemDto } from './dto/admin-problem.dto.js';
import type { AdminTestCaseDto } from './dto/admin-test-case.dto.js';
import type {
  AdminProblem,
  AdminProblemListQuery,
  AdminProblemPage,
  AdminTestCase,
} from './admin.types.js';

type ProblemRow = {
  id: string;
  problem_code: string;
  title: string;
  summary: string | null;
  statement: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  input_description: string | null;
  output_description: string | null;
  constraints_text: string | null;
  time_limit_ms: number;
  memory_limit_mb: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  updated_at: Date;
  tags: string[];
  languages: string[];
};

type TestCaseRow = {
  id: string;
  test_name: string | null;
  input_data: string;
  expected_output: string;
  is_sample: boolean;
  points: string | number;
  position: number;
  is_active: boolean;
};

const PROBLEM_FIELDS = `
  p.id, p.problem_code, p.title, p.summary, p.statement, p.difficulty,
  p.input_description, p.output_description, p.constraints_text,
  p.time_limit_ms, p.memory_limit_mb, p.status, p.updated_at,
  COALESCE((
    SELECT array_agg(t.name ORDER BY t.name)::text[]
    FROM problem_tags pt JOIN tags t ON t.id = pt.tag_id
    WHERE pt.problem_id = p.id
  ), ARRAY[]::text[]) AS tags,
  COALESCE((
    SELECT array_agg(l.name ORDER BY l.name)::text[]
    FROM problem_languages pl JOIN programming_languages l ON l.id = pl.language_id
    WHERE pl.problem_id = p.id
  ), ARRAY[]::text[]) AS languages`;

@Injectable()
export class AdminRepository {
  constructor(@Inject(DATABASE_POOL) private readonly database: Pool) {}

  async listProblems(query: AdminProblemListQuery): Promise<AdminProblemPage> {
    const conditions: string[] = [];
    const values: Array<string | number> = [];
    if (query.search?.trim()) {
      values.push(`%${escapeLike(query.search.trim())}%`);
      conditions.push(`(p.problem_code ILIKE $${values.length} ESCAPE '\\' OR p.title ILIKE $${values.length} ESCAPE '\\')`);
    }
    if (query.status) {
      values.push(query.status.toUpperCase());
      conditions.push(`p.status = $${values.length}`);
    }
    if (query.difficulty) {
      values.push(query.difficulty.toUpperCase());
      conditions.push(`p.difficulty = $${values.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const count = await this.database.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM problems p ${where}`,
      values,
    );
    const pageValues = [...values, query.pageSize, (query.page - 1) * query.pageSize];
    const rows = await this.database.query<ProblemRow>(
      `SELECT ${PROBLEM_FIELDS}
       FROM problems p
       ${where}
       ORDER BY p.updated_at DESC, p.problem_code ASC
       LIMIT $${pageValues.length - 1} OFFSET $${pageValues.length}`,
      pageValues,
    );
    return {
      items: rows.rows.map(mapProblem),
      total: Number(count.rows[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findProblem(id: string): Promise<AdminProblem> {
    const result = await this.database.query<ProblemRow>(
      `SELECT ${PROBLEM_FIELDS} FROM problems p WHERE p.id = $1 LIMIT 1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Không tìm thấy bài tập.');

    const examples = await this.database.query<Pick<TestCaseRow, 'id' | 'input_data' | 'expected_output'>>(
      `SELECT id, input_data, expected_output
       FROM problem_test_cases
       WHERE problem_id = $1 AND is_sample = TRUE AND is_active = TRUE
       ORDER BY position ASC`,
      [id],
    );
    return {
      ...mapProblem(row),
      examples: examples.rows.map((item) => ({
        id: item.id,
        input: item.input_data,
        output: item.expected_output,
      })),
    };
  }

  async saveProblem(input: AdminProblemDto, userId: string, id?: string): Promise<AdminProblem> {
    const client = await this.database.connect();
    let savedId = id;
    try {
      await client.query('BEGIN');
      const values = problemValues(input);
      if (id) {
        const updated = await client.query<{ id: string }>(
          `UPDATE problems
           SET problem_code = $2, title = $3, summary = $4, statement = $5,
               difficulty = $6, input_description = $7, output_description = $8,
               constraints_text = $9, time_limit_ms = $10, memory_limit_mb = $11,
               status = $12, published_at = CASE
                 WHEN $12 = 'PUBLISHED' THEN COALESCE(published_at, CURRENT_TIMESTAMP)
                 ELSE published_at END,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1
           RETURNING id`,
          [id, ...values],
        );
        if (!updated.rowCount) throw new NotFoundException('Không tìm thấy bài tập.');
      } else {
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO problems
             (problem_code, title, summary, statement, difficulty, input_description,
              output_description, constraints_text, time_limit_ms, memory_limit_mb,
              status, created_by, published_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                   CASE WHEN $11 = 'PUBLISHED' THEN CURRENT_TIMESTAMP ELSE NULL END)
           RETURNING id`,
          [...values, userId],
        );
        savedId = inserted.rows[0]?.id;
        if (!savedId) throw new Error('Problem insert did not return an id');
      }
      if (!savedId) throw new Error('Problem save did not return an id');

      await this.replaceTags(client, savedId, input.tags);
      await this.replaceLanguages(client, savedId, input.languages);
      await this.replaceExamples(client, savedId, input.examples);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      if (isUniqueViolation(error)) {
        throw new ConflictException('Mã bài tập đã được sử dụng.');
      }
      throw error;
    } finally {
      client.release();
    }
    return this.findProblem(savedId);
  }

  async setProblemStatus(id: string, status: AdminProblem['status']): Promise<void> {
    const result = await this.database.query(
      `UPDATE problems
       SET status = $2,
           published_at = CASE
             WHEN $2 = 'PUBLISHED' THEN COALESCE(published_at, CURRENT_TIMESTAMP)
             ELSE published_at END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id, status.toUpperCase()],
    );
    if (!result.rowCount) throw new NotFoundException('Không tìm thấy bài tập.');
  }

  async deleteProblem(id: string): Promise<void> {
    let result;
    try {
      result = await this.database.query(
        `DELETE FROM problems WHERE id = $1 AND status = 'DRAFT'`,
        [id],
      );
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException('Bài tập đã có dữ liệu liên quan và không thể xóa.');
      }
      throw error;
    }
    if (!result.rowCount) {
      const found = await this.database.query('SELECT 1 FROM problems WHERE id = $1', [id]);
      if (!found.rowCount) throw new NotFoundException('Không tìm thấy bài tập.');
      throw new ConflictException('Chỉ có thể xóa bài tập ở trạng thái bản nháp.');
    }
  }

  async listTags(): Promise<string[]> {
    const result = await this.database.query<{ name: string }>(
      'SELECT name FROM tags ORDER BY name ASC',
    );
    return result.rows.map((row) => row.name);
  }

  async listLanguages(): Promise<string[]> {
    const result = await this.database.query<{ name: string }>(
      'SELECT name FROM programming_languages WHERE is_enabled = TRUE ORDER BY name ASC',
    );
    return result.rows.map((row) => row.name);
  }

  async dashboard(): Promise<{
    total: number;
    published: number;
    draft: number;
    archived: number;
    recent: AdminProblem[];
  }> {
    const [counts, recent] = await Promise.all([
      this.database.query<{ status: string; count: string }>(
        `SELECT status, COUNT(*)::text AS count FROM problems GROUP BY status`,
      ),
      this.listProblems({ page: 1, pageSize: 4 }),
    ]);
    const byStatus = new Map(counts.rows.map((row) => [row.status, Number(row.count)]));
    return {
      total: [...byStatus.values()].reduce((sum, count) => sum + count, 0),
      published: byStatus.get('PUBLISHED') ?? 0,
      draft: byStatus.get('DRAFT') ?? 0,
      archived: byStatus.get('ARCHIVED') ?? 0,
      recent: recent.items,
    };
  }

  async listTestCases(problemId: string): Promise<AdminTestCase[]> {
    await this.ensureProblem(problemId);
    const result = await this.database.query<TestCaseRow>(
      `SELECT id, test_name, input_data, expected_output, is_sample, points, position, is_active
       FROM problem_test_cases
       WHERE problem_id = $1 AND is_active = TRUE
       ORDER BY position ASC, id ASC`,
      [problemId],
    );
    return result.rows.map(mapTestCase);
  }

  async saveTestCase(
    problemId: string,
    input: AdminTestCaseDto,
    id?: string,
  ): Promise<AdminTestCase> {
    await this.ensureProblem(problemId);
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const isSample = input.kind === 'sample';
      let result;
      if (id) {
        result = await client.query<TestCaseRow>(
          `UPDATE problem_test_cases
           SET test_name = $3, input_data = $4, expected_output = $5,
               is_sample = $6, points = $7, position = COALESCE($8, position)
           WHERE problem_id = $1 AND id = $2 AND is_active = TRUE
           RETURNING id, test_name, input_data, expected_output, is_sample,
                     points, position, is_active`,
          [
            problemId, id, input.name.trim(), input.input, input.expectedOutput,
            isSample, input.points ?? 0, input.position ?? null,
          ],
        );
      } else {
        result = await client.query<TestCaseRow>(
          `INSERT INTO problem_test_cases
             (problem_id, test_name, input_data, expected_output, is_sample, points, position)
           VALUES (
             $1, $2, $3, $4, $5, $6,
             COALESCE($7, (SELECT COALESCE(MAX(position), 0) + 1
                           FROM problem_test_cases WHERE problem_id = $1))
           )
           RETURNING id, test_name, input_data, expected_output, is_sample,
                     points, position, is_active`,
          [
            problemId, input.name.trim(), input.input, input.expectedOutput,
            isSample, input.points ?? 0, input.position ?? null,
          ],
        );
      }
      const row = result.rows[0];
      if (!row) throw new NotFoundException('Không tìm thấy test case.');
      await client.query('UPDATE problems SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [problemId]);
      await client.query('COMMIT');
      return mapTestCase(row);
    } catch (error) {
      await client.query('ROLLBACK');
      if (isUniqueViolation(error)) {
        throw new ConflictException('Vị trí test case đã được sử dụng.');
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteTestCase(problemId: string, id: string): Promise<void> {
    const result = await this.database.query(
      `DELETE FROM problem_test_cases WHERE problem_id = $1 AND id = $2`,
      [problemId, id],
    );
    if (!result.rowCount) throw new NotFoundException('Không tìm thấy test case.');
    await this.database.query('UPDATE problems SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [problemId]);
  }

  private async ensureProblem(id: string): Promise<void> {
    const result = await this.database.query('SELECT 1 FROM problems WHERE id = $1', [id]);
    if (!result.rowCount) throw new NotFoundException('Không tìm thấy bài tập.');
  }

  private async replaceTags(client: PoolClient, problemId: string, tags: string[]): Promise<void> {
    await client.query('DELETE FROM problem_tags WHERE problem_id = $1', [problemId]);
    for (const name of uniqueNames(tags)) {
      const existing = await client.query<{ id: string }>(
        'SELECT id FROM tags WHERE lower(name) = lower($1) LIMIT 1',
        [name],
      );
      let tagId = existing.rows[0]?.id;
      if (!tagId) {
        const slug = slugForTag(name);
        await client.query(
          'INSERT INTO tags (name, slug) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
          [name, slug],
        );
        const created = await client.query<{ id: string }>(
          'SELECT id FROM tags WHERE lower(name) = lower($1) LIMIT 1',
          [name],
        );
        tagId = created.rows[0]?.id;
      }
      if (!tagId) throw new ConflictException('Không thể lưu chủ đề đã chọn.');
      await client.query(
        'INSERT INTO problem_tags (problem_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [problemId, tagId],
      );
    }
  }

  private async replaceLanguages(client: PoolClient, problemId: string, languages: string[]): Promise<void> {
    const names = uniqueNames(languages);
    const result = await client.query<{ id: string; name: string }>(
      `SELECT id, name FROM programming_languages
       WHERE is_enabled = TRUE AND lower(name) = ANY($1::text[])`,
      [names.map((name) => name.toLowerCase())],
    );
    if (result.rows.length !== names.length) {
      throw new ConflictException('Một hoặc nhiều ngôn ngữ không còn được hỗ trợ.');
    }
    await client.query('DELETE FROM problem_languages WHERE problem_id = $1', [problemId]);
    for (const language of result.rows) {
      await client.query(
        'INSERT INTO problem_languages (problem_id, language_id) VALUES ($1, $2)',
        [problemId, language.id],
      );
    }
  }

  private async replaceExamples(
    client: PoolClient,
    problemId: string,
    examples: AdminProblemDto['examples'],
  ): Promise<void> {
    await client.query(
      'DELETE FROM problem_test_cases WHERE problem_id = $1 AND is_sample = TRUE',
      [problemId],
    );
    for (const [index, example] of examples.entries()) {
      await client.query(
        `INSERT INTO problem_test_cases
           (problem_id, test_name, input_data, expected_output, is_sample, points, position)
         VALUES ($1, $2, $3, $4, TRUE, 0, $5)`,
        [problemId, `Ví dụ ${index + 1}`, example.input, example.output, index + 1],
      );
    }
  }
}

function problemValues(input: AdminProblemDto): Array<string | number | null> {
  return [
    input.code.trim().toUpperCase(),
    input.title.trim(),
    input.summary?.trim() || null,
    input.statement,
    input.difficulty.toUpperCase(),
    input.inputDescription ?? null,
    input.outputDescription ?? null,
    input.constraints ?? null,
    Math.round(input.timeLimitSeconds * 1000),
    input.memoryLimitMb,
    (input.status ?? 'draft').toUpperCase(),
  ];
}

function mapProblem(row: ProblemRow): AdminProblem {
  return {
    id: row.id,
    code: row.problem_code,
    title: row.title,
    summary: row.summary,
    statement: row.statement,
    difficulty: row.difficulty.toLowerCase() as AdminProblem['difficulty'],
    tags: row.tags ?? [],
    languages: row.languages ?? [],
    inputDescription: row.input_description ?? '',
    outputDescription: row.output_description ?? '',
    constraints: row.constraints_text ?? '',
    timeLimitSeconds: row.time_limit_ms / 1000,
    memoryLimitMb: row.memory_limit_mb,
    examples: [],
    status: row.status.toLowerCase() as AdminProblem['status'],
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapTestCase(row: TestCaseRow): AdminTestCase {
  const points = Number(row.points);
  return {
    id: row.id,
    name: row.test_name ?? `Test ${row.position}`,
    input: row.input_data,
    expectedOutput: row.expected_output,
    kind: row.is_sample ? 'sample' : 'hidden',
    points: points === 0 ? null : points,
    position: row.position,
  };
}

function uniqueNames(names: string[]): string[] {
  return [...new Map(names.map((name) => [name.trim().toLocaleLowerCase(), name.trim()])).values()]
    .filter(Boolean);
}

function slugForTag(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'tag';
  const suffix = createHash('sha1').update(name.toLowerCase()).digest('hex').slice(0, 8);
  return `${base.slice(0, 110)}-${suffix}`;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23503';
}
