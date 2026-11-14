BEGIN;

-- Support bounded date-range scans for the Admin dashboard time series.
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at_dashboard
    ON public.submissions (submitted_at);

CREATE INDEX IF NOT EXISTS idx_users_created_at_dashboard
    ON public.users (created_at);

COMMIT;
