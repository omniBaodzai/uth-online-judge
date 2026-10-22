-- 1. BẢNG USERS (Quản lý thông tin tài khoản người dùng)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE,              -- Có thể NULL nếu người dùng đăng ký nhanh qua Google/GitHub
    email VARCHAR(255) UNIQUE NOT NULL,       -- Email là bắt buộc với mọi hình thức đăng ký
    password_hash VARCHAR(255),               -- NULL nếu người dùng chỉ đăng nhập qua Google/GitHub
    full_name VARCHAR(100),                   -- Lấy từ Google/GitHub Profile (hoặc người dùng tự cập nhật)
    avatar_url TEXT,                          -- Ảnh đại diện lấy từ Google/GitHub
    
    -- Thông tin liên kết OAuth2 (Google & GitHub)
    google_id VARCHAR(255) UNIQUE,            -- ID định danh duy nhất do Google cấp
    github_id VARCHAR(255) UNIQUE,            -- ID định danh duy nhất do GitHub cấp
    
    is_active BOOLEAN NOT NULL DEFAULT true,  -- Trạng thái tài khoản (true: hoạt động, false: bị khóa)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. BẢNG REFRESH_TOKENS (Quản lý phiên đăng nhập)
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL UNIQUE,          -- Chuỗi Refresh Token (hoặc mã hash của token)
    is_revoked BOOLEAN NOT NULL DEFAULT false,   -- Trạng thái thu hồi (true: đã đăng xuất / bị vô hiệu hóa)
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, -- Thời điểm token hết hạn (ví dụ: 7 ngày sau khi tạo)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Chỉ mục (Index) tối ưu tốc độ tra cứu khi Đăng nhập và Refresh Token
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
