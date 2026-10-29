BEGIN;

CREATE TABLE IF NOT EXISTS public.student_test_case_progress (
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    problem_id UUID NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
    test_case_id UUID NOT NULL,
    content_fingerprint CHAR(64) NOT NULL,
    first_passed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_student_test_case_progress_fingerprint
        CHECK (content_fingerprint ~ '^[0-9a-f]{64}$'),
    CONSTRAINT uq_student_test_case_progress_content
        UNIQUE (user_id, problem_id, test_case_id, content_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_student_test_case_progress_user_problem
    ON public.student_test_case_progress (user_id, problem_id);

COMMIT;
