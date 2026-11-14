import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { ProblemCommentsRepository } from './problem-comments.repository.js';

type ExistingComment = { id: string; content: string; parentId: string | null };

function buildRepository(input?: {
  problem?: { id: string; title: string } | null;
  parentAuthorId?: string;
  parentDeleted?: boolean;
  activeUsers?: string[];
  failNotification?: boolean;
}) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  let existingComment: ExistingComment | null = null;
  let nextCommentId = 0;
  const client = {
    query: vi.fn(async (sql: string, values?: unknown[]) => {
      calls.push({ sql, values });
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('FROM public.problems')) {
        return { rows: input?.problem === null ? [] : [input?.problem ?? { id: 'problem-id', title: 'Kho báu' }] };
      }
      if (sql.includes('WITH RECURSIVE ancestors')) return { rows: [{ id: 'root-comment-id' }] };
      if (sql.includes('idempotency_key = $3')) {
        return { rows: existingComment ? [{ ...existingComment }] : [] };
      }
      if (sql.includes('FROM public.problem_comments') && sql.includes('WHERE id = $1 AND problem_id = $2')) {
        return {
          rows: [{
            authorId: input?.parentAuthorId ?? 'parent-id',
            isDeleted: input?.parentDeleted ?? false,
          }],
        };
      }
      if (sql.includes('FROM public.users') && sql.includes('is_active = TRUE')) {
        const ids = (values?.[0] as string[]) ?? [];
        return {
          rows: ids
            .filter((id) => (input?.activeUsers ?? ['actor-id', 'parent-id']).includes(id))
            .map((id) => ({ id, name: id === 'actor-id' ? 'Nguyễn Văn A' : 'Nguyễn Văn B' })),
        };
      }
      if (sql.includes('INSERT INTO public.problem_comments')) {
        nextCommentId += 1;
        const comment: ExistingComment = {
          id: `new-comment-${nextCommentId}`,
          content: String(values?.[2]),
          parentId: values?.[3] as string | null,
        };
        if (values?.[4]) existingComment = comment;
        return { rows: [{ id: comment.id }] };
      }
      if (sql.includes('INSERT INTO public.notifications')) {
        if (input?.failNotification) throw new Error('notification insert failed');
        return { rows: [{ id: 'notification-id' }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    }),
    release: vi.fn(),
  };
  const pool = { connect: vi.fn().mockResolvedValue(client) };
  return {
    calls,
    client,
    repository: new ProblemCommentsRepository(pool as unknown as Pool),
  };
}

describe('ProblemCommentsRepository notifications', () => {
  it.each([
    ['A replies to B', 'actor-id', 'parent-id', 'parent-id'],
    ['B replies to A', 'parent-id', 'actor-id', 'actor-id'],
  ])('%s and notifies only the parent author', async (_label, actorId, parentAuthorId, expectedRecipient) => {
    const { calls, repository } = buildRepository({
      parentAuthorId,
      activeUsers: ['actor-id', 'parent-id'],
    });

    await expect(repository.createComment('khobau', actorId, '@parent_user Reply', 'parent-comment-id'))
      .resolves.toBe('new-comment-1');

    const commentInsert = calls.find(({ sql }) => sql.includes('INSERT INTO public.problem_comments'));
    expect(commentInsert?.values).toEqual([
      'problem-id',
      actorId,
      '@parent_user Reply',
      'parent-comment-id',
      null,
    ]);
    const notification = calls.find(({ sql }) => sql.includes('INSERT INTO public.notifications'));
    expect(notification?.values).toEqual([
      expectedRecipient,
      actorId,
      'PROBLEM_REPLY',
      'Có phản hồi mới',
      expect.stringContaining('trong bài tập "Kho báu".'),
      null,
      'PROBLEM_COMMENT',
      'new-comment-1',
      'PROBLEM_COMMENT',
      'new-comment-1',
      {
        problemCode: 'khobau',
        problemId: 'problem-id',
        commentId: 'new-comment-1',
        rootCommentId: 'root-comment-id',
      },
    ]);
    expect(calls.at(-1)?.sql).toBe('COMMIT');
  });

  it('does not notify the actor when they reply to their own comment', async () => {
    const { calls, repository } = buildRepository({
      parentAuthorId: 'actor-id',
      activeUsers: ['actor-id'],
    });

    await repository.createComment('khobau', 'actor-id', 'Reply', 'own-comment-id');

    expect(calls.some(({ sql }) => sql.includes('INSERT INTO public.notifications'))).toBe(false);
  });

  it('does not notify anyone for a top-level comment', async () => {
    const { calls, repository } = buildRepository();

    await repository.createComment('khobau', 'actor-id', 'New comment');

    expect(calls.some(({ sql }) => sql.includes('INSERT INTO public.notifications'))).toBe(false);
  });

  it('skips an inactive parent author but commits the comment', async () => {
    const { calls, repository } = buildRepository({
      parentAuthorId: 'inactive-id',
      activeUsers: ['actor-id'],
    });

    await repository.createComment('khobau', 'actor-id', 'Reply', 'parent-comment-id');

    expect(calls.some(({ sql }) => sql.includes('INSERT INTO public.notifications'))).toBe(false);
    expect(calls.at(-1)?.sql).toBe('COMMIT');
  });

  it('returns the original comment on retry with the same idempotency key', async () => {
    const { calls, repository } = buildRepository();
    const key = '550e8400-e29b-41d4-a716-446655440000';

    await repository.createComment('khobau', 'actor-id', 'Reply', 'parent-comment-id', key);
    await expect(repository.createComment('khobau', 'actor-id', 'Reply', 'parent-comment-id', key))
      .resolves.toBe('new-comment-1');

    expect(calls.filter(({ sql }) => sql.includes('INSERT INTO public.problem_comments'))).toHaveLength(1);
    expect(calls.filter(({ sql }) => sql.includes('INSERT INTO public.notifications'))).toHaveLength(1);
  });

  it('rejects reusing a key with a different payload', async () => {
    const { calls, repository } = buildRepository();
    const key = '550e8400-e29b-41d4-a716-446655440000';
    await repository.createComment('khobau', 'actor-id', 'Original', 'parent-comment-id', key);

    await expect(repository.createComment('khobau', 'actor-id', 'Changed', 'parent-comment-id', key))
      .rejects.toBeInstanceOf(ConflictException);
    expect(calls.at(-1)?.sql).toBe('ROLLBACK');
    expect(calls.filter(({ sql }) => sql.includes('INSERT INTO public.notifications'))).toHaveLength(1);
  });

  it('rolls back the comment if notification insertion fails', async () => {
    const { calls, repository } = buildRepository({ failNotification: true });

    await expect(repository.createComment('khobau', 'actor-id', 'Reply', 'parent-comment-id'))
      .rejects.toThrow('notification insert failed');

    expect(calls.some(({ sql }) => sql === 'COMMIT')).toBe(false);
    expect(calls.at(-1)?.sql).toBe('ROLLBACK');
  });

  it('rejects a missing, unpublished, archived, or organization problem inside the transaction', async () => {
    const { calls, repository } = buildRepository({ problem: null });

    await expect(repository.createComment('private-or-archived', 'actor-id', 'Comment'))
      .rejects.toBeInstanceOf(NotFoundException);
    const problemQuery = calls.find(({ sql }) => sql.includes('FROM public.problems'));
    expect(problemQuery?.sql).toContain("status = 'PUBLISHED'");
    expect(problemQuery?.sql).toContain('organization_id IS NULL');
    expect(problemQuery?.sql).toContain('FOR SHARE');
    expect(calls.some(({ sql }) => sql.includes('INSERT INTO public.problem_comments'))).toBe(false);
    expect(calls.at(-1)?.sql).toBe('ROLLBACK');
  });

  it('rejects replying to a deleted parent and rolls back', async () => {
    const { calls, repository } = buildRepository({ parentDeleted: true });

    await expect(repository.createComment('khobau', 'actor-id', 'Reply', 'parent-comment-id'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(calls.at(-1)?.sql).toBe('ROLLBACK');
    expect(calls.some(({ sql }) => sql.includes('INSERT INTO public.problem_comments'))).toBe(false);
  });
});

describe('migration 030 problem comment notifications', () => {
  const sql = readFileSync(new URL('../../sql/migrations/030_problem_comment_notifications.sql', import.meta.url), 'utf8');

  it('is additive and preserves existing notification types and data', () => {
    expect(sql).toContain('ADD COLUMN idempotency_key UUID');
    expect(sql).toContain('CREATE UNIQUE INDEX uq_problem_comments_idempotency');
    expect(sql).toContain("'CONTACT_REPLY', 'DISCUSSION_COMMENT', 'DISCUSSION_REPLY', 'PROBLEM_REPLY'");
    expect(sql).toContain("'CONTACT_REPLY', 'DISCUSSION_COMMENT', 'PROBLEM_COMMENT'");
    expect(sql).toContain("'CONTACT_MESSAGE', 'DISCUSSION_COMMENT', 'PROBLEM_COMMENT'");
    expect(sql).not.toMatch(/INSERT\s+INTO\s+public\.notifications/i);
    expect(sql).not.toMatch(/DELETE\s+FROM\s+public\.notifications/i);
    expect(sql).not.toMatch(/TRUNCATE|DROP TABLE|DROP COLUMN/i);
  });

  it('invalidates targets on both soft and physical comment deletion', () => {
    expect(sql).toContain('BEFORE DELETE ON public.problem_comments');
    expect(sql).toContain('BEFORE UPDATE OF deleted_at ON public.problem_comments');
    expect(sql).toContain("OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL");
    expect(sql).toContain("WHERE target_type = 'PROBLEM_COMMENT'");
    expect(sql).toContain('SET target_id = NULL');
  });
});

describe('ProblemCommentsRepository comment author profile fields', () => {
  it('returns username and avatar with the paginated comments and nested replies', async () => {
    const commentRow = {
      id: 'comment-id',
      problemId: 'problem-id',
      parentId: null,
      authorId: 'author-id',
      authorName: 'coder',
      authorUsername: 'coder',
      avatarUrl: '/uploads/avatars/coder.webp',
      content: 'hello',
      isDeleted: false,
      createdAt: '',
      updatedAt: '',
    };
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [commentRow] })
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [{ ...commentRow, parentId: 'root-id' }] });
    const repository = new ProblemCommentsRepository({ query } as unknown as Pool);

    await expect(repository.listComments('problem-id', { page: 1, pageSize: 10 }))
      .resolves.toMatchObject({ items: [commentRow] });
    await expect(repository.listReplies(['root-id'])).resolves.toMatchObject([
      { authorUsername: 'coder', avatarUrl: '/uploads/avatars/coder.webp' },
    ]);
    expect(query.mock.calls[0]?.[0]).toContain('u.username AS "authorUsername"');
    expect(query.mock.calls[0]?.[0]).toContain('u.avatar_url AS "avatarUrl"');
    expect(query.mock.calls[2]?.[0]).toContain('u.avatar_url AS "avatarUrl"');
  });
});
