-- Dữ liệu mẫu cho môi trường PHÁT TRIỂN. Không chạy tự động và không dành cho production.
-- Có thể chạy lại nhiều lần (ON CONFLICT DO NOTHING). Cần ít nhất một người dùng đã đăng ký.
--
--   Get-Content backend\sql\seeds\dev_problems.sql | docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users) THEN
    RAISE EXCEPTION 'Cần đăng ký ít nhất một người dùng trước khi nạp dữ liệu mẫu.';
  END IF;
END $$;

INSERT INTO programming_languages (name, slug, judge0_language_id, version) VALUES
  ('C++', 'cpp', 54, 'GCC 9.2.0'),
  ('Java', 'java', 62, 'OpenJDK 13'),
  ('Python', 'python', 71, '3.8'),
  ('JavaScript', 'javascript', 63, 'Node.js 12')
ON CONFLICT DO NOTHING;

INSERT INTO tags (name, slug) VALUES
  ('Toán học', 'math'),
  ('Chuỗi', 'strings'),
  ('Mảng', 'arrays')
ON CONFLICT DO NOTHING;

INSERT INTO problems (problem_code, title, statement, input_description, output_description,
                      constraints_text, difficulty, score, status, created_by, published_at)
SELECT 'UTH001', 'Tổng hai số',
       'Cho hai số nguyên A và B. Hãy in ra tổng của hai số này.',
       'Một dòng chứa hai số nguyên A và B, cách nhau bởi dấu cách.',
       'In ra một số nguyên là tổng A + B.',
       E'-10^18 <= A, B <= 10^18\nKết quả nằm trong phạm vi số nguyên 64 bit có dấu.',
       'EASY', 100, 'PUBLISHED', (SELECT id FROM users ORDER BY created_at LIMIT 1), NOW()
ON CONFLICT (problem_code) DO NOTHING;

INSERT INTO problems (problem_code, title, statement, input_description, output_description,
                      constraints_text, difficulty, score, status, created_by)
SELECT 'UTH900', 'Bài nháp (không hiển thị)', 'Bài tập ở trạng thái DRAFT.',
       NULL, NULL, NULL, 'EASY', 100, 'DRAFT', (SELECT id FROM users ORDER BY created_at LIMIT 1)
ON CONFLICT (problem_code) DO NOTHING;

INSERT INTO problem_tags (problem_id, tag_id)
SELECT p.id, t.id FROM problems p, tags t
WHERE p.problem_code = 'UTH001' AND t.slug = 'math'
ON CONFLICT DO NOTHING;

-- Một test mẫu (hiển thị) và một test ẩn (không bao giờ trả về qua API).
INSERT INTO problem_test_cases (problem_id, test_name, input_data, expected_output, is_sample, points, position)
SELECT p.id, 'sample-1', '3 5', '8', TRUE, 0, 1 FROM problems p WHERE p.problem_code = 'UTH001'
ON CONFLICT DO NOTHING;
INSERT INTO problem_test_cases (problem_id, test_name, input_data, expected_output, is_sample, points, position)
SELECT p.id, 'hidden-1', '1000000000000000000 1', '1000000000000000001', FALSE, 100, 2
FROM problems p WHERE p.problem_code = 'UTH001'
ON CONFLICT DO NOTHING;

COMMIT;
