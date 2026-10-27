BEGIN;

ALTER TABLE public.problems
    ADD COLUMN IF NOT EXISTS statement_pdf_url TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_problems_statement_pdf_url'
    ) THEN
        ALTER TABLE public.problems
            ADD CONSTRAINT chk_problems_statement_pdf_url
            CHECK (statement_pdf_url IS NULL
                OR statement_pdf_url ~ '^/uploads/problem-pdfs/[0-9a-f-]{36}\.pdf$');
    END IF;
END $$;

COMMIT;
