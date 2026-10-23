BEGIN;

-- Allows problem codes up to 50 characters. Existing codes are not modified.
ALTER TABLE public.problems
    ALTER COLUMN problem_code TYPE VARCHAR(50);

COMMIT;
