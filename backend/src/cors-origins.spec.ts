import { describe, expect, it } from 'vitest';
import { getAllowedFrontendOrigins } from './cors-origins.js';

describe('getAllowedFrontendOrigins', () => {
  it('always allows the local frontend origin and configured exact origins', () => {
    expect(getAllowedFrontendOrigins(' https://admin.example.test,https://staff.example.test '))
      .toEqual([
        'http://localhost:5173',
        'https://admin.example.test',
        'https://staff.example.test',
      ]);
  });

  it('normalizes valid origins and removes duplicates', () => {
    expect(getAllowedFrontendOrigins('http://localhost:5173/,https://ADMIN.example.test'))
      .toEqual(['http://localhost:5173', 'https://admin.example.test']);
  });

  it.each([
    '*',
    'https://example.test/admin',
    'javascript:alert(1)',
    'https://user:password@example.test',
    'not-an-origin',
  ])('rejects invalid configured origin %s', (origin) => {
    expect(() => getAllowedFrontendOrigins(origin)).toThrow('FRONTEND_ORIGINS');
  });
});
