BEGIN;

ALTER TABLE public.problems
    ADD COLUMN IF NOT EXISTS test_case_revision INTEGER NOT NULL DEFAULT 0;

UPDATE public.problem_test_cases
SET points = 1
WHERE points <> 1;

ALTER TABLE public.problem_test_cases
    ALTER COLUMN points SET DEFAULT 1;

ALTER TABLE public.problem_test_cases
    DROP CONSTRAINT IF EXISTS chk_test_case_points;

ALTER TABLE public.problem_test_cases
    ADD CONSTRAINT chk_test_case_points CHECK (points = 1);

COMMIT;
