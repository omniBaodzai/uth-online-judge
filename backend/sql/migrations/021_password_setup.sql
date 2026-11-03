BEGIN;

ALTER TABLE public.password_reset_challenges
    ADD COLUMN purpose VARCHAR(32) NOT NULL DEFAULT 'PASSWORD_RESET';

ALTER TABLE public.password_reset_challenges
    DROP CONSTRAINT password_reset_challenges_email_hash_key,
    ADD CONSTRAINT chk_password_reset_challenges_purpose
        CHECK (purpose IN ('PASSWORD_RESET', 'PASSWORD_SETUP')),
    ADD CONSTRAINT uq_password_reset_challenges_purpose_email
        UNIQUE (purpose, email_hash);

COMMIT;
