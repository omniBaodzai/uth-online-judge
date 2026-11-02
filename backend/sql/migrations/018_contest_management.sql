BEGIN;

CREATE TABLE public.contests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(120) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    rules TEXT,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    publication_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    visibility VARCHAR(10) NOT NULL DEFAULT 'PUBLIC',
    allow_registration BOOLEAN NOT NULL DEFAULT TRUE,
    show_leaderboard BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID NOT NULL,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMPTZ,

    CONSTRAINT fk_contests_created_by
        FOREIGN KEY (created_by)
        REFERENCES public.users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_contests_updated_by
        FOREIGN KEY (updated_by)
        REFERENCES public.users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_contests_slug
        CHECK (
            slug = lower(slug)
            AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
        ),
    CONSTRAINT chk_contests_title
        CHECK (length(btrim(title)) > 0),
    CONSTRAINT chk_contests_time_window
        CHECK (starts_at < ends_at),
    CONSTRAINT chk_contests_publication_status
        CHECK (publication_status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    CONSTRAINT chk_contests_visibility
        CHECK (visibility IN ('PUBLIC', 'PRIVATE')),
    CONSTRAINT chk_contests_private_not_published
        CHECK (visibility <> 'PRIVATE' OR publication_status <> 'PUBLISHED'),
    CONSTRAINT chk_contests_publication_timestamp
        CHECK (
            (publication_status = 'DRAFT' AND published_at IS NULL)
            OR
            (publication_status IN ('PUBLISHED', 'ARCHIVED') AND published_at IS NOT NULL)
        )
);

CREATE UNIQUE INDEX uq_contests_slug
    ON public.contests (slug);

CREATE INDEX idx_contests_publication_status_starts_at
    ON public.contests (publication_status, starts_at, id);

CREATE INDEX idx_contests_public_starts_at
    ON public.contests (starts_at, id)
    WHERE publication_status = 'PUBLISHED' AND visibility = 'PUBLIC';

CREATE TABLE public.contest_problems (
    contest_id UUID NOT NULL,
    problem_id UUID NOT NULL,
    position INTEGER NOT NULL,
    max_score NUMERIC(10, 2) NOT NULL,
    problem_code_snapshot VARCHAR(30) NOT NULL,
    problem_title_snapshot VARCHAR(255) NOT NULL,
    test_case_revision INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_contest_problems
        PRIMARY KEY (contest_id, problem_id),
    CONSTRAINT uq_contest_problems_position
        UNIQUE (contest_id, position),
    CONSTRAINT fk_contest_problems_contest
        FOREIGN KEY (contest_id)
        REFERENCES public.contests(id) ON DELETE RESTRICT,
    CONSTRAINT fk_contest_problems_problem
        FOREIGN KEY (problem_id)
        REFERENCES public.problems(id) ON DELETE RESTRICT,
    CONSTRAINT chk_contest_problems_position
        CHECK (position > 0),
    CONSTRAINT chk_contest_problems_max_score
        CHECK (max_score > 0),
    CONSTRAINT chk_contest_problems_test_case_revision
        CHECK (test_case_revision >= 0),
    CONSTRAINT chk_contest_problems_code_snapshot
        CHECK (length(btrim(problem_code_snapshot)) > 0),
    CONSTRAINT chk_contest_problems_title_snapshot
        CHECK (length(btrim(problem_title_snapshot)) > 0)
);

CREATE INDEX idx_contest_problems_problem_id
    ON public.contest_problems (problem_id, contest_id);

CREATE TABLE public.contest_participants (
    contest_id UUID NOT NULL,
    user_id UUID NOT NULL,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    registration_status VARCHAR(16) NOT NULL DEFAULT 'REGISTERED',
    cancelled_at TIMESTAMPTZ,

    CONSTRAINT pk_contest_participants
        PRIMARY KEY (contest_id, user_id),
    CONSTRAINT fk_contest_participants_contest
        FOREIGN KEY (contest_id)
        REFERENCES public.contests(id) ON DELETE RESTRICT,
    CONSTRAINT fk_contest_participants_user
        FOREIGN KEY (user_id)
        REFERENCES public.users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_contest_participants_status
        CHECK (registration_status IN ('REGISTERED', 'CANCELLED')),
    CONSTRAINT chk_contest_participants_cancelled_at
        CHECK (
            (registration_status = 'REGISTERED' AND cancelled_at IS NULL)
            OR
            (registration_status = 'CANCELLED' AND cancelled_at IS NOT NULL)
        )
);

CREATE INDEX idx_contest_participants_user_contest
    ON public.contest_participants (user_id, contest_id);

CREATE INDEX idx_contest_participants_registered
    ON public.contest_participants (contest_id, registered_at, user_id)
    WHERE registration_status = 'REGISTERED';

ALTER TABLE public.submissions
    ADD COLUMN contest_id UUID,
    ADD COLUMN contest_max_score_snapshot NUMERIC(10, 2),
    ADD CONSTRAINT fk_submissions_contest
        FOREIGN KEY (contest_id)
        REFERENCES public.contests(id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_submissions_contest_problem
        FOREIGN KEY (contest_id, problem_id)
        REFERENCES public.contest_problems(contest_id, problem_id)
        ON DELETE RESTRICT,
    ADD CONSTRAINT fk_submissions_contest_participant
        FOREIGN KEY (contest_id, user_id)
        REFERENCES public.contest_participants(contest_id, user_id)
        ON DELETE RESTRICT,
    ADD CONSTRAINT chk_submissions_contest_score_snapshot
        CHECK (
            (contest_id IS NULL AND contest_max_score_snapshot IS NULL)
            OR
            (
                contest_id IS NOT NULL
                AND contest_max_score_snapshot IS NOT NULL
                AND contest_max_score_snapshot > 0
            )
        );

CREATE INDEX idx_submissions_contest_leaderboard
    ON public.submissions (contest_id, user_id, problem_id, submitted_at)
    WHERE contest_id IS NOT NULL;

CREATE FUNCTION public.prevent_published_contest_slug_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.published_at IS NOT NULL
       AND (
           NEW.slug IS DISTINCT FROM OLD.slug
           OR NEW.published_at IS DISTINCT FROM OLD.published_at
       ) THEN
        RAISE EXCEPTION 'A published contest slug and publication timestamp are immutable.'
            USING ERRCODE = '55000';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contests_immutable_published_slug
    BEFORE UPDATE OF slug, published_at ON public.contests
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_published_contest_slug_change();

CREATE FUNCTION public.prevent_started_contest_schedule_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.starts_at <= clock_timestamp()
       AND (
           NEW.starts_at IS DISTINCT FROM OLD.starts_at
           OR NEW.ends_at IS DISTINCT FROM OLD.ends_at
       ) THEN
        RAISE EXCEPTION 'A contest schedule cannot be changed after it starts.'
            USING ERRCODE = '55000';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contests_immutable_schedule_after_start
    BEFORE UPDATE OF starts_at, ends_at ON public.contests
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_started_contest_schedule_change();

CREATE FUNCTION public.prevent_started_contest_problem_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    affected_contest_id UUID;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        SELECT id
        INTO affected_contest_id
        FROM public.contests
        WHERE id = OLD.contest_id
          AND starts_at <= clock_timestamp()
          AND publication_status IN ('PUBLISHED', 'ARCHIVED');

        IF FOUND THEN
            RAISE EXCEPTION 'Contest problems cannot be changed after the contest starts.'
                USING ERRCODE = '55000';
        END IF;
    END IF;

    IF TG_OP <> 'DELETE' THEN
        SELECT id
        INTO affected_contest_id
        FROM public.contests
        WHERE id = NEW.contest_id
          AND starts_at <= clock_timestamp()
          AND publication_status IN ('PUBLISHED', 'ARCHIVED');

        IF FOUND THEN
            RAISE EXCEPTION 'Contest problems cannot be changed after the contest starts.'
                USING ERRCODE = '55000';
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contest_problems_lock_after_start
    BEFORE INSERT OR UPDATE OR DELETE ON public.contest_problems
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_started_contest_problem_changes();

CREATE FUNCTION public.prevent_late_contest_registration_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    contest_starts_at TIMESTAMPTZ;
    contest_status VARCHAR(20);
    registration_allowed BOOLEAN;
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Contest registrations must be cancelled, not deleted.'
            USING ERRCODE = '55000';
    END IF;

    IF TG_OP = 'UPDATE'
       AND (
           NEW.contest_id IS DISTINCT FROM OLD.contest_id
           OR NEW.user_id IS DISTINCT FROM OLD.user_id
       ) THEN
        RAISE EXCEPTION 'Contest registration keys cannot be changed.'
            USING ERRCODE = '55000';
    END IF;

    SELECT starts_at, publication_status, allow_registration
    INTO contest_starts_at, contest_status, registration_allowed
    FROM public.contests
    WHERE id = NEW.contest_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Contest does not exist.'
            USING ERRCODE = '23503';
    END IF;

    IF contest_starts_at <= clock_timestamp() THEN
        RAISE EXCEPTION 'Contest registrations cannot be changed after the contest starts.'
            USING ERRCODE = '55000';
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.registration_status <> 'REGISTERED'
           OR contest_status <> 'PUBLISHED'
           OR NOT registration_allowed THEN
            RAISE EXCEPTION 'Contest is not accepting registrations.'
                USING ERRCODE = '55000';
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE'
       AND NEW.registration_status = 'REGISTERED'
       AND (
           contest_status <> 'PUBLISHED'
           OR NOT registration_allowed
       ) THEN
        RAISE EXCEPTION 'Contest is not accepting registrations.'
            USING ERRCODE = '55000';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contest_participants_registration_window
    BEFORE INSERT OR UPDATE OR DELETE ON public.contest_participants
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_late_contest_registration_changes();

CREATE FUNCTION public.prevent_problem_changes_during_contests()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    affected_problem_ids UUID[] := ARRAY[]::UUID[];
    v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    IF TG_OP <> 'INSERT' THEN
        affected_problem_ids := array_append(affected_problem_ids, OLD.id);
    END IF;
    IF TG_OP <> 'DELETE' THEN
        affected_problem_ids := array_append(affected_problem_ids, NEW.id);
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.contest_problems cp
        JOIN public.contests c ON c.id = cp.contest_id
        WHERE cp.problem_id = ANY (affected_problem_ids)
          AND c.publication_status = 'PUBLISHED'
          AND c.starts_at <= v_now
          AND v_now < c.ends_at
    ) THEN
        RAISE EXCEPTION 'Problem data cannot be changed while its contest is running.'
            USING ERRCODE = '55000';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_problems_lock_during_contests
    BEFORE UPDATE OR DELETE ON public.problems
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_problem_changes_during_contests();

CREATE FUNCTION public.prevent_test_case_changes_during_contests()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    affected_problem_ids UUID[] := ARRAY[]::UUID[];
    v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    IF TG_OP <> 'INSERT' THEN
        affected_problem_ids := array_append(affected_problem_ids, OLD.problem_id);
    END IF;
    IF TG_OP <> 'DELETE' THEN
        affected_problem_ids := array_append(affected_problem_ids, NEW.problem_id);
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.contest_problems cp
        JOIN public.contests c ON c.id = cp.contest_id
        WHERE cp.problem_id = ANY (affected_problem_ids)
          AND c.publication_status = 'PUBLISHED'
          AND c.starts_at <= v_now
          AND v_now < c.ends_at
    ) THEN
        RAISE EXCEPTION 'Test cases cannot be changed while their contest is running.'
            USING ERRCODE = '55000';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_problem_test_cases_lock_during_contests
    BEFORE INSERT OR UPDATE OR DELETE ON public.problem_test_cases
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_test_case_changes_during_contests();

COMMIT;
