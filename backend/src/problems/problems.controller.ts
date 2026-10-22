import { Controller, Get, Header, Inject, NotFoundException, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';

// Danh mục bài tập công khai: cùng bảng `problems` mà trang Admin chỉnh sửa.
@ApiTags('problems')
@Controller('api/problems')
export class ProblemsController {
  constructor(@Inject(DATABASE_POOL) private readonly database: Pool) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async list() {
    const result = await this.database.query(
      `SELECT p.code, p.title, p.total_score AS score, p.topic, p.tags, p.difficulty,
              s.total AS "submissionCount", s.solvers AS "acceptedCount",
              CASE WHEN s.total > 0 THEN round(s.accepted * 100.0 / s.total, 1)::float ELSE 0 END AS acceptance
       FROM problems p
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS total,
                count(*) FILTER (WHERE status = 'AC')::int AS accepted,
                count(DISTINCT user_id) FILTER (WHERE status = 'AC')::int AS solvers
         FROM submissions WHERE problem_id = p.id
       ) s ON true
       ORDER BY p.code`,
    );
    return { items: result.rows };
  }

  @Get(':code')
  @Header('Cache-Control', 'no-store')
  async detail(@Param('code') code: string) {
    const problem = await this.database.query(
      `SELECT id, code, title, total_score AS score, topic, tags, difficulty, description,
              input_spec AS "inputSpec", output_spec AS "outputSpec", constraints_text AS "constraintsText", source,
              time_limit_seconds::float AS "timeLimitSeconds", memory_limit_mb AS "memoryLimitMb"
       FROM problems WHERE upper(code) = upper($1)`,
      [code],
    );
    const row = problem.rows[0];
    if (!row) throw new NotFoundException('Không tìm thấy bài tập.');
    const samples = await this.database.query(
      `SELECT input, expected_output AS output FROM test_cases
       WHERE problem_id = $1 AND is_sample ORDER BY position`,
      [row.id],
    );
    const { id: _id, ...publicFields } = row as Record<string, unknown>;
    return { ...publicFields, examples: samples.rows };
  }
}
