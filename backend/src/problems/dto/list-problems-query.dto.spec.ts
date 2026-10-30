import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListProblemsQueryDto } from './list-problems-query.dto.js';

const parse = async (raw: Record<string, unknown>) => {
  const dto = plainToInstance(ListProblemsQueryDto, raw);
  return { dto, errors: await validate(dto, { whitelist: true, forbidNonWhitelisted: true }) };
};

describe('ListProblemsQueryDto', () => {
  it('applies defaults', async () => {
    const { dto, errors } = await parse({});
    expect(errors).toHaveLength(0);
    expect(dto).toMatchObject({ page: 1, pageSize: 20, sort: 'createdAt', order: 'desc' });
  });

  it('converts numbers and splits tag lists', async () => {
    const { dto, errors } = await parse({ page: '2', pageSize: '10', tags: 'math,arrays', status: 'solved' });
    expect(errors).toHaveLength(0);
    expect(dto).toMatchObject({ page: 2, pageSize: 10, tags: ['math', 'arrays'], status: 'solved' });
  });

  it.each([
    [{ page: '0' }],
    [{ page: 'abc' }],
    [{ pageSize: '51' }],
    [{ sort: 'password_hash' }],
    [{ sort: 'code; DROP TABLE problems' }],
    [{ order: 'sideways' }],
    [{ status: 'accepted' }],
    [{ tags: 'Bad Slug!' }],
    [{ search: 'a'.repeat(101) }],
    [{ unknown: 'x' }],
  ])('rejects %j', async (raw) => {
    expect((await parse(raw)).errors.length).toBeGreaterThan(0);
  });
});
