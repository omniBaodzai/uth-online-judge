import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminProblemDto } from './admin-problem.dto.js';
import { AdminTestCaseDto } from './admin-test-case.dto.js';

describe('Admin DTOs', () => {
  const base = {
    title: 'T', statement: 'S', difficulty: 'easy', tags: [], languages: [],
    timeLimitSeconds: 1, memoryLimitMb: 256,
  };

  it.each(['uth011', 'tong_hai_so', 'bai_tap_01', 'a'.repeat(50)])('accepts problem code %s', async (code) => {
    await expect(validate(plainToInstance(AdminProblemDto, { ...base, code }))).resolves.toHaveLength(0);
  });

  it.each(['UTH011', 'bài_tập', 'bai tap', 'bai-tap', '', 'a'.repeat(51)])('rejects problem code "%s"', async (code) => {
    const errors = await validate(plainToInstance(AdminProblemDto, { ...base, code }));
    expect(errors.map((error) => error.property)).toContain('code');
  });

  it('trims problem codes and accepts user-defined tags', async () => {
    const problem = plainToInstance(AdminProblemDto, {
      code: ' uth004 ',
      title: ' Example problem ',
      statement: 'Statement',
      difficulty: 'easy',
      tags: ['New tag'],
      languages: [],
      timeLimitSeconds: 1,
      memoryLimitMb: 256,
      examples: [],
    });

    expect(problem.code).toBe('uth004');
    expect(problem.title).toBe('Example problem');
    await expect(validate(problem)).resolves.toHaveLength(0);
  });

  it('accepts decimal problem scores and rejects negative or over-precision values', async () => {
    const valid = plainToInstance(AdminProblemDto, {
      ...base, code: 'uth011', scoringEnabled: true, score: '75.25',
    });
    await expect(validate(valid)).resolves.toHaveLength(0);

    for (const score of [-1, '75.251', 1_000_000]) {
      const invalid = plainToInstance(AdminProblemDto, {
        ...base, code: 'uth011', scoringEnabled: true, score,
      });
      const errors = await validate(invalid);
      expect(errors.map((error) => error.property)).toContain('score');
    }
  });

  it('allows scoring to stay disabled or enabled without requiring a problem-wide maximum', async () => {
    const unscored = plainToInstance(AdminProblemDto, {
      ...base, code: 'uth011', scoringEnabled: false,
    });
    await expect(validate(unscored)).resolves.toHaveLength(0);

    const withScoringEnabled = plainToInstance(AdminProblemDto, {
      ...base, code: 'uth011', scoringEnabled: true,
    });
    await expect(validate(withScoringEnabled)).resolves.toHaveLength(0);
  });

  it('accepts scoringEnabled through the strict global whitelist validation pipe', async () => {
    const payload = plainToInstance(AdminProblemDto, {
      ...base, code: 'uth011', scoringEnabled: false,
    });
    const errors = await validate(payload, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors).toHaveLength(0);
  });

  it('requires a collection revision and validates every test case in a problem payload', async () => {
    const valid = plainToInstance(AdminProblemDto, {
      ...base,
      code: 'uth011',
      testCasesRevision: 2,
      testCases: [{ name: 'Mẫu', input: '1', expectedOutput: '2', kind: 'sample', points: 1 }],
    });
    await expect(validate(valid, { whitelist: true, forbidNonWhitelisted: true })).resolves.toHaveLength(0);

    const staleShape = plainToInstance(AdminProblemDto, {
      ...base,
      code: 'uth011',
      testCases: [{ name: 'Mẫu', input: '1', expectedOutput: '2', kind: 'sample', points: 1 }],
    });
    expect((await validate(staleShape)).map((error) => error.property)).toContain('testCasesRevision');

    const weighted = plainToInstance(AdminProblemDto, {
      ...base,
      code: 'uth011',
      testCasesRevision: 2,
      testCases: [{ name: 'Test', input: '1', expectedOutput: '2', kind: 'hidden', points: 2 }],
    });
    const nestedErrors = await validate(weighted);
    expect(nestedErrors[0]?.children?.[0]?.children?.map((error) => error.property)).toContain('points');
  });

  it('accepts exactly one test-case point and rejects configurable weights', async () => {
    const valid = plainToInstance(AdminTestCaseDto, {
      name: 'fixed', input: '', expectedOutput: 'ok', kind: 'hidden', points: 1,
    });
    await expect(validate(valid)).resolves.toHaveLength(0);

    const invalid = plainToInstance(AdminTestCaseDto, {
      name: 'weighted', input: '', expectedOutput: 'ok', kind: 'hidden', points: 12.25,
    });
    const errors = await validate(invalid);
    expect(errors.map((error) => error.property)).toContain('points');
  });

  it('allows empty input and preserves whitespace output but rejects a missing output', async () => {
    const valid = plainToInstance(AdminTestCaseDto, {
      name: ' sample ',
      input: '',
      expectedOutput: ' \n',
      kind: 'hidden',
    });
    expect(valid.name).toBe('sample');
    await expect(validate(valid)).resolves.toHaveLength(0);

    const invalid = plainToInstance(AdminTestCaseDto, {
      name: 'sample',
      input: '',
      expectedOutput: '',
      kind: 'hidden',
    });
    const errors = await validate(invalid);
    expect(errors.map((error) => error.property)).toContain('expectedOutput');
  });
});
