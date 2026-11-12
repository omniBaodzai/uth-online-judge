BEGIN;

ALTER TABLE public.news_articles
    ADD COLUMN content_format VARCHAR(20) NOT NULL DEFAULT 'markdown',
    ADD COLUMN content_json JSONB;

ALTER TABLE public.news_articles
    ADD CONSTRAINT chk_news_articles_content_format
        CHECK (content_format IN ('markdown', 'tiptap-json')),
    ADD CONSTRAINT chk_news_articles_content_json
        CHECK (
            (content_format = 'markdown' AND content_json IS NULL)
            OR (
                content_format = 'tiptap-json'
                AND content_json IS NOT NULL
                AND jsonb_typeof(content_json) = 'object'
                AND content_json->>'format' = 'uth-news-rich-text'
                AND content_json->>'version' = '1'
            )
        );

COMMIT;
