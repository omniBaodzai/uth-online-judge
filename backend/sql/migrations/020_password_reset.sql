BEGIN;

ALTER TABLE public.users
    ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0,
    ADD CONSTRAINT chk_users_auth_version CHECK (auth_version >= 0);

CREATE TABLE public.password_reset_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    email_hash CHAR(64) NOT NULL UNIQUE,
    auth_version INTEGER NOT NULL,
    otp_hash CHAR(64),
    expires_at TIMESTAMPTZ NOT NULL,
    attempts SMALLINT NOT NULL DEFAULT 0,
    verified_at TIMESTAMPTZ,
    reset_token_hash CHAR(64) UNIQUE,
    reset_token_expires_at TIMESTAMPTZ,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_password_reset_attempts CHECK (attempts BETWEEN 0 AND 5),
    CONSTRAINT chk_password_reset_token_pair CHECK (
        (reset_token_hash IS NULL AND reset_token_expires_at IS NULL)
        OR (reset_token_hash IS NOT NULL AND reset_token_expires_at IS NOT NULL)
    )
);

CREATE INDEX idx_password_reset_user
    ON public.password_reset_challenges (user_id);
CREATE INDEX idx_password_reset_expiry
    ON public.password_reset_challenges (expires_at);

CREATE TABLE public.password_reset_rate_limits (
    scope VARCHAR(8) NOT NULL,
    key_hash CHAR(64) NOT NULL,
    window_started_at TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL,
    last_requested_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (scope, key_hash),
    CONSTRAINT chk_password_reset_rate_scope CHECK (scope IN ('EMAIL', 'IP')),
    CONSTRAINT chk_password_reset_rate_count CHECK (request_count >= 0)
);

CREATE INDEX idx_password_reset_rate_cleanup
    ON public.password_reset_rate_limits (last_requested_at);

COMMIT;
