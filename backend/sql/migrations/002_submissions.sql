BEGIN;

CREATE TABLE IF NOT EXISTS problems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(30) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    time_limit_seconds NUMERIC(5, 2) NOT NULL DEFAULT 1.0,
    memory_limit_mb INTEGER NOT NULL DEFAULT 256,
    total_score INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS test_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    input TEXT NOT NULL DEFAULT '',
    expected_output TEXT NOT NULL DEFAULT '',
    is_sample BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_test_cases_problem_id ON test_cases (problem_id, position);

CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    problem_code VARCHAR(30) NOT NULL,
    source_code TEXT NOT NULL,
    language_id INTEGER NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    execution_time DOUBLE PRECISION,
    memory_used INTEGER,
    score INTEGER NOT NULL DEFAULT 0,
    passed_tests INTEGER NOT NULL DEFAULT 0,
    total_tests INTEGER NOT NULL DEFAULT 0,
    compile_output TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_submissions_status CHECK (
        status IN ('PENDING', 'JUDGING', 'AC', 'WA', 'TLE', 'MLE', 'RE', 'CE')
    )
);

CREATE INDEX IF NOT EXISTS idx_submissions_user_created ON submissions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_problem_code ON submissions (problem_code);

-- Bài mẫu để chạy thử luồng chấm; thay bằng dữ liệu thật khi có.
INSERT INTO problems (code, title) VALUES ('UTH001', 'Tổng hai số') ON CONFLICT (code) DO NOTHING;

INSERT INTO test_cases (problem_id, position, input, expected_output, is_sample)
SELECT p.id, t.position, t.input, t.expected_output, TRUE
FROM problems p
CROSS JOIN (VALUES (1, E'3 5\n', E'8\n'), (2, E'-12 7\n', E'-5\n')) AS t(position, input, expected_output)
WHERE p.code = 'UTH001'
  AND NOT EXISTS (SELECT 1 FROM test_cases c WHERE c.problem_id = p.id);

COMMIT;
