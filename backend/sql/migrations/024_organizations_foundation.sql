BEGIN;

-- Nền tảng Organizations: chỉ thêm 3 bảng mới.
-- Không sửa users/problems/contests/submissions và không seed dữ liệu.
-- Rollback (chỉ khi chưa có dữ liệu cần giữ):
--   DROP TABLE public.organization_creation_requests;
--   DROP TABLE public.organization_members CASCADE;  -- gỡ FK owner của organizations
--   DROP TABLE public.organizations;

-- 1. Tổ chức.
-- owner_id có thể NULL (tổ chức tạm thời chưa có OWNER; khi đó chỉ Admin hệ thống quản trị).
-- owner_role là cột sinh: 'OWNER' khi có owner_id, NULL khi không. Nhờ NULL, composite FK
-- (MATCH SIMPLE) tự bỏ qua kiểm tra khi không có owner; khi có owner, FK buộc phải tồn tại
-- membership role OWNER tương ứng.
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(64) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    website_url TEXT,
    owner_id UUID REFERENCES public.users(id) ON DELETE RESTRICT,
    owner_role VARCHAR(5) GENERATED ALWAYS AS (
        CASE WHEN owner_id IS NOT NULL THEN 'OWNER' END
    ) STORED,
    status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    archived_at TIMESTAMPTZ,
    archived_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    problems_visibility VARCHAR(7) NOT NULL DEFAULT 'PRIVATE',
    contests_visibility VARCHAR(7) NOT NULL DEFAULT 'PRIVATE',
    submissions_visibility VARCHAR(7) NOT NULL DEFAULT 'PRIVATE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_organizations_slug UNIQUE (slug),
    CONSTRAINT chk_organizations_slug
        CHECK (length(slug) >= 3 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT chk_organizations_name
        CHECK (length(btrim(name)) > 0),
    CONSTRAINT chk_organizations_website_url
        CHECK (website_url IS NULL OR (length(website_url) <= 2048 AND website_url ~* '^https?://\S+$')),
    -- Đích của FK ngược từ organization_members (OWNER phải khớp owner_id).
    CONSTRAINT uq_organizations_id_owner UNIQUE (id, owner_id),
    CONSTRAINT chk_organizations_status
        CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    -- archived_by được phép NULL để giữ lịch sử khi tài khoản Admin bị xóa.
    CONSTRAINT chk_organizations_archive_shape
        CHECK (
            (status = 'ACTIVE' AND archived_at IS NULL AND archived_by IS NULL)
            OR
            (status = 'ARCHIVED' AND archived_at IS NOT NULL)
        ),
    CONSTRAINT chk_organizations_problems_visibility
        CHECK (problems_visibility IN ('PUBLIC', 'PRIVATE')),
    CONSTRAINT chk_organizations_contests_visibility
        CHECK (contests_visibility IN ('PUBLIC', 'PRIVATE')),
    CONSTRAINT chk_organizations_submissions_visibility
        CHECK (submissions_visibility IN ('PUBLIC', 'PRIVATE'))
);

CREATE INDEX idx_organizations_owner
    ON public.organizations (owner_id)
    WHERE owner_id IS NOT NULL;
CREATE INDEX idx_organizations_status_created
    ON public.organizations (status, created_at DESC, id DESC);

-- 2. Thành viên. Một người dùng có thể thuộc nhiều tổ chức.
CREATE TABLE public.organization_members (
    organization_id UUID NOT NULL
        REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL
        REFERENCES public.users(id) ON DELETE CASCADE,
    role VARCHAR(6) NOT NULL DEFAULT 'MEMBER',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Cột sinh: organization_id nếu là OWNER, ngược lại NULL. Dùng cho FK ngược bên dưới.
    owner_org_id UUID GENERATED ALWAYS AS (
        CASE WHEN role = 'OWNER' THEN organization_id END
    ) STORED,
    PRIMARY KEY (organization_id, user_id),
    -- Đích của FK owner (organizations.id, owner_id, owner_role).
    CONSTRAINT uq_organization_members_with_role
        UNIQUE (organization_id, user_id, role),
    CONSTRAINT chk_organization_members_role
        CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER'))
);

-- Tối đa một OWNER cho mỗi tổ chức.
CREATE UNIQUE INDEX uq_organization_members_single_owner
    ON public.organization_members (organization_id)
    WHERE role = 'OWNER';

-- Danh sách tổ chức của một người dùng.
CREATE INDEX idx_organization_members_user
    ON public.organization_members (user_id, organization_id);

-- 3. Nhất quán hai chiều giữa organizations.owner_id và membership OWNER.
-- Cả hai FK đều DEFERRABLE INITIALLY DEFERRED để giải quyết vòng tham chiếu: mọi thay đổi
-- owner phải nằm trong một transaction và được kiểm tra ở COMMIT.
--
-- (a) owner_id NOT NULL  => tồn tại membership (org, owner_id, 'OWNER').
--     owner_id NULL      => owner_role NULL, FK bỏ qua (MATCH SIMPLE), tổ chức không có OWNER.
ALTER TABLE public.organizations
    ADD CONSTRAINT fk_organizations_owner_membership
        FOREIGN KEY (id, owner_id, owner_role)
        REFERENCES public.organization_members (organization_id, user_id, role)
        DEFERRABLE INITIALLY DEFERRED;

-- (b) membership role OWNER => organizations.owner_id phải đúng là user đó.
--     Chặn membership OWNER mồ côi (owner_id NULL hoặc trỏ người khác).
--     Membership ADMIN/MEMBER có owner_org_id NULL nên FK bỏ qua.
-- Cùng với index một-OWNER, hai chiều này khiến owner_id và role OWNER luôn tương ứng 1-1.
ALTER TABLE public.organization_members
    ADD CONSTRAINT fk_organization_members_owner_matches
        FOREIGN KEY (owner_org_id, user_id)
        REFERENCES public.organizations (id, owner_id)
        DEFERRABLE INITIALLY DEFERRED;

-- Quy trình trong MỘT transaction (service layer; khóa dòng organizations bằng FOR UPDATE):
--   Gán OWNER:  INSERT/UPDATE membership role='OWNER' + UPDATE organizations.owner_id.
--   Chuyển A→B: hạ membership A xuống ADMIN TRƯỚC (index một-OWNER là immediate), nâng B lên
--               OWNER, rồi UPDATE owner_id = B.
--   Gỡ OWNER:   UPDATE owner_id = NULL và hạ (hoặc xóa) membership OWNER cũ.

-- 4. Yêu cầu tạo tổ chức. Thông tin người gửi được lưu trực tiếp để giữ lịch sử
-- kể cả khi tài khoản bị xóa (requester_id / reviewed_by về NULL).
CREATE TABLE public.organization_creation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    full_name VARCHAR(100) NOT NULL,
    workplace VARCHAR(200) NOT NULL,
    position VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    motivation TEXT NOT NULL,
    status VARCHAR(8) NOT NULL DEFAULT 'PENDING',
    reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    created_organization_id UUID
        REFERENCES public.organizations(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_org_requests_status
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    CONSTRAINT chk_org_requests_full_name CHECK (length(btrim(full_name)) > 0),
    CONSTRAINT chk_org_requests_workplace CHECK (length(btrim(workplace)) > 0),
    CONSTRAINT chk_org_requests_position CHECK (length(btrim(position)) > 0),
    CONSTRAINT chk_org_requests_phone
        CHECK (phone_number ~ '^[0-9+()\-. ]{9,20}$'),
    CONSTRAINT chk_org_requests_motivation
        CHECK (length(btrim(motivation)) > 0 AND length(motivation) <= 2000),
    -- Trạng thái và dữ liệu xét duyệt luôn khớp nhau.
    CONSTRAINT chk_org_requests_review_shape
        CHECK (
            (status = 'PENDING'
                AND reviewed_at IS NULL
                AND created_organization_id IS NULL)
            OR
            (status = 'APPROVED'
                AND reviewed_at IS NOT NULL
                AND created_organization_id IS NOT NULL)
            OR
            (status = 'REJECTED'
                AND reviewed_at IS NOT NULL
                AND created_organization_id IS NULL)
        )
);

-- Admin tạo tổ chức trực tiếp không cần request nên không có dòng nào ở đây.
-- Mỗi yêu cầu tạo tối đa một tổ chức, và mỗi tổ chức chỉ thuộc một yêu cầu.
CREATE UNIQUE INDEX uq_org_requests_created_organization
    ON public.organization_creation_requests (created_organization_id)
    WHERE created_organization_id IS NOT NULL;

-- Mỗi người dùng chỉ có một yêu cầu PENDING tại một thời điểm.
CREATE UNIQUE INDEX uq_org_requests_one_pending_per_requester
    ON public.organization_creation_requests (requester_id)
    WHERE status = 'PENDING' AND requester_id IS NOT NULL;

CREATE INDEX idx_org_requests_status_created
    ON public.organization_creation_requests (status, created_at DESC, id DESC);
CREATE INDEX idx_org_requests_requester_created
    ON public.organization_creation_requests (requester_id, created_at DESC, id DESC)
    WHERE requester_id IS NOT NULL;

COMMIT;
