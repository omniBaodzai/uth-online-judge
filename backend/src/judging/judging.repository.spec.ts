import { JudgingRepository } from './judging.repository.js';
import { testCaseFingerprint } from '../scoring/test-case-fingerprint.js';

describe('JudgingRepository', () => {
  it('selects only nonterminal pending, queued, and running submissions', async () => {
    const database = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [{ id: 'submission-1', status: 'RUNNING' }],
      }),
    };
    const repository = new JudgingRepository(database as never);

    await expect(repository.findRecoverableSubmissions(null, 100)).resolves.toEqual([
      { id: 'submission-1', status: 'RUNNING' },
    ]);
    const [recoverSql] = database.query.mock.calls[0];
    expect(recoverSql).toContain("s.status IN ('PENDING', 'QUEUED', 'RUNNING')");
    expect(recoverSql).toContain('s.judged_at IS NULL');

    await repository.markQueued('submission-1');
    const [markSql, values] = database.query.mock.calls[1];
    expect(markSql).toContain("WHERE id = $1 AND status = 'PENDING'");
    expect(values).toEqual(['submission-1']);
  });

  it('serializes duplicate workers with a PostgreSQL advisory lock and releases the claim', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ released: true }] }),
      release: vi.fn(),
    };
    const database = { connect: vi.fn().mockResolvedValue(client) };
    const repository = new JudgingRepository(database as never);

    await expect(repository.claim('submission-1', false)).resolves.toBe(true);
    await repository.releaseClaim('submission-1');

    expect(database.connect).toHaveBeenCalledOnce();
    expect(client.query.mock.calls[0][0]).toContain('pg_advisory_lock');
    expect(client.query.mock.calls[0][1]).toEqual(['submission-1']);
    expect(client.query.mock.calls[1][0]).toContain(
      "status IN ('PENDING', 'QUEUED')",
    );
    expect(client.query.mock.calls[1][0]).toContain("status = 'RUNNING'");
    expect(client.query.mock.calls[1][1]).toEqual(['submission-1', false]);
    expect(client.query.mock.calls[2][0]).toContain('pg_advisory_unlock');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('checks submission state after obtaining the lock before claiming', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ released: true }] }),
      release: vi.fn(),
    };
    const repository = new JudgingRepository({
      connect: vi.fn().mockResolvedValue(client),
    } as never);

    await expect(repository.claim('submission-1', true)).resolves.toBe(false);

    expect(client.query).toHaveBeenCalledTimes(3);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('serializes concurrent claims within a process and across replicas', async () => {
    let releaseSecondLock: (() => void) | undefined;
    let signalSecondLockRequest: (() => void) | undefined;
    let secondLockAcquired = false;
    const secondLockRequested = new Promise<void>((resolve) => {
      signalSecondLockRequest = resolve;
    });
    const firstClient = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockImplementationOnce(async () => {
          releaseSecondLock?.();
          return { rows: [{ released: true }] };
        }),
      release: vi.fn(),
    };
    const secondClient = {
      query: vi
        .fn()
        .mockImplementationOnce(async () => {
          signalSecondLockRequest?.();
          await new Promise<void>((resolve) => {
            releaseSecondLock = resolve;
          });
          secondLockAcquired = true;
          return { rows: [] };
        })
        .mockResolvedValueOnce({ rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ released: true }] }),
      release: vi.fn(),
    };
    const database = {
      connect: vi
        .fn()
        .mockResolvedValueOnce(firstClient)
        .mockResolvedValueOnce(secondClient),
    };
    const repository = new JudgingRepository(database as never);

    await expect(repository.claim('submission-1', false)).resolves.toBe(
      true,
    );
    const concurrentClaim = repository.claim('submission-1', true);
    await secondLockRequested;
    expect(secondLockAcquired).toBe(false);

    await repository.releaseClaim('submission-1');

    await expect(concurrentClaim).resolves.toBe(false);
    expect(secondLockAcquired).toBe(true);
    expect(database.connect).toHaveBeenCalledTimes(2);
    expect(secondClient.query.mock.calls[1][1]).toEqual(['submission-1', true]);
  });

  it('allows a retry to resume RUNNING only after acquiring the advisory lock', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ released: true }] }),
      release: vi.fn(),
    };
    const repository = new JudgingRepository({
      connect: vi.fn().mockResolvedValue(client),
    } as never);

    await expect(repository.claim('submission-1', true)).resolves.toBe(true);
    await repository.releaseClaim('submission-1');

    expect(client.query.mock.calls[1][0]).toContain("status = 'RUNNING'");
    expect(client.query.mock.calls[1][1]).toEqual(['submission-1', true]);
  });

  it('loads frozen inputs, expected outputs, limits and Judge0 language ID from the database', async () => {
    const database = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              source_code: 'secret code',
              judge0_language_id: 54,
              scoring_enabled: false,
              max_score: '0',
              has_snapshots: true,
              compilation_failed: false,
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              source_test_case_id: 'case-1',
              snapshot_id: 'snapshot-1',
              test_name: 'hidden',
              position: 1,
              input_data: 'hidden input',
              expected_output: 'hidden output',
              points: '100',
              time_limit_ms: 1500,
              memory_limit_kb: 262144,
            },
          ],
        }),
    };
    const repository = new JudgingRepository(database as never);

    await expect(repository.loadContext('submission-1', 3)).resolves.toEqual({
      sourceCode: 'secret code',
      judge0LanguageId: 54,
      scoringEnabled: false,
      maxScore: 0,
      hasSnapshots: true,
      compilationFailed: false,
      testCases: [
        {
          id: 'case-1',
          snapshotId: 'snapshot-1',
          name: 'hidden',
          position: 1,
          input: 'hidden input',
          expectedOutput: 'hidden output',
          points: 100,
          cpuTimeLimitSeconds: 1.5,
          memoryLimitKb: 262144,
        },
      ],
    });
    expect(database.query.mock.calls[0][0]).toContain('s.scoring_enabled');
    expect(database.query.mock.calls[0][0]).toContain('FROM submissions s');
    expect(database.query.mock.calls[1][0]).toContain(
      'submission_test_case_snapshots',
    );
    expect(database.query.mock.calls[1][0]).not.toContain('problem_test_cases');
    expect(database.query.mock.calls[1][0]).toContain('LIMIT CASE');
    expect(database.query.mock.calls[1][1]).toEqual([
      'submission-1',
      null,
      null,
      3,
    ]);
  });

  it('upserts a result per original test case so retries do not double-award points', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [], rowCount: null })
        .mockResolvedValueOnce({ rows: [{ id: 'submission-1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: null }),
      release: vi.fn(),
    };
    const database = { connect: vi.fn().mockResolvedValue(client) };
    const repository = new JudgingRepository(database as never);

    await repository.persistTestResult('submission-1', {
      testCase: {
        id: 'case-1',
        snapshotId: 'snapshot-1',
        name: null,
        position: 1,
        input: 'hidden',
        expectedOutput: 'hidden',
        points: 5,
        cpuTimeLimitSeconds: 1,
        memoryLimitKb: 1024,
      },
      verdict: 'ACCEPTED' as never,
      executionTimeMs: 10,
      memoryUsedKb: 64,
      pointsAwarded: 5,
    });

    expect(client.query.mock.calls[1][0]).toContain('FOR SHARE');
    expect(client.query.mock.calls[2][0]).toContain(
      'ON CONFLICT (submission_id, test_case_id)',
    );
    expect(client.query.mock.calls[2][1]).toEqual([
      'submission-1',
      'case-1',
      'snapshot-1',
      'ACCEPTED',
      10,
      64,
      5,
    ]);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('marks unjudged snapshot cases as internal errors without overwriting completed results', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [], rowCount: null })
        .mockResolvedValueOnce({ rows: [{ id: 'submission-1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: null }),
      release: vi.fn(),
    };
    const database = { connect: vi.fn().mockResolvedValue(client) };
    const repository = new JudgingRepository(database as never);

    await repository.persistUnjudgedTestResults('submission-1');

    const [sql, values] = client.query.mock.calls[2];
    expect(sql).toContain('LEFT JOIN submission_test_results');
    expect(sql).toContain('result.submission_id IS NULL');
    expect(sql).toContain('$2, NULL, NULL, 0');
    expect(sql).toContain(
      'ON CONFLICT (submission_id, test_case_id) DO NOTHING',
    );
    expect(sql).toContain('submission_test_case_snapshots');
    expect(values).toEqual(['submission-1', 'INTERNAL_ERROR']);
  });

  it('ignores late results from workers after a submission becomes terminal', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [], rowCount: null })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: null }),
      release: vi.fn(),
    };
    const repository = new JudgingRepository({
      connect: vi.fn().mockResolvedValue(client),
    } as never);

    await repository.persistTestResult('submission-1', {
      testCase: {
        id: 'case-1',
        snapshotId: 'snapshot-1',
        name: null,
        position: 1,
        input: '',
        expectedOutput: '',
        points: 1,
        cpuTimeLimitSeconds: 1,
        memoryLimitKb: 1024,
      },
      verdict: 'ACCEPTED' as never,
      executionTimeMs: 10,
      memoryUsedKb: 64,
      pointsAwarded: 1,
    });

    expect(client.query).toHaveBeenCalledTimes(3);
    expect(client.query.mock.calls[1][0]).toContain("status = 'RUNNING'");
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('finalizes complete results and records accepted test progress transactionally and idempotently', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [], rowCount: null })
        .mockResolvedValueOnce({
          rows: [{ user_id: 'user-1', problem_id: 'problem-1' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [
            {
              snapshot_count: '2',
              result_count: '2',
              score: '1',
              execution_time_ms: '12',
              memory_used_kb: 128,
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              test_case_id: 'case-1',
              input_data: 'input',
              expected_output: 'output',
            },
          ],
        })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: null }),
      release: vi.fn(),
    };
    const database = { connect: vi.fn().mockResolvedValue(client) };
    const repository = new JudgingRepository(database as never);

    await repository.persistFinalResult('submission-1');

    const [insertSql, insertValues] = client.query.mock.calls[4];
    expect(insertSql).toContain('student_test_case_progress');
    expect(insertSql).toContain(
      'ON CONFLICT (user_id, problem_id, test_case_id, content_fingerprint)',
    );
    expect(insertValues).toEqual([
      'user-1',
      'problem-1',
      'case-1',
      testCaseFingerprint('input', 'output'),
    ]);

    const [finalizeSql, finalizeValues] = client.query.mock.calls[5];
    expect(finalizeSql).toContain("status <> 'ACCEPTED'");
    expect(finalizeSql).toContain('execution_time_ms = $5');
    expect(finalizeSql).toContain('memory_used_kb = $6');
    expect(client.query.mock.calls[2][0]).toContain(
      'SUM(result.execution_time_ms)::text AS execution_time_ms',
    );
    expect(client.query.mock.calls[2][0]).toContain(
      'MAX(result.memory_used_kb) AS memory_used_kb',
    );
    expect(client.query.mock.calls[2][0]).not.toContain('wall_time');
    expect(finalizeValues).toEqual([
      'submission-1',
      false,
      true,
      '1',
      '12',
      128,
    ]);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('does not award cumulative progress or mark a submission accepted when results are incomplete', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [], rowCount: null })
        .mockResolvedValueOnce({
          rows: [{ user_id: 'user-1', problem_id: 'problem-1' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [
            {
              snapshot_count: '2',
              result_count: '1',
              score: '1',
              execution_time_ms: '12',
              memory_used_kb: 128,
            },
          ],
        })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: null }),
      release: vi.fn(),
    };
    const repository = new JudgingRepository({
      connect: vi.fn().mockResolvedValue(client),
    } as never);

    await repository.persistFinalResult('submission-1');

    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).includes('student_test_case_progress'),
      ),
    ).toBe(false);
    const [sql, values] = client.query.mock.calls[3];
    expect(sql).toContain("THEN 'INTERNAL_ERROR'");
    expect(values).toEqual(['submission-1', false, false, '1', '12', 128]);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('does not re-finalize a duplicate event after the submission is terminal', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [], rowCount: null })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: null }),
      release: vi.fn(),
    };
    const repository = new JudgingRepository({
      connect: vi.fn().mockResolvedValue(client),
    } as never);

    await repository.persistFinalResult('submission-1');

    expect(client.query).toHaveBeenCalledTimes(3);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });
});
