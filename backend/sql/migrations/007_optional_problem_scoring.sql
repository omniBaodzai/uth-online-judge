BEGIN;

ALTER TABLE public.problems
    ADD COLUMN IF NOT EXISTS scoring_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.submissions
    ADD COLUMN IF NOT EXISTS scoring_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Before this explicit flag, every persisted problem/submission used the scoring path.
-- Adding the columns with TRUE preserves those existing semantics and all stored results.
-- New problems and submissions use optional scoring by default.
ALTER TABLE public.problems
    ALTER COLUMN scoring_enabled SET DEFAULT FALSE;

ALTER TABLE public.submissions
    ALTER COLUMN scoring_enabled SET DEFAULT FALSE;

COMMIT;
