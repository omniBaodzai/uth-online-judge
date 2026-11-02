import { BadRequestException } from '@nestjs/common';
import { ContestsRepository } from './contests.repository.js';

describe('ContestsRepository', () => {
  it('uses bound parameters for list filters and escapes LIKE wildcards', async () => {
    const database = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    const repository = new ContestsRepository(database as never);

    await repository.list({
      page: 2,
      pageSize: 10,
      search: "x%_'; DROP TABLE contests; --",
      publicationStatus: 'DRAFT',
    });

    const [sql, values] = database.query.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toContain('DROP TABLE');
    expect(values).toEqual(["%x\\%\\_'; DROP TABLE contests; --%", 'DRAFT']);
    expect(database.query.mock.calls[1]?.[1]).toEqual([
      "%x\\%\\_'; DROP TABLE contests; --%",
      'DRAFT',
      10,
      10,
    ]);
  });

  it('creates a contest inside a transaction and returns a mapped detail', async () => {
    const now = new Date('2026-10-31T00:00:00Z');
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('INSERT INTO public.contests')) return { rows: [{ id: 'contest-id' }] };
        if (sql.includes('FROM public.contests c') && sql.includes('participant_count')) {
          return {
            rows: [{
              id: 'contest-id',
              slug: 'contest-2026',
              title: 'Contest 2026',
              description: null,
              rules: null,
              starts_at: now,
              ends_at: new Date('2026-11-01T00:00:00Z'),
              publication_status: 'DRAFT',
              visibility: 'PUBLIC',
              allow_registration: true,
              show_leaderboard: true,
              created_by: 'admin-id',
              updated_by: 'admin-id',
              created_at: now,
              updated_at: now,
              published_at: null,
              participant_count: 0,
            }],
          };
        }
        if (sql.includes('FROM public.contest_problems')) return { rows: [] };
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    const database = { connect: vi.fn().mockResolvedValue(client) };
    const repository = new ContestsRepository(database as never);

    const result = await repository.create({
      slug: 'contest-2026',
      title: 'Contest 2026',
      startsAt: '2026-11-01T07:00:00Z',
      endsAt: '2026-11-01T12:00:00Z',
    }, 'admin-id');

    expect(result).toMatchObject({
      id: 'contest-id',
      publicationStatus: 'DRAFT',
      participantCount: 0,
      problems: [],
    });
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rejects publishing a private contest and rolls back without database writes', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FOR UPDATE')) {
          return {
            rows: [{
              id: 'contest-id',
              slug: 'private-contest',
              title: 'Private',
              description: null,
              rules: null,
              starts_at: new Date('2026-11-01T07:00:00Z'),
              ends_at: new Date('2026-11-01T12:00:00Z'),
              publication_status: 'DRAFT',
              visibility: 'PRIVATE',
              allow_registration: true,
              show_leaderboard: true,
              created_by: 'admin-id',
              updated_by: null,
              created_at: new Date(),
              updated_at: new Date(),
              published_at: null,
            }],
          };
        }
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    const repository = new ContestsRepository({
      connect: vi.fn().mockResolvedValue(client),
    } as never);

    await expect(repository.publish('contest-id')).rejects.toBeInstanceOf(BadRequestException);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes("SET publication_status = 'PUBLISHED'"))).toBe(false);
    expect(client.release).toHaveBeenCalledOnce();
  });
});
