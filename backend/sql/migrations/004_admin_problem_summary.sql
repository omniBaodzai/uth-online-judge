BEGIN;

-- Additive and safe to rerun; existing problem rows keep their data and receive NULL.
ALTER TABLE public.problems
    ADD COLUMN IF NOT EXISTS summary VARCHAR(200);

COMMIT;
