import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminProblemDto } from './admin-problem.dto.js';
import { AdminTestCaseDto } from './admin-test-case.dto.js';

describe('Admin DTOs', () => {
  const base = {
    title: 'T', statement: 'S', difficulty: 'easy', tags: [], languages: [],
    timeLimitSeconds: 1, memoryLimitMb: 256, examples: [],
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
