import { JudgingRepository } from './judging.repository.js';

describe('JudgingRepository', () => {
  it('claims only eligible submissions and permits BullMQ retries to resume RUNNING jobs', async () => {
    const database = { query: vi.fn().mockResolvedValue({ rowCount: 1 }) };
    const repository = new JudgingRepository(database as never);

    await expect(repository.claim('submission-1', false)).resolves.toBe(true);
    await expect(repository.claim('submission-1', true)).resolves.toBe(true);

    expect(database.query.mock.calls[0][0]).toContain("status IN ('PENDING', 'QUEUED')");
    expect(database.query.mock.calls[0][0]).toContain("status = 'RUNNING'");
    expect(database.query.mock.calls[0][1]).toEqual(['submission-1', false]);
    expect(database.query.mock.calls[1][1]).toEqual(['submission-1', true]);
  });

  it('loads frozen inputs, expected outputs, limits and Judge0 language ID from the database', async () => {
    const database = {
      query: vi.fn()
        .mockResolvedValueOnce({
          rows: [{ source_code: 'secret code', judge0_language_id: 54, scoring_enabled: false, max_score: '0' }],
        })
        .mockResolvedValueOnce({
          rows: [{
            source_test_case_id: 'case-1',
            snapshot_id: 'snapshot-1',
            test_name: 'hidden',
            position: 1,
            input_data: 'hidden input',
            expected_output: 'hidden output',
            points: '100',
            time_limit_ms: 1500,
            memory_limit_kb: 262144,
          }],
        }),
    };
    const repository = new JudgingRepository(database as never);

    await expect(repository.loadContext('submission-1')).resolves.toEqual({
      sourceCode: 'secret code',
      judge0LanguageId: 54,
      scoringEnabled: false,
      maxScore: 0,
      testCases: [{
        id: 'case-1',
        snapshotId: 'snapshot-1',
        name: 'hidden',
        position: 1,
        input: 'hidden input',
        expectedOutput: 'hidden output',
        points: 100,
        cpuTimeLimitSeconds: 1.5,
        memoryLimitKb: 262144,
      }],
    });
    expect(database.query.mock.calls[0][0]).toContain('s.scoring_enabled');
    expect(database.query.mock.calls[0][0]).toContain('FROM submissions s');
    expect(database.query.mock.calls[1][0]).toContain('submission_test_case_snapshots');
    expect(database.query.mock.calls[1][0]).not.toContain('problem_test_cases');
  });

  it('upserts a result per original test case so retries do not double-award points', async () => {
    const database = { query: vi.fn().mockResolvedValue({ rowCount: 1 }) };
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

    expect(database.query.mock.calls[0][0]).toContain('ON CONFLICT (submission_id, test_case_id)');
    expect(database.query.mock.calls[0][1]).toEqual([
      'submission-1', 'case-1', 'snapshot-1', 'ACCEPTED', 10, 64, 5,
    ]);
  });

  it('marks unjudged snapshot cases as internal errors without overwriting completed results', async () => {
    const database = { query: vi.fn().mockResolvedValue({ rowCount: 1 }) };
    const repository = new JudgingRepository(database as never);

    await repository.persistUnjudgedTestResults('submission-1');

    const [sql, values] = database.query.mock.calls[0];
    expect(sql).toContain('LEFT JOIN submission_test_results');
    expect(sql).toContain('result.submission_id IS NULL');
    expect(sql).toContain("'INTERNAL_ERROR'");
    expect(sql).toContain('ON CONFLICT (submission_id, test_case_id) DO NOTHING');
    expect(sql).toContain('submission_test_case_snapshots');
    expect(values).toEqual(['submission-1']);
  });

  it('stores the exact sum of awarded test points and aggregates total time and peak memory', async () => {
    const database = { query: vi.fn().mockResolvedValue({ rowCount: 1 }) };
    const repository = new JudgingRepository(database as never);

    await repository.persistFinalResult('submission-1');

    const [sql, values] = database.query.mock.calls[0];
    expect(sql).toContain('score = CASE WHEN s.scoring_enabled THEN totals.score ELSE 0 END');
    expect(sql).not.toContain('LEAST(totals.score');
    expect(sql).toContain('CASE WHEN s.scoring_enabled THEN');
    expect(sql).toContain('SUM(execution_time_ms)');
    expect(sql).toContain('MAX(memory_used_kb)');
    expect(sql).toContain("status <> 'ACCEPTED'");
    expect(values).toEqual(['submission-1', false]);
  });
});
