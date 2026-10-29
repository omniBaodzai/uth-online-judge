import { loadJudge0Config } from './judge0.config.js';
import {
  Judge0ConfigError,
  Judge0InvalidResponseError,
  Judge0SubmissionTimeoutError,
  Judge0TimeoutError,
  Judge0UnavailableError,
} from './judge0.errors.js';
import { Judge0Service, mapVerdict } from './judge0.service.js';
import { Judge0Verdict } from './judge0.types.js';

const config = {
  baseUrl: 'http://judge0.test:2358',
  requestTimeoutMs: 1000,
  pollIntervalMs: 1,
  maxPollAttempts: 3,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function build(fetchFn: ReturnType<typeof vi.fn>) {
  return new Judge0Service(config, fetchFn as unknown as typeof fetch);
}

const finished = {
  token: 'abc-1',
  status: { id: 3, description: 'Accepted' },
  stdout: '8\n',
  time: '0.012',
  memory: 1024,
};

describe('Judge0Service', () => {
  it('checks health through GET /about', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ version: '1.13.1' }));
    await expect(build(fetchFn).checkHealth()).resolves.toEqual({
      version: '1.13.1',
    });
    expect(fetchFn.mock.calls[0][0]).toBe('http://judge0.test:2358/about');
  });

  it('lists languages and rejects malformed entries', async () => {
    const ok = build(
      vi.fn().mockResolvedValue(json([{ id: 54, name: 'C++ (GCC 9.2.0)' }])),
    );
    await expect(ok.getLanguages()).resolves.toEqual([
      { id: 54, name: 'C++ (GCC 9.2.0)' },
    ]);
    for (const entry of [
      { id: 'x' },
      { id: 0, name: 'Unknown' },
      { id: 54.5, name: 'Invalid' },
      { id: 54, name: ' ' },
    ]) {
      const bad = build(vi.fn().mockResolvedValue(json([entry])));
      await expect(bad.getLanguages()).rejects.toBeInstanceOf(
        Judge0InvalidResponseError,
      );
    }
  });

  it('creates an asynchronous submission with snake_case fields', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ token: 'abc-1' }, 201));
    const token = await build(fetchFn).createSubmission({
      languageId: 54,
      sourceCode: 'int main(){}',
      stdin: '3 5',
      expectedOutput: '8',
      cpuTimeLimitSeconds: 2,
      memoryLimitKb: 128000,
    });
    expect(token).toBe('abc-1');
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(
      'http://judge0.test:2358/submissions?base64_encoded=false&wait=false',
    );
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      language_id: 54,
      source_code: 'int main(){}',
      stdin: '3 5',
      expected_output: '8',
      cpu_time_limit: 2,
      memory_limit: 128000,
    });
  });

  it('creates a bounded Judge0 batch and validates unique tokens', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        json([{ token: 'token-1' }, { token: 'token-2' }], 201),
      );
    await expect(
      build(fetchFn).createSubmissionBatch([
        {
          languageId: 54,
          sourceCode: 'int main(){}',
          stdin: '1',
          expectedOutput: '1',
        },
        {
          languageId: 54,
          sourceCode: 'int main(){}',
          stdin: '2',
          expectedOutput: '2',
        },
      ]),
    ).resolves.toEqual(['token-1', 'token-2']);
    expect(fetchFn.mock.calls[0][0]).toBe(
      'http://judge0.test:2358/submissions/batch?base64_encoded=false',
    );
    expect(JSON.parse(fetchFn.mock.calls[0][1].body)).toEqual({
      submissions: [
        {
          language_id: 54,
          source_code: 'int main(){}',
          stdin: '1',
          expected_output: '1',
        },
        {
          language_id: 54,
          source_code: 'int main(){}',
          stdin: '2',
          expected_output: '2',
        },
      ],
    });
    await expect(
      build(vi.fn()).createSubmissionBatch([]),
    ).rejects.toBeInstanceOf(Judge0InvalidResponseError);
    await expect(
      build(
        vi.fn().mockResolvedValue(json([{ token: 'same' }, { token: 'same' }])),
      ).createSubmissionBatch([
        { languageId: 54, sourceCode: 'x' },
        { languageId: 54, sourceCode: 'x' },
      ]),
    ).rejects.toBeInstanceOf(Judge0InvalidResponseError);
  });

  it('rejects a missing or unsafe token on creation', async () => {
    await expect(
      build(vi.fn().mockResolvedValue(json({}))).createSubmission({
        languageId: 54,
        sourceCode: 'x',
      }),
    ).rejects.toBeInstanceOf(Judge0InvalidResponseError);
    await expect(
      build(
        vi.fn().mockResolvedValue(json({ token: '../x' })),
      ).createSubmission({ languageId: 54, sourceCode: 'x' }),
    ).rejects.toBeInstanceOf(Judge0InvalidResponseError);
  });

  it('maps a finished submission result', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(finished));
    const result = await build(fetchFn).getSubmission('abc-1');
    expect(fetchFn.mock.calls[0][0]).toBe(
      'http://judge0.test:2358/submissions/abc-1?base64_encoded=false&fields=token,status,stdout,stderr,compile_output,message,time,wall_time,memory,created_at,finished_at',
    );
    expect(result).toMatchObject({
      token: 'abc-1',
      statusId: 3,
      verdict: Judge0Verdict.Accepted,
      isFinished: true,
      stdout: '8\n',
      stderr: null,
      timeSeconds: 0.012,
      memoryKb: 1024,
    });
  });

  it('preserves Judge0 decimal seconds, wall seconds, and memory kilobytes as raw values', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      json({
        token: 'abc-1',
        status: { id: 3, description: 'Accepted' },
        time: '0.038',
        wall_time: '0.0415',
        memory: 12_152,
      }),
    );

    await expect(build(fetchFn).getSubmission('abc-1')).resolves.toMatchObject({
      timeSeconds: 0.038,
      wallTimeSeconds: 0.0415,
      memoryKb: 12_152,
    });
  });

  it('preserves missing Judge0 resource measurements as null', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      json({
        token: 'abc-1',
        status: { id: 3, description: 'Accepted' },
        time: null,
        wall_time: null,
        memory: null,
      }),
    );

    await expect(build(fetchFn).getSubmission('abc-1')).resolves.toMatchObject({
      timeSeconds: null,
      wallTimeSeconds: null,
      memoryKb: null,
    });
  });

  it('refuses tokens that could alter the request path', async () => {
    const fetchFn = vi.fn();
    await expect(build(fetchFn).getSubmission('a/../b')).rejects.toBeInstanceOf(
      Judge0InvalidResponseError,
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('rejects invalid submission bodies', async () => {
    await expect(
      build(vi.fn().mockResolvedValue(json({ status: {} }))).getSubmission(
        't1',
      ),
    ).rejects.toBeInstanceOf(Judge0InvalidResponseError);
    await expect(
      build(
        vi
          .fn()
          .mockResolvedValue(
            json({ status: { id: 3, description: 'A' }, time: 'abc' }),
          ),
      ).getSubmission('t1'),
    ).rejects.toBeInstanceOf(Judge0InvalidResponseError);
  });

  it('maps network failures, HTTP errors, timeouts and non-JSON bodies', async () => {
    await expect(
      build(
        vi.fn().mockRejectedValue(new TypeError('fetch failed')),
      ).checkHealth(),
    ).rejects.toBeInstanceOf(Judge0UnavailableError);
    await expect(
      build(
        vi.fn().mockResolvedValue(new Response('x', { status: 500 })),
      ).checkHealth(),
    ).rejects.toBeInstanceOf(Judge0UnavailableError);
    const timeout = Object.assign(new Error('timed out'), {
      name: 'TimeoutError',
    });
    await expect(
      build(vi.fn().mockRejectedValue(timeout)).checkHealth(),
    ).rejects.toBeInstanceOf(Judge0TimeoutError);
    await expect(
      build(vi.fn().mockResolvedValue(new Response('<html>'))).checkHealth(),
    ).rejects.toBeInstanceOf(Judge0InvalidResponseError);
  });

  it('polls until the submission finishes', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        json({ status: { id: 1, description: 'In Queue' } }),
      )
      .mockResolvedValueOnce(
        json({ status: { id: 2, description: 'Processing' } }),
      )
      .mockResolvedValueOnce(json(finished));
    const result = await build(fetchFn).waitForResult('abc-1');
    expect(result.verdict).toBe(Judge0Verdict.Accepted);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('polls a batch in token order and reports execution timing metadata', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      json({
        submissions: [
          {
            token: 'token-2',
            status: { id: 3, description: 'Accepted' },
            time: '0.007',
            wall_time: '0.020',
            memory: 1000,
            created_at: '2026-10-23T10:00:00.000Z',
            finished_at: '2026-10-23T10:00:01.250Z',
          },
          {
            token: 'token-1',
            status: { id: 4, description: 'Wrong Answer' },
            time: '0.010',
            wall_time: '0.030',
            memory: 1200,
          },
        ],
      }),
    );
    const results = await build(fetchFn).waitForResults(
      ['token-1', 'token-2'],
      2_000,
    );

    expect(fetchFn).toHaveBeenCalledOnce();
    expect(new URL(fetchFn.mock.calls[0][0]).pathname).toBe(
      '/submissions/batch',
    );
    expect(results.timedOut).toBe(false);
    expect(results.results.map((item) => item.token)).toEqual([
      'token-1',
      'token-2',
    ]);
    expect(results.results[0]).toMatchObject({
      verdict: Judge0Verdict.WrongAnswer,
      wallTimeSeconds: 0.03,
    });
    expect(results.results[1]).toMatchObject({
      verdict: Judge0Verdict.Accepted,
      wallTimeSeconds: 0.02,
      submissionDurationMs: 1_250,
    });
  });

  it('backs off polling pending Judge0 work instead of making frequent repeated requests', async () => {
    vi.useFakeTimers();
    try {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(
          json({
            submissions: [
              {
                token: 'token-1',
                status: { id: 2, description: 'Processing' },
              },
            ],
          }),
        )
        .mockResolvedValueOnce(
          json({
            submissions: [
              {
                token: 'token-1',
                status: { id: 2, description: 'Processing' },
              },
            ],
          }),
        )
        .mockResolvedValueOnce(
          json({
            submissions: [
              { token: 'token-1', status: { id: 3, description: 'Accepted' } },
            ],
          }),
        );
      const waiting = build(fetchFn).waitForResults(['token-1'], 10_000);

      await vi.advanceTimersByTimeAsync(500);
      expect(fetchFn).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(999);
      expect(fetchFn).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      await expect(waiting).resolves.toMatchObject({ timedOut: false });
      expect(fetchFn).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('persists completed batch cases once and polls only the remaining tokens', async () => {
    vi.useFakeTimers();
    try {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(
          json({
            submissions: [
              {
                token: 'token-1',
                status: { id: 3, description: 'Accepted' },
                time: '0.01',
              },
              {
                token: 'token-2',
                status: { id: 2, description: 'Processing' },
              },
            ],
          }),
        )
        .mockResolvedValueOnce(
          json({
            submissions: [
              {
                token: 'token-2',
                status: { id: 4, description: 'Wrong Answer' },
                time: '0.02',
              },
            ],
          }),
        );
      const onCompleted = vi.fn().mockResolvedValue(undefined);
      const waiting = build(fetchFn).waitForResults(
        ['token-1', 'token-2'],
        5_000,
        onCompleted,
      );
      await vi.advanceTimersByTimeAsync(500);
      const outcome = await waiting;

      expect(outcome.timedOut).toBe(false);
      expect(outcome.results.map((item) => item.verdict)).toEqual([
        Judge0Verdict.Accepted,
        Judge0Verdict.WrongAnswer,
      ]);
      expect(onCompleted).toHaveBeenCalledTimes(2);
      expect(
        onCompleted.mock.calls.map(([items]) =>
          items.map((item) => item.token),
        ),
      ).toEqual([['token-1'], ['token-2']]);
      expect(new URL(fetchFn.mock.calls[1][0]).searchParams.get('tokens')).toBe(
        'token-2',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects incomplete or mismatched Judge0 batch responses', async () => {
    const service = build(
      vi.fn().mockResolvedValue(
        json({
          submissions: [
            {
              token: 'someone-else',
              status: { id: 3, description: 'Accepted' },
            },
          ],
        }),
      ),
    );
    await expect(
      service.waitForResults(['token-1'], 2_000),
    ).rejects.toBeInstanceOf(Judge0InvalidResponseError);
  });

  it('stops polling after the configured attempts', async () => {
    const fetchFn = vi
      .fn()
      .mockImplementation(async () =>
        json({ status: { id: 2, description: 'Processing' } }),
      );
    await expect(build(fetchFn).waitForResult('abc-1')).rejects.toBeInstanceOf(
      Judge0SubmissionTimeoutError,
    );
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('extends polling to the bounded execution timeout when requested', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(finished));
    await expect(
      build(fetchFn).waitForResult('abc-1', 10_000),
    ).resolves.toMatchObject({
      verdict: Judge0Verdict.Accepted,
    });
    expect(fetchFn).toHaveBeenCalledOnce();
  });
});

describe('mapVerdict (Judge0 CE v1.13.1 statuses)', () => {
  it.each([
    [1, Judge0Verdict.Pending],
    [2, Judge0Verdict.Pending],
    [3, Judge0Verdict.Accepted],
    [4, Judge0Verdict.WrongAnswer],
    [5, Judge0Verdict.TimeLimitExceeded],
    [6, Judge0Verdict.CompilationError],
    [7, Judge0Verdict.RuntimeError],
    [8, Judge0Verdict.RuntimeError],
    [9, Judge0Verdict.RuntimeError],
    [10, Judge0Verdict.RuntimeError],
    [11, Judge0Verdict.RuntimeError],
    [12, Judge0Verdict.RuntimeError],
    [13, Judge0Verdict.InternalError],
    [14, Judge0Verdict.InternalError],
    [99, Judge0Verdict.InternalError],
  ])('status %i -> %s', (id, verdict) => {
    expect(mapVerdict(id)).toBe(verdict);
  });
});

describe('loadJudge0Config', () => {
  it('requires a valid http(s) URL and trims trailing slashes', () => {
    expect(() => loadJudge0Config({})).toThrow(Judge0ConfigError);
    expect(() => loadJudge0Config({ JUDGE0_API_URL: 'not a url' })).toThrow(
      Judge0ConfigError,
    );
    expect(() => loadJudge0Config({ JUDGE0_API_URL: 'ftp://host' })).toThrow(
      Judge0ConfigError,
    );
    expect(
      loadJudge0Config({ JUDGE0_API_URL: 'http://host:2358//' }).baseUrl,
    ).toBe('http://host:2358');
  });

  it('uses defaults and accepts positive integer overrides', () => {
    const defaults = loadJudge0Config({ JUDGE0_API_URL: 'http://h' });
    expect(defaults).toMatchObject({
      requestTimeoutMs: 10000,
      pollIntervalMs: 500,
      maxPollAttempts: 30,
    });
    const custom = loadJudge0Config({
      JUDGE0_API_URL: 'http://h',
      JUDGE0_MAX_POLL_ATTEMPTS: '5',
      JUDGE0_POLL_INTERVAL_MS: '-1',
    });
    expect(custom).toMatchObject({ maxPollAttempts: 5, pollIntervalMs: 500 });
  });
});
