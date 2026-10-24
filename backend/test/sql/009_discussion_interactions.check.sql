-- Kiểm thử ràng buộc của migration 009 trên một PostgreSQL TẠM (container dùng một lần), KHÔNG chạy trên DB thật.
-- Cách chạy: xem backend/test/sql/run-009-check.ps1.
\set ON_ERROR_STOP on

CREATE TABLE public.users (id UUID PRIMARY KEY DEFAULT gen_random_uuid());
\i /migrations/008_community.sql
\i /migrations/009_discussion_interactions.sql
-- Chạy lại phải idempotent.
\i /migrations/009_discussion_interactions.sql

INSERT INTO public.users (id) VALUES
  ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000b2');
INSERT INTO public.discussions (id, title, content, author_id) VALUES
  ('d0000000-0000-0000-0000-000000000001', 't1', 'c', '00000000-0000-0000-0000-0000000000a1'),
  ('d0000000-0000-0000-0000-000000000002', 't2', 'c', '00000000-0000-0000-0000-0000000000a1');
INSERT INTO public.discussion_comments (id, discussion_id, author_id, content) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'root'),
  ('c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'root2'),
  ('c0000000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a1', 'other discussion');
INSERT INTO public.discussion_comments (id, discussion_id, author_id, content, parent_id) VALUES
  ('c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b2', 'reply', 'c0000000-0000-0000-0000-000000000001');

CREATE TABLE public.check_results (name TEXT, ok BOOLEAN);

-- Chạy một câu lệnh, kỳ vọng lỗi có SQLSTATE cho trước.
CREATE FUNCTION pg_temp.expect_error(label TEXT, stmt TEXT, expected TEXT) RETURNS void AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
    INSERT INTO public.check_results VALUES (label, false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.check_results VALUES (label, SQLSTATE = expected);
  END;
END $$ LANGUAGE plpgsql;

-- 1. Độ sâu
SELECT pg_temp.expect_error('reply to reply rejected (INSERT)',
  $q$INSERT INTO public.discussion_comments (discussion_id, author_id, content, parent_id)
     VALUES ('d0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'x', 'c0000000-0000-0000-0000-000000000003')$q$, '23514');
SELECT pg_temp.expect_error('parent with children cannot become reply (UPDATE)',
  $q$UPDATE public.discussion_comments SET parent_id = 'c0000000-0000-0000-0000-000000000002' WHERE id = 'c0000000-0000-0000-0000-000000000001'$q$, '23514');
SELECT pg_temp.expect_error('root cannot be re-parented under a reply (UPDATE)',
  $q$UPDATE public.discussion_comments SET parent_id = 'c0000000-0000-0000-0000-000000000003' WHERE id = 'c0000000-0000-0000-0000-000000000002'$q$, '23514');
SELECT pg_temp.expect_error('self parent rejected',
  $q$UPDATE public.discussion_comments SET parent_id = id WHERE id = 'c0000000-0000-0000-0000-000000000002'$q$, '23514');
-- 3. Cùng chủ đề (khóa ngoại ghép)
SELECT pg_temp.expect_error('parent from another discussion rejected',
  $q$INSERT INTO public.discussion_comments (discussion_id, author_id, content, parent_id)
     VALUES ('d0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'x', 'c0000000-0000-0000-0000-000000000009')$q$, '23503');
-- 4. Reaction
INSERT INTO public.discussion_reactions (user_id, comment_id, reaction_type)
  VALUES ('00000000-0000-0000-0000-0000000000a1', 'c0000000-0000-0000-0000-000000000001', 'LIKE');
SELECT pg_temp.expect_error('duplicate comment reaction rejected',
  $q$INSERT INTO public.discussion_reactions (user_id, comment_id, reaction_type)
     VALUES ('00000000-0000-0000-0000-0000000000a1', 'c0000000-0000-0000-0000-000000000001', 'LOVE')$q$, '23505');
INSERT INTO public.discussion_reactions (user_id, discussion_id, reaction_type)
  VALUES ('00000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-000000000001', 'LIKE');
SELECT pg_temp.expect_error('duplicate discussion reaction rejected',
  $q$INSERT INTO public.discussion_reactions (user_id, discussion_id, reaction_type)
     VALUES ('00000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-000000000001', 'LOVE')$q$, '23505');
SELECT pg_temp.expect_error('reaction with both targets rejected',
  $q$INSERT INTO public.discussion_reactions (user_id, discussion_id, comment_id, reaction_type)
     VALUES ('00000000-0000-0000-0000-0000000000b2', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'LIKE')$q$, '23514');
SELECT pg_temp.expect_error('reaction with no target rejected',
  $q$INSERT INTO public.discussion_reactions (user_id, reaction_type) VALUES ('00000000-0000-0000-0000-0000000000b2', 'LIKE')$q$, '23514');
SELECT pg_temp.expect_error('invalid reaction type rejected',
  $q$INSERT INTO public.discussion_reactions (user_id, comment_id, reaction_type)
     VALUES ('00000000-0000-0000-0000-0000000000b2', 'c0000000-0000-0000-0000-000000000001', 'HATE')$q$, '23514');
-- Upsert nguyên tử (đúng dạng ReactionsRepository dùng) không tạo bản ghi thứ hai.
INSERT INTO public.discussion_reactions (user_id, comment_id, reaction_type)
  VALUES ('00000000-0000-0000-0000-0000000000a1', 'c0000000-0000-0000-0000-000000000001', 'HELPFUL')
  ON CONFLICT (user_id, comment_id) WHERE comment_id IS NOT NULL DO UPDATE SET reaction_type = EXCLUDED.reaction_type;
INSERT INTO public.check_results SELECT 'upsert keeps one row and changes type',
  count(*) = 1 AND min(reaction_type) = 'HELPFUL'
  FROM public.discussion_reactions WHERE comment_id = 'c0000000-0000-0000-0000-000000000001';

-- 2. Xóa cha không xóa lây phản hồi của người khác
DELETE FROM public.discussion_comments WHERE id = 'c0000000-0000-0000-0000-000000000001';
INSERT INTO public.check_results SELECT 'hard-deleting parent keeps reply as root',
  count(*) = 1 AND bool_and(parent_id IS NULL) FROM public.discussion_comments WHERE id = 'c0000000-0000-0000-0000-000000000003';
INSERT INTO public.check_results SELECT 'reactions of deleted comment are removed',
  count(*) = 0 FROM public.discussion_reactions WHERE comment_id = 'c0000000-0000-0000-0000-000000000001';

-- Xóa tác giả bình luận cha giữ lại phản hồi của người khác (tác giả cha không sở hữu chủ đề).
INSERT INTO public.users (id) VALUES ('00000000-0000-0000-0000-0000000000c3');
INSERT INTO public.discussion_comments (id, discussion_id, author_id, content) VALUES
  ('c0000000-0000-0000-0000-000000000010', 'd0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c3', 'p');
INSERT INTO public.discussion_comments (id, discussion_id, author_id, content, parent_id) VALUES
  ('c0000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b2', 'r', 'c0000000-0000-0000-0000-000000000010');
DELETE FROM public.users WHERE id = '00000000-0000-0000-0000-0000000000c3';
INSERT INTO public.check_results SELECT 'deleting parent author keeps others replies',
  count(*) = 1 FROM public.discussion_comments WHERE id = 'c0000000-0000-0000-0000-000000000011' AND parent_id IS NULL;

-- Xóa chủ đề xóa toàn bộ bình luận (cả cha lẫn con trong cùng lệnh).
INSERT INTO public.discussions (id, title, content, author_id) VALUES
  ('d0000000-0000-0000-0000-000000000003', 't3', 'c', '00000000-0000-0000-0000-0000000000a1');
INSERT INTO public.discussion_comments (id, discussion_id, author_id, content) VALUES
  ('c0000000-0000-0000-0000-000000000020', 'd0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000a1', 'p');
INSERT INTO public.discussion_comments (id, discussion_id, author_id, content, parent_id) VALUES
  ('c0000000-0000-0000-0000-000000000021', 'd0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000b2', 'r', 'c0000000-0000-0000-0000-000000000020');
DELETE FROM public.discussions WHERE id = 'd0000000-0000-0000-0000-000000000003';
INSERT INTO public.check_results SELECT 'deleting discussion removes all its comments',
  count(*) = 0 FROM public.discussion_comments WHERE discussion_id = 'd0000000-0000-0000-0000-000000000003';

SELECT name, CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result FROM public.check_results ORDER BY ok, name;
SELECT CASE WHEN count(*) FILTER (WHERE NOT ok) = 0 THEN 'ALL PASS' ELSE 'SOME FAILED' END AS summary FROM public.check_results;
