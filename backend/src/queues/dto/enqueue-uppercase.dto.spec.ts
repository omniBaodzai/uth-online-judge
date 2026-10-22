import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EnqueueUppercaseDto } from './enqueue-uppercase.dto.js';

const errorsFor = (text: unknown) =>
  validate(plainToInstance(EnqueueUppercaseDto, { text }));

describe('EnqueueUppercaseDto', () => {
  it('accepts a normal string', async () => {
    expect(await errorsFor('hello')).toHaveLength(0);
  });

  it.each([['', 'empty'], ['a'.repeat(201), 'too long'], [123, 'non-string'], [undefined, 'missing']])(
    'rejects %s',
    async (value) => {
      expect((await errorsFor(value)).length).toBeGreaterThan(0);
    },
  );
});
