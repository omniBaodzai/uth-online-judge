BEGIN;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role VARCHAR(16) NOT NULL DEFAULT 'USER';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_role' AND conrelid = 'users'::regclass) THEN
        ALTER TABLE users ADD CONSTRAINT chk_users_role CHECK (role IN ('ADMIN', 'MODERATOR', 'USER'));
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

CREATE TABLE IF NOT EXISTS activity_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    actor_id UUID,
    action VARCHAR(64) NOT NULL,
    detail JSONB,
    ip VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS error_logs (
    id BIGSERIAL PRIMARY KEY,
    source VARCHAR(16) NOT NULL DEFAULT 'BACKEND',
    level VARCHAR(8) NOT NULL DEFAULT 'ERROR',
    message TEXT NOT NULL,
    stack TEXT,
    path TEXT,
    method VARCHAR(10),
    status_code INTEGER,
    user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_error_logs_source CHECK (source IN ('BACKEND', 'FRONTEND')),
    CONSTRAINT chk_error_logs_level CHECK (level IN ('ERROR', 'WARN'))
);
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    priority VARCHAR(8) NOT NULL DEFAULT 'NORMAL',
    admin_reply TEXT,
    handled_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_support_status CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
    CONSTRAINT chk_support_priority CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT'))
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets (status, created_at DESC);

CREATE TABLE IF NOT EXISTS contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind VARCHAR(16) NOT NULL DEFAULT 'COMMENT',
    problem_code VARCHAR(30),
    title VARCHAR(200),
    body TEXT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    moderation_note TEXT,
    moderated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_contributions_kind CHECK (kind IN ('COMMENT', 'BLOG', 'SOLUTION')),
    CONSTRAINT chk_contributions_status CHECK (status IN ('PENDING', 'APPROVED', 'HIDDEN'))
);
CREATE INDEX IF NOT EXISTS idx_contributions_status ON contributions (status, created_at DESC);

CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(64) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
