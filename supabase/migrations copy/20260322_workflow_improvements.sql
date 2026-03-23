-- =============================================================================
-- Migration: All Workflow Improvement Features
-- Features: B2, A3, A1, A2, B1, B3, C2, B4, B5, B6, A5
-- =============================================================================

-- ── B2: Buffer time between appointments ─────────────────────────────────────
ALTER TABLE public.services
    ADD COLUMN IF NOT EXISTS buffer_minutes INT NOT NULL DEFAULT 0;

-- ── A3: Minimum advance booking rule ─────────────────────────────────────────
ALTER TABLE public.services
    ADD COLUMN IF NOT EXISTS min_advance_hours INT NOT NULL DEFAULT 0;

-- ── A1: Notes / special requests on appointments ─────────────────────────────
ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- ── B3: Revenue tracking — snapshot price at booking time ────────────────────
ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS price NUMERIC(12, 2);
ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'LKR';

-- ── A2: True rescheduling — track rescheduled_from ───────────────────────────
ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS rescheduled_from UUID REFERENCES public.appointments(id) ON DELETE SET NULL;

-- ── C2: Custom bot greeting & persona ────────────────────────────────────────
ALTER TABLE public.businesses
    ADD COLUMN IF NOT EXISTS bot_name TEXT NOT NULL DEFAULT 'Assistant';
ALTER TABLE public.businesses
    ADD COLUMN IF NOT EXISTS bot_greeting TEXT;
ALTER TABLE public.businesses
    ADD COLUMN IF NOT EXISTS bot_tone TEXT NOT NULL DEFAULT 'friendly';

-- ── B6: Customisable reminder schedule ───────────────────────────────────────
ALTER TABLE public.businesses
    ADD COLUMN IF NOT EXISTS reminder_hours JSONB NOT NULL DEFAULT '[24, 1]';
ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS reminders_sent JSONB NOT NULL DEFAULT '{}';

-- ── B1: Blackout dates & holidays ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.business_blackouts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id     UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    label           TEXT NOT NULL DEFAULT 'Closed',
    repeat_annually BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (business_id, date)
);

-- ── B4: Customer profiles (unified by phone) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id     UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    phone           TEXT NOT NULL,
    name            TEXT NOT NULL,
    platform        TEXT,
    chat_id         TEXT,
    notes           TEXT,
    total_bookings  INT NOT NULL DEFAULT 0,
    noshow_count    INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (business_id, phone)
);

-- ── A5: Post-appointment reviews ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id          UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    appointment_id       UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    customer_chat_id     TEXT,
    platform             TEXT,
    rating               INT CHECK (rating BETWEEN 1 AND 5),
    comment              TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS review_requested_at TIMESTAMPTZ;

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_blackouts_business_date ON public.business_blackouts(business_id, date);
CREATE INDEX IF NOT EXISTS idx_customers_business_phone ON public.customers(business_id, phone);
CREATE INDEX IF NOT EXISTS idx_customers_chat_id ON public.customers(chat_id);
CREATE INDEX IF NOT EXISTS idx_reviews_business ON public.reviews(business_id);
CREATE INDEX IF NOT EXISTS idx_reviews_appointment ON public.reviews(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointments_review_requested ON public.appointments(business_id, review_requested_at) WHERE review_requested_at IS NULL;
