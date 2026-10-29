BEGIN;

ALTER TABLE public.problem_editorials
    DROP CONSTRAINT IF EXISTS problem_editorials_problem_id_key;

ALTER TABLE public.problem_editorials
    ADD COLUMN IF NOT EXISTS title VARCHAR(160),
    ADD COLUMN IF NOT EXISTS language VARCHAR(100),
    ADD COLUMN IF NOT EXISTS source_code TEXT;

UPDATE public.problem_editorials
SET title = COALESCE(NULLIF(title, ''), 'Lời giải hiện có'),
    language = COALESCE(NULLIF(language, ''), 'text'),
    source_code = COALESCE(source_code, content_markdown);

ALTER TABLE public.problem_editorials
    ALTER COLUMN title SET DEFAULT 'Lời giải',
    ALTER COLUMN title SET NOT NULL,
    ALTER COLUMN language SET DEFAULT 'text',
    ALTER COLUMN language SET NOT NULL,
    ALTER COLUMN source_code SET DEFAULT '',
    ALTER COLUMN source_code SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_problem_editorials_problem_published_created
    ON public.problem_editorials (problem_id, is_published, created_at, id);

COMMIT;
