import type { PoolClient } from 'pg';

export type NotificationSourceType = 'CONTACT_REPLY' | 'DISCUSSION_COMMENT' | 'PROBLEM_COMMENT';
export type NotificationType = 'CONTACT_REPLY' | 'DISCUSSION_COMMENT' | 'DISCUSSION_REPLY' | 'PROBLEM_REPLY';
export type NotificationTargetType = 'CONTACT_MESSAGE' | 'DISCUSSION_COMMENT' | 'PROBLEM_COMMENT';

export type NewNotification = {
  recipientUserId: string;
  actorUserId: string | null;
  type: NotificationType;
  title: string;
  content: string;
  referenceId: string | null;
  sourceType: NotificationSourceType;
  sourceId: string;
  targetType: NotificationTargetType;
  targetId: string;
  metadata: Record<string, string>;
};

export async function insertNotification(client: PoolClient, notification: NewNotification): Promise<boolean> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO public.notifications
       (recipient_user_id, actor_user_id, type, title, content, reference_id,
        source_type, source_id, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (recipient_user_id, source_type, source_id) DO NOTHING
     RETURNING id`,
    [
      notification.recipientUserId,
      notification.actorUserId,
      notification.type,
      notification.title,
      notification.content,
      notification.referenceId,
      notification.sourceType,
      notification.sourceId,
      notification.targetType,
      notification.targetId,
      notification.metadata,
    ],
  );
  return Boolean(result.rows[0]);
}
