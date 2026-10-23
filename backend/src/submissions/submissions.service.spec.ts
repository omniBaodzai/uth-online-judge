import { BadRequestException, NotFoundException } from '@nestjs/common';
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSubmissionDto } from './dto/create-submission.dto.js';
import { SubmissionsRepository } from './submissions.repository.js';
import { SubmissionsService } from './submissions.service.js';

describe('SubmissionsService', () => {
  const repository = {
    findPublishedProblemId: vi.fn(),
    findEnabledLanguageId: vi.fn(),
    insert: vi.fn(),
    findOwned: vi.fn(),
  };
  const service = new SubmissionsService(repository as never);
  const input = { problemCode: 'UTH001', language: 'cpp', sourceCode: 'int main(){}' };

  beforeEach(() => vi.resetAllMocks());

  it('records a submission for the authenticated user', async () => {
    repository.findPublishedProblemId.mockResolvedValue('p1');
    repository.findEnabledLanguageId.mockResolvedValue('l1');
    repository.insert.mockResolvedValue({ id: 's1', status: 'PENDING', submittedAt: 'now' });

    await expect(service.create('user-1', input)).resolves.toEqual({
      id: 's1',
      status: 'PENDING',
      submittedAt: 'now',
    });
    expect(repository.insert).toHaveBeenCalledWith({
      userId: 'user-1',
      problemId: 'p1',
      languageId: 'l1',
      sourceCode: input.sourceCode,
    });
  });

  it('rejects unknown/unpublished problems and unsupported languages without inserting', async () => {
    repository.findPublishedProblemId.mockResolvedValue(null);
    await expect(service.create('u', input)).rejects.toBeInstanceOf(NotFoundException);

    repository.findPublishedProblemId.mockResolvedValue('p1');
    repository.findEnabledLanguageId.mockResolvedValue(null);
    await expect(service.create('u', input)).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('only returns submissions owned by the caller', async () => {
    repository.findOwned.mockResolvedValue(null);
    await expect(service.getOwned('s1', 'someone-else')).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findOwned).toHaveBeenCalledWith('s1', 'someone-else');
  });
});

describe('SubmissionsRepository', () => {
  const database = { query: vi.fn() };
  const repository = new SubmissionsRepository(database as never);

  beforeEach(() => database.query.mockReset());

  it('lets the schema default set the status instead of accepting one', async () => {
    database.query.mockResolvedValue({
      rows: [{ id: 's1', status: 'PENDING', submitted_at: new Date('2026-01-01T00:00:00.000Z') }],
    });
    await repository.insert({ userId: 'u', problemId: 'p', languageId: 'l', sourceCode: 'code' });

    const [sql, values] = database.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO submissions (user_id, problem_id, language_id, source_code)');
    expect(sql).not.toContain('score');
    expect(values).toEqual(['u', 'p', 'l', 'code']);
  });

  it('scopes reads to the owner and never selects hidden judging data', async () => {
    database.query.mockResolvedValue({ rows: [] });
    await expect(repository.findOwned('s1', 'u1')).resolves.toBeNull();

    const [sql, values] = database.query.mock.calls[0];
    expect(sql).toContain('s.user_id = $2');
    expect(values).toEqual(['s1', 'u1']);
    expect(database.query).toHaveBeenCalledTimes(1);
  });

  it('exposes per-test results without test data or error output', async () => {
    database.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 's1',
            problem_code: 'UTH001',
            language: 'cpp',
            source_code: 'code',
            status: 'PENDING',
            score: '0.00',
            execution_time_ms: null,
            memory_used_kb: null,
            submitted_at: new Date('2026-01-01T00:00:00.000Z'),
            judged_at: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ position: 1, status: 'ACCEPTED', execution_time_ms: 5, memory_used_kb: 100, points_awarded: '10' }],
      });

    const view = await repository.findOwned('s1', 'u1');
    expect(view?.testResults).toEqual([
      { position: 1, status: 'ACCEPTED', executionTimeMs: 5, memoryUsedKb: 100, pointsAwarded: 10 },
    ]);
    const resultsSql = database.query.mock.calls[1][0] as string;
    expect(resultsSql).not.toContain('expected_output');
    expect(resultsSql).not.toContain('input_data');
    expect(resultsSql).not.toContain('error_message');
  });
});

describe('CreateSubmissionDto', () => {
  const errors = (raw: Record<string, unknown>) =>
    validate(plainToInstance(CreateSubmissionDto, raw), { whitelist: true, forbidNonWhitelisted: true });
  const valid = { problemCode: 'UTH001', language: 'cpp', sourceCode: 'x' };

  it('accepts a valid payload', async () => {
    expect(await errors(valid)).toHaveLength(0);
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
