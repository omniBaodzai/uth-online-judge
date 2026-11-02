BEGIN;

CREATE TABLE public.contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL,
    subject VARCHAR(120) NOT NULL,
    content VARCHAR(2000) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'NEW',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_contact_messages_status
        CHECK (status IN ('NEW', 'IN_PROGRESS', 'RESOLVED')),
    CONSTRAINT chk_contact_messages_full_name
        CHECK (length(btrim(full_name)) > 0),
    CONSTRAINT chk_contact_messages_email
        CHECK (length(btrim(email)) > 0),
    CONSTRAINT chk_contact_messages_subject
        CHECK (length(btrim(subject)) > 0),
    CONSTRAINT chk_contact_messages_content
        CHECK (length(btrim(content)) > 0)
);

CREATE INDEX idx_contact_messages_created
    ON public.contact_messages (created_at DESC, id DESC);
CREATE INDEX idx_contact_messages_status_created
    ON public.contact_messages (status, created_at DESC, id DESC);
CREATE INDEX idx_contact_messages_user_created
    ON public.contact_messages (user_id, created_at DESC, id DESC)
    WHERE user_id IS NOT NULL;

CREATE TABLE public.contact_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_message_id UUID NOT NULL
        REFERENCES public.contact_messages(id) ON DELETE CASCADE,
    sender_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    sender_role VARCHAR(8) NOT NULL,
    sender_name VARCHAR(100) NOT NULL,
    content VARCHAR(5000) NOT NULL,
    idempotency_key UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_contact_replies_sender_role
        CHECK (sender_role IN ('ADMIN', 'USER')),
    CONSTRAINT chk_contact_replies_sender_name
        CHECK (length(btrim(sender_name)) > 0),
    CONSTRAINT chk_contact_replies_content
        CHECK (length(btrim(content)) > 0)
);

CREATE INDEX idx_contact_replies_message_created
    ON public.contact_replies (contact_message_id, created_at, id);
CREATE UNIQUE INDEX uq_contact_replies_idempotency
    ON public.contact_replies (contact_message_id, sender_user_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_user_id UUID NOT NULL
        REFERENCES public.users(id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL,
    title VARCHAR(160) NOT NULL,
    content VARCHAR(500) NOT NULL,
    reference_id UUID NOT NULL
        REFERENCES public.contact_replies(id) ON DELETE CASCADE,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMPTZ,
    CONSTRAINT chk_notifications_type
        CHECK (type IN ('CONTACT_REPLY')),
    CONSTRAINT chk_notifications_read_at
        CHECK ((is_read AND read_at IS NOT NULL) OR (NOT is_read AND read_at IS NULL)),
    CONSTRAINT uq_notifications_reference
        UNIQUE (recipient_user_id, type, reference_id)
);

CREATE INDEX idx_notifications_recipient_created
    ON public.notifications (recipient_user_id, created_at DESC, id DESC);
CREATE INDEX idx_notifications_unread
    ON public.notifications (recipient_user_id, created_at DESC, id DESC)
    WHERE is_read = FALSE;

CREATE TABLE public.contact_submission_rate_limits (
    ip_hash CHAR(64) PRIMARY KEY,
    window_started_at TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL,
    CONSTRAINT chk_contact_submission_rate_count
        CHECK (request_count > 0)
);

CREATE INDEX idx_contact_submission_rate_window
    ON public.contact_submission_rate_limits (window_started_at);

COMMIT;
