BEGIN;

INSERT INTO problems (code, title, time_limit_seconds, memory_limit_mb, total_score) VALUES
    ('PY001', '[Nhập xuất]. Bài 1. Xin chào Python', 1.0, 256, 5),
    ('PY002', '[Nhập xuất]. Bài 2. Tổng và hiệu hai số', 1.0, 256, 5),
    ('PY003', '[Kiểu dữ liệu-if else]. Bài 3. Chẵn hay lẻ', 1.0, 256, 5),
    ('PY004', '[Kiểu dữ liệu-if else]. Bài 4. Số lớn nhất trong ba số', 1.0, 256, 10),
    ('PY005', '[Kiểu dữ liệu-if else]. Bài 5. Phân loại điểm', 1.0, 256, 10),
    ('PY006', '[Kiểu dữ liệu-if else]. Bài 9. Kiểm tra năm nhuận', 1.0, 256, 10),
    ('PY007', '[Vòng lặp]. Bài 10. Tổng các số từ 1 đến n', 1.0, 256, 10),
    ('PY008', '[Vòng lặp]. Bài 11. Đếm chữ số', 1.0, 256, 10),
    ('PY009', '[Vòng lặp]. Bài 12. Số nguyên tố', 1.0, 256, 15),
    ('PY010', '[Chuỗi]. Bài 13. Đảo ngược chuỗi', 1.0, 256, 10),
    ('PY011', '[Chuỗi]. Bài 14. Đếm từ trong câu', 1.0, 256, 15),
    ('PY012', '[Danh sách]. Bài 15. Tìm phần tử lớn thứ hai', 1.0, 256, 20)
ON CONFLICT (code) DO NOTHING;

INSERT INTO test_cases (problem_id, position, input, expected_output, is_sample)
SELECT p.id, t.position, t.input, t.expected_output, t.is_sample
FROM (VALUES
    ('PY001', 1, E'', E'Hello UTH\n', TRUE),
    ('PY001', 2, E'\n', E'Hello UTH\n', FALSE),

    ('PY002', 1, E'7 3\n', E'10\n4\n', TRUE),
    ('PY002', 2, E'-5 5\n', E'0\n-10\n', FALSE),
    ('PY002', 3, E'1000000000 1000000000\n', E'2000000000\n0\n', FALSE),
    ('PY002', 4, E'0 0\n', E'0\n0\n', FALSE),

    ('PY003', 1, E'4\n', E'EVEN\n', TRUE),
    ('PY003', 2, E'7\n', E'ODD\n', TRUE),
    ('PY003', 3, E'0\n', E'EVEN\n', FALSE),
    ('PY003', 4, E'-3\n', E'ODD\n', FALSE),
    ('PY003', 5, E'-8\n', E'EVEN\n', FALSE),

    ('PY004', 1, E'3 9 5\n', E'9\n', TRUE),
    ('PY004', 2, E'-1 -2 -3\n', E'-1\n', FALSE),
    ('PY004', 3, E'5 5 5\n', E'5\n', FALSE),
    ('PY004', 4, E'10 2 10\n', E'10\n', FALSE),
    ('PY004', 5, E'1 2 3\n', E'3\n', FALSE),

    ('PY005', 1, E'8.5\n', E'Gioi\n', TRUE),
    ('PY005', 2, E'4.9\n', E'Yeu\n', TRUE),
    ('PY005', 3, E'8\n', E'Gioi\n', FALSE),
    ('PY005', 4, E'6.5\n', E'Kha\n', FALSE),
    ('PY005', 5, E'7.99\n', E'Kha\n', FALSE),
    ('PY005', 6, E'5\n', E'Trung binh\n', FALSE),
    ('PY005', 7, E'6.4\n', E'Trung binh\n', FALSE),
    ('PY005', 8, E'0\n', E'Yeu\n', FALSE),
    ('PY005', 9, E'10\n', E'Gioi\n', FALSE),

    ('PY006', 1, E'2024\n', E'YES\n', TRUE),
    ('PY006', 2, E'1900\n', E'NO\n', TRUE),
    ('PY006', 3, E'2000\n', E'YES\n', FALSE),
    ('PY006', 4, E'2023\n', E'NO\n', FALSE),
    ('PY006', 5, E'4\n', E'YES\n', FALSE),
    ('PY006', 6, E'100\n', E'NO\n', FALSE),

    ('PY007', 1, E'10\n', E'55\n', TRUE),
    ('PY007', 2, E'1\n', E'1\n', FALSE),
    ('PY007', 3, E'100\n', E'5050\n', FALSE),
    ('PY007', 4, E'1000000\n', E'500000500000\n', FALSE),

    ('PY008', 1, E'12345\n', E'5\n', TRUE),
    ('PY008', 2, E'0\n', E'1\n', TRUE),
    ('PY008', 3, E'7\n', E'1\n', FALSE),
    ('PY008', 4, E'99999\n', E'5\n', FALSE),
    ('PY008', 5, E'1000000000000000000\n', E'19\n', FALSE),

    ('PY009', 1, E'17\n', E'YES\n', TRUE),
    ('PY009', 2, E'21\n', E'NO\n', TRUE),
    ('PY009', 3, E'1\n', E'NO\n', FALSE),
    ('PY009', 4, E'2\n', E'YES\n', FALSE),
    ('PY009', 5, E'4\n', E'NO\n', FALSE),
    ('PY009', 6, E'1000000007\n', E'YES\n', FALSE),
    ('PY009', 7, E'999999999\n', E'NO\n', FALSE),

    ('PY010', 1, E'uth\n', E'htu\n', TRUE),
    ('PY010', 2, E'a\n', E'a\n', FALSE),
    ('PY010', 3, E'abc def\n', E'fed cba\n', FALSE),
    ('PY010', 4, E'racecar\n', E'racecar\n', FALSE),

    ('PY011', 1, E'hoc   lap trinh python\n', E'4\n', TRUE),
    ('PY011', 2, E'a\n', E'1\n', FALSE),
    ('PY011', 3, E'  hello world  \n', E'2\n', FALSE),
    ('PY011', 4, E'one two three four five\n', E'5\n', FALSE),

    ('PY012', 1, E'5\n3 9 9 5 1\n', E'5\n', TRUE),
    ('PY012', 2, E'1\n4\n', E'-1\n', FALSE),
    ('PY012', 3, E'3\n2 2 2\n', E'-1\n', FALSE),
    ('PY012', 4, E'4\n-1 -5 -3 -1\n', E'-3\n', FALSE),
    ('PY012', 5, E'2\n1 2\n', E'1\n', FALSE)
) AS t(code, position, input, expected_output, is_sample)
JOIN problems p ON p.code = t.code
WHERE NOT EXISTS (SELECT 1 FROM test_cases c WHERE c.problem_id = p.id);

COMMIT;
