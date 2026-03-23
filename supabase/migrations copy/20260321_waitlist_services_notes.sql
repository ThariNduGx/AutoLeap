-- =============================================================================
-- Migration: Waitlist, Services, Notes/Tags, Cancellation Window
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. WAITLIST TABLE
-- When all appointment slots are full, customers can join a per-service
-- waitlist. When a cancellation occurs, the first person on the list
-- is notified via their original channel.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.waitlist (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id       UUID        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    customer_chat_id  TEXT        NOT NULL,
    platform          TEXT        NOT NULL DEFAULT 'telegram',
    customer_name     TEXT,
    service_type      TEXT,
    preferred_date    DATE,
    notified_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_business_service
    ON public.waitlist (business_id, service_type, created_at);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "waitlist_service_role_all" ON public.waitlist FOR ALL USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. SERVICES TABLE
-- Business-defined menu of services with name, duration, and price.
-- Used by the AI booking agent to present options and set duration.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.services (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id      UUID        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name             TEXT        NOT NULL,
    description      TEXT,
    duration_minutes INTEGER     NOT NULL DEFAULT 60,
    price            NUMERIC(10, 2),
    is_active        BOOLEAN     NOT NULL DEFAULT true,
    sort_order       INTEGER     NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_services_business_active
    ON public.services (business_id, is_active, sort_order);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "services_service_role_all" ON public.services FOR ALL USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CUSTOMER NOTES & TAGS ON CONVERSATIONS
-- Internal-only fields: business owner can add notes and label conversations.
-- Never sent to the customer.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.conversations
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS tags  TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_conversations_tags
    ON public.conversations USING GIN (tags);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. CANCELLATION GRACE WINDOW ON BUSINESSES
-- If set, customers cannot self-cancel appointments within this many hours
-- of the appointment time. The bot will route them to a human instead.
-- 0 (default) means no restriction — any appointment can be cancelled.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.businesses
    ADD COLUMN IF NOT EXISTS cancellation_window_hours INTEGER NOT NULL DEFAULT 0;
