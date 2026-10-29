BEGIN;

-- Tương tác thảo luận: phản hồi một cấp cho bình luận và cảm xúc (reaction) cho chủ đề/bình luận.
-- Chỉ thêm cột/bảng mới; không đổi hay xóa dữ liệu hiện có. Bình luận cũ có parent_id = NULL (bình luận gốc).
-- Yêu cầu migration 008_community.sql đã được áp dụng.

-- 1. Phản hồi một cấp -------------------------------------------------------------------------

ALTER TABLE public.discussion_comments
    ADD COLUMN IF NOT EXISTS parent_id UUID,
    -- Xóa mềm: bình luận gốc đã bị xóa nhưng còn phản hồi sẽ được giữ lại làm chỗ giữ chỗ (nội dung bị xóa trắng).
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Khóa phụ (id, discussion_id) để khóa ngoại tổng hợp bắt buộc phản hồi cùng chủ đề với bình luận cha.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_discussion_comments_id_discussion'
    ) THEN
        ALTER TABLE public.discussion_comments
            ADD CONSTRAINT uq_discussion_comments_id_discussion UNIQUE (id, discussion_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_discussion_comments_parent'
    ) THEN
        -- ON DELETE SET NULL (chỉ parent_id; discussion_id là NOT NULL nên phải liệt kê cột, cần PostgreSQL 15+):
        -- xóa bình luận cha (kể cả khi xóa tài khoản tác giả, vì author_id ở 008 là ON DELETE CASCADE)
        -- KHÔNG xóa lây phản hồi của người khác; phản hồi trở thành bình luận gốc.
        -- Xóa cả chủ đề vẫn xóa mọi bình luận qua fk_discussion_comments_discussion.
        ALTER TABLE public.discussion_comments
            ADD CONSTRAINT fk_discussion_comments_parent
            FOREIGN KEY (parent_id, discussion_id)
            REFERENCES public.discussion_comments (id, discussion_id) ON DELETE SET NULL (parent_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'discussion_comments_no_self_parent_check'
    ) THEN
        ALTER TABLE public.discussion_comments
            ADD CONSTRAINT discussion_comments_no_self_parent_check CHECK (parent_id IS NULL OR parent_id <> id);
    END IF;
END $$;

-- Chỉ một cấp: bình luận cha phải là bình luận gốc, và bình luận đã có phản hồi không được trở thành phản hồi.
-- FOR SHARE khóa dòng cha để một giao dịch khác không thể đồng thời biến cha thành phản hồi
-- (UPDATE của giao dịch đó phải chờ, rồi trigger của nó thấy phản hồi vừa được thêm).
CREATE OR REPLACE FUNCTION public.enforce_discussion_comment_depth()
RETURNS trigger AS $$
DECLARE
    parent_parent_id UUID;
BEGIN
    IF NEW.parent_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' AND EXISTS (
        SELECT 1 FROM public.discussion_comments c WHERE c.parent_id = NEW.id
    ) THEN
        RAISE EXCEPTION 'Bình luận đã có phản hồi không thể trở thành phản hồi.' USING ERRCODE = '23514';
    END IF;

    SELECT p.parent_id INTO parent_parent_id
    FROM public.discussion_comments p
    WHERE p.id = NEW.parent_id
    FOR SHARE;

    IF parent_parent_id IS NOT NULL THEN
        RAISE EXCEPTION 'Phản hồi chỉ được phép một cấp.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_discussion_comments_depth ON public.discussion_comments;
CREATE TRIGGER trg_discussion_comments_depth
BEFORE INSERT OR UPDATE OF parent_id ON public.discussion_comments
FOR EACH ROW EXECUTE FUNCTION public.enforce_discussion_comment_depth();

CREATE INDEX IF NOT EXISTS idx_discussion_comments_parent
ON public.discussion_comments (parent_id, created_at, id)
WHERE parent_id IS NOT NULL;

-- 2. Cảm xúc ----------------------------------------------------------------------------------
-- Một bảng cho cả chủ đề và bình luận: đúng một trong hai khóa ngoại được điền,
-- nên có ràng buộc toàn vẹn và xóa chủ đề/bình luận/người dùng sẽ xóa theo cảm xúc.

CREATE TABLE IF NOT EXISTS public.discussion_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    discussion_id UUID,
    comment_id UUID,
    reaction_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT discussion_reactions_type_check CHECK (reaction_type IN ('LIKE', 'LOVE', 'HELPFUL')),
    CONSTRAINT discussion_reactions_single_target_check
        CHECK ((discussion_id IS NOT NULL AND comment_id IS NULL) OR (discussion_id IS NULL AND comment_id IS NOT NULL)),
    CONSTRAINT fk_discussion_reactions_user
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_discussion_reactions_discussion
        FOREIGN KEY (discussion_id) REFERENCES public.discussions(id) ON DELETE CASCADE,
    CONSTRAINT fk_discussion_reactions_comment
        FOREIGN KEY (comment_id) REFERENCES public.discussion_comments(id) ON DELETE CASCADE
);

-- Mỗi người dùng tối đa một cảm xúc cho mỗi đối tượng (an toàn khi nhiều yêu cầu đồng thời).
CREATE UNIQUE INDEX IF NOT EXISTS uq_discussion_reactions_user_discussion
ON public.discussion_reactions (user_id, discussion_id)
WHERE discussion_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_discussion_reactions_user_comment
ON public.discussion_reactions (user_id, comment_id)
WHERE comment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_discussion_reactions_discussion
ON public.discussion_reactions (discussion_id, reaction_type)
WHERE discussion_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_discussion_reactions_comment
ON public.discussion_reactions (comment_id, reaction_type)
WHERE comment_id IS NOT NULL;

COMMIT;
