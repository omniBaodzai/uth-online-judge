
BEGIN;

-- =========================================================
-- 1. TAGS: Danh mục chủ đề thuật toán
-- =========================================================
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- 2. PROGRAMMING_LANGUAGES: Ngôn ngữ được phép nộp
-- judge0_language_id là ID ngôn ngữ do Judge0 cung cấp.
-- Không giả định ID này cố định giữa mọi môi trường.
-- =========================================================
CREATE TABLE IF NOT EXISTS programming_languages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    judge0_language_id INTEGER NOT NULL,
    version VARCHAR(100),
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_programming_languages_judge0
        UNIQUE (judge0_language_id)
);

-- =========================================================
-- 3. PROBLEMS: Thông tin bài tập
-- =========================================================
CREATE TABLE IF NOT EXISTS problems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_code VARCHAR(30) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    statement TEXT NOT NULL,
    input_description TEXT,
    output_description TEXT,
    constraints_text TEXT,
    difficulty VARCHAR(20) NOT NULL DEFAULT 'EASY',
    score NUMERIC(8, 2) NOT NULL DEFAULT 100,
    time_limit_ms INTEGER NOT NULL DEFAULT 2000,
    memory_limit_mb INTEGER NOT NULL DEFAULT 256,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',

    created_by UUID NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMPTZ,

    CONSTRAINT chk_problems_difficulty
        CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD')),

    CONSTRAINT chk_problems_status
        CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),

    CONSTRAINT chk_problems_score
        CHECK (score >= 0),

    CONSTRAINT chk_problems_time_limit
        CHECK (time_limit_ms > 0),

    CONSTRAINT chk_problems_memory_limit
        CHECK (memory_limit_mb > 0)
);

-- =========================================================
-- 4. PROBLEM_TAGS: Quan hệ nhiều-nhiều giữa bài và chủ đề
-- =========================================================
CREATE TABLE IF NOT EXISTS problem_tags (
    problem_id UUID NOT NULL
        REFERENCES problems(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL
        REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (problem_id, tag_id)
);

-- =========================================================
-- 5. PROBLEM_TEST_CASES: Dữ liệu dùng để chấm bài
-- Test ẩn tuyệt đối không được trả về frontend.
-- =========================================================
CREATE TABLE IF NOT EXISTS problem_test_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_id UUID NOT NULL
        REFERENCES problems(id) ON DELETE CASCADE,

    test_name VARCHAR(100),
    input_data TEXT NOT NULL,
    expected_output TEXT NOT NULL,

    is_sample BOOLEAN NOT NULL DEFAULT FALSE,
    points NUMERIC(8, 2) NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_test_case_points
        CHECK (points >= 0),

    CONSTRAINT chk_test_case_position
        CHECK (position > 0),

    CONSTRAINT uq_problem_test_position
        UNIQUE (problem_id, position)
);

-- =========================================================
-- 6. SUBMISSIONS: Mỗi lần người dùng nộp mã nguồn
-- =========================================================
CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

    problem_id UUID NOT NULL
        REFERENCES problems(id) ON DELETE RESTRICT,

    language_id UUID NOT NULL
        REFERENCES programming_languages(id) ON DELETE RESTRICT,

    source_code TEXT NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    score NUMERIC(8, 2) NOT NULL DEFAULT 0,

    execution_time_ms INTEGER,
    memory_used_kb INTEGER,

    -- Token dùng để tra cứu submission trên Judge0.
    judge0_token VARCHAR(255) UNIQUE,

    error_message TEXT,

    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    judged_at TIMESTAMPTZ,

    CONSTRAINT chk_submission_status
        CHECK (
            status IN (
                'PENDING',
                'QUEUED',
                'RUNNING',
                'ACCEPTED',
                'WRONG_ANSWER',
                'TIME_LIMIT_EXCEEDED',
                'MEMORY_LIMIT_EXCEEDED',
                'COMPILATION_ERROR',
                'RUNTIME_ERROR',
                'INTERNAL_ERROR'
            )
        ),

    CONSTRAINT chk_submission_score
        CHECK (score >= 0),

    CONSTRAINT chk_submission_execution_time
        CHECK (execution_time_ms IS NULL OR execution_time_ms >= 0),

    CONSTRAINT chk_submission_memory
        CHECK (memory_used_kb IS NULL OR memory_used_kb >= 0)
);

-- =========================================================
-- 7. SUBMISSION_TEST_RESULTS: Kết quả từng test case
-- =========================================================
CREATE TABLE IF NOT EXISTS submission_test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    submission_id UUID NOT NULL
        REFERENCES submissions(id) ON DELETE CASCADE,

    test_case_id UUID NOT NULL
        REFERENCES problem_test_cases(id) ON DELETE RESTRICT,

    status VARCHAR(30) NOT NULL,
    execution_time_ms INTEGER,
    memory_used_kb INTEGER,
    points_awarded NUMERIC(8, 2) NOT NULL DEFAULT 0,
    error_message TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_submission_test
        UNIQUE (submission_id, test_case_id),

    CONSTRAINT chk_test_result_status
        CHECK (
            status IN (
                'ACCEPTED',
                'WRONG_ANSWER',
                'TIME_LIMIT_EXCEEDED',
                'MEMORY_LIMIT_EXCEEDED',
                'COMPILATION_ERROR',
                'RUNTIME_ERROR',
                'INTERNAL_ERROR'
            )
        ),

    CONSTRAINT chk_test_result_points
        CHECK (points_awarded >= 0)
);

-- =========================================================
-- 8. PROBLEM_EDITORIALS: Lời giải chính thức
-- Mỗi bài tập có tối đa một lời giải chính thức.
-- =========================================================
CREATE TABLE IF NOT EXISTS problem_editorials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    problem_id UUID NOT NULL UNIQUE
        REFERENCES problems(id) ON DELETE CASCADE,

    author_id UUID NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

    content_markdown TEXT NOT NULL,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMPTZ
);

-- =========================================================
-- 9. INDEXES: Tối ưu các truy vấn phổ biến
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_problems_status_created
    ON problems (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_problems_difficulty
    ON problems (difficulty);

CREATE INDEX IF NOT EXISTS idx_problem_tags_tag
    ON problem_tags (tag_id);

CREATE INDEX IF NOT EXISTS idx_test_cases_problem_active
    ON problem_test_cases (problem_id, is_active, position);

CREATE INDEX IF NOT EXISTS idx_submissions_user_date
    ON submissions (user_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_submissions_problem_date
    ON submissions (problem_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_submissions_status_date
    ON submissions (status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_test_results_submission
    ON submission_test_results (submission_id);

COMMIT;
