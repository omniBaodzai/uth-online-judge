BEGIN;

-- Bình luận bài tập: bảng riêng, tách hoàn toàn khỏi discussion_comments / discussion_reactions.
-- Chỉ tạo bảng mới; không đổi hay xóa dữ liệu hiện có. Yêu cầu 002 (problems) và các migration users.

CREATE TABLE IF NOT EXISTS public.problem_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_id UUID NOT NULL,
    author_id UUID NOT NULL,
    parent_id UUID,
    content TEXT NOT NULL,
    -- Xóa mềm: bình luận còn phản hồi được giữ lại làm chỗ giữ chỗ (nội dung bị xóa trắng).
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_problem_comments_problem
        FOREIGN KEY (problem_id) REFERENCES public.problems(id) ON DELETE CASCADE,
    CONSTRAINT fk_problem_comments_author
        FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT problem_comments_no_self_parent_check CHECK (parent_id IS NULL OR parent_id <> id),
    -- Khóa phụ (id, problem_id) để khóa ngoại tổng hợp bắt buộc phản hồi cùng bài tập với bình luận cha.
    CONSTRAINT uq_problem_comments_id_problem UNIQUE (id, problem_id),
    -- ON DELETE SET NULL (parent_id) (PostgreSQL 15+): xóa cha không xóa lây phản hồi của người khác.
    CONSTRAINT fk_problem_comments_parent
        FOREIGN KEY (parent_id, problem_id)
        REFERENCES public.problem_comments (id, problem_id) ON DELETE SET NULL (parent_id)
);

CREATE INDEX IF NOT EXISTS idx_problem_comments_thread
ON public.problem_comments (problem_id, created_at, id)
WHERE parent_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_problem_comments_parent
ON public.problem_comments (parent_id, created_at, id)
WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_problem_comments_author
ON public.problem_comments (author_id);

-- Phản hồi nhiều cấp nhưng không cho phép vòng lặp cha-con (giống discussion_comments, migration 012).
CREATE OR REPLACE FUNCTION public.enforce_problem_comment_parent()
RETURNS trigger AS $$
DECLARE
    creates_cycle BOOLEAN;
BEGIN
    IF NEW.parent_id IS NULL THEN
        RETURN NEW;
    END IF;

    WITH RECURSIVE ancestors(id, parent_id) AS (
        SELECT c.id, c.parent_id
        FROM public.problem_comments c
        WHERE c.id = NEW.parent_id
        UNION
        SELECT parent.id, parent.parent_id
        FROM public.problem_comments parent
        JOIN ancestors child ON parent.id = child.parent_id
    )
    SELECT EXISTS (SELECT 1 FROM ancestors WHERE id = NEW.id) INTO creates_cycle;

    IF creates_cycle THEN
        RAISE EXCEPTION 'Bình luận không thể là cha của chính nó.' USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_problem_comments_parent ON public.problem_comments;
CREATE TRIGGER trg_problem_comments_parent
BEFORE INSERT OR UPDATE OF parent_id ON public.problem_comments
FOR EACH ROW EXECUTE FUNCTION public.enforce_problem_comment_parent();

-- Cảm xúc cho bình luận bài tập: mỗi người dùng tối đa một cảm xúc cho mỗi bình luận.
CREATE TABLE IF NOT EXISTS public.problem_comment_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    comment_id UUID NOT NULL,
    reaction_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT problem_comment_reactions_type_check CHECK (reaction_type IN ('LIKE', 'LOVE', 'HELPFUL')),
    CONSTRAINT fk_problem_comment_reactions_user
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_problem_comment_reactions_comment
        FOREIGN KEY (comment_id) REFERENCES public.problem_comments(id) ON DELETE CASCADE
);

-- Chỉ mục từng phần (WHERE comment_id IS NOT NULL) để dùng chung câu upsert ON CONFLICT của ReactionsRepository.
CREATE UNIQUE INDEX IF NOT EXISTS uq_problem_comment_reactions_user_comment
ON public.problem_comment_reactions (user_id, comment_id)
WHERE comment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_problem_comment_reactions_comment
ON public.problem_comment_reactions (comment_id, reaction_type);

COMMIT;
