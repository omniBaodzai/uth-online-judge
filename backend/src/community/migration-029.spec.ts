import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../../sql/migrations/029_generalize_notifications.sql', import.meta.url), 'utf8');

describe('migration 029 notification generalization', () => {
  it('backfills contact notifications without changing their IDs or read state', () => {
    const updateStart = migration.indexOf('UPDATE public.notifications n');
    const backfill = migration.slice(updateStart, migration.indexOf('ALTER TABLE', updateStart));
    expect(backfill).toMatch(/source_type = 'CONTACT_REPLY'/);
    expect(backfill).toMatch(/source_id = r\.id/);
    expect(backfill).toMatch(/target_id = r\.contact_message_id/);
    expect(backfill).toMatch(/metadata = jsonb_build_object/);
    const assignedColumns = backfill.slice(backfill.indexOf('SET'), backfill.indexOf('FROM'));
    expect(assignedColumns).not.toMatch(/(?:^|,)\s*(?:id|is_read|read_at)\s*=/);
  });

  it('keeps the legacy reply reference while allowing discussion notifications without one', () => {
    expect(migration).toMatch(/ALTER TABLE public\.discussion_comments[\s\S]*ADD COLUMN idempotency_key UUID/);
    expect(migration).toMatch(
      /uq_discussion_comments_idempotency[\s\S]*\(discussion_id, author_id, idempotency_key\)[\s\S]*WHERE idempotency_key IS NOT NULL/,
    );
    expect(migration).toMatch(/ALTER COLUMN reference_id DROP NOT NULL/);
    expect(migration).toMatch(/ADD CONSTRAINT chk_notifications_type[\s\S]*'DISCUSSION_COMMENT'[\s\S]*'DISCUSSION_REPLY'/);
    expect(migration).toMatch(/uq_notifications_source_recipient[\s\S]*\(recipient_user_id, source_type, source_id\)/);
    expect(migration).not.toMatch(/DROP TABLE|TRUNCATE|DELETE FROM/i);
  });

  it('invalidates targets while retaining notifications when comments or discussions are deleted', () => {
    expect(migration).toMatch(/UPDATE public\.notifications[\s\S]*SET target_id = NULL[\s\S]*target_id = OLD\.id/);
    expect(migration).toMatch(/OLD\.deleted_at IS NULL AND NEW\.deleted_at IS NOT NULL/);
    expect(migration).toMatch(/metadata ->> 'discussionId' = OLD\.id::text/);
    expect(migration).toMatch(/BEFORE DELETE ON public\.discussions/);
  });
});
