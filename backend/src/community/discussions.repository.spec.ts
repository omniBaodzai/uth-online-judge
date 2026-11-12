import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { DiscussionsRepository } from './discussions.repository.js';

describe('DiscussionsRepository.createComment notifications', () => {
  function makeRepository(input?: {
    discussionAuthorId?: string;
    parentAuthorId?: string;
    actorId?: string;
    activeRecipients?: string[];
    failNotification?: boolean;
    isLocked?: boolean;
  }) {
    const calls: Array<{ sql: string; values?: unknown[] }> = [];
    const client = {
      query: vi.fn(async (sql: string, values?: unknown[]) => {
        calls.push({ sql, values });
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
        if (sql.includes('FROM public.discussions')) {
          return {
            rows: [{
              id: 'discussion-id',
              title: 'A discussion',
              authorId: input?.discussionAuthorId ?? 'owner-id',
              isLocked: input?.isLocked ?? false,
            }],
          };
        }
        if (sql.includes('FROM public.users') && sql.includes('is_active = TRUE')) {
          return {
            rows: [
              { id: input?.actorId ?? 'actor-id', name: 'Actor' },
              ...(input?.activeRecipients ?? ['owner-id']).map((id) => ({ id, name: id })),
            ],
          };
        }
        if (sql.includes('FROM public.discussion_comments') && sql.includes('WHERE id = $1 AND discussion_id = $2')) {
          return { rows: [{ authorId: input?.parentAuthorId ?? 'parent-id', isDeleted: false }] };
        }
        if (sql.includes('WITH RECURSIVE ancestors')) return { rows: [{ id: 'root-id' }] };
        if (sql.includes('INSERT INTO public.discussion_comments')) return { rows: [{ id: 'new-comment-id' }] };
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
      repository: new DiscussionsRepository(pool as unknown as Pool),
    };
  }

  it('commits comment and notifications together and deduplicates thread/parent recipients', async () => {
    const { calls, client, repository } = makeRepository({
      discussionAuthorId: 'same-owner',
      parentAuthorId: 'same-owner',
      activeRecipients: ['same-owner'],
    });

    await expect(repository.createComment('discussion-id', 'actor-id', 'Reply', 'parent-comment-id'))
      .resolves.toBe('new-comment-id');

    const inserts = calls.filter(({ sql }) => sql.includes('INSERT INTO public.notifications'));
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.values).toEqual(expect.arrayContaining(['same-owner', 'DISCUSSION_REPLY', 'new-comment-id']));
    expect(calls.findIndex(({ sql }) => sql.includes('INSERT INTO public.discussion_comments')))
      .toBeLessThan(calls.findIndex(({ sql }) => sql.includes('INSERT INTO public.notifications')));
    expect(calls[0]?.sql).toBe('BEGIN');
    expect(calls.at(-1)?.sql).toBe('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('notifies both distinct active recipients when the thread author and parent author differ', async () => {
    const { calls, repository } = makeRepository({
      discussionAuthorId: 'thread-owner',
      parentAuthorId: 'parent-owner',
      activeRecipients: ['parent-owner', 'thread-owner'],
    });

    await repository.createComment('discussion-id', 'actor-id', 'Reply', 'parent-comment-id');

    const notifications = calls.filter(({ sql }) => sql.includes('INSERT INTO public.notifications'));
    expect(notifications).toHaveLength(2);
    expect(notifications.map(({ values }) => values?.[0])).toEqual(['parent-owner', 'thread-owner']);
  });

  it('filters the actor and inactive users from notification recipients', async () => {
    const { calls, repository } = makeRepository({
      discussionAuthorId: 'actor-id',
      parentAuthorId: 'inactive-id',
      activeRecipients: [],
    });
    await repository.createComment('discussion-id', 'actor-id', 'Reply', 'parent-comment-id');

    expect(calls.some(({ sql }) => sql.includes('INSERT INTO public.notifications'))).toBe(false);
    expect(calls.find(({ sql }) => sql.includes('FROM public.users') && sql.includes('is_active = TRUE'))?.values)
      .toEqual([['actor-id', 'inactive-id']]);
  });

  it('rolls back the comment when notification persistence fails', async () => {
    const { calls, repository } = makeRepository({ failNotification: true });

    await expect(repository.createComment('discussion-id', 'actor-id', 'Hello')).rejects.toThrow(
      'notification insert failed',
    );
    expect(calls.some(({ sql }) => sql === 'COMMIT')).toBe(false);
    expect(calls.at(-1)?.sql).toBe('ROLLBACK');
  });

  it('returns the original comment on an idempotent retry without sending duplicate notifications', async () => {
    const calls: string[] = [];
    const client = {
      query: vi.fn(async (sql: string) => {
        calls.push(sql);
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
        if (sql.includes('idempotency_key = $3')) {
          return { rows: [{ id: 'existing-comment-id', content: 'Original', parentId: null }] };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      }),
      release: vi.fn(),
    };
    const repository = new DiscussionsRepository({
      connect: vi.fn().mockResolvedValue(client),
    } as unknown as Pool);

    await expect(repository.createComment(
      'discussion-id',
      'actor-id',
      'Original',
      null,
      '550e8400-e29b-41d4-a716-446655440000',
    )).resolves.toBe('existing-comment-id');

    expect(calls).toEqual(['BEGIN', expect.stringContaining('idempotency_key = $3'), 'COMMIT']);
    expect(calls.some((sql) => sql.includes('INSERT INTO public.notifications'))).toBe(false);
  });

  it('rejects reusing an idempotency key with a different comment payload', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'existing-comment-id', content: 'Original', parentId: null }] })
      .mockResolvedValueOnce({ rows: [] });
    const client = { query, release: vi.fn() };
    const repository = new DiscussionsRepository({
      connect: vi.fn().mockResolvedValue(client),
    } as unknown as Pool);

    await expect(repository.createComment(
      'discussion-id',
      'actor-id',
      'Changed',
      null,
      '550e8400-e29b-41d4-a716-446655440000',
    )).rejects.toBeInstanceOf(ConflictException);
    expect(query).toHaveBeenLastCalledWith('ROLLBACK');
  });

  it('rejects locked discussions inside the transaction', async () => {
    const { calls, repository } = makeRepository({ isLocked: true });
    await expect(repository.createComment('discussion-id', 'actor-id', 'Hello')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(calls.at(-1)?.sql).toBe('ROLLBACK');
    expect(calls.some(({ sql }) => sql.includes('INSERT INTO public.discussion_comments'))).toBe(false);
  });
});

describe('DiscussionsRepository comment author profile fields', () => {
  it('returns username and avatar in both root and nested comment queries', async () => {
    const commentRow = {
      id: 'comment-id',
      discussionId: 'discussion-id',
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
    const repository = new DiscussionsRepository({ query } as unknown as Pool);

    await expect(repository.listComments('discussion-id', { page: 1, pageSize: 10 }))
      .resolves.toMatchObject({ items: [commentRow] });
    await expect(repository.listReplies(['root-id'])).resolves.toMatchObject([
      { authorUsername: 'coder', avatarUrl: '/uploads/avatars/coder.webp' },
    ]);
    expect(query.mock.calls[0]?.[0]).toContain('u.username AS "authorUsername"');
    expect(query.mock.calls[0]?.[0]).toContain('u.avatar_url AS "avatarUrl"');
    expect(query.mock.calls[2]?.[0]).toContain('u.avatar_url AS "avatarUrl"');
  });
});
