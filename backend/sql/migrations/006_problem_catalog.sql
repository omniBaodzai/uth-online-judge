-- Đồng bộ danh sách bài tập: DB là nguồn dữ liệu duy nhất cho cả trang Admin và trang người dùng.
BEGIN;

ALTER TABLE problems
  ADD COLUMN IF NOT EXISTS topic text NOT NULL DEFAULT 'Khác',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS difficulty varchar(20) NOT NULL DEFAULT 'Trung bình',
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS input_spec text,
  ADD COLUMN IF NOT EXISTS output_spec text,
  ADD COLUMN IF NOT EXISTS constraints_text text,
  ADD COLUMN IF NOT EXISTS source varchar(255);

ALTER TABLE problems DROP CONSTRAINT IF EXISTS problems_difficulty_check;
ALTER TABLE problems ADD CONSTRAINT problems_difficulty_check CHECK (difficulty IN ('Dễ', 'Trung bình', 'Khó'));

INSERT INTO problems (code, title, total_score, topic, tags, difficulty)
VALUES ('UTH001', 'Tổng hai số', 10, 'Nhập môn', ARRAY['Cơ bản', 'Toán học']::text[], 'Dễ')
ON CONFLICT (code) DO UPDATE SET topic = EXCLUDED.topic, tags = EXCLUDED.tags, difficulty = EXCLUDED.difficulty;
INSERT INTO problems (code, title, total_score, topic, tags, difficulty)
VALUES ('UTH002', 'Dãy số Fibonacci', 15, 'Quy hoạch động', ARRAY['Quy hoạch động']::text[], 'Dễ')
ON CONFLICT (code) DO UPDATE SET topic = EXCLUDED.topic, tags = EXCLUDED.tags, difficulty = EXCLUDED.difficulty;
INSERT INTO problems (code, title, total_score, topic, tags, difficulty)
VALUES ('UTH003', 'Chuỗi đối xứng', 20, 'Chuỗi', ARRAY['Chuỗi', 'Hai con trỏ']::text[], 'Trung bình')
ON CONFLICT (code) DO UPDATE SET topic = EXCLUDED.topic, tags = EXCLUDED.tags, difficulty = EXCLUDED.difficulty;
INSERT INTO problems (code, title, total_score, topic, tags, difficulty)
VALUES ('UTH004', 'Đường đi ngắn nhất', 25, 'Đồ thị', ARRAY['Đồ thị', 'BFS']::text[], 'Trung bình')
ON CONFLICT (code) DO UPDATE SET topic = EXCLUDED.topic, tags = EXCLUDED.tags, difficulty = EXCLUDED.difficulty;
INSERT INTO problems (code, title, total_score, topic, tags, difficulty)
VALUES ('UTH005', 'Tìm kiếm nhị phân', 15, 'Mảng', ARRAY['Tìm kiếm', 'Mảng']::text[], 'Dễ')
ON CONFLICT (code) DO UPDATE SET topic = EXCLUDED.topic, tags = EXCLUDED.tags, difficulty = EXCLUDED.difficulty;
INSERT INTO problems (code, title, total_score, topic, tags, difficulty)
VALUES ('UTH006', 'Dãy con tăng dài nhất', 30, 'Quy hoạch động', ARRAY['Quy hoạch động', 'Mảng']::text[], 'Khó')
ON CONFLICT (code) DO UPDATE SET topic = EXCLUDED.topic, tags = EXCLUDED.tags, difficulty = EXCLUDED.difficulty;
INSERT INTO problems (code, title, total_score, topic, tags, difficulty)
VALUES ('UTH007', 'Đếm số thành phần liên thông', 20, 'Đồ thị', ARRAY['Đồ thị', 'DFS']::text[], 'Trung bình')
ON CONFLICT (code) DO UPDATE SET topic = EXCLUDED.topic, tags = EXCLUDED.tags, difficulty = EXCLUDED.difficulty;
INSERT INTO problems (code, title, total_score, topic, tags, difficulty)
VALUES ('UTH008', 'Ước chung lớn nhất', 10, 'Nhập môn', ARRAY['Số học']::text[], 'Dễ')
ON CONFLICT (code) DO UPDATE SET topic = EXCLUDED.topic, tags = EXCLUDED.tags, difficulty = EXCLUDED.difficulty;
INSERT INTO problems (code, title, total_score, topic, tags, difficulty)
VALUES ('UTH009', 'Ngoặc hợp lệ', 20, 'Cấu trúc dữ liệu', ARRAY['Ngăn xếp', 'Chuỗi']::text[], 'Trung bình')
ON CONFLICT (code) DO UPDATE SET topic = EXCLUDED.topic, tags = EXCLUDED.tags, difficulty = EXCLUDED.difficulty;
INSERT INTO problems (code, title, total_score, topic, tags, difficulty)
VALUES ('UTH010', 'Đồng xu đổi tiền', 25, 'Quy hoạch động', ARRAY['Tham lam', 'Quy hoạch động']::text[], 'Trung bình')
ON CONFLICT (code) DO UPDATE SET topic = EXCLUDED.topic, tags = EXCLUDED.tags, difficulty = EXCLUDED.difficulty;
INSERT INTO problems (code, title, total_score, topic, tags, difficulty)
VALUES ('UTH011', 'Sắp xếp sự kiện', 20, 'Mảng', ARRAY['Sắp xếp', 'Tham lam']::text[], 'Trung bình')
ON CONFLICT (code) DO UPDATE SET topic = EXCLUDED.topic, tags = EXCLUDED.tags, difficulty = EXCLUDED.difficulty;
INSERT INTO problems (code, title, total_score, topic, tags, difficulty)
VALUES ('UTH012', 'Cây khung nhỏ nhất', 35, 'Đồ thị', ARRAY['Đồ thị', 'MST']::text[], 'Khó')
ON CONFLICT (code) DO UPDATE SET topic = EXCLUDED.topic, tags = EXCLUDED.tags, difficulty = EXCLUDED.difficulty;
INSERT INTO problems (code, title, total_score, topic, tags, difficulty)
VALUES ('UTH013', 'Truy vấn tổng đoạn', 30, 'Cấu trúc dữ liệu', ARRAY['Mảng', 'Cây đoạn']::text[], 'Khó')
ON CONFLICT (code) DO UPDATE SET topic = EXCLUDED.topic, tags = EXCLUDED.tags, difficulty = EXCLUDED.difficulty;
INSERT INTO problems (code, title, total_score, topic, tags, difficulty)
VALUES ('UTH014', 'Hoán vị kế tiếp', 25, 'Toán tổ hợp', ARRAY['Tổ hợp', 'Sắp xếp']::text[], 'Trung bình')
ON CONFLICT (code) DO UPDATE SET topic = EXCLUDED.topic, tags = EXCLUDED.tags, difficulty = EXCLUDED.difficulty;
INSERT INTO problems (code, title, total_score, topic, tags, difficulty)
VALUES ('UTH015', 'Tô màu bản đồ', 40, 'Đồ thị', ARRAY['Đồ thị', 'DFS']::text[], 'Khó')
ON CONFLICT (code) DO UPDATE SET topic = EXCLUDED.topic, tags = EXCLUDED.tags, difficulty = EXCLUDED.difficulty;
INSERT INTO problems (code, title, total_score, topic, tags, difficulty)
VALUES ('UTH016', 'Tổng tiền tố', 15, 'Mảng', ARRAY['Mảng', 'Cộng dồn']::text[], 'Dễ')
ON CONFLICT (code) DO UPDATE SET topic = EXCLUDED.topic, tags = EXCLUDED.tags, difficulty = EXCLUDED.difficulty;
INSERT INTO problems (code, title, total_score, topic, tags, difficulty)
VALUES ('UTH017', 'Xâu con chung dài nhất', 35, 'Chuỗi', ARRAY['Chuỗi', 'Quy hoạch động']::text[], 'Khó')
ON CONFLICT (code) DO UPDATE SET topic = EXCLUDED.topic, tags = EXCLUDED.tags, difficulty = EXCLUDED.difficulty;
INSERT INTO problems (code, title, total_score, topic, tags, difficulty)
VALUES ('UTH018', 'Mô phỏng hàng đợi', 20, 'Cấu trúc dữ liệu', ARRAY['Hàng đợi', 'Mô phỏng']::text[], 'Dễ')
ON CONFLICT (code) DO UPDATE SET topic = EXCLUDED.topic, tags = EXCLUDED.tags, difficulty = EXCLUDED.difficulty;
INSERT INTO problems (code, title, total_score, topic, tags, difficulty)
VALUES ('PY001', '[Nhập xuất]. Bài 1. Xin chào Python', 5, 'Nhập xuất', ARRAY['Python cơ bản']::text[], 'Dễ')
ON CONFLICT (code) DO UPDATE SET topic = EXCLUDED.topic, tags = EXCLUDED.tags, difficulty = EXCLUDED.difficulty;
INSERT INTO problems (code, title, total_score, topic, tags, difficulty)
VALUES ('PY002', '[Nhập xuất]. Bài 2. Tổng và hiệu hai số', 5, 'Nhập xuất', ARRAY['Python cơ bản', 'Toán học']::text[], 'Dễ')
ON CONFLICT (code) DO UPDATE SET topic = EXCLUDED.topic, tags = EXCLUDED.tags, difficulty = EXCLUDED.difficulty;
INSERT INTO problems (code, title, total_score, topic, tags, difficulty)
VALUES ('PY003', '[Kiểu dữ liệu-if else]. Bài 3. Chẵn hay lẻ', 5, 'Kiểu dữ liệu-if else', ARRAY['Python cơ bản', 'Rẽ nhánh']::text[], 'Dễ')
ON CONFLICT (code) DO UPDATE SET topic = EXCLUDED.topic, tags = EXCLUDED.tags, difficulty = EXCLUDED.difficulty;
INSERT INTO problems (code, title, total_score, topic, tags, difficulty)
VALUES ('PY004', '[Kiểu dữ liệu-if else]. Bài 4. Số lớn nhất trong ba số', 10, 'Kiểu dữ liệu-if else', ARRAY['Python cơ bản', 'Rẽ nhánh']::text[], 'Dễ')
ON CONFLICT (code) DO UPDATE SET topic = EXCLUDED.topic, tags = EXCLUDED.tags, difficulty = EXCLUDED.difficulty;
INSERT INTO problems (code, title, total_score, topic, tags, difficulty)
VALUES ('PY005', '[Kiểu dữ liệu-if else]. Bài 5. Phân loại điểm', 10, 'Kiểu dữ liệu-if else', ARRAY['Python cơ bản', 'Rẽ nhánh']::text[], 'Dễ')
ON CONFLICT (code) DO UPDATE SET topic = EXCLUDED.topic, tags = EXCLUDED.tags, difficulty = EXCLUDED.difficulty;
INSERT INTO problems (code, title, total_score, topic, tags, difficulty)
VALUES ('PY006', '[Kiểu dữ liệu-if else]. Bài 9. Kiểm tra năm nhuận', 10, 'Kiểu dữ liệu-if else', ARRAY['Python cơ bản', 'Rẽ nhánh']::text[], 'Dễ')
ON CONFLICT (code) DO UPDATE SET topic = EXCLUDED.topic, tags = EXCLUDED.tags, difficulty = EXCLUDED.difficulty;
INSERT INTO problems (code, title, total_score, topic, tags, difficulty)
VALUES ('PY007', '[Vòng lặp]. Bài 10. Tổng các số từ 1 đến n', 10, 'Vòng lặp', ARRAY['Python cơ bản', 'Vòng lặp']::text[], 'Dễ')
ON CONFLICT (code) DO UPDATE SET topic = EXCLUDED.topic, tags = EXCLUDED.tags, difficulty = EXCLUDED.difficulty;
INSERT INTO problems (code, title, total_score, topic, tags, difficulty)
VALUES ('PY008', '[Vòng lặp]. Bài 11. Đếm chữ số', 10, 'Vòng lặp', ARRAY['Python cơ bản', 'Vòng lặp']::text[], 'Dễ')
ON CONFLICT (code) DO UPDATE SET topic = EXCLUDED.topic, tags = EXCLUDED.tags, difficulty = EXCLUDED.difficulty;
INSERT INTO problems (code, title, total_score, topic, tags, difficulty)
VALUES ('PY009', '[Vòng lặp]. Bài 12. Số nguyên tố', 15, 'Vòng lặp', ARRAY['Python cơ bản', 'Số học']::text[], 'Trung bình')
ON CONFLICT (code) DO UPDATE SET topic = EXCLUDED.topic, tags = EXCLUDED.tags, difficulty = EXCLUDED.difficulty;
INSERT INTO problems (code, title, total_score, topic, tags, difficulty)
VALUES ('PY010', '[Chuỗi]. Bài 13. Đảo ngược chuỗi', 10, 'Chuỗi', ARRAY['Python cơ bản', 'Chuỗi']::text[], 'Dễ')
ON CONFLICT (code) DO UPDATE SET topic = EXCLUDED.topic, tags = EXCLUDED.tags, difficulty = EXCLUDED.difficulty;
INSERT INTO problems (code, title, total_score, topic, tags, difficulty)
VALUES ('PY011', '[Chuỗi]. Bài 14. Đếm từ trong câu', 15, 'Chuỗi', ARRAY['Python cơ bản', 'Chuỗi']::text[], 'Trung bình')
ON CONFLICT (code) DO UPDATE SET topic = EXCLUDED.topic, tags = EXCLUDED.tags, difficulty = EXCLUDED.difficulty;
INSERT INTO problems (code, title, total_score, topic, tags, difficulty)
VALUES ('PY012', '[Danh sách]. Bài 15. Tìm phần tử lớn thứ hai', 20, 'Danh sách', ARRAY['Python cơ bản', 'Danh sách']::text[], 'Trung bình')
ON CONFLICT (code) DO UPDATE SET topic = EXCLUDED.topic, tags = EXCLUDED.tags, difficulty = EXCLUDED.difficulty;

COMMIT;
