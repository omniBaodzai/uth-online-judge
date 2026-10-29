BEGIN;

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS organization VARCHAR(160);

CREATE INDEX IF NOT EXISTS idx_discussion_comments_author_id
    ON public.discussion_comments (author_id);

COMMIT;
