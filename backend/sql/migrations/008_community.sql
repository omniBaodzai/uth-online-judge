BEGIN;

-- Góc cộng đồng: tin tức (do ADMIN đăng) và thảo luận (do người dùng tạo).
-- Không thay đổi các bảng hiện có. Vai trò ADMIN đã có sẵn ở users.role (migration 003).

CREATE TABLE IF NOT EXISTS public.news_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(200) NOT NULL,
    summary VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    author_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT news_articles_slug_key UNIQUE (slug),
    CONSTRAINT news_articles_status_check CHECK (status IN ('DRAFT', 'PUBLISHED')),
    -- Bài đã xuất bản bắt buộc có thời điểm xuất bản.
    CONSTRAINT news_articles_published_at_check CHECK (status <> 'PUBLISHED' OR published_at IS NOT NULL),
    CONSTRAINT fk_news_articles_author
        FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_news_articles_public_feed
ON public.news_articles (published_at DESC, id DESC)
WHERE status = 'PUBLISHED';

CREATE INDEX IF NOT EXISTS idx_news_articles_updated_at
ON public.news_articles (updated_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS public.discussions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    author_id UUID NOT NULL,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_discussions_author
        FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_discussions_created_at
ON public.discussions (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_discussions_author_id
ON public.discussions (author_id);

CREATE TABLE IF NOT EXISTS public.discussion_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discussion_id UUID NOT NULL,
    author_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_discussion_comments_discussion
        FOREIGN KEY (discussion_id) REFERENCES public.discussions(id) ON DELETE CASCADE,
    CONSTRAINT fk_discussion_comments_author
        FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_discussion_comments_thread
ON public.discussion_comments (discussion_id, created_at, id);

COMMIT;

-- Cấp quyền ADMIN thủ công cho một tài khoản đáng tin cậy (KHÔNG chạy tự động):
--   UPDATE public.users SET role = 'ADMIN' WHERE email = 'ten-tai-khoan@example.com' AND is_active = TRUE;
