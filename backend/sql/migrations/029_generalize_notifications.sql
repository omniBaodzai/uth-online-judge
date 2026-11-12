BEGIN;

ALTER TABLE public.discussion_comments
    ADD COLUMN idempotency_key UUID;

CREATE UNIQUE INDEX uq_discussion_comments_idempotency
    ON public.discussion_comments (discussion_id, author_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.notifications
    ADD COLUMN actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN source_type VARCHAR(32),
    ADD COLUMN source_id UUID,
    ADD COLUMN target_type VARCHAR(32),
    ADD COLUMN target_id UUID,
    ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.notifications n
SET actor_user_id = r.sender_user_id,
    source_type = 'CONTACT_REPLY',
    source_id = r.id,
    target_type = 'CONTACT_MESSAGE',
    target_id = r.contact_message_id,
    metadata = jsonb_build_object('contactMessageId', r.contact_message_id)
FROM public.contact_replies r
WHERE r.id = n.reference_id;

ALTER TABLE public.notifications
    ALTER COLUMN source_type SET NOT NULL,
    ALTER COLUMN source_id SET NOT NULL,
    ALTER COLUMN target_type SET NOT NULL,
    ALTER COLUMN reference_id DROP NOT NULL,
    DROP CONSTRAINT chk_notifications_type,
    ADD CONSTRAINT chk_notifications_type
        CHECK (type IN ('CONTACT_REPLY', 'DISCUSSION_COMMENT', 'DISCUSSION_REPLY')),
    ADD CONSTRAINT chk_notifications_source_type
        CHECK (source_type IN ('CONTACT_REPLY', 'DISCUSSION_COMMENT')),
    ADD CONSTRAINT chk_notifications_target_type
        CHECK (target_type IN ('CONTACT_MESSAGE', 'DISCUSSION_COMMENT')),
    ADD CONSTRAINT chk_notifications_source_target
        CHECK (
            (type = 'CONTACT_REPLY' AND source_type = 'CONTACT_REPLY' AND target_type = 'CONTACT_MESSAGE')
            OR
            (type IN ('DISCUSSION_COMMENT', 'DISCUSSION_REPLY')
                AND source_type = 'DISCUSSION_COMMENT' AND target_type = 'DISCUSSION_COMMENT')
        ),
    ADD CONSTRAINT chk_notifications_metadata_object
        CHECK (jsonb_typeof(metadata) = 'object');

CREATE UNIQUE INDEX uq_notifications_source_recipient
    ON public.notifications (recipient_user_id, source_type, source_id);
CREATE INDEX idx_notifications_target
    ON public.notifications (target_type, target_id)
    WHERE target_id IS NOT NULL;
CREATE INDEX idx_notifications_discussion_metadata
    ON public.notifications ((metadata ->> 'discussionId'))
    WHERE target_type = 'DISCUSSION_COMMENT';

CREATE FUNCTION public.invalidate_discussion_comment_notification_targets()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.notifications
    SET target_id = NULL
    WHERE target_type = 'DISCUSSION_COMMENT'
      AND target_id = OLD.id;
    RETURN OLD;
END;
$$;

CREATE TRIGGER trg_invalidate_deleted_discussion_comment_notification_targets
BEFORE DELETE ON public.discussion_comments
FOR EACH ROW
EXECUTE FUNCTION public.invalidate_discussion_comment_notification_targets();

CREATE TRIGGER trg_invalidate_soft_deleted_discussion_comment_notification_targets
BEFORE UPDATE OF deleted_at ON public.discussion_comments
FOR EACH ROW
WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
EXECUTE FUNCTION public.invalidate_discussion_comment_notification_targets();

CREATE FUNCTION public.invalidate_discussion_notification_targets()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.notifications
    SET target_id = NULL
    WHERE target_type = 'DISCUSSION_COMMENT'
      AND metadata ->> 'discussionId' = OLD.id::text;
    RETURN OLD;
END;
$$;

CREATE TRIGGER trg_invalidate_deleted_discussion_notification_targets
BEFORE DELETE ON public.discussions
FOR EACH ROW
EXECUTE FUNCTION public.invalidate_discussion_notification_targets();

COMMIT;
