BEGIN;

ALTER TABLE public.problem_comments
    ADD COLUMN idempotency_key UUID;

CREATE UNIQUE INDEX uq_problem_comments_idempotency
    ON public.problem_comments (problem_id, author_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.notifications
    DROP CONSTRAINT chk_notifications_type,
    DROP CONSTRAINT chk_notifications_source_type,
    DROP CONSTRAINT chk_notifications_target_type,
    DROP CONSTRAINT chk_notifications_source_target,
    ADD CONSTRAINT chk_notifications_type
        CHECK (type IN ('CONTACT_REPLY', 'DISCUSSION_COMMENT', 'DISCUSSION_REPLY', 'PROBLEM_REPLY')),
    ADD CONSTRAINT chk_notifications_source_type
        CHECK (source_type IN ('CONTACT_REPLY', 'DISCUSSION_COMMENT', 'PROBLEM_COMMENT')),
    ADD CONSTRAINT chk_notifications_target_type
        CHECK (target_type IN ('CONTACT_MESSAGE', 'DISCUSSION_COMMENT', 'PROBLEM_COMMENT')),
    ADD CONSTRAINT chk_notifications_source_target
        CHECK (
            (type = 'CONTACT_REPLY' AND source_type = 'CONTACT_REPLY' AND target_type = 'CONTACT_MESSAGE')
            OR
            (type IN ('DISCUSSION_COMMENT', 'DISCUSSION_REPLY')
                AND source_type = 'DISCUSSION_COMMENT' AND target_type = 'DISCUSSION_COMMENT')
            OR
            (type = 'PROBLEM_REPLY'
                AND source_type = 'PROBLEM_COMMENT' AND target_type = 'PROBLEM_COMMENT')
        );

CREATE FUNCTION public.invalidate_problem_comment_notification_targets()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.notifications
    SET target_id = NULL
    WHERE target_type = 'PROBLEM_COMMENT'
      AND target_id = OLD.id;
    RETURN OLD;
END;
$$;

CREATE TRIGGER trg_invalidate_deleted_problem_comment_notification_targets
BEFORE DELETE ON public.problem_comments
FOR EACH ROW
EXECUTE FUNCTION public.invalidate_problem_comment_notification_targets();

CREATE TRIGGER trg_invalidate_soft_deleted_problem_comment_notification_targets
BEFORE UPDATE OF deleted_at ON public.problem_comments
FOR EACH ROW
WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
EXECUTE FUNCTION public.invalidate_problem_comment_notification_targets();

COMMIT;
