BEGIN;

INSERT INTO problems (code, title, time_limit_seconds, memory_limit_mb, total_score) VALUES
    ('UTH002', 'Dãy số Fibonacci', 1.0, 256, 15),
    ('UTH003', 'Chuỗi đối xứng', 1.0, 256, 20),
    ('UTH004', 'Đường đi ngắn nhất', 2.0, 256, 25)
ON CONFLICT (code) DO NOTHING;

-- Chỉ thêm test case cho bài chưa có test case để script chạy lại an toàn.
INSERT INTO test_cases (problem_id, position, input, expected_output, is_sample)
SELECT p.id, t.position, t.input, t.expected_output, t.is_sample
FROM (VALUES
    -- UTH002: Fibonacci
    ('UTH002', 1, E'10\n', E'55\n', TRUE),
    ('UTH002', 2, E'0\n', E'0\n', FALSE),
    ('UTH002', 3, E'1\n', E'1\n', FALSE),
    ('UTH002', 4, E'2\n', E'1\n', FALSE),
    ('UTH002', 5, E'50\n', E'12586269025\n', FALSE),
    ('UTH002', 6, E'90\n', E'2880067194370816120\n', FALSE),
    -- UTH003: chuỗi đối xứng
    ('UTH003', 1, E'level\n', E'YES\n', TRUE),
    ('UTH003', 2, E'uth\n', E'NO\n', TRUE),
    ('UTH003', 3, E'a\n', E'YES\n', FALSE),
    ('UTH003', 4, E'abba\n', E'YES\n', FALSE),
    ('UTH003', 5, E'abca\n', E'NO\n', FALSE),
    ('UTH003', 6, E'racecar\n', E'YES\n', FALSE),
    -- UTH004: BFS đường đi ngắn nhất
    ('UTH004', 1, E'5 5\n1 2\n1 3\n2 4\n3 4\n4 5\n1 5\n', E'3\n', TRUE),
    ('UTH004', 2, E'4 2\n1 2\n3 4\n1 4\n', E'-1\n', FALSE),
    ('UTH004', 3, E'1 0\n1 1\n', E'0\n', FALSE),
    ('UTH004', 4, E'6 5\n1 2\n2 3\n3 4\n4 5\n5 6\n1 6\n', E'5\n', FALSE),
    ('UTH004', 5, E'6 7\n1 2\n2 3\n3 4\n4 5\n5 6\n1 3\n3 5\n1 6\n', E'3\n', FALSE)
) AS t(code, position, input, expected_output, is_sample)
JOIN problems p ON p.code = t.code
WHERE NOT EXISTS (SELECT 1 FROM test_cases c WHERE c.problem_id = p.id);

COMMIT;
