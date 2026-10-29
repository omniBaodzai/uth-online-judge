
BEGIN;

-- 1. Bổ sung vai trò tài khoản.
-- Tài khoản hiện tại mặc định là STUDENT.
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'STUDENT';

-- Chỉ cho phép hai vai trò ở giai đoạn hiện tại.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_role_check'
          AND conrelid = 'public.users'::regclass
    ) THEN
        ALTER TABLE public.users
        ADD CONSTRAINT users_role_check
        CHECK (role IN ('STUDENT', 'ADMIN'));
    END IF;
END
$$;

-- 2. Liên kết bài tập với các ngôn ngữ được hỗ trợ.
CREATE TABLE IF NOT EXISTS public.problem_languages (
    problem_id UUID NOT NULL,
    language_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT problem_languages_pkey
        PRIMARY KEY (problem_id, language_id),

    CONSTRAINT fk_problem_languages_problem
        FOREIGN KEY (problem_id)
        REFERENCES public.problems(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_problem_languages_language
        FOREIGN KEY (language_id)
        REFERENCES public.programming_languages(id)
        ON DELETE RESTRICT
);

-- Hỗ trợ truy vấn ngược: tìm các bài dùng một ngôn ngữ.
CREATE INDEX IF NOT EXISTS idx_problem_languages_language_id
ON public.problem_languages(language_id);

COMMIT;
