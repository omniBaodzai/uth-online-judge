import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';
import { ActivityLogService } from '../platform/activity-log.service.js';

const BACKUP_NAME = /^backup-\d{8}-\d{6}\.json$/;
// Thứ tự phụ thuộc khóa ngoại: bảng cha trước, bảng con sau.
const BACKUP_TABLES = ['users', 'problems', 'test_cases', 'submissions', 'contributions', 'support_tickets', 'activity_logs', 'system_settings'] as const;
const MAX_IMPORT_ROWS = 5000;

type ExportDefinition = { sql: string; columns: string[] };
const EXPORTS: Record<string, ExportDefinition> = {
  users: {
    // Không bao giờ xuất password_hash.
    sql: 'SELECT username, email, full_name, role, is_active, created_at FROM users ORDER BY created_at',
    columns: ['username', 'email', 'full_name', 'role', 'is_active', 'created_at'],
  },
  problems: {
    sql: 'SELECT code, title, time_limit_seconds, memory_limit_mb, total_score FROM problems ORDER BY code',
    columns: ['code', 'title', 'time_limit_seconds', 'memory_limit_mb', 'total_score'],
  },
  test_cases: {
    sql: `SELECT p.code AS problem_code, t.position, t.input, t.expected_output, t.is_sample
          FROM test_cases t JOIN problems p ON p.id = t.problem_id ORDER BY p.code, t.position`,
    columns: ['problem_code', 'position', 'input', 'expected_output', 'is_sample'],
  },
  submissions: {
    sql: `SELECT u.username, s.problem_code, s.language_id, s.status, s.score, s.passed_tests, s.total_tests,
                 s.execution_time, s.memory_used, s.created_at
          FROM submissions s JOIN users u ON u.id = s.user_id ORDER BY s.created_at DESC`,
    columns: ['username', 'problem_code', 'language_id', 'status', 'score', 'passed_tests', 'total_tests', 'execution_time', 'memory_used', 'created_at'],
  },
};

/** Chống CSV/Excel formula injection: ô chuỗi bắt đầu bằng = + - @ sẽ được thêm dấu nháy đơn. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const lines = [columns.join(',')];
  for (const row of rows) lines.push(columns.map((column) => csvCell(row[column])).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`; // BOM để Excel nhận đúng UTF-8
}

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(cell); cell = '';
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
    } else cell += char;
  }
  row.push(cell);
  if (row.some((value) => value !== '')) rows.push(row);
  const [header, ...body] = rows;
  if (!header) return [];
  const names = header.map((name) => name.trim());
  return body.map((values) => Object.fromEntries(names.map((name, index) => [name, values[index] ?? ''])));
}

@Injectable()
export class AdminDataService {
  private readonly backupDir = process.env.BACKUP_DIR ?? join(process.cwd(), 'backups');

  constructor(
    @Inject(DATABASE_POOL) private readonly database: Pool,
    private readonly activity: ActivityLogService,
  ) {}

  // ---- Xuất / nhập CSV ----
  async exportCsv(actorId: string, table: string) {
    const definition = EXPORTS[table];
    if (!definition) throw new BadRequestException('Bảng không được hỗ trợ xuất dữ liệu.');
    const rows = await this.database.query(definition.sql);
    await this.activity.log({ userId: null, actorId, action: 'DATA_EXPORTED', detail: { table, rows: rows.rowCount } });
    return { filename: `${table}-${new Date().toISOString().slice(0, 10)}.csv`, content: toCsv(rows.rows, definition.columns) };
  }

  async importCsv(actorId: string, table: 'problems' | 'test_cases', csv: string) {
    const rows = parseCsv(csv);
    if (rows.length === 0) throw new BadRequestException('Tệp CSV không có dữ liệu.');
    if (rows.length > MAX_IMPORT_ROWS) throw new BadRequestException(`Tối đa ${MAX_IMPORT_ROWS} dòng mỗi lần nhập.`);

    const client = await this.database.connect();
    const errors: string[] = [];
    let imported = 0;
    try {
      await client.query('BEGIN');
      if (table === 'problems') {
        for (const [index, row] of rows.entries()) {
          const code = row.code?.trim().toUpperCase();
          const time = Number(row.time_limit_seconds || 1);
          const memory = Number.parseInt(row.memory_limit_mb || '256', 10);
          const score = Number.parseInt(row.total_score || '100', 10);
          if (!code || !/^[A-Z0-9_-]{2,30}$/.test(code) || !row.title?.trim() || !(time > 0 && time <= 30) || !(memory >= 16 && memory <= 2048) || !(score >= 1 && score <= 10000)) {
            errors.push(`Dòng ${index + 2}: dữ liệu không hợp lệ`);
            continue;
          }
          await client.query(
            `INSERT INTO problems (code, title, time_limit_seconds, memory_limit_mb, total_score)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (code) DO UPDATE SET title = EXCLUDED.title, time_limit_seconds = EXCLUDED.time_limit_seconds,
               memory_limit_mb = EXCLUDED.memory_limit_mb, total_score = EXCLUDED.total_score`,
            [code, row.title.trim(), time, memory, score],
          );
          imported += 1;
        }
      } else {
        // Với mỗi bài có trong tệp, thay toàn bộ test case hiện có bằng test case trong tệp.
        const grouped = new Map<string, Record<string, string>[]>();
        for (const [index, row] of rows.entries()) {
          const code = row.problem_code?.trim().toUpperCase();
          if (!code) { errors.push(`Dòng ${index + 2}: thiếu problem_code`); continue; }
          grouped.set(code, [...(grouped.get(code) ?? []), row]);
        }
        for (const [code, tests] of grouped) {
          const problem = await client.query<{ id: string }>('SELECT id FROM problems WHERE code = $1', [code]);
          if (!problem.rows[0]) { errors.push(`Không tìm thấy bài ${code}`); continue; }
          await client.query('DELETE FROM test_cases WHERE problem_id = $1', [problem.rows[0].id]);
          for (const [index, test] of tests.entries()) {
            await client.query(
              'INSERT INTO test_cases (problem_id, position, input, expected_output, is_sample) VALUES ($1, $2, $3, $4, $5)',
              [problem.rows[0].id, index + 1, test.input ?? '', test.expected_output ?? '', /^(true|1|t)$/i.test(test.is_sample ?? '')],
            );
            imported += 1;
          }
        }
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    await this.activity.log({ userId: null, actorId, action: 'DATA_IMPORTED', detail: { table, imported, errors: errors.length } });
    return { imported, errors: errors.slice(0, 50) };
  }

  // ---- Sao lưu / phục hồi ----
  async listBackups() {
    await mkdir(this.backupDir, { recursive: true });
    const names = (await readdir(this.backupDir)).filter((name) => BACKUP_NAME.test(name));
    const items = await Promise.all(
      names.map(async (name) => {
        const info = await stat(join(this.backupDir, name));
        return { name, sizeBytes: info.size, createdAt: info.mtime.toISOString() };
      }),
    );
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createBackup(actorId: string | null, reason = 'manual') {
    await mkdir(this.backupDir, { recursive: true });
    const tables: Record<string, unknown[]> = {};
    for (const table of BACKUP_TABLES) {
      const result = await this.database.query<{ data: unknown[] }>(`SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) AS data FROM ${table} t`);
      tables[table] = result.rows[0]?.data ?? [];
    }
    // Không bao giờ ghi đè: nếu trùng giây thì lùi sang giây kế tiếp.
    let name = '';
    for (let offset = 0; ; offset += 1) {
      const stamp = new Date(Date.now() + offset * 1000).toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
      name = `backup-${stamp}.json`;
      try {
        // Tệp chứa password_hash nên chỉ chủ tiến trình được đọc.
        await writeFile(join(this.backupDir, name), JSON.stringify({ version: 1, createdAt: new Date().toISOString(), tables }), { mode: 0o600, flag: 'wx' });
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || offset > 60) throw error;
      }
    }
    await this.activity.log({ userId: null, actorId, action: 'BACKUP_CREATED', detail: { name, reason } });
    return { name };
  }

  async restoreBackup(actorId: string, name: string) {
    const file = this.resolveBackup(name);
    let parsed: { version?: number; tables?: Record<string, unknown> };
    try {
      parsed = JSON.parse(await readFile(file, 'utf8')) as typeof parsed;
    } catch {
      throw new NotFoundException('Không tìm thấy hoặc không đọc được tệp sao lưu.');
    }
    if (parsed.version !== 1 || !parsed.tables || BACKUP_TABLES.some((table) => !Array.isArray(parsed.tables?.[table]))) {
      throw new BadRequestException('Tệp sao lưu không hợp lệ hoặc không đầy đủ.');
    }

    const safety = await this.createBackup(actorId, 'pre-restore');
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      await client.query(`TRUNCATE TABLE ${[...BACKUP_TABLES, 'refresh_tokens'].join(', ')} RESTART IDENTITY CASCADE`);
      for (const table of BACKUP_TABLES) {
        const rows = parsed.tables[table] as unknown[];
        if (rows.length) {
          await client.query(`INSERT INTO ${table} SELECT * FROM jsonb_populate_recordset(NULL::${table}, $1::jsonb)`, [JSON.stringify(rows)]);
        }
      }
      await client.query(`SELECT setval(pg_get_serial_sequence('activity_logs', 'id'), COALESCE((SELECT max(id) FROM activity_logs), 0) + 1, false)`);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    await this.activity.log({ userId: null, actorId, action: 'BACKUP_RESTORED', detail: { name, safetyBackup: safety.name } });
    return { restored: name, safetyBackup: safety.name };
  }

  async deleteBackup(actorId: string, name: string) {
    await unlink(this.resolveBackup(name)).catch(() => {
      throw new NotFoundException('Không tìm thấy tệp sao lưu.');
    });
    await this.activity.log({ userId: null, actorId, action: 'BACKUP_DELETED', detail: { name } });
    return { name };
  }

  private resolveBackup(name: string) {
    if (!BACKUP_NAME.test(name)) throw new BadRequestException('Tên tệp sao lưu không hợp lệ.');
    return join(this.backupDir, name);
  }
}
