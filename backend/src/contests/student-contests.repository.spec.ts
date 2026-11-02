import { ConflictException, NotFoundException } from '@nestjs/common';
import { StudentContestsRepository } from './student-contests.repository.js';

const contestId = 'c0a80101-0000-4000-8000-000000000001';
const userId = 'c0a80101-0000-4000-8000-000000000002';
const startsAt = new Date('2026-10-31T07:00:00.000Z');
const endsAt = new Date('2026-10-31T08:00:00.000Z');

function publicContestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: contestId,
    slug: 'uth-challenge',
    title: 'UTH Challenge',
    description: 'Public contest',
    rules: 'Rules',
    starts_at: startsAt,
    ends_at: endsAt,
    allow_registration: true,
    time_status: 'ONGOING',
    can_register: false,
    participant_count: 2,
    is_registered: true,
    registration_status: 'REGISTERED',
    database_now: new Date('2026-10-31T07:30:00.000Z'),
    ...overrides,
  };
}

function databaseWithClient(client: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> }) {
  return { connect: vi.fn().mockResolvedValue(client) };
}

describe('StudentContestsRepository', () => {
  it('lists only public published contests using a single PostgreSQL time snapshot and bound filters', async () => {
    const databaseNow = new Date('2026-10-31T07:30:00.000Z');
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ now: databaseNow }] })
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({
          rows: [publicContestRow({ rules: undefined })],
        })
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    };
    const repository = new StudentContestsRepository(databaseWithClient(client) as never);

    const result = await repository.list({
      page: 2,
      pageSize: 10,
      search: "x%_'; SELECT pg_sleep(10)--",
      timeStatus: 'ONGOING',
      sort: 'title',
      order: 'desc',
    }, userId);

    expect(result).toMatchObject({
      total: 1,
      page: 2,
      pageSize: 10,
      items: [{ slug: 'uth-challenge', timeStatus: 'ONGOING', isRegistered: true }],
    });
    const countCall = client.query.mock.calls[2] as [string, unknown[]];
    const pageCall = client.query.mock.calls[3] as [string, unknown[]];
    expect(countCall[0]).toContain("c.publication_status = 'PUBLISHED' AND c.visibility = 'PUBLIC'");
    expect(countCall[0]).toContain('c.starts_at <= $2::timestamptz');
    expect(countCall[1]).toEqual([
      "%x\\%\\_'; SELECT pg\\_sleep(10)--%",
      databaseNow,
    ]);
    expect(pageCall[0]).toContain('ORDER BY title DESC NULLS LAST, c.id ASC');
    expect(pageCall[0]).toContain('registration.user_id = $1::uuid');
    expect(pageCall[0]).not.toMatch(/test_case_revision|answer|source_code/i);
    expect(pageCall[1]).toEqual([
      userId,
      databaseNow,
      "%x\\%\\_'; SELECT pg\\_sleep(10)--%",
      databaseNow,
      10,
      10,
    ]);
    expect(client.query).toHaveBeenCalledWith(
      'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY',
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('does not pass unused parameters when listing without filters', async () => {
    const databaseNow = new Date('2026-10-31T07:30:00.000Z');
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ now: databaseNow }] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({
          rows: [publicContestRow({ is_registered: false, can_register: true })],
        }),
      release: vi.fn(),
    };
    const repository = new StudentContestsRepository(databaseWithClient(client) as never);

    const result = await repository.list({
      page: 1,
      pageSize: 20,
      search: undefined,
      timeStatus: undefined,
      sort: 'startsAt',
      order: 'asc',
    }, null);

    const countCall = client.query.mock.calls[2] as [string, unknown[]];
    const pageCall = client.query.mock.calls[3] as [string, unknown[]];
    expect(countCall[1]).toEqual([]);
    expect(pageCall[1]).toEqual([null, databaseNow, 20, 0]);
    expect(result.items[0]?.isRegistered).toBe(false);
  });

  it('returns no problem details for an unregistered visitor, including before the contest starts', async () => {
    const now = new Date('2026-10-30T07:30:00.000Z');
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [publicContestRow({
            time_status: 'UPCOMING',
            can_register: true,
            is_registered: false,
            registration_status: null,
            database_now: now,
          })],
        })
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    };
    const repository = new StudentContestsRepository(databaseWithClient(client) as never);

    const result = await repository.findPublic('uth-challenge', null);

    expect(result).toMatchObject({
      timeStatus: 'UPCOMING',
      canRegister: true,
      isRegistered: false,
      registrationStatus: null,
      problems: [],
    });
    expect(client.query.mock.calls[1]?.[1]).toEqual([null, 'uth-challenge', null]);
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('FROM public.contest_problems'),
      expect.anything(),
    );
  });

  it('returns problem snapshots only for a registered participant during the active window', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [publicContestRow()] })
        .mockResolvedValueOnce({
          rows: [{
            problem_id: 'p1',
            problem_code_snapshot: 'sum-two',
            problem_title_snapshot: 'Sum two',
            position: 1,
            max_score: '25.50',
          }],
        })
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    };
    const repository = new StudentContestsRepository(databaseWithClient(client) as never);

    const result = await repository.findPublic(contestId, userId);

    expect(result.problems).toEqual([{
      problemId: 'p1',
      problemCode: 'sum-two',
      problemTitle: 'Sum two',
      position: 1,
      maxScore: 25.5,
    }]);
    expect(client.query.mock.calls[1]?.[1]).toEqual([contestId, contestId, userId]);
    expect(client.query.mock.calls[2]?.[0]).not.toMatch(
      /test_case_revision|test_case|answer|source_code/i,
    );
  });

  it('hides drafts, private contests, and archived contests behind the same 404', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    };
    const repository = new StudentContestsRepository(databaseWithClient(client) as never);

    await expect(repository.findPublic('hidden-contest', null))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("c.publication_status = 'PUBLISHED' AND c.visibility = 'PUBLIC'"),
      [null, 'hidden-contest', null],
    );
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('creates a participant row inside a transaction and resolves slug identifiers', async () => {
    const registeredAt = new Date('2026-10-30T06:00:00.000Z');
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM public.contests c') && sql.includes('FOR UPDATE')) {
          return { rows: [{ id: contestId }] };
        }
        if (sql.includes('AS before_start')) {
          return { rows: [{ before_start: true, allow_registration: true }] };
        }
        if (sql.includes('FROM public.contest_participants') && sql.includes('FOR UPDATE')) {
          return { rows: [] };
        }
        if (sql.includes('INSERT INTO public.contest_participants')) {
          return {
            rows: [{
              contest_id: contestId,
              registration_status: 'REGISTERED',
              registered_at: registeredAt,
            }],
          };
        }
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    const repository = new StudentContestsRepository(databaseWithClient(client) as never);

    await expect(repository.register('uth-challenge', userId)).resolves.toEqual({
      contestId,
      registrationStatus: 'REGISTERED',
      registeredAt: registeredAt.toISOString(),
    });

    const lockCall = client.query.mock.calls.find(([sql]) =>
      String(sql).includes('FROM public.contests c') && String(sql).includes('FOR UPDATE'),
    ) as [string, unknown[]];
    expect(lockCall[0]).toContain('c.slug = $2');
    expect(lockCall[1]).toEqual([null, 'uth-challenge']);
    const insertCall = client.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO public.contest_participants'),
    ) as [string, unknown[]];
    expect(insertCall[0]).toContain('c.starts_at > clock_timestamp()');
    expect(insertCall[1]).toEqual([contestId, userId]);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('allows cancelled participants to register again by updating the existing row', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM public.contests c') && sql.includes('FOR UPDATE')) {
          return { rows: [{ id: contestId }] };
        }
        if (sql.includes('AS before_start')) {
          return { rows: [{ before_start: true, allow_registration: true }] };
        }
        if (sql.includes('FROM public.contest_participants') && sql.includes('FOR UPDATE')) {
          return { rows: [{ registration_status: 'CANCELLED' }] };
        }
        if (sql.includes('UPDATE public.contest_participants')) {
          return {
            rows: [{
              contest_id: contestId,
              registration_status: 'REGISTERED',
              registered_at: startsAt,
            }],
          };
        }
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    const repository = new StudentContestsRepository(databaseWithClient(client) as never);

    await expect(repository.register(contestId, userId)).resolves.toMatchObject({
      registrationStatus: 'REGISTERED',
    });
    expect(client.query.mock.calls.some(([sql]) =>
      String(sql).includes('UPDATE public.contest_participants'),
    )).toBe(true);
    expect(client.query.mock.calls.some(([sql]) =>
      String(sql).includes('INSERT INTO public.contest_participants'),
    )).toBe(false);
  });

  it('rejects duplicate registration and a registration that crosses the start boundary', async () => {
    const duplicateClient = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM public.contests c') && sql.includes('FOR UPDATE')) {
          return { rows: [{ id: contestId }] };
        }
        if (sql.includes('AS before_start')) {
          return { rows: [{ before_start: true, allow_registration: true }] };
        }
        if (sql.includes('FROM public.contest_participants') && sql.includes('FOR UPDATE')) {
          return { rows: [{ registration_status: 'REGISTERED' }] };
        }
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    const duplicateRepository = new StudentContestsRepository(
      databaseWithClient(duplicateClient) as never,
    );
    await expect(duplicateRepository.register(contestId, userId))
      .rejects.toBeInstanceOf(ConflictException);
    expect(duplicateClient.query.mock.calls.some(([sql]) =>
      String(sql).includes('INSERT INTO public.contest_participants'),
    )).toBe(false);

    const cutoffClient = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM public.contests c') && sql.includes('FOR UPDATE')) {
          return { rows: [{ id: contestId }] };
        }
        if (sql.includes('AS before_start')) {
          return { rows: [{ before_start: false, allow_registration: true }] };
        }
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    const cutoffRepository = new StudentContestsRepository(
      databaseWithClient(cutoffClient) as never,
    );
    await expect(cutoffRepository.register(contestId, userId))
      .rejects.toBeInstanceOf(ConflictException);
    expect(cutoffClient.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('rejects new registrations when the contest disables registration', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM public.contests c') && sql.includes('FOR UPDATE')) {
          return { rows: [{ id: contestId }] };
        }
        if (sql.includes('AS before_start')) {
          return { rows: [{ before_start: true, allow_registration: false }] };
        }
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    const repository = new StudentContestsRepository(databaseWithClient(client) as never);

    await expect(repository.register(contestId, userId))
      .rejects.toBeInstanceOf(ConflictException);
    expect(client.query.mock.calls.some(([sql]) =>
      String(sql).includes('FROM public.contest_participants'),
    )).toBe(false);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('cancels an active registration without deleting its record', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM public.contests c') && sql.includes('FOR UPDATE')) {
          return { rows: [{ id: contestId }] };
        }
        if (sql.includes('AS before_start')) {
          return { rows: [{ before_start: true, allow_registration: false }] };
        }
        if (sql.includes('UPDATE public.contest_participants')) {
          return {
            rows: [{
              contest_id: contestId,
              registration_status: 'CANCELLED',
              registered_at: startsAt,
            }],
          };
        }
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    const repository = new StudentContestsRepository(databaseWithClient(client) as never);

    await expect(repository.cancel(contestId, userId)).resolves.toMatchObject({
      registrationStatus: 'CANCELLED',
    });
    expect(client.query.mock.calls.some(([sql]) =>
      String(sql).includes('DELETE FROM public.contest_participants'),
    )).toBe(false);
  });
});
