import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { DiscussionsRepository } from './discussions.repository.js';
import { ReactionsRepository } from './reactions.repository.js';

const migration = readFileSync(new URL('../../sql/migrations/009_discussion_interactions.sql', import.meta.url), 'utf8');
const code = migration.replace(/--.*$/gm, '');
const nestedRepliesMigration = readFileSync(new URL('../../sql/migrations/012_nested_discussion_replies.sql', import.meta.url), 'utf8');

// Hành vi thực tế của ràng buộc được kiểm tra trên PostgreSQL tạm bằng test/sql/run-009-check.ps1.
describe('migration 009 safeguards', () => {
  it('does not cascade-delete replies when a parent comment is removed', () => {
    const fk = code.slice(code.indexOf('fk_discussion_comments_parent'));
    expect(fk).toMatch(/ON DELETE SET NULL \(parent_id\)/);
    expect(fk.slice(0, fk.indexOf('END IF'))).not.toMatch(/ON DELETE CASCADE/);
  });

  it('keeps the composite parent foreign key on (parent_id, discussion_id)', () => {
    expect(migration).toMatch(/FOREIGN KEY \(parent_id, discussion_id\)\s+REFERENCES public\.discussion_comments \(id, discussion_id\)/);
  });

  it('depth trigger rejects parents that already have replies and locks the parent row', () => {
    const fn = migration.slice(migration.indexOf('enforce_discussion_comment_depth()'), migration.indexOf('CREATE TRIGGER'));
    expect(fn).toMatch(/TG_OP = 'UPDATE'[\s\S]*c\.parent_id = NEW\.id/);
    expect(fn).toMatch(/FOR SHARE/);
    expect(migration).toMatch(/BEFORE INSERT OR UPDATE OF parent_id/);
  });

  it('enforces one reaction per user per target with partial unique indexes', () => {
    expect(migration).toMatch(/UNIQUE INDEX IF NOT EXISTS uq_discussion_reactions_user_discussion[\s\S]*?\(user_id, discussion_id\)\s+WHERE discussion_id IS NOT NULL/);
    expect(migration).toMatch(/UNIQUE INDEX IF NOT EXISTS uq_discussion_reactions_user_comment[\s\S]*?\(user_id, comment_id\)\s+WHERE comment_id IS NOT NULL/);
  });

  it('does not drop or rewrite existing data', () => {
    expect(migration).not.toMatch(/DROP TABLE|TRUNCATE|DELETE FROM|ALTER COLUMN/i);
  });
});

describe('migration 012 nested replies', () => {
  it('replaces the depth restriction with a cycle check', () => {
    expect(nestedRepliesMigration).toMatch(/DROP TRIGGER IF EXISTS trg_discussion_comments_depth/);
    expect(nestedRepliesMigration).toMatch(/CREATE TRIGGER trg_discussion_comments_parent/);
    expect(nestedRepliesMigration).toMatch(/WITH RECURSIVE ancestors/);
    expect(nestedRepliesMigration).toMatch(/WHERE id = NEW\.id/);
    expect(nestedRepliesMigration).not.toMatch(/parent_parent_id/);
  });
});

describe('deleteComment', () => {
  const build = (soft: number, removed: { parentId: string | null }[]) => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: soft, rows: [] })
      .mockResolvedValueOnce({ rowCount: removed.length, rows: removed })
      .mockResolvedValue({ rowCount: 0, rows: [] });
    return { query, repository: new DiscussionsRepository({ query } as never) };
  };

  it('soft-deletes a comment that has replies and never hard-deletes it', async () => {
    const { query, repository } = build(1, []);
    await repository.deleteComment('c1');
    expect(query).toHaveBeenCalledTimes(1);
    expect(String(query.mock.calls[0][0])).toMatch(/SET deleted_at = NOW\(\), content = ''/);
  });

  it('hard-deletes a leaf only when it has no replies', async () => {
    const { query, repository } = build(0, [{ parentId: null }]);
    await repository.deleteComment('c1');
    expect(String(query.mock.calls[1][0])).toMatch(/DELETE FROM[\s\S]*NOT EXISTS[\s\S]*r\.parent_id = c\.id/);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('cleans up a soft-deleted parent left without replies', async () => {
    const { query, repository } = build(0, [{ parentId: 'p1' }]);
    await repository.deleteComment('r1');
    expect(query).toHaveBeenCalledTimes(3);
    const cleanup = String(query.mock.calls[2][0]);
    expect(cleanup).toMatch(/p\.deleted_at IS NOT NULL[\s\S]*NOT EXISTS/);
    expect(query.mock.calls[2][1]).toEqual(['p1']);
  });

  it('cleans up soft-deleted ancestors across nested replies', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ parentId: 'p2' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ parentId: 'p1' }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });
    await new DiscussionsRepository({ query } as never).deleteComment('leaf');
    expect(query).toHaveBeenCalledTimes(4);
    expect(query.mock.calls[2][1]).toEqual(['p2']);
    expect(query.mock.calls[3][1]).toEqual(['p1']);
  });

  it('loads descendants recursively when listing replies', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await new DiscussionsRepository({ query } as never).listReplies(['c1']);
    expect(String(query.mock.calls[0][0])).toMatch(/WITH RECURSIVE descendants/);
    expect(String(query.mock.calls[0][0])).toMatch(/child\.parent_id = parent\.id/);
  });
});

describe('reaction uniqueness', () => {
  it('upserts against the partial unique index instead of insert-then-update', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [] });
    await new ReactionsRepository({ query } as never).set('COMMENT', 'c1', 'u1', 'LOVE');
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toMatch(/ON CONFLICT \(user_id, comment_id\) WHERE comment_id IS NOT NULL\s+DO UPDATE/);
    expect(query.mock.calls[0][1]).toEqual(expect.arrayContaining(['u1', 'c1', 'LOVE']));
  });
});
