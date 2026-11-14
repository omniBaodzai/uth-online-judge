import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { insertNotification } from './notification-writer.js';

describe('insertNotification', () => {
  it('uses the event key for retry-safe recipient deduplication', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 'notification-id' }] });
    const inserted = await insertNotification({ query } as unknown as PoolClient, {
      recipientUserId: 'recipient-id',
      actorUserId: 'actor-id',
      type: 'DISCUSSION_REPLY',
      title: 'Có phản hồi mới',
      content: 'Một người dùng đã trả lời.',
      referenceId: null,
      sourceType: 'DISCUSSION_COMMENT',
      sourceId: 'comment-id',
      targetType: 'DISCUSSION_COMMENT',
      targetId: 'comment-id',
      metadata: { discussionId: 'discussion-id', commentId: 'comment-id', rootCommentId: 'root-id' },
    });

    expect(inserted).toBe(true);
    expect(query.mock.calls[0]?.[0]).toContain(
      'ON CONFLICT (recipient_user_id, source_type, source_id) DO NOTHING',
    );
    expect(query.mock.calls[0]?.[1]).toEqual([
      'recipient-id',
      'actor-id',
      'DISCUSSION_REPLY',
      'Có phản hồi mới',
      'Một người dùng đã trả lời.',
      null,
      'DISCUSSION_COMMENT',
      'comment-id',
      'DISCUSSION_COMMENT',
      'comment-id',
      { discussionId: 'discussion-id', commentId: 'comment-id', rootCommentId: 'root-id' },
    ]);
  });

  it('reports an already-inserted event without duplicating it', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const inserted = await insertNotification({ query } as unknown as PoolClient, {
      recipientUserId: 'recipient-id',
      actorUserId: null,
      type: 'CONTACT_REPLY',
      title: 'A reply',
      content: 'A message',
      referenceId: 'reply-id',
      sourceType: 'CONTACT_REPLY',
      sourceId: 'reply-id',
      targetType: 'CONTACT_MESSAGE',
      targetId: 'message-id',
      metadata: { contactMessageId: 'message-id' },
    });

    expect(inserted).toBe(false);
  });
});
