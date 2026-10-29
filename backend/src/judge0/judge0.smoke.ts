import { Judge0Service } from './judge0.service.js';
import { Judge0Verdict } from './judge0.types.js';

// Real Judge0 smoke test. Run explicitly: npm run test:judge0-smoke (requires JUDGE0_API_URL).
describe('Judge0 smoke (real server)', () => {
  const service = new Judge0Service();

  it('reaches /about and lists languages', async () => {
    const about = await service.checkHealth();
    expect(about.version).toBeTruthy();
    const languages = await service.getLanguages();
    expect(languages.some((language) => language.id === 54)).toBe(true);
  });

  it('judges a C++ program as Accepted and Wrong Answer', async () => {
    const source = '#include <iostream>\nint main(){int a,b;std::cin>>a>>b;std::cout<<a+b<<"\\n";}';
    const accepted = await service.waitForResult(
      await service.createSubmission({ languageId: 54, sourceCode: source, stdin: '3 5', expectedOutput: '8' }),
    );
    expect(accepted.verdict).toBe(Judge0Verdict.Accepted);
    const wrong = await service.waitForResult(
      await service.createSubmission({ languageId: 54, sourceCode: source, stdin: '3 5', expectedOutput: '9' }),
    );
    expect(wrong.verdict).toBe(Judge0Verdict.WrongAnswer);
  }, 60_000);

  it('benchmarks a representative three-case C++ batch', async () => {
    const sourceCode = '#include <iostream>\nint main(){long long a,b;std::cin>>a>>b;std::cout<<a+b<<"\\n";}';
    const cases = [
      { stdin: '3 5', expectedOutput: '8' },
      { stdin: '2 7', expectedOutput: '9' },
      { stdin: '-4 3', expectedOutput: '-1' },
    ];
    const startedAt = performance.now();
    const tokens = await service.createSubmissionBatch(cases.map((testCase) => ({
      languageId: 54,
      sourceCode,
      stdin: testCase.stdin,
      expectedOutput: testCase.expectedOutput,
    })));
    const outcome = await service.waitForResults(tokens, 120_000);
    const totalMs = Math.round(performance.now() - startedAt);

    expect(outcome.timedOut).toBe(false);
    expect(outcome.results).toHaveLength(3);
    expect(outcome.results.every((result) => result.verdict === Judge0Verdict.Accepted)).toBe(true);
    console.info('[Judge0 benchmark]', JSON.stringify({
      testCases: cases.length,
      totalMs,
      judge0DurationsMs: outcome.results.map((result) => result.submissionDurationMs),
      executionMs: outcome.results.map((result) => result.timeSeconds === null ? null : Math.round(result.timeSeconds * 1000)),
      wallMs: outcome.results.map((result) => result.wallTimeSeconds === null ? null : Math.round(result.wallTimeSeconds * 1000)),
    }));
  }, 180_000);
});
