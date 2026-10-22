import { InjectQueue } from '@nestjs/bullmq';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';
import { ActivityLogService } from '../platform/activity-log.service.js';
import { JUDGE_QUEUE } from '../submissions/submission.constants.js';
import { escapeLike, pageParams } from './admin-users.service.js';
import type { ModerateDto, ProblemDto, TicketUpdateDto } from './dto.js';

const UUID = /^[0-9a-f-]{36}$/i;

@Injectable()
export class AdminContentService {
  constructor(
    @Inject(DATABASE_POOL) private readonly database: Pool,
    @InjectQueue(JUDGE_QUEUE) private readonly judgeQueue: Queue,
    private readonly activity: ActivityLogService,
  ) {}

  // ---- Bài tập ----
  async listProblems(search?: string, page?: string, pageSize?: string) {
    const p = pageParams(page, pageSize);
    const values: unknown[] = [];
    let clause = '';
    if (search?.trim()) {
      values.push(`%${escapeLike(search.trim())}%`);
      clause = 'WHERE p.code ILIKE $1 OR p.title ILIKE $1';
    }
    const rows = await this.database.query(
      `SELECT p.id, p.code, p.title, p.time_limit_seconds::float AS "timeLimitSeconds",
              p.memory_limit_mb AS "memoryLimitMb", p.total_score AS "totalScore", p.created_at AS "createdAt",
              (SELECT count(*)::int FROM test_cases t WHERE t.problem_id = p.id) AS "testCount",
              (SELECT count(*)::int FROM submissions s WHERE s.problem_id = p.id) AS "submissionCount"
       FROM problems p ${clause} ORDER BY p.code
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, p.pageSize, p.offset],
    );
    const total = await this.database.query<{ count: string }>(`SELECT count(*) FROM problems p ${clause}`, values);
    return { items: rows.rows, total: Number(total.rows[0]?.count ?? 0), page: p.page, pageSize: p.pageSize };
  }

  async getProblem(id: string) {
    if (!UUID.test(id)) throw new NotFoundException('Không tìm thấy bài tập.');
    const problem = await this.database.query(
      `SELECT id, code, title, time_limit_seconds::float AS "timeLimitSeconds", memory_limit_mb AS "memoryLimitMb",
              total_score AS "totalScore" FROM problems WHERE id = $1`,
      [id],
    );
    if (!problem.rows[0]) throw new NotFoundException('Không tìm thấy bài tập.');
    const tests = await this.database.query(
      `SELECT input, expected_output AS "expectedOutput", is_sample AS "isSample"
       FROM test_cases WHERE problem_id = $1 ORDER BY position`,
      [id],
    );
    return { ...problem.rows[0], testCases: tests.rows };
  }

  async saveProblem(actorId: string, input: ProblemDto, id?: string) {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      let problemId = id;
      if (id) {
        if (!UUID.test(id)) throw new NotFoundException('Không tìm thấy bài tập.');
        const updated = await client.query(
          `UPDATE problems SET code = $2, title = $3, time_limit_seconds = $4, memory_limit_mb = $5, total_score = $6
           WHERE id = $1 RETURNING id`,
          [id, input.code.toUpperCase(), input.title, input.timeLimitSeconds, input.memoryLimitMb, input.totalScore],
        );
        if (!updated.rows[0]) throw new NotFoundException('Không tìm thấy bài tập.');
      } else {
        const created = await client.query<{ id: string }>(
          `INSERT INTO problems (code, title, time_limit_seconds, memory_limit_mb, total_score)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [input.code.toUpperCase(), input.title, input.timeLimitSeconds, input.memoryLimitMb, input.totalScore],
        );
        problemId = created.rows[0]!.id;
      }
      if (input.testCases) {
        await client.query('DELETE FROM test_cases WHERE problem_id = $1', [problemId]);
        for (const [index, test] of input.testCases.entries()) {
          await client.query(
            'INSERT INTO test_cases (problem_id, position, input, expected_output, is_sample) VALUES ($1, $2, $3, $4, $5)',
            [problemId, index + 1, test.input, test.expectedOutput, test.isSample ?? false],
          );
        }
      }
      await client.query('COMMIT');
      await this.activity.log({ userId: null, actorId, action: id ? 'PROBLEM_UPDATED' : 'PROBLEM_CREATED', detail: { code: input.code } });
      return this.getProblem(problemId!);
    } catch (error) {
      await client.query('ROLLBACK');
      if ((error as { code?: string }).code === '23505') throw new ConflictException('Mã bài đã tồn tại.');
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteProblem(actorId: string, id: string) {
    if (!UUID.test(id)) throw new NotFoundException('Không tìm thấy bài tập.');
    const result = await this.database.query<{ code: string }>('DELETE FROM problems WHERE id = $1 RETURNING code', [id]);
    if (!result.rows[0]) throw new NotFoundException('Không tìm thấy bài tập.');
    await this.activity.log({ userId: null, actorId, action: 'PROBLEM_DELETED', detail: { code: result.rows[0].code } });
    return { id };
  }

  // ---- Bài nộp ----
  async listSubmissions(query: { status?: string; problemCode?: string; username?: string; page?: string; pageSize?: string }) {
    const p = pageParams(query.page, query.pageSize);
    const where: string[] = [];
    const values: unknown[] = [];
    if (query.status) { values.push(query.status); where.push(`s.status = $${values.length}`); }
    if (query.problemCode) { values.push(query.problemCode.toUpperCase()); where.push(`s.problem_code = $${values.length}`); }
    if (query.username) { values.push(`%${escapeLike(query.username)}%`); where.push(`u.username ILIKE $${values.length}`); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await this.database.query(
      `SELECT s.id, u.username, s.problem_code AS "problemCode", s.language_id AS "languageId", s.status, s.score,
              s.passed_tests AS "passedTests", s.total_tests AS "totalTests", s.execution_time AS "executionTime",
              s.memory_used AS "memoryUsed", s.created_at AS "createdAt"
       FROM submissions s JOIN users u ON u.id = s.user_id ${clause}
       ORDER BY s.created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, p.pageSize, p.offset],
    );
    const total = await this.database.query<{ count: string }>(
      `SELECT count(*) FROM submissions s JOIN users u ON u.id = s.user_id ${clause}`,
      values,
    );
    return { items: rows.rows, total: Number(total.rows[0]?.count ?? 0), page: p.page, pageSize: p.pageSize };
  }

  async deleteSubmission(actorId: string, id: string) {
    if (!UUID.test(id)) throw new NotFoundException('Không tìm thấy bài nộp.');
    const result = await this.database.query('DELETE FROM submissions WHERE id = $1 RETURNING id', [id]);
    if (!result.rows[0]) throw new NotFoundException('Không tìm thấy bài nộp.');
    await this.activity.log({ userId: null, actorId, action: 'SUBMISSION_DELETED', detail: { id } });
    return { id };
  }

  async rejudge(actorId: string, id: string) {
    if (!UUID.test(id)) throw new NotFoundException('Không tìm thấy bài nộp.');
    const result = await this.database.query(
      `UPDATE submissions SET status = 'PENDING', score = 0, passed_tests = 0, execution_time = NULL,
              memory_used = NULL, compile_output = NULL WHERE id = $1 RETURNING id`,
      [id],
    );
    if (!result.rows[0]) throw new NotFoundException('Không tìm thấy bài nộp.');
    await this.judgeQueue.add('judge', { submissionId: id }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 1000, removeOnFail: 1000 });
    await this.activity.log({ userId: null, actorId, action: 'SUBMISSION_REJUDGED', detail: { id } });
    return { id, status: 'PENDING' };
  }

  // ---- Kiểm duyệt nội dung ----
  async listContributions(query: { status?: string; kind?: string; page?: string; pageSize?: string }) {
    const p = pageParams(query.page, query.pageSize);
    const where: string[] = [];
    const values: unknown[] = [];
    if (query.status) { values.push(query.status); where.push(`c.status = $${values.length}`); }
    if (query.kind) { values.push(query.kind); where.push(`c.kind = $${values.length}`); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await this.database.query(
      `SELECT c.id, u.username, c.kind, c.problem_code AS "problemCode", c.title, c.body, c.status,
              c.moderation_note AS "moderationNote", c.created_at AS "createdAt"
       FROM contributions c JOIN users u ON u.id = c.user_id ${clause}
       ORDER BY (c.status = 'PENDING') DESC, c.created_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, p.pageSize, p.offset],
    );
    const total = await this.database.query<{ count: string }>(`SELECT count(*) FROM contributions c ${clause}`, values);
    return { items: rows.rows, total: Number(total.rows[0]?.count ?? 0), page: p.page, pageSize: p.pageSize };
  }

  async moderate(actorId: string, id: string, input: ModerateDto) {
    if (!UUID.test(id)) throw new NotFoundException('Không tìm thấy nội dung.');
    const result = await this.database.query(
      `UPDATE contributions SET status = $2, moderation_note = $3, moderated_by = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING id, status, user_id`,
      [id, input.status, input.note ?? null, actorId],
    );
    const row = result.rows[0] as { id: string; status: string; user_id: string } | undefined;
    if (!row) throw new NotFoundException('Không tìm thấy nội dung.');
    await this.activity.log({ userId: row.user_id, actorId, action: 'CONTENT_MODERATED', detail: { id, status: input.status } });
    return { id: row.id, status: row.status };
  }

  async deleteContribution(actorId: string, id: string) {
    if (!UUID.test(id)) throw new NotFoundException('Không tìm thấy nội dung.');
    const result = await this.database.query('DELETE FROM contributions WHERE id = $1 RETURNING id', [id]);
    if (!result.rows[0]) throw new NotFoundException('Không tìm thấy nội dung.');
    await this.activity.log({ userId: null, actorId, action: 'CONTENT_DELETED', detail: { id } });
    return { id };
  }

  // ---- Hỗ trợ kỹ thuật ----
  async listTickets(query: { status?: string; page?: string; pageSize?: string }) {
    const p = pageParams(query.page, query.pageSize);
    const values: unknown[] = [];
    let clause = '';
    if (query.status) { values.push(query.status); clause = 'WHERE t.status = $1'; }
    const rows = await this.database.query(
      `SELECT t.id, u.username, u.email, t.subject, t.message, t.status, t.priority, t.admin_reply AS "adminReply",
              t.created_at AS "createdAt", t.updated_at AS "updatedAt"
       FROM support_tickets t JOIN users u ON u.id = t.user_id ${clause}
       ORDER BY (t.status IN ('OPEN','IN_PROGRESS')) DESC,
                CASE t.priority WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'NORMAL' THEN 2 ELSE 3 END, t.created_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, p.pageSize, p.offset],
    );
    const total = await this.database.query<{ count: string }>(`SELECT count(*) FROM support_tickets t ${clause}`, values);
    return { items: rows.rows, total: Number(total.rows[0]?.count ?? 0), page: p.page, pageSize: p.pageSize };
  }

  async updateTicket(actorId: string, id: string, input: TicketUpdateDto) {
    if (!UUID.test(id)) throw new NotFoundException('Không tìm thấy yêu cầu.');
    const result = await this.database.query(
      `UPDATE support_tickets
       SET status = COALESCE($2, status), priority = COALESCE($3, priority), admin_reply = COALESCE($4, admin_reply),
           handled_by = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING id, status, priority, user_id`,
      [id, input.status ?? null, input.priority ?? null, input.reply ?? null, actorId],
    );
    const row = result.rows[0] as { id: string; status: string; priority: string; user_id: string } | undefined;
    if (!row) throw new NotFoundException('Không tìm thấy yêu cầu.');
    await this.activity.log({ userId: row.user_id, actorId, action: 'TICKET_UPDATED', detail: { id, status: row.status } });
    return { id: row.id, status: row.status, priority: row.priority };
  }
}
