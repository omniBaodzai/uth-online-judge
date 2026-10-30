BEGIN;

CREATE TABLE IF NOT EXISTS public.problem_illustrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_data BYTEA NOT NULL,
    content_type VARCHAR(32) NOT NULL,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_problem_illustrations_content_type
        CHECK (content_type IN ('image/png', 'image/jpeg', 'image/webp', 'image/gif')),
    CONSTRAINT chk_problem_illustrations_size
        CHECK (octet_length(image_data) BETWEEN 1 AND 5242880)
);

ALTER TABLE public.problems
    ADD COLUMN IF NOT EXISTS illustration_url TEXT,
    ADD COLUMN IF NOT EXISTS illustration_width SMALLINT NOT NULL DEFAULT 100,
    ADD COLUMN IF NOT EXISTS illustration_aspect_ratio VARCHAR(8) NOT NULL DEFAULT 'auto',
    ADD COLUMN IF NOT EXISTS illustration_alignment VARCHAR(10) NOT NULL DEFAULT 'center';

ALTER TABLE public.problems
    DROP CONSTRAINT IF EXISTS chk_problems_illustration_width,
    ADD CONSTRAINT chk_problems_illustration_width
        CHECK (illustration_width BETWEEN 25 AND 100),
    DROP CONSTRAINT IF EXISTS chk_problems_illustration_aspect_ratio,
    ADD CONSTRAINT chk_problems_illustration_aspect_ratio
        CHECK (illustration_aspect_ratio IN ('auto', '16:9', '4:3', '1:1', '3:2')),
    DROP CONSTRAINT IF EXISTS chk_problems_illustration_alignment,
    ADD CONSTRAINT chk_problems_illustration_alignment
        CHECK (illustration_alignment IN ('left', 'center', 'right'));

COMMIT;
