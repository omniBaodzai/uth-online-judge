BEGIN;

CREATE TABLE public.news_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_data BYTEA NOT NULL,
    content_type VARCHAR(32) NOT NULL,
    byte_size INTEGER NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    orphaned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_news_media_content_type
        CHECK (content_type IN ('image/png', 'image/jpeg', 'image/webp')),
    CONSTRAINT chk_news_media_byte_size
        CHECK (byte_size BETWEEN 1 AND 5242880 AND octet_length(image_data) = byte_size),
    CONSTRAINT chk_news_media_dimensions
        CHECK (width BETWEEN 1 AND 12000 AND height BETWEEN 1 AND 12000 AND width::BIGINT * height <= 16000000)
);

CREATE TABLE public.news_article_media (
    news_article_id UUID NOT NULL REFERENCES public.news_articles(id) ON DELETE CASCADE,
    news_media_id UUID NOT NULL REFERENCES public.news_media(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_news_article_media PRIMARY KEY (news_article_id, news_media_id)
);

CREATE INDEX idx_news_article_media_media
    ON public.news_article_media (news_media_id, news_article_id);

CREATE INDEX idx_news_media_orphaned
    ON public.news_media (orphaned_at, id)
    WHERE orphaned_at IS NOT NULL;

CREATE FUNCTION public.set_news_media_orphaned_state()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.news_media
        SET orphaned_at = NULL
        WHERE id = NEW.news_media_id;
        RETURN NEW;
    END IF;

    UPDATE public.news_media AS media
    SET orphaned_at = CURRENT_TIMESTAMP
    WHERE media.id = OLD.news_media_id
      AND NOT EXISTS (
          SELECT 1
          FROM public.news_article_media AS reference
          WHERE reference.news_media_id = OLD.news_media_id
      );
    RETURN OLD;
END;
$$;

CREATE TRIGGER trg_news_article_media_orphaned_state
AFTER INSERT OR DELETE ON public.news_article_media
FOR EACH ROW
EXECUTE FUNCTION public.set_news_media_orphaned_state();

COMMIT;
