BEGIN;

ALTER TABLE public.submissions
    ADD COLUMN IF NOT EXISTS max_score NUMERIC(8, 2);

UPDATE public.submissions s
SET max_score = p.score
FROM public.problems p
WHERE p.id = s.problem_id
  AND s.max_score IS NULL;

ALTER TABLE public.submissions
    ALTER COLUMN max_score SET DEFAULT 0,
    ALTER COLUMN max_score SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.submission_test_case_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL
        REFERENCES public.submissions(id) ON DELETE CASCADE,
    source_test_case_id UUID NOT NULL,
    test_name VARCHAR(100),
    input_data TEXT NOT NULL,
    expected_output TEXT NOT NULL,
    points NUMERIC(8, 2) NOT NULL,
    position INTEGER NOT NULL,
    time_limit_ms INTEGER NOT NULL,
    memory_limit_kb INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_submission_test_case_snapshot
        UNIQUE (submission_id, source_test_case_id),
    CONSTRAINT uq_submission_test_snapshot_position
        UNIQUE (submission_id, position),
    CONSTRAINT chk_submission_test_snapshot_points
        CHECK (points >= 0),
    CONSTRAINT chk_submission_test_snapshot_position
        CHECK (position > 0),
    CONSTRAINT chk_submission_test_snapshot_time
        CHECK (time_limit_ms > 0),
    CONSTRAINT chk_submission_test_snapshot_memory
        CHECK (memory_limit_kb > 0)
);

ALTER TABLE public.submission_test_results
    ADD COLUMN IF NOT EXISTS snapshot_id UUID;

INSERT INTO public.submission_test_case_snapshots
    (submission_id, source_test_case_id, test_name, input_data, expected_output,
     points, position, time_limit_ms, memory_limit_kb)
SELECT r.submission_id, tc.id, tc.test_name, tc.input_data, tc.expected_output,
       tc.points, tc.position, p.time_limit_ms, p.memory_limit_mb * 1024
FROM public.submission_test_results r
JOIN public.submissions s ON s.id = r.submission_id
JOIN public.problems p ON p.id = s.problem_id
JOIN public.problem_test_cases tc ON tc.id = r.test_case_id
ON CONFLICT (submission_id, source_test_case_id) DO NOTHING;

UPDATE public.submission_test_results r
SET snapshot_id = snapshot.id
FROM public.submission_test_case_snapshots snapshot
WHERE snapshot.submission_id = r.submission_id
  AND snapshot.source_test_case_id = r.test_case_id
  AND r.snapshot_id IS NULL;

INSERT INTO public.submission_test_case_snapshots
    (submission_id, source_test_case_id, test_name, input_data, expected_output,
     points, position, time_limit_ms, memory_limit_kb)
SELECT s.id, tc.id, tc.test_name, tc.input_data, tc.expected_output,
       tc.points, tc.position, p.time_limit_ms, p.memory_limit_mb * 1024
FROM public.submissions s
JOIN public.problems p ON p.id = s.problem_id
JOIN public.problem_test_cases tc ON tc.problem_id = p.id AND tc.is_active = TRUE
WHERE s.status IN ('PENDING', 'QUEUED')
  AND NOT EXISTS (
      SELECT 1
      FROM public.submission_test_case_snapshots snapshot
      WHERE snapshot.submission_id = s.id
  )
ON CONFLICT (submission_id, source_test_case_id) DO NOTHING;

UPDATE public.submissions s
SET status = 'INTERNAL_ERROR',
    error_message = 'No active test cases were available for judging recovery.',
    judged_at = CURRENT_TIMESTAMP
WHERE s.status IN ('PENDING', 'QUEUED')
  AND NOT EXISTS (
      SELECT 1
      FROM public.submission_test_case_snapshots snapshot
      WHERE snapshot.submission_id = s.id
  );

ALTER TABLE public.submission_test_results
    DROP CONSTRAINT IF EXISTS submission_test_results_test_case_id_fkey;

ALTER TABLE public.submission_test_results
    ALTER COLUMN snapshot_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_submission_test_results_snapshot'
          AND conrelid = 'public.submission_test_results'::regclass
    ) THEN
        ALTER TABLE public.submission_test_results
            ADD CONSTRAINT fk_submission_test_results_snapshot
            FOREIGN KEY (snapshot_id)
            REFERENCES public.submission_test_case_snapshots(id)
            ON DELETE CASCADE;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_submission_test_snapshots_submission_position
    ON public.submission_test_case_snapshots (submission_id, position);

COMMIT;
