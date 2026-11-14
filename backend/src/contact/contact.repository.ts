import { Inject, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';
import { insertNotification } from '../notifications/notification-writer.js';
import { escapeLikePattern } from '../submissions/global-submissions.js';
import type {
  ContactMessageCategory,
  ContactMessageStatus,
  ContactReplySenderRole,
  ProblemReportType,
} from './contact.dto.js';

export type ContactMessageRecord = {
  id: string;
  userId: string | null;
  username: string | null;
  fullName: string;
  email: string;
  subject: string;
  content: string;
  status: ContactMessageStatus;
  category: ContactMessageCategory;
  reportType: ProblemReportType | null;
  problemId: string | null;
  problemCode: string | null;
  problemTitle: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContactReplyRecord = {
  id: string;
  contactMessageId: string;
  senderUserId: string | null;
  senderRole: ContactReplySenderRole;
  senderName: string;
  content: string;
  createdAt: string;
};

export type ContactMessageDetails = ContactMessageRecord & { replies: ContactReplyRecord[] };

export type ContactMessageListQuery = {
  page: number;
  pageSize: number;
  q?: string;
  status?: ContactMessageStatus;
  category?: ContactMessageCategory;
};

export type ContactMessagePage = {
  items: ContactMessageRecord[];
  total: number;
  page: number;
  pageSize: number;
  statistics: Record<ContactMessageStatus, number> & { total: number };
};

export type NotificationRecord = {
  id: string;
  type: 'CONTACT_REPLY' | 'DISCUSSION_COMMENT' | 'DISCUSSION_REPLY' | 'PROBLEM_REPLY';
  title: string;
  content: string;
  contactMessageId: string;
  actorUserId: string | null;
  actorName: string | null;
  sourceType: 'CONTACT_REPLY' | 'DISCUSSION_COMMENT' | 'PROBLEM_COMMENT';
  sourceId: string;
  targetType: 'CONTACT_MESSAGE' | 'DISCUSSION_COMMENT' | 'PROBLEM_COMMENT';
  targetId: string | null;
  targetAvailable: boolean;
  metadata: Record<string, string>;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
};

export type ContactReplyResult = { reply: ContactReplyRecord; created: boolean };

const USERNAME_SQL = `(SELECT u.username FROM public.users u WHERE u.id = m.user_id)`;

const CONTACT_MESSAGE_COLUMNS = `
  m.id,
  m.user_id AS "userId",
  ${USERNAME_SQL} AS username,
  m.full_name AS "fullName",
  m.email,
  m.subject,
  m.content,
  m.status,
  m.category,
  m.report_type AS "reportType",
  m.problem_id AS "problemId",
  m.problem_code_snapshot AS "problemCode",
  m.problem_title_snapshot AS "problemTitle",
  m.created_at AS "createdAt",
  m.updated_at AS "updatedAt"`;

const CONTACT_REPLY_COLUMNS = `
  r.id,
  r.contact_message_id AS "contactMessageId",
  r.sender_user_id AS "senderUserId",
  r.sender_role AS "senderRole",
  r.sender_name AS "senderName",
  r.content,
  r.created_at AS "createdAt"`;

@Injectable()
export class ContactRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async consumePublicSubmissionLimit(ipAddress: string): Promise<boolean> {
    const ipHash = createHash('sha256').update(ipAddress).digest('hex');
    await this.pool.query(
      `DELETE FROM public.contact_submission_rate_limits
       WHERE window_started_at < CURRENT_TIMESTAMP - INTERVAL '2 hours'`,
    );
    const result = await this.pool.query<{ requestCount: number }>(
      `INSERT INTO public.contact_submission_rate_limits (ip_hash, window_started_at, request_count)
       VALUES ($1, CURRENT_TIMESTAMP, 1)
       ON CONFLICT (ip_hash) DO UPDATE
       SET window_started_at = CASE
             WHEN public.contact_submission_rate_limits.window_started_at
                  <= CURRENT_TIMESTAMP - INTERVAL '1 hour'
             THEN CURRENT_TIMESTAMP
             ELSE public.contact_submission_rate_limits.window_started_at
           END,
           request_count = CASE
             WHEN public.contact_submission_rate_limits.window_started_at
                  <= CURRENT_TIMESTAMP - INTERVAL '1 hour'
             THEN 1
             ELSE LEAST(public.contact_submission_rate_limits.request_count + 1, 6)
           END
       RETURNING request_count AS "requestCount"`,
      [ipHash],
    );
    const requestCount = result.rows[0]?.requestCount;
    if (requestCount === undefined) {
      throw new Error('Public contact rate-limit query returned no counter.');
    }
    return requestCount <= 5;
  }

  async createMessage(input: {
    userId: string | null;
    fullName: string;
    email: string;
    subject: string;
    content: string;
  }): Promise<ContactMessageRecord> {
    const result = await this.pool.query<ContactMessageRecord>(
      `INSERT INTO public.contact_messages AS m (user_id, full_name, email, subject, content)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${CONTACT_MESSAGE_COLUMNS}`,
      [input.userId, input.fullName, input.email, input.subject, input.content],
    );
    const message = result.rows[0];
    if (!message) throw new Error('Contact message insert returned no record.');
    return message;
  }

  async findPublishedProblem(code: string): Promise<{ id: string; code: string; title: string } | null> {
    const result = await this.pool.query<{ id: string; code: string; title: string }>(
      `SELECT id, problem_code AS code, title
       FROM public.problems
       WHERE problem_code = $1 AND status = 'PUBLISHED'
         AND organization_id IS NULL`,
      [code],
    );
    return result.rows[0] ?? null;
  }

  async findUserIdentity(userId: string): Promise<{ username: string | null; email: string } | null> {
    const result = await this.pool.query<{ username: string | null; email: string }>(
      `SELECT username, email FROM public.users WHERE id = $1`,
      [userId],
    );
    return result.rows[0] ?? null;
  }

  async createProblemReport(input: {
    userId: string;
    fullName: string;
    email: string;
    subject: string;
    content: string;
    reportType: ProblemReportType;
    problem: { id: string; code: string; title: string };
  }): Promise<ContactMessageRecord> {
    const result = await this.pool.query<ContactMessageRecord>(
      `INSERT INTO public.contact_messages AS m
         (user_id, full_name, email, subject, content, category, report_type,
          problem_id, problem_code_snapshot, problem_title_snapshot)
       VALUES ($1, $2, $3, $4, $5, 'PROBLEM_REPORT', $6, $7, $8, $9)
       RETURNING ${CONTACT_MESSAGE_COLUMNS}`,
      [
        input.userId,
        input.fullName,
        input.email,
        input.subject,
        input.content,
        input.reportType,
        input.problem.id,
        input.problem.code,
        input.problem.title,
      ],
    );
    const message = result.rows[0];
    if (!message) throw new Error('Problem report insert returned no record.');
    return message;
  }

  async listAdmin(query: ContactMessageListQuery): Promise<ContactMessagePage> {
    const status = query.status ?? null;
    const search = query.q?.trim()
      ? `%${escapeLikePattern(query.q.trim())}%`
      : null;
    const filter = `($1::text IS NULL OR m.status = $1)
      AND ($3::text IS NULL OR m.category = $3)
      AND ($2::text IS NULL OR m.full_name ILIKE $2 ESCAPE '\\'
        OR m.email ILIKE $2 ESCAPE '\\' OR m.subject ILIKE $2 ESCAPE '\\'
        OR m.problem_code_snapshot ILIKE $2 ESCAPE '\\'
        OR m.problem_title_snapshot ILIKE $2 ESCAPE '\\'
        OR ${USERNAME_SQL} ILIKE $2 ESCAPE '\\')`;
    const category = query.category ?? null;
    const [items, count, stats] = await Promise.all([
      this.pool.query<ContactMessageRecord>(
        `SELECT ${CONTACT_MESSAGE_COLUMNS}
         FROM public.contact_messages m
         WHERE ${filter}
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT $4 OFFSET $5`,
        [status, search, category, query.pageSize, (query.page - 1) * query.pageSize],
      ),
      this.pool.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total
         FROM public.contact_messages m
         WHERE ${filter}`,
        [status, search, category],
      ),
      this.pool.query<{ status: ContactMessageStatus; count: number }>(
        `SELECT status, COUNT(*)::int AS count
         FROM public.contact_messages
         GROUP BY status`,
      ),
    ]);
    const statistics: ContactMessagePage['statistics'] = {
      total: 0,
      NEW: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
    };
    for (const row of stats.rows) {
      statistics[row.status] = Number(row.count);
      statistics.total += Number(row.count);
    }
    return {
      items: items.rows,
      total: count.rows[0]?.total ?? 0,
      page: query.page,
      pageSize: query.pageSize,
      statistics,
    };
  }

  async findAdminMessage(id: string): Promise<ContactMessageDetails | null> {
    const result = await this.pool.query<ContactMessageRecord>(
      `SELECT ${CONTACT_MESSAGE_COLUMNS}
       FROM public.contact_messages m WHERE m.id = $1`,
      [id],
    );
    const message = result.rows[0];
    if (!message) return null;
    const replies = await this.listReplies(id);
    return { ...message, replies };
  }

  async listUserMessages(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: ContactMessageRecord[]; total: number; page: number; pageSize: number }> {
    const [items, count] = await Promise.all([
      this.pool.query<ContactMessageRecord>(
        `SELECT ${CONTACT_MESSAGE_COLUMNS}
         FROM public.contact_messages m
         WHERE m.user_id = $1
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT $2 OFFSET $3`,
        [userId, pageSize, (page - 1) * pageSize],
      ),
      this.pool.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM public.contact_messages WHERE user_id = $1`,
        [userId],
      ),
    ]);
    return { items: items.rows, total: count.rows[0]?.total ?? 0, page, pageSize };
  }

  async findUserMessage(userId: string, id: string): Promise<ContactMessageDetails | null> {
    const result = await this.pool.query<ContactMessageRecord>(
      `SELECT ${CONTACT_MESSAGE_COLUMNS}
       FROM public.contact_messages m
       WHERE m.id = $1 AND m.user_id = $2`,
      [id, userId],
    );
    const message = result.rows[0];
    if (!message) return null;
    return { ...message, replies: await this.listReplies(id) };
  }

  async updateStatus(id: string, status: ContactMessageStatus): Promise<ContactMessageRecord | null> {
    const result = await this.pool.query<ContactMessageRecord>(
      `UPDATE public.contact_messages m
       SET status = $2, updated_at = CURRENT_TIMESTAMP
       WHERE m.id = $1
       RETURNING ${CONTACT_MESSAGE_COLUMNS}`,
      [id, status],
    );
    return result.rows[0] ?? null;
  }

  async createReply(input: {
    contactMessageId: string;
    senderUserId: string;
    senderRole: ContactReplySenderRole;
    content: string;
    idempotencyKey: string | null;
    requireOwner?: boolean;
  }): Promise<ContactReplyResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const message = await client.query<{
        userId: string | null;
        subject: string;
        status: ContactMessageStatus;
      }>(
        `SELECT user_id AS "userId", subject, status
         FROM public.contact_messages
         WHERE id = $1
         FOR UPDATE`,
        [input.contactMessageId],
      );
      const contactMessage = message.rows[0];
      if (!contactMessage || (input.requireOwner && contactMessage.userId !== input.senderUserId)) {
        throw new NotFoundException('Không tìm thấy yêu cầu liên hệ.');
      }
      if (input.requireOwner && contactMessage.status === 'RESOLVED') {
        throw new ConflictException('Yêu cầu đã được xử lý. Vui lòng chờ Admin mở lại trước khi phản hồi.');
      }

      const sender = await client.query<{ senderName: string }>(
        `SELECT COALESCE(NULLIF(full_name, ''), NULLIF(username, ''), email) AS "senderName"
         FROM public.users WHERE id = $1`,
        [input.senderUserId],
      );
      const senderName = sender.rows[0]?.senderName;
      if (!senderName) throw new NotFoundException('Không tìm thấy tài khoản người gửi.');

      const inserted = await insertReply(client, {
        ...input,
        senderName,
      });
      if (!inserted.created) {
        await client.query('COMMIT');
        return inserted;
      }

      if (input.senderRole === 'ADMIN' && contactMessage.userId) {
        const title = 'Admin đã phản hồi yêu cầu của bạn';
        const content = `Yêu cầu "${contactMessage.subject}" đã được quản trị viên phản hồi.`;
        await insertNotification(client, {
          recipientUserId: contactMessage.userId,
          actorUserId: input.senderUserId,
          type: 'CONTACT_REPLY',
          title,
          content,
          referenceId: inserted.reply.id,
          sourceType: 'CONTACT_REPLY',
          sourceId: inserted.reply.id,
          targetType: 'CONTACT_MESSAGE',
          targetId: input.contactMessageId,
          metadata: { contactMessageId: input.contactMessageId },
        });
      }

      await client.query('COMMIT');
      return inserted;
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async listNotifications(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: NotificationRecord[]; total: number; unreadCount: number; page: number; pageSize: number }> {
    const [items, counts] = await Promise.all([
      this.pool.query<NotificationRecord>(
        `SELECT n.id, n.type, n.title, n.content,
                COALESCE(n.metadata ->> 'contactMessageId', r.contact_message_id::text, '') AS "contactMessageId",
                n.actor_user_id AS "actorUserId",
                CASE WHEN u.id IS NULL THEN NULL
                     WHEN u.is_active = FALSE THEN 'Người dùng không còn hoạt động'
                     ELSE COALESCE(NULLIF(u.full_name, ''), NULLIF(u.username, ''), 'Người dùng')
                END AS "actorName",
                n.source_type AS "sourceType",
                n.source_id AS "sourceId",
                n.target_type AS "targetType",
                n.target_id AS "targetId",
                CASE
                  WHEN n.target_id IS NULL THEN FALSE
                  WHEN n.target_type = 'CONTACT_MESSAGE' THEN EXISTS (
                    SELECT 1 FROM public.contact_messages m WHERE m.id = n.target_id
                  )
                  WHEN n.target_type = 'DISCUSSION_COMMENT' THEN EXISTS (
                    SELECT 1
                    FROM public.discussion_comments c
                    JOIN public.discussions d ON d.id = c.discussion_id
                    WHERE c.id = n.target_id AND c.deleted_at IS NULL
                  )
                  WHEN n.target_type = 'PROBLEM_COMMENT' THEN EXISTS (
                    SELECT 1
                    FROM public.problem_comments c
                    JOIN public.problems p ON p.id = c.problem_id
                    WHERE c.id = n.target_id
                      AND c.deleted_at IS NULL
                      AND p.status = 'PUBLISHED'
                      AND p.organization_id IS NULL
                  )
                  ELSE FALSE
                END AS "targetAvailable",
                n.metadata,
                n.is_read AS "isRead",
                n.created_at AS "createdAt",
                n.read_at AS "readAt"
         FROM public.notifications n
         LEFT JOIN public.contact_replies r ON r.id = n.reference_id
         LEFT JOIN public.users u ON u.id = n.actor_user_id
         WHERE n.recipient_user_id = $1
         ORDER BY n.created_at DESC, n.id DESC
         LIMIT $2 OFFSET $3`,
        [userId, pageSize, (page - 1) * pageSize],
      ),
      this.pool.query<{ total: number; unreadCount: number }>(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE is_read = FALSE)::int AS "unreadCount"
         FROM public.notifications
         WHERE recipient_user_id = $1`,
        [userId],
      ),
    ]);
    return {
      items: items.rows,
      total: counts.rows[0]?.total ?? 0,
      unreadCount: counts.rows[0]?.unreadCount ?? 0,
      page,
      pageSize,
    };
  }

  async unreadNotificationCount(userId: string): Promise<number> {
    const result = await this.pool.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM public.notifications WHERE recipient_user_id = $1 AND is_read = FALSE`,
      [userId],
    );
    return result.rows[0]?.count ?? 0;
  }

  async markNotificationRead(userId: string, id: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE public.notifications
       SET is_read = TRUE, read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
       WHERE id = $1 AND recipient_user_id = $2`,
      [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async markAllNotificationsRead(userId: string): Promise<number> {
    const result = await this.pool.query(
      `UPDATE public.notifications
       SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
       WHERE recipient_user_id = $1 AND is_read = FALSE`,
      [userId],
    );
    return result.rowCount ?? 0;
  }

  private async listReplies(contactMessageId: string): Promise<ContactReplyRecord[]> {
    const result = await this.pool.query<ContactReplyRecord>(
      `SELECT ${CONTACT_REPLY_COLUMNS}
       FROM public.contact_replies r
       WHERE r.contact_message_id = $1
       ORDER BY r.created_at ASC, r.id ASC`,
      [contactMessageId],
    );
    return result.rows;
  }
}

async function insertReply(
  client: PoolClient,
  input: {
    contactMessageId: string;
    senderUserId: string;
    senderRole: ContactReplySenderRole;
    senderName: string;
    content: string;
    idempotencyKey: string | null;
  },
): Promise<ContactReplyResult> {
  const result = await client.query<ContactReplyRecord>(
    `INSERT INTO public.contact_replies
       (contact_message_id, sender_user_id, sender_role, sender_name, content, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (contact_message_id, sender_user_id, idempotency_key)
       WHERE idempotency_key IS NOT NULL
     DO NOTHING
     RETURNING id, contact_message_id AS "contactMessageId",
               sender_user_id AS "senderUserId", sender_role AS "senderRole",
               sender_name AS "senderName", content, created_at AS "createdAt"`,
    [
      input.contactMessageId,
      input.senderUserId,
      input.senderRole,
      input.senderName,
      input.content,
      input.idempotencyKey,
    ],
  );
  if (result.rows[0]) return { reply: result.rows[0], created: true };

  const existing = await client.query<ContactReplyRecord>(
    `SELECT id, contact_message_id AS "contactMessageId",
            sender_user_id AS "senderUserId", sender_role AS "senderRole",
            sender_name AS "senderName", content, created_at AS "createdAt"
     FROM public.contact_replies
     WHERE contact_message_id = $1 AND sender_user_id = $2 AND idempotency_key = $3`,
    [input.contactMessageId, input.senderUserId, input.idempotencyKey],
  );
  if (!existing.rows[0]) throw new ConflictException('Không thể lưu phản hồi. Vui lòng thử lại.');
  return { reply: existing.rows[0], created: false };
}

async function rollback(client: PoolClient): Promise<void> {
  await client.query('ROLLBACK');
}
