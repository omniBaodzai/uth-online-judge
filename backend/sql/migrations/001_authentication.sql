BEGIN;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    full_name VARCHAR(100),
    avatar_url TEXT,
    google_id VARCHAR(255) UNIQUE,
    github_id VARCHAR(255) UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_users_auth_method CHECK (
        password_hash IS NOT NULL OR google_id IS NOT NULL OR github_id IS NOT NULL
    )
);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE users
SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
    updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
WHERE created_at IS NULL OR updated_at IS NULL;

ALTER TABLE users
    ALTER COLUMN created_at SET NOT NULL,
    ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_users_auth_method'
          AND conrelid = 'users'::regclass
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT chk_users_auth_method
            CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL OR github_id IS NOT NULL)
            NOT VALID;
    END IF;
END
$$;

ALTER TABLE users VALIDATE CONSTRAINT chk_users_auth_method;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower_unique
    ON users (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower_unique
    ON users (lower(username))
    WHERE username IS NOT NULL;

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE refresh_tokens
    ADD COLUMN IF NOT EXISTS token_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'refresh_tokens'
          AND column_name = 'token'
    ) THEN
        EXECUTE $migration$
            UPDATE refresh_tokens
            SET token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex'),
                token = encode(sha256(convert_to(token, 'UTF8')), 'hex'),
                revoked_at = COALESCE(revoked_at, created_at, CURRENT_TIMESTAMP)
            WHERE token IS NOT NULL
        $migration$;
        ALTER TABLE refresh_tokens ALTER COLUMN token DROP NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'refresh_tokens'
          AND column_name = 'is_revoked'
    ) THEN
        EXECUTE $migration$
            UPDATE refresh_tokens
            SET revoked_at = COALESCE(revoked_at, created_at, CURRENT_TIMESTAMP)
            WHERE is_revoked = TRUE
        $migration$;
    END IF;
END
$$;

ALTER TABLE refresh_tokens ALTER COLUMN token_hash SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_index i
        JOIN pg_class t ON t.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_attribute a ON a.attrelid = t.oid
        WHERE n.nspname = current_schema()
          AND t.relname = 'refresh_tokens'
          AND i.indisunique
          AND i.indnatts = 1
          AND a.attname = 'token_hash'
          AND a.attnum = ANY(i.indkey)
    ) THEN
        CREATE UNIQUE INDEX idx_refresh_tokens_token_hash_unique
            ON refresh_tokens (token_hash);
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id
    ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at
    ON refresh_tokens (expires_at);

COMMIT;
