import { BadGatewayException, BadRequestException, GatewayTimeoutException } from '@nestjs/common';
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Judge0TimeoutError, Judge0UnavailableError } from '../judge0/judge0.errors.js';
import { AdminRepository, slugForLanguage } from './admin.repository.js';
import { AdminService } from './admin.service.js';
import { AddJudge0LanguageDto } from './dto/admin-language.dto.js';

describe('Admin language configuration', () => {
  const repository = { listConfiguredJudge0Ids: vi.fn(), enableLanguage: vi.fn() };
  const judge0 = { getLanguages: vi.fn() };
  const service = new AdminService(repository as never, judge0 as never, {} as never);

  beforeEach(() => vi.resetAllMocks());

  it('marks Judge0 languages that are already configured', async () => {
    judge0.getLanguages.mockResolvedValue([{ id: 54, name: 'C++ (GCC 9.2.0)' }, { id: 71, name: 'Python (3.8.1)' }]);
    repository.listConfiguredJudge0Ids.mockResolvedValue(new Set([54]));
    await expect(service.listJudge0Languages()).resolves.toEqual([
      { id: 54, name: 'C++ (GCC 9.2.0)', configured: true },
      { id: 71, name: 'Python (3.8.1)', configured: false },
    ]);
  });

  it('adds a language using the name reported by Judge0, not client input', async () => {
    judge0.getLanguages.mockResolvedValue([{ id: 54, name: 'C++ (GCC 9.2.0)' }]);
    repository.enableLanguage.mockResolvedValue({
      judge0LanguageId: 54,
      slug: 'cpp',
      name: 'C++ (GCC 9.2.0)',
    });
    await service.addJudge0Language(54);
    expect(repository.enableLanguage).toHaveBeenCalledWith(54, 'C++ (GCC 9.2.0)');
  });

  it('rejects ids that Judge0 does not provide', async () => {
    judge0.getLanguages.mockResolvedValue([{ id: 54, name: 'C++ (GCC 9.2.0)' }]);
    await expect(service.addJudge0Language(999)).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.enableLanguage).not.toHaveBeenCalled();
  });

  it('turns Judge0 failures into meaningful HTTP errors', async () => {
    judge0.getLanguages.mockRejectedValue(new Judge0UnavailableError('down'));
    await expect(service.addJudge0Language(54)).rejects.toBeInstanceOf(BadGatewayException);
    judge0.getLanguages.mockRejectedValue(new Judge0TimeoutError('slow'));
    await expect(service.addJudge0Language(54)).rejects.toBeInstanceOf(GatewayTimeoutException);
  });
});

describe('AdminRepository.enableLanguage', () => {
  it('upserts by judge0_language_id with bound parameters', async () => {
    const database = {
      query: vi.fn().mockResolvedValue({
        rows: [{ judge0_language_id: 54, slug: 'j0-54-cpp-gcc-9-2-0', name: 'C++ (GCC 9.2.0)' }],
      }),
    };
    const repository = new AdminRepository(database as never);
    await expect(repository.enableLanguage(54, 'C++ (GCC 9.2.0)')).resolves.toEqual({
      judge0LanguageId: 54,
      slug: 'j0-54-cpp-gcc-9-2-0',
      name: 'C++ (GCC 9.2.0)',
    });
    const [sql, values] = database.query.mock.calls[0];
    expect(sql).toContain('ON CONFLICT (judge0_language_id)');
    expect(values).toEqual(['C++ (GCC 9.2.0)', 'j0-54-cpp-gcc-9-2-0', 54]);
  });

  it('builds slugs accepted by the submission DTO', () => {
    expect(slugForLanguage('C++ (GCC 9.2.0)', 54)).toBe('j0-54-cpp-gcc-9-2-0');
    expect(slugForLanguage('C++ (GCC 9.2.0)', 55)).toBe('j0-55-cpp-gcc-9-2-0');
    expect(slugForLanguage('!!!', 100)).toBe('j0-100-language');
    expect(slugForLanguage('x'.repeat(120), 54)).toHaveLength(100);
  });
});

describe('AddJudge0LanguageDto', () => {
  it.each([[54, 0], ['54', 0], [0, 1], [-1, 1], ['abc', 1], [1.5, 1], [undefined, 1]])('validates %j', async (value, count) => {
    const errors = await validate(plainToInstance(AddJudge0LanguageDto, { judge0LanguageId: value }));
    expect(errors.length).toBe(count);
  });
});
