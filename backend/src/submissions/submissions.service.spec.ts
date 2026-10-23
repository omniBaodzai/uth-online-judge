import { BadRequestException, NotFoundException } from '@nestjs/common';
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSubmissionDto } from './dto/create-submission.dto.js';
import {
  ProblemSubmissionsParamsDto,
  ProblemSubmissionsQueryDto,
} from './dto/problem-submissions.dto.js';
import { SubmissionsRepository } from './submissions.repository.js';
import { SubmissionsService } from './submissions.service.js';

describe('SubmissionsService', () => {
  const repository = {
    findPublishedProblemId: vi.fn(),
    findAllowedLanguageId: vi.fn(),
    insert: vi.fn(),
    markQueued: vi.fn(),
    markEnqueueFailed: vi.fn(),
    findOwned: vi.fn(),
    findProblemSubmissions: vi.fn(),
  };
  const queue = { add: vi.fn() };
  const service = new SubmissionsService(repository as never, queue as never);
  const input = { problemCode: 'UTH001', language: 'cpp', sourceCode: 'int main(){}' };

  beforeEach(() => vi.resetAllMocks());

  it('records a submission for the authenticated user', async () => {
    repository.findPublishedProblemId.mockResolvedValue('p1');
    repository.findAllowedLanguageId.mockResolvedValue('l1');
    repository.insert.mockResolvedValue({ id: 's1', status: 'PENDING', submittedAt: 'now' });
    queue.add.mockResolvedValue({});

    await expect(service.create('user-1', input)).resolves.toEqual({
      id: 's1',
      status: 'QUEUED',
      submittedAt: 'now',
    });
    expect(queue.add).toHaveBeenCalledWith(
      'judge-submission',
      { submissionId: 's1' },
      expect.objectContaining({ jobId: 's1', attempts: 3 }),
    );
    expect(repository.markQueued).toHaveBeenCalledWith('s1');
    expect(repository.insert).toHaveBeenCalledWith({
      userId: 'user-1',
      problemId: 'p1',
      languageId: 'l1',
      sourceCode: input.sourceCode,
    });
  });

  it('marks the submission failed when the judging queue is unavailable', async () => {
    repository.findPublishedProblemId.mockResolvedValue('p1');
    repository.findAllowedLanguageId.mockResolvedValue('l1');
    repository.insert.mockResolvedValue({ id: 's1', status: 'PENDING', submittedAt: 'now' });
    queue.add.mockRejectedValue(new Error('redis unavailable'));

    await expect(service.create('user-1', input)).rejects.toMatchObject({ status: 503 });
    expect(repository.markEnqueueFailed).toHaveBeenCalledWith('s1');
  });

  it('rejects unknown/unpublished problems and unsupported languages without inserting', async () => {
    repository.findPublishedProblemId.mockResolvedValue(null);
    await expect(service.create('u', input)).rejects.toBeInstanceOf(NotFoundException);

    repository.findPublishedProblemId.mockResolvedValue('p1');
    repository.findAllowedLanguageId.mockResolvedValue(null);
    await expect(service.create('u', input)).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.findAllowedLanguageId).toHaveBeenCalledWith('p1', 'cpp');
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('checks the language against the problem allow-list in SQL', async () => {
    const database = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    const repo = new SubmissionsRepository(database as never);
    await expect(repo.findAllowedLanguageId('p1', 'cpp')).resolves.toBeNull();
    const [sql, values] = database.query.mock.calls[0];
    expect(sql).toContain('problem_languages');
    expect(sql).toContain('is_enabled = TRUE');
    expect(values).toEqual(['p1', 'cpp']);
  });

  it('only returns submissions owned by the caller', async () => {
    repository.findOwned.mockResolvedValue(null);
    await expect(service.getOwned('s1', 'someone-else')).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findOwned).toHaveBeenCalledWith('s1', 'someone-else');
  });

  it('returns the current user submissions for one problem with validated filters', async () => {
    const result = { problem: { code: 'UTH001' }, items: [], total: 0, statistics: {} };
    repository.findProblemSubmissions.mockResolvedValue(result);

    await expect(service.getProblemSubmissions('user-1', 'UTH001', {
      page: 2,
      pageSize: 20,
      status: 'ACCEPTED',
      language: 'C++',
    })).resolves.toBe(result);
    expect(repository.findProblemSubmissions).toHaveBeenCalledWith(
      'user-1', 'UTH001', 2, 20, 'ACCEPTED', 'C++',
    );
  });

  it('does not return a user-scoped list when the problem is missing or unpublished', async () => {
    repository.findProblemSubmissions.mockResolvedValue(null);
    await expect(service.getProblemSubmissions('user-1', 'MISSING', {
      page: 1,
      pageSize: 10,
    })).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('SubmissionsRepository', () => {
  const database = { query: vi.fn() };
  const repository = new SubmissionsRepository(database as never);

  beforeEach(() => database.query.mockReset());

  it('lets the schema default set the status instead of accepting one', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [], rowCount: null })
        .mockResolvedValueOnce({ rows: [{ id: 'p' }], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [{ scoring_enabled: true, max_score: '100.00', assigned_points: '100.00', scored_test_count: '2', points_match: true }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [{ id: 's1', status: 'PENDING', submitted_at: new Date('2026-01-01T00:00:00.000Z') }], rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 2, rows: [] })
        .mockResolvedValue({ rows: [], rowCount: 1 }),
      release: vi.fn(),
    };
    (database as typeof database & { connect: ReturnType<typeof vi.fn> }).connect = vi.fn().mockResolvedValue(client);
    await repository.insert({ userId: 'u', problemId: 'p', languageId: 'l', sourceCode: 'code' });

    const [sql, values] = client.query.mock.calls[3];
    const snapshotSql = client.query.mock.calls[4][0] as string;
    expect(sql).toContain('INSERT INTO submissions');
    expect(sql).toContain('scoring_enabled');
    expect(sql).toContain('p.score');
    expect(sql).toContain('JOIN problem_languages');
    expect(sql).toContain('l.is_enabled = TRUE');
    expect(values).toEqual(['u', 'p', 'l', 'code']);
    expect(snapshotSql).toContain('submission_test_case_snapshots');
    expect(snapshotSql).toContain('expected_output');
    expect(snapshotSql).toContain('tc.is_active = TRUE');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rejects submissions when hidden-test weights do not sum to the problem score', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [], rowCount: null })
        .mockResolvedValueOnce({ rows: [{ id: 'p' }], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [{ scoring_enabled: true, max_score: '100.00', assigned_points: '0.00', scored_test_count: '2', points_match: false }],
          rowCount: 1,
        }),
      release: vi.fn(),
    };
    (database as typeof database & { connect: ReturnType<typeof vi.fn> }).connect = vi.fn().mockResolvedValue(client);

    await expect(repository.insert({
      userId: 'u', problemId: 'p', languageId: 'l', sourceCode: 'code',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(client.query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO submissions'), expect.anything());
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('accepts an unscored submission without point configuration and snapshots the disabled flag', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [], rowCount: null })
        .mockResolvedValueOnce({ rows: [{ id: 'p' }], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [{
            scoring_enabled: false,
            max_score: '100.00',
            assigned_points: '0.00',
            scored_test_count: '1',
            points_match: false,
          }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ id: 's1', status: 'PENDING', submitted_at: new Date('2026-01-01T00:00:00.000Z') }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }),
      release: vi.fn(),
    };
    (database as typeof database & { connect: ReturnType<typeof vi.fn> }).connect = vi.fn().mockResolvedValue(client);

    await repository.insert({ userId: 'u', problemId: 'p', languageId: 'l', sourceCode: 'code' });

    const insertSql = client.query.mock.calls[3][0] as string;
    const snapshotSql = client.query.mock.calls[4][0] as string;
    expect(insertSql).toContain('CASE WHEN p.scoring_enabled THEN p.score ELSE 0 END');
    expect(insertSql).toContain('p.scoring_enabled');
    expect(snapshotSql).toContain('CASE WHEN tc.is_sample THEN 0 ELSE tc.points END');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('scopes reads to the owner and never selects hidden judging data', async () => {
    database.query.mockResolvedValue({ rows: [] });
    await expect(repository.findOwned('s1', 'u1')).resolves.toBeNull();

    const [sql, values] = database.query.mock.calls[0];
    expect(sql).toContain('s.user_id = $2');
    expect(values).toEqual(['s1', 'u1']);
    expect(database.query).toHaveBeenCalledTimes(1);
  });

  it('filters problem submissions by owner in SQL and returns only safe list fields', async () => {
    database.query
      .mockResolvedValueOnce({
        rows: [{ id: 'problem-1', problem_code: 'UTH001', title: 'Tổng hai số', scoring_enabled: true }],
      })
      .mockResolvedValueOnce({
        rows: [{
          items: [{
            id: 'submission-1',
            status: 'ACCEPTED',
            language: 'C++',
            scoring_enabled: true,
            score: '100.00',
            max_score: '100.00',
            execution_time_ms: 8,
            memory_used_kb: 256,
            submitted_at: '2026-01-01T00:00:00.000Z',
          }],
          total: 1,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          total: 8,
          accepted: 2,
          wrong_answer: 3,
          compilation_error: 1,
          verdict_counts: {
            ACCEPTED: 2,
            WRONG_ANSWER: 3,
            COMPILATION_ERROR: 1,
            RUNNING: 2,
          },
          languages: ['C++'],
        }],
      });

    const result = await repository.findProblemSubmissions(
      'user-1', 'uth001', 1, 10, 'ACCEPTED', 'C++',
    );

    expect(result).toMatchObject({
      problem: { code: 'UTH001', title: 'Tổng hai số', scoringEnabled: true },
      items: [{
        id: 'submission-1',
        status: 'ACCEPTED',
        language: 'C++',
        score: 100,
        maxScore: 100,
      }],
      total: 1,
      statistics: {
        total: 8,
        accepted: 2,
        wrongAnswer: 3,
        compilationError: 1,
        acceptanceRate: 25,
        verdictCounts: {
          ACCEPTED: 2,
          WRONG_ANSWER: 3,
          COMPILATION_ERROR: 1,
          RUNNING: 2,
        },
        languages: ['C++'],
      },
    });

    const listSql = database.query.mock.calls[1][0] as string;
    expect(listSql).toContain('s.user_id = $2');
    expect(listSql).toContain('s.status = $3');
    expect(listSql).toContain('l.name = $4');
    expect(listSql).toContain('ORDER BY submitted_at DESC, id DESC');
    expect(listSql).not.toContain('source_code');
    expect(listSql).not.toContain('input_data');
    expect(listSql).not.toContain('expected_output');
    expect(database.query.mock.calls[1][1]).toEqual([
      'problem-1', 'user-1', 'ACCEPTED', 'C++', 10, 0,
    ]);
    expect(database.query.mock.calls[2][1]).toEqual(['problem-1', 'user-1']);
    const statisticsSql = database.query.mock.calls[2][0] as string;
    expect(statisticsSql).toContain('GROUP BY counted.status');
    expect(statisticsSql).toContain('counted.user_id = $2');
    expect(statisticsSql).not.toContain('LIMIT');
    expect(statisticsSql).not.toContain('status = $3');
  });

  it('does not expose scores for submissions from an unscored problem', async () => {
    database.query
      .mockResolvedValueOnce({
        rows: [{ id: 'problem-2', problem_code: 'UTH002', title: 'Bài không điểm', scoring_enabled: false }],
      })
      .mockResolvedValueOnce({
        rows: [{
          items: [{
            id: 'submission-2',
            status: 'ACCEPTED',
            language: 'Python',
            scoring_enabled: false,
            score: '0.00',
            max_score: '0.00',
            execution_time_ms: 8,
            memory_used_kb: 256,
            submitted_at: '2026-01-01T00:00:00.000Z',
          }],
          total: 1,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          total: 1,
          accepted: 1,
          wrong_answer: 0,
          compilation_error: 0,
          verdict_counts: { ACCEPTED: 1 },
          languages: ['Python'],
        }],
      });

    const result = await repository.findProblemSubmissions('user-1', 'UTH002', 1, 10);
    expect(result?.items[0]).toMatchObject({ scoringEnabled: false, score: null, maxScore: null });
  });

  it('exposes per-test results without test data or error output', async () => {
    database.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 's1',
            problem_code: 'UTH001',
            problem_title: 'Tổng hai số',
            username: 'student1',
            language: 'C++ (GCC 9.2.0)',
            source_code: 'code',
            status: 'PENDING',
            scoring_enabled: true,
            score: '0.00',
            max_score: '100.00',
            execution_time_ms: null,
            memory_used_kb: null,
            submitted_at: new Date('2026-01-01T00:00:00.000Z'),
            judged_at: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { position: 1, status: 'ACCEPTED', execution_time_ms: 5, memory_used_kb: 100, points_awarded: '10', max_points: '10' },
          { position: 2, status: null, execution_time_ms: null, memory_used_kb: null, points_awarded: null, max_points: '20' },
        ],
      });

    const view = await repository.findOwned('s1', 'u1');
    expect(view).toMatchObject({
      problemTitle: 'Tổng hai số',
      username: 'student1',
      language: 'C++ (GCC 9.2.0)',
      score: 0,
      scoringEnabled: true,
      maxScore: 100,
    });
    expect(view?.testResults).toEqual([
      { position: 1, status: 'ACCEPTED', executionTimeMs: 5, memoryUsedKb: 100, pointsAwarded: 10, maxPoints: 10 },
      { position: 2, status: null, executionTimeMs: null, memoryUsedKb: null, pointsAwarded: 0, maxPoints: 20 },
    ]);
    const resultsSql = database.query.mock.calls[1][0] as string;
    expect(resultsSql).toContain('LEFT JOIN submission_test_results');
    expect(resultsSql).toContain('snapshot.points AS max_points');
    expect(resultsSql).not.toContain('expected_output');
    expect(resultsSql).not.toContain('input_data');
    expect(resultsSql).not.toContain('actual_output');
    expect(resultsSql).not.toContain('error_message');
    expect(resultsSql).not.toContain('judge0_token');
    expect(resultsSql).toContain('submission_test_case_snapshots');
    const submissionSql = database.query.mock.calls[0][0] as string;
    expect(submissionSql).toContain('u.username');
    expect(submissionSql).toContain('s.user_id = $2');
  });

  it('returns an explicit unscored mode without exposing dormant or test-case points', async () => {
    database.query
      .mockResolvedValueOnce({
        rows: [{
          id: 's2',
          problem_code: 'UTH002',
          problem_title: 'Unscored problem',
          username: 'student2',
          language: 'C++',
          source_code: 'code',
          status: 'ACCEPTED',
          scoring_enabled: false,
          score: '0.00',
          max_score: '0.00',
          execution_time_ms: 10,
          memory_used_kb: 100,
          submitted_at: new Date('2026-01-01T00:00:00.000Z'),
          judged_at: new Date('2026-01-01T00:00:01.000Z'),
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          position: 1,
          status: 'ACCEPTED',
          execution_time_ms: 10,
          memory_used_kb: 100,
          points_awarded: '8',
          max_points: '8',
        }],
      });

    await expect(repository.findOwned('s2', 'u2')).resolves.toMatchObject({
      scoringEnabled: false,
      score: 0,
      maxScore: 0,
      testResults: [{ pointsAwarded: 0, maxPoints: 0 }],
    });
  });
});

describe('CreateSubmissionDto', () => {
  const errors = (raw: Record<string, unknown>) =>
    validate(plainToInstance(CreateSubmissionDto, raw), { whitelist: true, forbidNonWhitelisted: true });
  const valid = { problemCode: 'UTH001', language: 'cpp', sourceCode: 'x' };

  it('accepts a valid payload', async () => {
    expect(await errors(valid)).toHaveLength(0);
  });

  describe('ProblemSubmissionsQueryDto', () => {
    const errors = (raw: Record<string, unknown>) =>
      validate(plainToInstance(ProblemSubmissionsQueryDto, raw), {
        whitelist: true,
        forbidNonWhitelisted: true,
      });

    it('accepts bounded pagination and supported filters', async () => {
      expect(await errors({
        page: '2',
        pageSize: '20',
        status: 'RUNNING',
        language: 'C++',
      })).toHaveLength(0);
    });

    it.each([
      [{ page: '0' }],
      [{ pageSize: '51' }],
      [{ status: 'NOT_A_VERDICT' }],
      [{ userId: 'other-user' }],
    ])('rejects invalid filters or pagination %j', async (override) => {
      expect((await errors(override)).length).toBeGreaterThan(0);
    });

    it('validates the problem code route parameter', async () => {
      expect(await validate(plainToInstance(ProblemSubmissionsParamsDto, {
        problemCode: 'UTH012',
      }))).toHaveLength(0);
      expect((await validate(plainToInstance(ProblemSubmissionsParamsDto, {
        problemCode: 'bad code!',
      }))).length).toBeGreaterThan(0);
    });
  });

  it.each([
    [{ problemCode: 'bad code!' }],
    [{ language: 'C++ ; drop' }],
    [{ sourceCode: '' }],
    [{ sourceCode: 'a'.repeat(65537) }],
    [{ userId: 'someone-else' }],
    [{ status: 'ACCEPTED' }],
  ])('rejects %j', async (override) => {
    expect((await errors({ ...valid, ...override })).length).toBeGreaterThan(0);
  });
});
