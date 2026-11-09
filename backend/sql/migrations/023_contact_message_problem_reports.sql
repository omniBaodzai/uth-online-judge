BEGIN;

-- Báo cáo vấn đề của bài tập dùng chung bảng contact_messages.
-- Thay đổi chỉ bổ sung cột; tin nhắn cũ tự động thuộc category CONTACT.
ALTER TABLE public.contact_messages
    ADD COLUMN category VARCHAR(20) NOT NULL DEFAULT 'CONTACT',
    ADD COLUMN report_type VARCHAR(32),
    ADD COLUMN problem_id UUID REFERENCES public.problems(id) ON DELETE SET NULL,
    ADD COLUMN problem_code_snapshot VARCHAR(30),
    ADD COLUMN problem_title_snapshot VARCHAR(255);

-- problem_id có thể về NULL khi bài tập bị xóa, nên ràng buộc dựa trên snapshot thay vì problem_id.
ALTER TABLE public.contact_messages
    ADD CONSTRAINT chk_contact_messages_category
        CHECK (category IN ('CONTACT', 'PROBLEM_REPORT')),
    ADD CONSTRAINT chk_contact_messages_report_type
        CHECK (report_type IS NULL OR report_type IN (
            'INCORRECT_STATEMENT', 'INCORRECT_TEST_DATA', 'DISPLAY_ISSUE', 'OTHER'
        )),
    ADD CONSTRAINT chk_contact_messages_report_shape
        CHECK (
            (category = 'CONTACT'
                AND report_type IS NULL
                AND problem_id IS NULL
                AND problem_code_snapshot IS NULL
                AND problem_title_snapshot IS NULL)
            OR
            (category = 'PROBLEM_REPORT'
                AND report_type IS NOT NULL
                AND problem_code_snapshot IS NOT NULL
                AND problem_title_snapshot IS NOT NULL)
        );

CREATE INDEX idx_contact_messages_category_created
    ON public.contact_messages (category, created_at DESC, id DESC);
CREATE INDEX idx_contact_messages_problem
    ON public.contact_messages (problem_id, created_at DESC)
    WHERE problem_id IS NOT NULL;

COMMIT;
