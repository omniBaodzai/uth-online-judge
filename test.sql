-- Bảng users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    username VARCHAR(50) UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),

    full_name VARCHAR(100),
    avatar_url TEXT,

    -- Định danh tài khoản OAuth
    google_id VARCHAR(255) UNIQUE,
    github_id VARCHAR(255) UNIQUE,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Tài khoản phải có ít nhất một phương thức đăng nhập
    CONSTRAINT chk_users_auth_method
        CHECK (
            password_hash IS NOT NULL
            OR google_id IS NOT NULL
            OR github_id IS NOT NULL
        )
);

-- Bảng refresh_tokens
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    -- Chỉ lưu SHA-256 hash, không lưu token gốc
    token_hash VARCHAR(64) NOT NULL UNIQUE,

    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Chỉ mục phục vụ truy vấn
CREATE INDEX idx_refresh_tokens_user_id
    ON refresh_tokens(user_id);

CREATE INDEX idx_refresh_tokens_expires_at
    ON refresh_tokens(expires_at);
