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
});
