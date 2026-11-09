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
    expect(pageCall[0]).toContain(
      '(c.ends_at <= $2::timestamptz OR account.is_active = TRUE)',
    );
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
    expect(client.query.mock.calls[1]?.[0]).toContain(
      '(c.ends_at <= db_clock.now OR account.is_active = TRUE)',
    );
    expect(client.query.mock.calls[1]?.[0]).toContain('c.organization_id IS NULL');
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
    expect(client.query.mock.calls[2]?.[0]).toContain(
      'contest_problem_content_accessible(cp.contest_id, cp.problem_id)',
    );
  });

  it('aggregates only the public contest submissions without joining per-test results', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            total_participants: 3,
            total_problems: 2,
            total_submissions: 8,
            accepted_submissions: 2,
            wrong_answer_submissions: 1,
            time_limit_submissions: 1,
            runtime_error_submissions: 1,
            pending_submissions: 2,
            other_submissions: 1,
            active_submitters: 4,
            solved_participants: 2,
            status_counts: [
              { status: 'ACCEPTED', count: 2 },
              { status: 'COMPILATION_ERROR', count: 1 },
              { status: 'PENDING', count: 1 },
              { status: 'QUEUED', count: 1 },
              { status: 'RUNTIME_ERROR', count: 1 },
              { status: 'TIME_LIMIT_EXCEEDED', count: 1 },
              { status: 'WRONG_ANSWER', count: 1 },
            ],
            problem_statistics: [
              {
                problem_id: 'p1',
                problem_code: 'sum-two',
                problem_title: 'Sum two',
                total_submissions: 5,
                accepted_submissions: 2,
                status_counts: [
                  { status: 'ACCEPTED', count: 2 },
                  { status: 'WRONG_ANSWER', count: 1 },
                  { status: 'PENDING', count: 2 },
                ],
              },
              {
                problem_id: 'p2',
                problem_code: 'array-sum',
                problem_title: 'Array sum',
                total_submissions: 3,
                accepted_submissions: 0,
                status_counts: [
                  { status: 'COMPILATION_ERROR', count: 1 },
                  { status: 'RUNTIME_ERROR', count: 1 },
                  { status: 'TIME_LIMIT_EXCEEDED', count: 1 },
                ],
              },
            ],
            language_statistics: [
              {
                language_id: 'language-1',
                language_name: 'C++ (GCC 14.1.0)',
                total_submissions: 8,
                accepted_submissions: 2,
                status_counts: [
                  { status: 'ACCEPTED', count: 2 },
                  { status: 'COMPILATION_ERROR', count: 1 },
                  { status: 'PENDING', count: 2 },
                  { status: 'RUNTIME_ERROR', count: 1 },
                  { status: 'TIME_LIMIT_EXCEEDED', count: 1 },
                  { status: 'WRONG_ANSWER', count: 1 },
                ],
              },
            ],
          }],
        })
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    };
    const repository = new StudentContestsRepository(databaseWithClient(client) as never);

    await expect(repository.findPublicStatistics('uth-challenge')).resolves.toEqual({
      totalParticipants: 3,
      totalProblems: 2,
      totalSubmissions: 8,
      acceptedSubmissions: 2,
      wrongAnswerSubmissions: 1,
      timeLimitSubmissions: 1,
      runtimeErrorSubmissions: 1,
      pendingSubmissions: 2,
      otherSubmissions: 1,
      activeSubmitters: 4,
      solvedParticipants: 2,
      statusCounts: [
        { status: 'ACCEPTED', count: 2 },
        { status: 'COMPILATION_ERROR', count: 1 },
        { status: 'PENDING', count: 1 },
        { status: 'QUEUED', count: 1 },
        { status: 'RUNTIME_ERROR', count: 1 },
        { status: 'TIME_LIMIT_EXCEEDED', count: 1 },
        { status: 'WRONG_ANSWER', count: 1 },
      ],
      problemStatistics: [
        {
          problemId: 'p1',
          problemCode: 'sum-two',
          problemTitle: 'Sum two',
          totalSubmissions: 5,
          acceptedSubmissions: 2,
          statusCounts: [
            { status: 'ACCEPTED', count: 2 },
            { status: 'WRONG_ANSWER', count: 1 },
            { status: 'PENDING', count: 2 },
          ],
        },
        {
          problemId: 'p2',
          problemCode: 'array-sum',
          problemTitle: 'Array sum',
          totalSubmissions: 3,
          acceptedSubmissions: 0,
          statusCounts: [
            { status: 'COMPILATION_ERROR', count: 1 },
            { status: 'RUNTIME_ERROR', count: 1 },
            { status: 'TIME_LIMIT_EXCEEDED', count: 1 },
          ],
        },
      ],
      languageStatistics: [
        {
          languageId: 'language-1',
          languageName: 'C++ (GCC 14.1.0)',
          totalSubmissions: 8,
          acceptedSubmissions: 2,
          statusCounts: [
            { status: 'ACCEPTED', count: 2 },
            { status: 'COMPILATION_ERROR', count: 1 },
            { status: 'PENDING', count: 2 },
            { status: 'RUNTIME_ERROR', count: 1 },
            { status: 'TIME_LIMIT_EXCEEDED', count: 1 },
            { status: 'WRONG_ANSWER', count: 1 },
          ],
        },
      ],
    });

    const [sql, values] = client.query.mock.calls[1] as [string, unknown[]];
    expect(sql).toContain("c.publication_status = 'PUBLISHED' AND c.visibility = 'PUBLIC'");
    expect(sql).toContain('s.contest_id = (SELECT id FROM public_contest)');
    expect(sql).toContain('public.contest_problem_content_accessible(s.contest_id, p.id)');
    expect(sql).toContain("owner.status = 'ACTIVE'");
    expect(sql).toContain("s.status IN ('PENDING', 'QUEUED', 'RUNNING')");
    expect(sql).toContain("participant.registration_status = 'REGISTERED'");
    expect(sql).toContain(
      '(contest.ends_at <= CURRENT_TIMESTAMP OR account.is_active = TRUE)',
    );
    expect(sql).toContain("FILTER (WHERE s.status = 'ACCEPTED')");
    expect(sql).toContain('(s.problem_id, s.status)');
    expect(sql).toContain('(s.language_id, s.status)');
    expect(sql).toContain('problem_code_snapshot');
    expect(sql).toContain('JOIN public.programming_languages language');
    expect(sql).not.toMatch(/submission_test_results|submission_test_case_results|JOIN.*test_results/i);
    expect(values).toEqual([null, 'uth-challenge']);
    expect(client.query).toHaveBeenCalledWith(
      'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY',
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('returns zero counts for a public contest with no submissions and hides non-public contests', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            total_participants: '0',
            total_problems: '1',
            total_submissions: '0',
            accepted_submissions: '0',
            wrong_answer_submissions: '0',
            time_limit_submissions: '0',
            runtime_error_submissions: '0',
            pending_submissions: '0',
            other_submissions: '0',
            active_submitters: '0',
            solved_participants: '0',
            status_counts: [],
            problem_statistics: [{
              problem_id: 'p1',
              problem_code: 'sum-two',
              problem_title: 'Sum two',
              total_submissions: '0',
              accepted_submissions: '0',
              status_counts: [],
            }],
            language_statistics: [],
          }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    };
    const repository = new StudentContestsRepository(databaseWithClient(client) as never);

    await expect(repository.findPublicStatistics(contestId)).resolves.toMatchObject({
      totalParticipants: 0,
      totalProblems: 1,
      totalSubmissions: 0,
      acceptedSubmissions: 0,
      pendingSubmissions: 0,
      activeSubmitters: 0,
      solvedParticipants: 0,
      statusCounts: [],
      problemStatistics: [{
        problemId: 'p1',
        problemCode: 'sum-two',
        problemTitle: 'Sum two',
        totalSubmissions: 0,
        acceptedSubmissions: 0,
        statusCounts: [],
      }],
      languageStatistics: [],
    });
    await expect(repository.findPublicStatistics('hidden-contest'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(client.query.mock.calls[1]?.[1]).toEqual([contestId, contestId]);
    expect(client.query.mock.calls[4]?.[0]).toContain(
      "c.publication_status = 'PUBLISHED' AND c.visibility = 'PUBLIC'",
    );
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(2);
  });

  it('ranks registered participants from eligible contest scores before search and pagination', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            contest_exists: true,
            total: '1',
            total_participants: '4',
            items: [{
              rank: 2,
              userId,
              username: 'coder_uth',
              avatarUrl: 'https://example.test/avatar.png',
              totalScore: '87.50',
              acceptedProblems: 1,
              totalProblems: 3,
              elapsedSeconds: '1842',
            }],
          }],
        })
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    };
    const repository = new StudentContestsRepository(databaseWithClient(client) as never);

    await expect(repository.findPublicLeaderboard('uth-challenge', {
      page: 2,
      pageSize: 20,
      search: 'coder_%',
    })).resolves.toEqual({
      items: [{
        rank: 2,
        userId,
        username: 'coder_uth',
        avatarUrl: 'https://example.test/avatar.png',
        totalScore: 87.5,
        acceptedProblems: 1,
        totalProblems: 3,
        elapsedSeconds: 1842,
      }],
      total: 1,
      totalParticipants: 4,
      page: 2,
      pageSize: 20,
    });

    const [sql, values] = client.query.mock.calls[1] as [string, unknown[]];
    expect(sql).toContain("c.publication_status = 'PUBLISHED' AND c.visibility = 'PUBLIC'");
    expect(sql).toContain('c.show_leaderboard = TRUE');
    expect(sql).toContain('participant.registration_status = \'REGISTERED\'');
    expect(sql).toContain(
      '(contest.ends_at <= CURRENT_TIMESTAMP OR account.is_active = TRUE)',
    );
    expect(sql).toContain('submission.submitted_at >= contest.starts_at');
    expect(sql).toContain('submission.submitted_at < contest.ends_at');
    expect(sql).toContain('submission.contest_id');
    expect(sql).toContain('contest_problem.problem_id = submission.problem_id');
    expect(sql).toContain('public.contest_problem_content_accessible(contest.id, problem.id)');
    expect(sql).toContain("owner.status = 'ACTIVE'");
    expect(sql).toContain('submission.contest_max_score_snapshot');
    expect(sql).toContain('snapshot.points');
    expect(sql).toContain('result.points_awarded');
    expect(sql).toContain('submission.judged_at IS NOT NULL');
    expect(sql).toContain('COUNT(result.snapshot_id) = COUNT(snapshot.id)');
    expect(sql).toContain('ROUND(');
    expect(sql).toContain('LEAST(');
    expect(sql).toContain("submission.status IN (\n               'ACCEPTED'");
    expect(sql).not.toContain("'PENDING'");
    expect(sql).not.toContain("'INTERNAL_ERROR'");
    expect(sql.indexOf('RANK() OVER')).toBeLessThan(sql.indexOf('WHERE $3::text IS NULL OR username ILIKE'));
    expect(sql).toContain('LIMIT $4 OFFSET $5');
    expect(values).toEqual([
      null,
      'uth-challenge',
      '%coder\\_\\%%',
      20,
      20,
    ]);
  });

  it('returns an empty page for a public contest with no registered participants', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ contest_exists: true, total: 0, total_participants: 0, items: [] }],
        })
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    };
    const repository = new StudentContestsRepository(databaseWithClient(client) as never);

    await expect(repository.findPublicLeaderboard('uth-challenge', {
      page: 1,
      pageSize: 10,
    })).resolves.toEqual({
      items: [],
      total: 0,
      totalParticipants: 0,
      page: 1,
      pageSize: 10,
    });
  });

  it('hides missing, non-public, archived, or disabled leaderboards behind 404', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            contest_exists: false,
            total: 0,
            total_participants: 0,
            items: [],
          }],
        })
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    };
    const repository = new StudentContestsRepository(databaseWithClient(client) as never);

    await expect(repository.findPublicLeaderboard('hidden-contest', {
      page: 1,
      pageSize: 10,
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
  });

  it('returns registered members once, derives participation from contest-window submissions, and filters before paging', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            contest_exists: true,
            total: '2',
            participant_count: '5',
            items: [
              {
                userId,
                username: 'student',
                avatarUrl: null,
                registeredAt: new Date('2026-10-30T06:00:00.000Z'),
                status: 'participated',
              },
              {
                userId: 'c0a80101-0000-4000-8000-000000000003',
                username: 'student_two',
                avatarUrl: 'https://example.test/avatar.png',
                registeredAt: new Date('2026-10-30T07:00:00.000Z'),
                status: 'registered',
              },
            ],
          }],
        })
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    };
    const repository = new StudentContestsRepository(databaseWithClient(client) as never);

    await expect(repository.findPublicParticipants('uth-challenge', {
      page: 2,
      pageSize: 20,
      search: 'Student_%',
      status: 'all',
    })).resolves.toEqual({
      items: [
        {
          userId,
          username: 'student',
          avatarUrl: null,
          registeredAt: '2026-10-30T06:00:00.000Z',
          status: 'participated',
        },
        {
          userId: 'c0a80101-0000-4000-8000-000000000003',
          username: 'student_two',
          avatarUrl: 'https://example.test/avatar.png',
          registeredAt: '2026-10-30T07:00:00.000Z',
          status: 'registered',
        },
      ],
      total: 2,
      participantCount: 5,
      page: 2,
      pageSize: 20,
    });

    const [sql, values] = client.query.mock.calls[1] as [string, unknown[]];
    expect(sql).toContain("c.publication_status = 'PUBLISHED' AND c.visibility = 'PUBLIC'");
    expect(sql).toContain("participant.registration_status = 'REGISTERED'");
    expect(sql).toContain(
      '(contest.ends_at <= CURRENT_TIMESTAMP OR account.is_active = TRUE)',
    );
    expect(sql).toContain('submission.contest_id');
    expect(sql).toContain('submission.user_id = participant.user_id');
    expect(sql).toContain('submission.submitted_at >= contest.starts_at');
    expect(sql).toContain('submission.submitted_at < contest.ends_at');
    expect(sql).toContain("username ILIKE $3 ESCAPE '\\'");
    expect(sql).toContain("status = $4");
    expect(sql).toContain('ORDER BY registered_at ASC, user_id ASC');
    expect(sql).toContain('COUNT(*)::int FROM registered_participants');
    expect(sql).not.toMatch(/email|password|token|source_code/i);
    expect(values).toEqual([
      null,
      'uth-challenge',
      '%Student\\_\\%%',
      'all',
      20,
      20,
    ]);
  });

  it('returns an empty member page for an empty public contest and hides non-public contests', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            contest_exists: true,
            total: '0',
            participant_count: '0',
            items: [],
          }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            contest_exists: false,
            total: '0',
            participant_count: '0',
            items: [],
          }],
        })
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    };
    const repository = new StudentContestsRepository(databaseWithClient(client) as never);

    await expect(repository.findPublicParticipants('uth-challenge', {
      page: 1,
      pageSize: 10,
      status: 'all',
    })).resolves.toEqual({
      items: [],
      total: 0,
      participantCount: 0,
      page: 1,
      pageSize: 10,
    });
    await expect(repository.findPublicParticipants('hidden-contest', {
      page: 1,
      pageSize: 10,
      status: 'all',
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(client.release).toHaveBeenCalledTimes(2);
  });

  it('filters contest submissions and computes matching statistics before pagination', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            contest_exists: true,
            total: '3',
            items: [{
              id: 'submission-id',
              status: 'ACCEPTED',
              submittedAt: new Date('2026-10-31T07:20:00.000Z'),
              username: 'student',
              problemCode: 'UTH001',
              problemTitle: 'Sum two',
              language: 'C++',
              executionTimeMs: 18,
              memoryUsedKb: 2048,
              canViewDetails: true,
            }],
            status_counts: [
              { status: 'ACCEPTED', count: '2' },
              { status: 'WRONG_ANSWER', count: 1 },
            ],
            languages: ['C++', 'Python'],
          }],
        })
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    };
    const repository = new StudentContestsRepository(databaseWithClient(client) as never);

    await expect(repository.findPublicSubmissions('uth-challenge', {
      page: 2,
      pageSize: 20,
      search: 'UTH_%',
      status: 'ACCEPTED',
      language: 'C++',
    }, userId)).resolves.toEqual({
      items: [{
        id: 'submission-id',
        status: 'ACCEPTED',
        submittedAt: '2026-10-31T07:20:00.000Z',
        username: 'student',
        problemCode: 'UTH001',
        problemTitle: 'Sum two',
        language: 'C++',
        executionTimeMs: 18,
        memoryUsedKb: 2048,
        canViewDetails: true,
      }],
      total: 3,
      page: 2,
      pageSize: 20,
      statistics: {
        total: 3,
        accepted: 2,
        acceptanceRate: 66.7,
        verdictCounts: { ACCEPTED: 2, WRONG_ANSWER: 1 },
      },
      filters: { languages: ['C++', 'Python'] },
    });

    const [sql, values] = client.query.mock.calls[1] as [string, unknown[]];
    expect(sql).toContain("c.publication_status = 'PUBLISHED' AND c.visibility = 'PUBLIC'");
    expect(sql).toContain('contest.id = submission.contest_id');
    expect(sql).toContain('contest_problem.contest_id = contest.id');
    expect(sql).toContain('contest_problem.problem_id = submission.problem_id');
    expect(sql).toContain("OR problem_code ILIKE $5 ESCAPE '\\'");
    expect(sql).toContain('status = $3');
    expect(sql).toContain('language = $4');
    expect(sql).toContain('ORDER BY submitted_at DESC, id DESC');
    expect(sql).toContain('COUNT(*)::int FROM filtered');
    expect(sql).not.toMatch(/source_code|judge0_token|error_message|input_data|expected_output|password_hash/i);
    expect(values).toEqual([
      null,
      'uth-challenge',
      'ACCEPTED',
      'C++',
      '%UTH\\_\\%%',
      20,
      20,
      userId,
    ]);
  });

  it('returns zero submission stats for an empty public contest and hides non-public contests', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            contest_exists: true,
            total: '0',
            items: [],
            status_counts: [],
            languages: [],
          }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            contest_exists: false,
            total: '0',
            items: [],
            status_counts: [],
            languages: [],
          }],
        })
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    };
    const repository = new StudentContestsRepository(databaseWithClient(client) as never);

    await expect(repository.findPublicSubmissions('uth-challenge', {
      page: 1,
      pageSize: 10,
    }, null)).resolves.toMatchObject({
      items: [],
      total: 0,
      statistics: { total: 0, accepted: 0, acceptanceRate: 0, verdictCounts: {} },
    });
    await expect(repository.findPublicSubmissions('hidden-contest', {
      page: 1,
      pageSize: 10,
    }, null)).rejects.toBeInstanceOf(NotFoundException);
    expect(client.release).toHaveBeenCalledTimes(2);
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
