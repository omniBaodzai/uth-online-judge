import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { ContactRepository } from './contact.repository.js';

describe('ContactRepository', () => {
  it('uses a hashed IP and enforces a capped five-request hourly window', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ requestCount: 5 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ requestCount: 6 }] });
    const repository = new ContactRepository({ query } as unknown as Pool);

    await expect(repository.consumePublicSubmissionLimit('203.0.113.8')).resolves.toBe(true);
    await expect(repository.consumePublicSubmissionLimit('203.0.113.8')).resolves.toBe(false);

    const rateLimitCalls = query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO public.contact_submission_rate_limits'));
    expect(rateLimitCalls).toHaveLength(2);
    expect(rateLimitCalls[0]?.[0]).toContain("INTERVAL '1 hour'");
    expect(rateLimitCalls[0]?.[0]).toContain('LEAST(');
    expect(rateLimitCalls[0]?.[1]?.[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(rateLimitCalls[0]?.[1]?.[0]).not.toBe('203.0.113.8');
  });

  it('filters the admin list by category and searches username and problem fields', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new ContactRepository({ query } as unknown as Pool);
    await repository.listAdmin({ page: 2, pageSize: 10, q: 'hello', category: 'PROBLEM_REPORT' });
    const [listSql, listValues] = query.mock.calls[0] as [string, unknown[]];
    expect(listSql).toContain('m.category = $3');
    expect(listSql).toContain('m.problem_code_snapshot ILIKE $2');
    expect(listSql).toContain('u.username FROM public.users u');
    expect(listValues).toEqual([null, '%hello%', 'PROBLEM_REPORT', 10, 10]);
    expect(query.mock.calls[1]?.[1]).toEqual([null, '%hello%', 'PROBLEM_REPORT']);
  });

  it('inserts problem reports as NEW PROBLEM_REPORT rows with parameterized values', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 'report-id' }] });
    const repository = new ContactRepository({ query } as unknown as Pool);
    await repository.createProblemReport({
      userId: 'user-id',
      fullName: 'alice',
      email: 'alice@uth.edu.vn',
      subject: 's',
      content: "x'; DROP TABLE users;--",
      reportType: 'OTHER',
      problem: { id: 'problem-id', code: 'hello', title: 'Hello' },
    });
    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("'PROBLEM_REPORT'");
    expect(sql).not.toContain('DROP TABLE');
    expect(values).toContain("x'; DROP TABLE users;--");
  });

  function makeClient(queryImpl: (sql: string, values?: unknown[]) => Promise<unknown>) {
    const client = {
      query: vi.fn((sql: string, values?: unknown[]) => queryImpl(sql, values)),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) };
    return { client, repository: new ContactRepository(pool as unknown as Pool) };
  }

  it('creates an Admin reply and its user notification in one transaction', async () => {
    const reply = {
      id: 'reply-id',
      contactMessageId: 'message-id',
      senderUserId: 'admin-id',
      senderRole: 'ADMIN',
      senderName: 'Admin',
      content: 'We have replied.',
      createdAt: '2026-11-02T00:00:00.000Z',
    };
    const calls: string[] = [];
    const { client, repository } = makeClient(async (sql) => {
      calls.push(sql);
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('FROM public.contact_messages')) {
        return { rows: [{ userId: 'owner-id', subject: 'Need help', status: 'NEW' }] };
      }
      if (sql.includes('FROM public.users')) return { rows: [{ senderName: 'Admin' }] };
      if (sql.includes('INSERT INTO public.contact_replies')) return { rows: [reply] };
      if (sql.includes('INSERT INTO public.notifications')) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    await expect(repository.createReply({
      contactMessageId: 'message-id',
      senderUserId: 'admin-id',
      senderRole: 'ADMIN',
      content: reply.content,
      idempotencyKey: null,
    })).resolves.toEqual({ reply, created: true });

    expect(calls[0]).toBe('BEGIN');
    expect(calls.at(-1)).toBe('COMMIT');
    expect(calls).toContainEqual(expect.stringContaining('INSERT INTO public.notifications'));
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rolls back resolved user replies and rejects attempts to access another owner request', async () => {
    for (const [rows, expectedError] of [
      [[{ userId: 'user-id', subject: 'Resolved', status: 'RESOLVED' }], ConflictException],
      [[{ userId: 'different-user', subject: 'Private', status: 'NEW' }], NotFoundException],
    ] as const) {
      const { client, repository } = makeClient(async (sql) => {
        if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] };
        if (sql.includes('FROM public.contact_messages')) return { rows };
        throw new Error(`Unexpected SQL: ${sql}`);
      });

      await expect(repository.createReply({
        contactMessageId: 'message-id',
        senderUserId: 'user-id',
        senderRole: 'USER',
        content: 'Reply',
        idempotencyKey: null,
        requireOwner: true,
      })).rejects.toBeInstanceOf(expectedError);

      expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
      expect(client.release).toHaveBeenCalledOnce();
    }
  });

  it('does not create another reply or notification for an idempotent retry', async () => {
    const existing = {
      id: 'reply-id',
      contactMessageId: 'message-id',
      senderUserId: 'admin-id',
      senderRole: 'ADMIN',
      senderName: 'Admin',
      content: 'Original reply',
      createdAt: '2026-11-02T00:00:00.000Z',
    };
    const { client, repository } = makeClient(async (sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('FROM public.contact_messages')) {
        return { rows: [{ userId: 'owner-id', subject: 'Need help', status: 'NEW' }] };
      }
      if (sql.includes('FROM public.users')) return { rows: [{ senderName: 'Admin' }] };
      if (sql.includes('INSERT INTO public.contact_replies')) return { rows: [] };
      if (sql.includes('FROM public.contact_replies')) return { rows: [existing] };
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    await expect(repository.createReply({
      contactMessageId: 'message-id',
      senderUserId: 'admin-id',
      senderRole: 'ADMIN',
      content: 'Original reply',
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
    })).resolves.toEqual({ reply: existing, created: false });
    expect(client.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO public.notifications'))).toBe(false);
  });
});
