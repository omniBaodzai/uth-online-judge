import { readFileSync } from 'node:fs';

describe('migration 031 hidden global problems', () => {
  const migration = readFileSync(
    new URL('../../sql/migrations/031_hidden_global_problems.sql', import.meta.url),
    'utf8',
  );

  it('adds a non-null false-by-default visibility flag without modifying existing problem data', () => {
    expect(migration).toMatch(/ALTER TABLE public\.problems\s+ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT FALSE/i);
    expect(migration).toMatch(/^BEGIN;/);
    expect(migration).toMatch(/COMMIT;\s*$/);
    expect(migration).not.toMatch(/UPDATE|DELETE|TRUNCATE|DROP TABLE|published_at|status\s*=/i);
  });
});
