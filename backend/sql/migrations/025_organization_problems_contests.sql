BEGIN;

-- Phạm vi GLOBAL/ORGANIZATION cho bài tập và kỳ thi.
-- organization_id IS NULL  => GLOBAL (dữ liệu hiện có giữ nguyên, không backfill, không đổi hành vi).
-- organization_id NOT NULL => thuộc một tổ chức; không bao giờ tự động thành Global/PUBLIC.
-- Test cases, tags, editorials, languages, submissions và Judge0 dùng chung bảng hiện có (không nhân bản).
-- problems.problem_code và contests.slug vẫn UNIQUE toàn hệ thống.
--
-- Thứ tự lock thống nhất (mọi trigger và service phải tuân thủ để tránh deadlock):
--   1) organizations (FOR SHARE/UPDATE) theo id TĂNG DẦN
--   2) organization_problem_grants
--   3) contest_problems
-- ARCHIVE tổ chức chỉ khóa MỘT dòng organizations (FOR UPDATE) nên không tạo vòng chờ.
--
-- Rollback (chỉ khi chưa có dữ liệu tổ chức cần giữ):
--   DROP TRIGGER trg_contest_problems_organization_scope ON public.contest_problems;
--   DROP TRIGGER trg_problems_organization_immutable ON public.problems;
--   DROP TRIGGER trg_contests_organization_immutable ON public.contests;
--   DROP TRIGGER trg_problem_grants_guard ON public.organization_problem_grants;
--   DROP FUNCTION public.contest_problem_content_accessible(UUID, UUID);
--   DROP FUNCTION public.enforce_contest_problem_organization_scope();
--   DROP FUNCTION public.enforce_organization_id_immutable();
--   DROP FUNCTION public.enforce_problem_grant_rules();
--   DROP TABLE public.organization_problem_grants;
--   ALTER TABLE public.contests DROP CONSTRAINT chk_contests_private_not_published;
--   ALTER TABLE public.contests ADD CONSTRAINT chk_contests_private_not_published
--       CHECK (visibility <> 'PRIVATE' OR publication_status <> 'PUBLISHED');
--   ALTER TABLE public.contests DROP COLUMN organization_id;
--   ALTER TABLE public.problems DROP COLUMN organization_id;

-- 1. Bài tập.
ALTER TABLE public.problems
    ADD COLUMN organization_id UUID
        REFERENCES public.organizations(id) ON DELETE RESTRICT;

CREATE INDEX idx_problems_organization
    ON public.problems (organization_id, status, created_at DESC)
    WHERE organization_id IS NOT NULL;

-- 2. Kỳ thi.
ALTER TABLE public.contests
    ADD COLUMN organization_id UUID
        REFERENCES public.organizations(id) ON DELETE RESTRICT;

CREATE INDEX idx_contests_organization
    ON public.contests (organization_id, publication_status, starts_at DESC)
    WHERE organization_id IS NOT NULL;

-- Kỳ thi tổ chức PRIVATE (chỉ thành viên xem) vẫn phải xuất bản được.
-- Với GLOBAL ràng buộc cũ giữ nguyên.
ALTER TABLE public.contests DROP CONSTRAINT chk_contests_private_not_published;
ALTER TABLE public.contests
    ADD CONSTRAINT chk_contests_private_not_published
        CHECK (
            organization_id IS NOT NULL
            OR visibility <> 'PRIVATE'
            OR publication_status <> 'PUBLISHED'
        );

-- 3. organization_id bất biến: chuyển phạm vi sẽ làm sai lệch submissions, contest_problems và grants.
CREATE FUNCTION public.enforce_organization_id_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
        RAISE EXCEPTION 'organization_id cannot be changed once the row exists.'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_problems_organization_immutable
    BEFORE UPDATE OF organization_id ON public.problems
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_organization_id_immutable();

CREATE TRIGGER trg_contests_organization_immutable
    BEFORE UPDATE OF organization_id ON public.contests
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_organization_id_immutable();

-- 4. Cấp quyền dùng chéo bài tập tổ chức (chỉ quyền "đưa bài vào kỳ thi" + hiển thị đề trong ngữ cảnh kỳ thi).
-- Grant KHÔNG bao gồm: sửa bài, xem hidden test cases, xem solutions/editorials, hay công khai bài.
--   scope = 'ORGANIZATION':   tổ chức grantee_organization_id được dùng bài trong kỳ thi của mình.
--   scope = 'GLOBAL_CONTESTS': CỐ Ý áp dụng cho MỌI kỳ thi GLOBAL (hiện tại và tương lai),
--                              không gắn với một kỳ thi cụ thể (grantee_organization_id phải NULL).
-- Thu hồi mềm bằng revoked_at (giữ lịch sử, không xóa dòng).
CREATE TABLE public.organization_problem_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_id UUID NOT NULL
        REFERENCES public.problems(id) ON DELETE CASCADE,
    scope VARCHAR(20) NOT NULL,
    grantee_organization_id UUID
        REFERENCES public.organizations(id) ON DELETE CASCADE,
    granted_by UUID
        REFERENCES public.users(id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_by UUID
        REFERENCES public.users(id) ON DELETE SET NULL,
    revoked_at TIMESTAMPTZ,
    CONSTRAINT chk_problem_grants_scope
        CHECK (scope IN ('ORGANIZATION', 'GLOBAL_CONTESTS')),
    CONSTRAINT chk_problem_grants_grantee
        CHECK (
            (scope = 'ORGANIZATION' AND grantee_organization_id IS NOT NULL)
            OR (scope = 'GLOBAL_CONTESTS' AND grantee_organization_id IS NULL)
        ),
    CONSTRAINT chk_problem_grants_revocation
        CHECK (revoked_by IS NULL OR revoked_at IS NOT NULL)
);

COMMENT ON COLUMN public.organization_problem_grants.scope IS
    'ORGANIZATION: one grantee organization. GLOBAL_CONTESTS: every GLOBAL contest (intentional, not per-contest).';

-- Chống grant trùng (chỉ tính grant còn hiệu lực).
CREATE UNIQUE INDEX uq_problem_grants_active_organization
    ON public.organization_problem_grants (problem_id, grantee_organization_id)
    WHERE scope = 'ORGANIZATION' AND revoked_at IS NULL;

CREATE UNIQUE INDEX uq_problem_grants_active_global
    ON public.organization_problem_grants (problem_id)
    WHERE scope = 'GLOBAL_CONTESTS' AND revoked_at IS NULL;

CREATE INDEX idx_problem_grants_grantee
    ON public.organization_problem_grants (grantee_organization_id)
    WHERE grantee_organization_id IS NOT NULL AND revoked_at IS NULL;

CREATE INDEX idx_problem_grants_problem
    ON public.organization_problem_grants (problem_id, granted_at DESC);

-- Quy tắc grant ở DB.
-- INSERT: chỉ bài tổ chức, không tự cấp cho chủ bài, hai tổ chức đều ACTIVE. Khóa organizations
--         (FOR SHARE, id tăng dần) để không chạy đua với ARCHIVE.
-- UPDATE: chỉ được chuyển đúng một lần từ "còn hiệu lực" sang "đã thu hồi" (revoked_at = thời điểm hiện tại).
--         Mọi cột cấp quyền đều bất biến; grant đã thu hồi hoàn toàn bất biến.
--         revoked_by bắt buộc ở lần thu hồi; API phải lấy từ danh tính JWT, không nhận actor tùy ý từ client.
--         Ngoại lệ duy nhất: FK ON DELETE SET NULL của users có thể đặt granted_by/revoked_by về NULL;
--         pg_trigger_depth() phân biệt cập nhật FK lồng nhau với UPDATE nghiệp vụ thông thường.
CREATE FUNCTION public.enforce_problem_grant_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    owner_org UUID;
    owner_status VARCHAR;
    grantee_status VARCHAR;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.id IS DISTINCT FROM OLD.id
           OR NEW.problem_id IS DISTINCT FROM OLD.problem_id
           OR NEW.scope IS DISTINCT FROM OLD.scope
           OR NEW.grantee_organization_id IS DISTINCT FROM OLD.grantee_organization_id
           OR NEW.granted_at IS DISTINCT FROM OLD.granted_at
           OR (NEW.granted_by IS DISTINCT FROM OLD.granted_by
               AND NOT (NEW.granted_by IS NULL AND pg_trigger_depth() > 1)) THEN
            RAISE EXCEPTION 'Grant details are immutable after creation.'
                USING ERRCODE = '23514';
        END IF;

        IF OLD.revoked_at IS NOT NULL THEN
            IF NEW.revoked_at IS DISTINCT FROM OLD.revoked_at
               OR (NEW.revoked_by IS DISTINCT FROM OLD.revoked_by
                   AND NOT (NEW.revoked_by IS NULL AND pg_trigger_depth() > 1)) THEN
                RAISE EXCEPTION 'A revoked problem grant is immutable; create a new grant instead.'
                    USING ERRCODE = '23514';
            END IF;
            RETURN NEW;
        END IF;

        IF NEW.revoked_at IS NOT NULL THEN
            IF NEW.revoked_by IS NULL THEN
                RAISE EXCEPTION 'revoked_by is required when revoking a problem grant.'
                    USING ERRCODE = '23514';
            END IF;
            NEW.revoked_at := CURRENT_TIMESTAMP;
        ELSIF NEW.revoked_by IS DISTINCT FROM OLD.revoked_by
              AND NOT (NEW.revoked_by IS NULL AND pg_trigger_depth() > 1) THEN
            RAISE EXCEPTION 'revoked_by can only be set together with revoked_at.'
                USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END IF;

    SELECT organization_id INTO owner_org FROM public.problems WHERE id = NEW.problem_id;
    IF owner_org IS NULL THEN
        RAISE EXCEPTION 'Only organization problems can be granted.'
            USING ERRCODE = '23514';
    END IF;
    IF NEW.revoked_at IS NOT NULL OR NEW.revoked_by IS NOT NULL THEN
        RAISE EXCEPTION 'A new problem grant cannot be created already revoked.'
            USING ERRCODE = '23514';
    END IF;
    IF NEW.granted_by IS NULL THEN
        RAISE EXCEPTION 'granted_by is required when creating a problem grant.'
            USING ERRCODE = '23514';
    END IF;
    IF NEW.scope = 'ORGANIZATION' AND NEW.grantee_organization_id = owner_org THEN
        RAISE EXCEPTION 'An organization does not need a grant for its own problem.'
            USING ERRCODE = '23514';
    END IF;

    PERFORM 1
       FROM public.organizations
      WHERE id IN (owner_org, NEW.grantee_organization_id)
      ORDER BY id
        FOR SHARE;

    SELECT status INTO owner_status FROM public.organizations WHERE id = owner_org;
    IF owner_status IS DISTINCT FROM 'ACTIVE' THEN
        RAISE EXCEPTION 'Archived organizations cannot grant problems.'
            USING ERRCODE = '23514';
    END IF;

    IF NEW.scope = 'ORGANIZATION' THEN
        SELECT status INTO grantee_status
          FROM public.organizations WHERE id = NEW.grantee_organization_id;
        IF grantee_status IS DISTINCT FROM 'ACTIVE' THEN
            RAISE EXCEPTION 'The grantee organization must be ACTIVE.'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_problem_grants_guard
    BEFORE INSERT OR UPDATE ON public.organization_problem_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_problem_grant_rules();

-- 5. Chốt chặn cuối ở DB cho việc THÊM bài vào kỳ thi (service kiểm tra trước để trả lỗi rõ ràng):
--   - Bài GLOBAL: dùng được ở mọi kỳ thi GLOBAL; ở kỳ thi tổ chức ACTIVE.
--   - Bài tổ chức: chỉ dùng ở kỳ thi cùng tổ chức, hoặc khi có grant còn hiệu lực
--     (ORGANIZATION cho đúng tổ chức nhận, GLOBAL_CONTESTS cho mọi kỳ thi GLOBAL).
--   - Kỳ thi/bài thuộc tổ chức ARCHIVED: không nhận liên kết mới.
-- Khóa organizations (id tăng dần) rồi khóa dòng grant (FOR SHARE) để không chạy đua với ARCHIVE
-- hay thu hồi grant. Chỉ chạy khi chèn/đổi liên kết; contest_problems đã có không bị ảnh hưởng.
CREATE FUNCTION public.enforce_contest_problem_organization_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    problem_org UUID;
    contest_org UUID;
    problem_org_status VARCHAR;
    contest_org_status VARCHAR;
BEGIN
    SELECT organization_id INTO problem_org FROM public.problems WHERE id = NEW.problem_id;
    SELECT organization_id INTO contest_org FROM public.contests WHERE id = NEW.contest_id;

    IF problem_org IS NULL AND contest_org IS NULL THEN
        RETURN NEW;
    END IF;

    PERFORM 1
       FROM public.organizations
      WHERE id IN (problem_org, contest_org)
      ORDER BY id
        FOR SHARE;

    IF contest_org IS NOT NULL THEN
        SELECT status INTO contest_org_status FROM public.organizations WHERE id = contest_org;
        IF contest_org_status IS DISTINCT FROM 'ACTIVE' THEN
            RAISE EXCEPTION 'Archived organization contests cannot receive new problems.'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    IF problem_org IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT status INTO problem_org_status FROM public.organizations WHERE id = problem_org;
    IF problem_org_status IS DISTINCT FROM 'ACTIVE' THEN
        RAISE EXCEPTION 'Problems of archived organizations cannot be added to contests.'
            USING ERRCODE = '23514';
    END IF;

    IF contest_org IS NOT DISTINCT FROM problem_org THEN
        RETURN NEW;
    END IF;

    PERFORM 1
       FROM public.organization_problem_grants g
      WHERE g.problem_id = NEW.problem_id
        AND g.revoked_at IS NULL
        AND (
             (contest_org IS NULL AND g.scope = 'GLOBAL_CONTESTS')
             OR (contest_org IS NOT NULL
                 AND g.scope = 'ORGANIZATION'
                 AND g.grantee_organization_id = contest_org)
        )
        FOR SHARE;
    IF FOUND THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Organization problem is not granted for this contest scope.'
        USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER trg_contest_problems_organization_scope
    BEFORE INSERT OR UPDATE OF contest_id, problem_id ON public.contest_problems
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_contest_problem_organization_scope();

-- 6. Quyền xem NỘI DUNG bài (đề bài, ví dụ) của một contest_problems đã tồn tại.
-- Liên kết contest_problems và snapshot (mã, tiêu đề, điểm) là LỊCH SỬ và luôn được giữ,
-- kể cả khi grant bị thu hồi hoặc tổ chức ARCHIVED, để bảng điểm/bài nộp cũ không hỏng.
-- Hàm này CHỈ kiểm tra scope/grant, KHÔNG xác thực JWT, quyền người xem với contest,
-- publication_status, visibility hay trạng thái ARCHIVED. API bắt buộc kiểm tra tất cả các yếu tố đó
-- độc lập trước khi phục vụ nội dung đề bài.
-- Nội dung riêng tư của bài tổ chức chỉ được phục vụ trong ngữ cảnh kỳ thi khi hàm này trả về true:
--   bài GLOBAL, bài cùng tổ chức với kỳ thi, hoặc grant còn hiệu lực đúng phạm vi.
-- Sau khi thu hồi, API chỉ được trả snapshot; không trả đề bài, hidden test cases hay solutions.
CREATE FUNCTION public.contest_problem_content_accessible(p_contest_id UUID, p_problem_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT CASE
        WHEN p.id IS NULL OR c.id IS NULL THEN FALSE
        WHEN p.organization_id IS NULL THEN TRUE
        WHEN c.organization_id IS NOT DISTINCT FROM p.organization_id THEN TRUE
        ELSE EXISTS (
            SELECT 1
              FROM public.organization_problem_grants g
             WHERE g.problem_id = p.id
               AND g.revoked_at IS NULL
               AND (
                    (c.organization_id IS NULL AND g.scope = 'GLOBAL_CONTESTS')
                    OR (c.organization_id IS NOT NULL
                        AND g.scope = 'ORGANIZATION'
                        AND g.grantee_organization_id = c.organization_id)
               )
        )
    END
    FROM (SELECT p_problem_id AS pid, p_contest_id AS cid) i
    LEFT JOIN public.problems p ON p.id = i.pid
    LEFT JOIN public.contests c ON c.id = i.cid;
$$;

COMMENT ON FUNCTION public.contest_problem_content_accessible(UUID, UUID) IS
    'Checks only problem/contest scope and active cross-use grant. Not an authorization decision: callers must independently validate JWT, viewer access to the contest, publication status, visibility, and ARCHIVED status before returning problem content.';

COMMIT;
