-- =============================================================================
-- AutoLeap Combined Schema
-- Generated from all migration files in chronological order.
-- Safe to run on a fresh OR existing database (fully idempotent).
-- =============================================================================


-- =============================================================================
-- EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- =============================================================================
-- SECTION 1: CORE TABLES
-- (001_initial_schema, 002_create_users_table, 20260119_add_facebook_messenger_fields)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.users (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT        UNIQUE NOT NULL,
    password_hash TEXT        NOT NULL DEFAULT '',
    name          TEXT        NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist (safe upgrade from placeholder schema)
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS name          TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.users
    ALTER COLUMN password_hash SET DEFAULT '',
    ALTER COLUMN name          SET DEFAULT '',
    ALTER COLUMN created_at    SET DEFAULT NOW(),
    ALTER COLUMN updated_at    SET DEFAULT NOW();

-- Back-fill any NULLs left by the placeholder schema
UPDATE public.users
SET
    password_hash = COALESCE(password_hash, ''),
    name          = COALESCE(name, ''),
    created_at    = COALESCE(created_at, NOW()),
    updated_at    = COALESCE(updated_at, NOW())
WHERE password_hash IS NULL
   OR name          IS NULL
   OR created_at    IS NULL
   OR updated_at    IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON public.users (email);

-- shared updated_at trigger function (used by users, appointments, customers)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE IF NOT EXISTS public.businesses (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name                 TEXT        NOT NULL,
    telegram_bot_token   TEXT,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.businesses
    ADD COLUMN IF NOT EXISTS updated_at                    TIMESTAMPTZ  DEFAULT NOW();

-- Facebook Messenger fields (20260119_add_facebook_messenger_fields)
ALTER TABLE public.businesses
    ADD COLUMN IF NOT EXISTS fb_page_id                   TEXT,
    ADD COLUMN IF NOT EXISTS fb_page_access_token         TEXT,
    ADD COLUMN IF NOT EXISTS fb_page_name                 TEXT;

ALTER TABLE public.businesses
    DROP CONSTRAINT IF EXISTS businesses_fb_page_id_unique;
ALTER TABLE public.businesses
    ADD CONSTRAINT businesses_fb_page_id_unique UNIQUE (fb_page_id);

CREATE INDEX IF NOT EXISTS idx_businesses_fb_page_id
    ON public.businesses (fb_page_id)
    WHERE fb_page_id IS NOT NULL;

COMMENT ON COLUMN public.businesses.fb_page_id          IS 'Facebook Page ID - unique identifier for the connected page';
COMMENT ON COLUMN public.businesses.fb_page_access_token IS 'Long-lived Facebook Page Access Token for sending messages';
COMMENT ON COLUMN public.businesses.fb_page_name         IS 'Display name of the Facebook Page for UI purposes';

-- Security & Performance columns (20260319_security_and_perf)
ALTER TABLE public.businesses
    ADD COLUMN IF NOT EXISTS telegram_webhook_secret      TEXT,
    ADD COLUMN IF NOT EXISTS google_calendar_token        TEXT,
    ADD COLUMN IF NOT EXISTS google_calendar_email        TEXT,
    ADD COLUMN IF NOT EXISTS description                  TEXT,
    ADD COLUMN IF NOT EXISTS service_categories           TEXT[],
    ADD COLUMN IF NOT EXISTS business_hours               JSONB DEFAULT '{
        "monday":    {"open": "08:00", "close": "18:00", "enabled": true},
        "tuesday":   {"open": "08:00", "close": "18:00", "enabled": true},
        "wednesday": {"open": "08:00", "close": "18:00", "enabled": true},
        "thursday":  {"open": "08:00", "close": "18:00", "enabled": true},
        "friday":    {"open": "08:00", "close": "18:00", "enabled": true},
        "saturday":  {"open": "09:00", "close": "14:00", "enabled": false},
        "sunday":    {"open": "09:00", "close": "14:00", "enabled": false}
    }'::jsonb,
    ADD COLUMN IF NOT EXISTS onboarding_complete          BOOLEAN      DEFAULT false;

-- Timezone & email (20260320_timezone_email_cleanup)
ALTER TABLE public.businesses
    ADD COLUMN IF NOT EXISTS timezone                     TEXT        NOT NULL DEFAULT 'Asia/Colombo',
    ADD COLUMN IF NOT EXISTS email_notifications_enabled  BOOLEAN     NOT NULL DEFAULT true;

-- Enhancement columns (20260319_enhancements)
ALTER TABLE public.businesses
    ADD COLUMN IF NOT EXISTS owner_telegram_chat_id       TEXT;

-- Workflow improvements (20260322_workflow_improvements)
ALTER TABLE public.businesses
    ADD COLUMN IF NOT EXISTS bot_name                     TEXT        NOT NULL DEFAULT 'Assistant',
    ADD COLUMN IF NOT EXISTS bot_greeting                 TEXT,
    ADD COLUMN IF NOT EXISTS bot_tone                     TEXT        NOT NULL DEFAULT 'friendly',
    ADD COLUMN IF NOT EXISTS reminder_hours               JSONB       NOT NULL DEFAULT '[24, 1]';

-- Waitlist / services migration (20260321_waitlist_services_notes)
ALTER TABLE public.businesses
    ADD COLUMN IF NOT EXISTS cancellation_window_hours    INTEGER     NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_businesses_telegram_secret
    ON public.businesses (telegram_webhook_secret)
    WHERE telegram_webhook_secret IS NOT NULL;


-- =============================================================================
-- SECTION 2: USER ROLES AND BUSINESS LINK
-- (20260119120000_add_user_roles_and_business_link)
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'business');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS role        user_role DEFAULT 'business',
    ADD COLUMN IF NOT EXISTS business_id UUID;

ALTER TABLE public.businesses
    ADD COLUMN IF NOT EXISTS user_id UUID;

UPDATE public.users SET role = 'business' WHERE role IS NULL;

-- Clean up dangling FK references before adding constraints
UPDATE public.users u
SET business_id = NULL
WHERE business_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = u.business_id);

UPDATE public.businesses b
SET user_id = NULL
WHERE user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = b.user_id);

DO $$ BEGIN
    ALTER TABLE public.users
        ADD CONSTRAINT users_business_id_fkey
        FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE public.businesses
        ADD CONSTRAINT businesses_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_role        ON public.users (role);
CREATE INDEX IF NOT EXISTS idx_users_business_id ON public.users (business_id);
CREATE INDEX IF NOT EXISTS idx_businesses_user_id ON public.businesses (user_id);

-- Seed default admin user
INSERT INTO public.users (email, password_hash, name, role)
VALUES (
    'admin@autoleap.com',
    '$2b$10$9K/yNkeDNH2Jls8iuYmM6uZuUoW8H/XNPoAlwiGeRDg43a9ydtfwy',
    'System Administrator',
    'admin'
)
ON CONFLICT (email) DO NOTHING;

COMMENT ON COLUMN public.users.role        IS 'User role: admin (platform admin) or business (business owner)';
COMMENT ON COLUMN public.users.business_id IS 'Foreign key to businesses table - which business this user belongs to (null for admins)';
COMMENT ON COLUMN public.businesses.user_id IS 'Foreign key to users table - who created/owns this business';


-- =============================================================================
-- SECTION 3: APPOINTMENTS
-- (20260112181500_create_appointments_table, 20260319_enhancements,
--  20260320_timezone_email_cleanup, 20260320_fix_appointment_status_default,
--  20260322_workflow_improvements, 20260320_appointment_reminders,
--  20260328_appointments_updated_at)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.appointments (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id      UUID        REFERENCES public.businesses(id),
    customer_name    TEXT        NOT NULL,
    customer_phone   TEXT        NOT NULL,
    service_type     TEXT        NOT NULL,
    appointment_date DATE        NOT NULL,
    appointment_time TIME        NOT NULL,
    duration_minutes INT         DEFAULT 60,
    google_event_id  TEXT,
    status           TEXT        DEFAULT 'scheduled',
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Status check constraint (20260320_timezone_email_cleanup + 20260320_fix_appointment_status_default)
ALTER TABLE public.appointments
    DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_status_check
    CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show'));

ALTER TABLE public.appointments
    ALTER COLUMN status SET DEFAULT 'scheduled';

-- Additional columns added by later migrations
ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS customer_chat_id      TEXT,
    ADD COLUMN IF NOT EXISTS platform              TEXT        DEFAULT 'telegram',
    ADD COLUMN IF NOT EXISTS notes                 TEXT,
    ADD COLUMN IF NOT EXISTS price                 NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS currency              TEXT        NOT NULL DEFAULT 'LKR',
    ADD COLUMN IF NOT EXISTS rescheduled_from      UUID        REFERENCES public.appointments(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS review_requested_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reminders_sent        JSONB       NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS reminder_24h_sent     BOOLEAN     NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS reminder_1h_sent      BOOLEAN     NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Back-fill updated_at to created_at for historical rows
UPDATE public.appointments SET updated_at = created_at WHERE updated_at = NOW() AND created_at < NOW();

DROP TRIGGER IF EXISTS trg_appointments_updated_at ON public.appointments;
CREATE TRIGGER trg_appointments_updated_at
    BEFORE UPDATE ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Drop legacy faqs table if it exists
DROP TABLE IF EXISTS faqs CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_appointments_business_date
    ON public.appointments (business_id, appointment_date);

CREATE INDEX IF NOT EXISTS appointments_customer_chat_id_idx
    ON public.appointments (business_id, customer_chat_id);

CREATE INDEX IF NOT EXISTS idx_appointments_chat_id
    ON public.appointments (business_id, customer_chat_id, appointment_date);

CREATE INDEX IF NOT EXISTS idx_appointments_status
    ON public.appointments (business_id, status);

CREATE INDEX IF NOT EXISTS idx_appointments_created_at
    ON public.appointments (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_appointments_platform
    ON public.appointments (business_id, platform)
    WHERE platform IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_reminders
    ON public.appointments (business_id, appointment_date, appointment_time, status)
    WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_appointments_review_requested
    ON public.appointments (business_id, review_requested_at)
    WHERE review_requested_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_business_updated_at
    ON public.appointments (business_id, updated_at DESC);


-- =============================================================================
-- SECTION 4: BUSINESS COSTS
-- (20260112182500_create_business_costs)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.business_costs (
    id          UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID              REFERENCES public.businesses(id),
    date        DATE              NOT NULL,
    total_cost  DOUBLE PRECISION  DEFAULT 0,
    breakdown   JSONB             DEFAULT '{}'::jsonb,
    query_count INT               DEFAULT 0,
    cache_hits  INT               DEFAULT 0,
    created_at  TIMESTAMPTZ       DEFAULT NOW(),
    UNIQUE (business_id, date)
);

CREATE INDEX IF NOT EXISTS idx_business_costs_date
    ON public.business_costs (business_id, date);


-- =============================================================================
-- SECTION 5: FAQ DOCUMENTS AND EMBEDDINGS
-- These tables are referenced by multiple migrations but have no CREATE TABLE
-- migration file. They are created here from the schema implied by all usages.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.faq_documents (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id    UUID        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    question       TEXT        NOT NULL,
    answer         TEXT        NOT NULL,
    hit_count      INTEGER     NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Generated column for case-insensitive deduplication (20260326_faq_dedup)
ALTER TABLE public.faq_documents
    ADD COLUMN IF NOT EXISTS question_lower TEXT GENERATED ALWAYS AS (lower(question)) STORED;

CREATE INDEX IF NOT EXISTS idx_faq_documents_business_id
    ON public.faq_documents (business_id);

CREATE INDEX IF NOT EXISTS idx_faq_documents_hit_count
    ON public.faq_documents (business_id, hit_count DESC);

-- Dedup existing rows before creating the unique index (keep newest per business+question)
DELETE FROM public.faq_documents d_old
USING public.faq_documents d_new
WHERE d_old.business_id = d_new.business_id
  AND lower(d_old.question) = lower(d_new.question)
  AND d_old.created_at < d_new.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_faq_documents_uniq_question
    ON public.faq_documents (business_id, question_lower);


CREATE TABLE IF NOT EXISTS public.faq_embeddings (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    faq_id           UUID        NOT NULL REFERENCES public.faq_documents(id) ON DELETE CASCADE,
    embedding        vector(1536),
    embedding_gemini vector(768),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure embedding columns are the correct vector type (20260329_pgvector_migration)
ALTER TABLE public.faq_embeddings
    ALTER COLUMN embedding        TYPE vector(1536) USING embedding::vector(1536);
ALTER TABLE public.faq_embeddings
    ALTER COLUMN embedding_gemini TYPE vector(768)  USING embedding_gemini::vector(768);

-- Re-apply CASCADE on faq_id FK (20260325_match_faqs_openai)
ALTER TABLE public.faq_embeddings
    DROP CONSTRAINT IF EXISTS faq_embeddings_faq_id_fkey;
ALTER TABLE public.faq_embeddings
    ADD CONSTRAINT faq_embeddings_faq_id_fkey
    FOREIGN KEY (faq_id) REFERENCES public.faq_documents(id) ON DELETE CASCADE;

-- Unique index on faq_id for upsert atomicity (20260327_rag_fixes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_faq_embeddings_faq_id
    ON public.faq_embeddings (faq_id);

-- HNSW vector indexes (20260329_pgvector_migration)
CREATE INDEX IF NOT EXISTS idx_faq_embeddings_hnsw_openai
    ON public.faq_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_faq_embeddings_hnsw_gemini
    ON public.faq_embeddings
    USING hnsw (embedding_gemini vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);


-- =============================================================================
-- SECTION 6: REQUEST QUEUE
-- (referenced by 20260319_security_and_perf, 20260320_conversations_and_queue_fix,
--  20260320_dead_letter_queue_and_budget_alerts, 20260320_webhook_idempotency)
-- Table was never formally created in migrations; created here from usages.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.request_queue (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id     UUID        REFERENCES public.businesses(id) ON DELETE CASCADE,
    platform        TEXT        NOT NULL DEFAULT 'telegram',
    payload         JSONB       NOT NULL DEFAULT '{}',
    status          TEXT        NOT NULL DEFAULT 'pending',
    retry_count     INT         NOT NULL DEFAULT 0,
    retry_at        TIMESTAMPTZ,
    error_message   TEXT,
    idempotency_key TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dead letter queue columns (20260320_dead_letter_queue_and_budget_alerts)
ALTER TABLE public.request_queue
    ADD COLUMN IF NOT EXISTS retry_count     INT         NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS retry_at        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS error_message   TEXT;

-- Webhook idempotency column (20260320_webhook_idempotency)
ALTER TABLE public.request_queue
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_request_queue_status_created
    ON public.request_queue (status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_request_queue_business_status
    ON public.request_queue (business_id, status);

CREATE INDEX IF NOT EXISTS idx_request_queue_retry
    ON public.request_queue (status, retry_at)
    WHERE status = 'failed' AND retry_at IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_request_queue_idempotency_key
    ON public.request_queue (idempotency_key)
    WHERE idempotency_key IS NOT NULL;


-- =============================================================================
-- SECTION 7: CONVERSATIONS
-- (20260320_conversations_and_queue_fix, 20260321_waitlist_services_notes)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.conversations (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id      UUID        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    customer_chat_id TEXT        NOT NULL,
    platform         TEXT        NOT NULL DEFAULT 'telegram',
    intent           TEXT,
    status           TEXT        NOT NULL DEFAULT 'ai',
    state            JSONB       DEFAULT '{}'::jsonb,
    history          JSONB       DEFAULT '[]'::jsonb,
    last_message_at  TIMESTAMPTZ DEFAULT NOW(),
    expires_at       TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 minutes'),
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.conversations
    ADD COLUMN IF NOT EXISTS status   TEXT     NOT NULL DEFAULT 'ai',
    ADD COLUMN IF NOT EXISTS platform TEXT     NOT NULL DEFAULT 'telegram',
    ADD COLUMN IF NOT EXISTS notes    TEXT,
    ADD COLUMN IF NOT EXISTS tags     TEXT[]   NOT NULL DEFAULT '{}';

ALTER TABLE public.conversations
    DROP CONSTRAINT IF EXISTS conversations_status_check;
ALTER TABLE public.conversations
    ADD CONSTRAINT conversations_status_check
    CHECK (status IN ('ai', 'human', 'escalated'));

CREATE INDEX IF NOT EXISTS idx_conversations_active
    ON public.conversations (business_id, customer_chat_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_conversations_business_recent
    ON public.conversations (business_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_created_at
    ON public.conversations (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_tags
    ON public.conversations USING GIN (tags);


-- =============================================================================
-- SECTION 8: BOOKING ATTEMPTS
-- (20260319_security_and_perf)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.booking_attempts (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id      UUID        REFERENCES public.businesses(id) ON DELETE CASCADE,
    conversation_id  UUID,
    customer_chat_id TEXT,
    platform         TEXT        DEFAULT 'telegram',
    success          BOOLEAN     NOT NULL,
    failure_reason   TEXT,
    turns_taken      INT         DEFAULT 0,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_attempts_business
    ON public.booking_attempts (business_id, created_at DESC);


-- =============================================================================
-- SECTION 9: BUDGETS AND COST LOGS
-- (20260320_budgets_and_cost_logs, 20260320_dead_letter_queue_and_budget_alerts,
--  20260326_budget_fixes)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.budgets (
    id                   UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id          UUID             NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    monthly_budget_usd   DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    current_usage_usd    DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    pending_usage_usd    DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    budget_alert_sent_at TIMESTAMPTZ,
    pending_updated_at   TIMESTAMPTZ,
    created_at           TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    UNIQUE (business_id)
);

-- Ensure all columns exist
ALTER TABLE public.budgets
    ADD COLUMN IF NOT EXISTS budget_alert_sent_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS pending_updated_at     TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_budgets_business_id ON public.budgets (business_id);

-- Auto-provision budget rows for existing businesses
INSERT INTO public.budgets (business_id)
SELECT id FROM public.businesses
ON CONFLICT (business_id) DO NOTHING;


CREATE TABLE IF NOT EXISTS public.cost_logs (
    id          UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID             NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    amount_usd  DOUBLE PRECISION NOT NULL,
    model_used  TEXT             NOT NULL,
    tokens_in   INTEGER          NOT NULL DEFAULT 0,
    tokens_out  INTEGER          NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cost_logs_business_created
    ON public.cost_logs (business_id, created_at DESC);


-- =============================================================================
-- SECTION 10: WAITLIST, SERVICES, BLACKOUTS, CUSTOMERS, REVIEWS
-- (20260321_waitlist_services_notes, 20260322_service_tiers,
--  20260322_workflow_improvements, 20260324_reviews_unique_constraint)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.waitlist (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id      UUID        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    customer_chat_id TEXT        NOT NULL,
    platform         TEXT        NOT NULL DEFAULT 'telegram',
    customer_name    TEXT,
    service_type     TEXT,
    preferred_date   DATE,
    notified_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_business_service
    ON public.waitlist (business_id, service_type, created_at);


CREATE TABLE IF NOT EXISTS public.services (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id      UUID        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name             TEXT        NOT NULL,
    description      TEXT,
    duration_minutes INTEGER     NOT NULL DEFAULT 60,
    price            NUMERIC(10, 2),
    is_active        BOOLEAN     NOT NULL DEFAULT true,
    sort_order       INTEGER     NOT NULL DEFAULT 0,
    tiers            JSONB       NOT NULL DEFAULT '[]',
    currency         TEXT        NOT NULL DEFAULT 'LKR',
    buffer_minutes   INT         NOT NULL DEFAULT 0,
    min_advance_hours INT        NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure service tier / workflow columns exist
ALTER TABLE public.services
    ADD COLUMN IF NOT EXISTS tiers            JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS currency         TEXT  NOT NULL DEFAULT 'LKR',
    ADD COLUMN IF NOT EXISTS buffer_minutes   INT   NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS min_advance_hours INT  NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_services_business_active
    ON public.services (business_id, is_active, sort_order);


CREATE TABLE IF NOT EXISTS public.business_blackouts (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id     UUID        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    date            DATE        NOT NULL,
    label           TEXT        NOT NULL DEFAULT 'Closed',
    repeat_annually BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (business_id, date)
);

CREATE INDEX IF NOT EXISTS idx_blackouts_business_date
    ON public.business_blackouts (business_id, date);


CREATE TABLE IF NOT EXISTS public.customers (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id    UUID        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    phone          TEXT        NOT NULL,
    name           TEXT        NOT NULL,
    platform       TEXT,
    chat_id        TEXT,
    notes          TEXT,
    total_bookings INT         NOT NULL DEFAULT 0,
    noshow_count   INT         NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (business_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_customers_business_phone
    ON public.customers (business_id, phone);

CREATE INDEX IF NOT EXISTS idx_customers_chat_id
    ON public.customers (chat_id);

CREATE INDEX IF NOT EXISTS idx_customers_name_trgm
    ON public.customers USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_business_chat_id
    ON public.customers (business_id, chat_id)
    WHERE chat_id IS NOT NULL;


CREATE TABLE IF NOT EXISTS public.reviews (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id      UUID        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    appointment_id   UUID        REFERENCES public.appointments(id) ON DELETE SET NULL,
    customer_chat_id TEXT,
    platform         TEXT,
    rating           INT         CHECK (rating BETWEEN 1 AND 5),
    comment          TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint to prevent duplicate reviews (20260324_reviews_unique_constraint)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'reviews_appointment_customer_unique'
          AND conrelid = 'public.reviews'::regclass
    ) THEN
        ALTER TABLE public.reviews
            ADD CONSTRAINT reviews_appointment_customer_unique
            UNIQUE (appointment_id, customer_chat_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reviews_business
    ON public.reviews (business_id);

CREATE INDEX IF NOT EXISTS idx_reviews_appointment
    ON public.reviews (appointment_id);

CREATE INDEX IF NOT EXISTS idx_reviews_business_created_at
    ON public.reviews (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_rating
    ON public.reviews (business_id, rating)
    WHERE rating IS NOT NULL;


-- =============================================================================
-- SECTION 11: PLATFORM SETTINGS
-- (20260323_platform_settings)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.platform_settings (
    key        TEXT        PRIMARY KEY,
    value      TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.platform_settings (key, value) VALUES
    ('default_monthly_budget_usd', '10'),
    ('default_ai_model',           'gemini-flash-latest'),
    ('global_announcement',        '')
ON CONFLICT (key) DO NOTHING;


-- =============================================================================
-- SECTION 12: RLS — ENABLE ON ALL TABLES
-- (20260321_rls_and_indexes_audit, 20260329_post_bootstrap_reconcile)
-- =============================================================================

ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_costs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_blackouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_attempts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_embeddings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_queue      ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- SECTION 13: RLS — DENY POLICIES (restrictive, service_role bypasses RLS)
-- All direct access from anon/authenticated roles is denied.
-- The backend exclusively uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.
-- (20260321_rls_and_indexes_audit, 20260329_post_bootstrap_reconcile)
-- =============================================================================

DROP POLICY IF EXISTS "deny_direct_access" ON public.users;
CREATE POLICY "deny_direct_access" ON public.users
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "deny_direct_access" ON public.businesses;
CREATE POLICY "deny_direct_access" ON public.businesses
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "deny_direct_access" ON public.appointments;
CREATE POLICY "deny_direct_access" ON public.appointments
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "deny_direct_access" ON public.business_costs;
CREATE POLICY "deny_direct_access" ON public.business_costs
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "deny_direct_access" ON public.budgets;
CREATE POLICY "deny_direct_access" ON public.budgets
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "deny_direct_access" ON public.cost_logs;
CREATE POLICY "deny_direct_access" ON public.cost_logs
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "deny_direct_access" ON public.conversations;
CREATE POLICY "deny_direct_access" ON public.conversations
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "deny_direct_access" ON public.waitlist;
CREATE POLICY "deny_direct_access" ON public.waitlist
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "deny_direct_access" ON public.services;
CREATE POLICY "deny_direct_access" ON public.services
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "deny_direct_access" ON public.business_blackouts;
CREATE POLICY "deny_direct_access" ON public.business_blackouts
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "deny_direct_access" ON public.customers;
CREATE POLICY "deny_direct_access" ON public.customers
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "deny_direct_access" ON public.reviews;
CREATE POLICY "deny_direct_access" ON public.reviews
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "deny_direct_access" ON public.booking_attempts;
CREATE POLICY "deny_direct_access" ON public.booking_attempts
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "deny_direct_access" ON public.platform_settings;
CREATE POLICY "deny_direct_access" ON public.platform_settings
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "deny_direct_access" ON public.faq_documents;
CREATE POLICY "deny_direct_access" ON public.faq_documents
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "deny_direct_access" ON public.faq_embeddings;
CREATE POLICY "deny_direct_access" ON public.faq_embeddings
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "deny_direct_access" ON public.request_queue;
CREATE POLICY "deny_direct_access" ON public.request_queue
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);


-- =============================================================================
-- SECTION 14: STORED FUNCTIONS
-- =============================================================================

-- ── upsert_daily_cost (20260319_security_and_perf) ───────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_daily_cost(
    p_business_id UUID,
    p_date        DATE,
    p_cost        DOUBLE PRECISION,
    p_is_cache    BOOLEAN DEFAULT false
)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO public.business_costs (business_id, date, total_cost, query_count, cache_hits)
    VALUES (p_business_id, p_date, p_cost, 1, CASE WHEN p_is_cache THEN 1 ELSE 0 END)
    ON CONFLICT (business_id, date) DO UPDATE SET
        total_cost  = business_costs.total_cost + EXCLUDED.total_cost,
        query_count = business_costs.query_count + 1,
        cache_hits  = business_costs.cache_hits + CASE WHEN p_is_cache THEN 1 ELSE 0 END;
END;
$$;

-- ── increment_faq_hits (20260320_faq_hit_count) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_faq_hits(p_ids UUID[])
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE public.faq_documents
    SET hit_count = hit_count + 1
    WHERE id = ANY(p_ids);
END;
$$;

-- ── reserve_budget (20260320_budgets_and_cost_logs) ───────────────────────────
CREATE OR REPLACE FUNCTION public.reserve_budget(
    p_business_id    UUID,
    p_estimated_cost DOUBLE PRECISION
)
RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
    v_budget RECORD;
BEGIN
    INSERT INTO public.budgets (business_id)
    VALUES (p_business_id)
    ON CONFLICT (business_id) DO NOTHING;

    SELECT * INTO v_budget
    FROM   public.budgets
    WHERE  business_id = p_business_id
    FOR UPDATE;

    IF v_budget.monthly_budget_usd IS NULL OR v_budget.monthly_budget_usd <= 0 THEN
        RETURN TRUE;
    END IF;

    IF (v_budget.current_usage_usd + v_budget.pending_usage_usd + p_estimated_cost)
        > v_budget.monthly_budget_usd THEN
        RETURN FALSE;
    END IF;

    UPDATE public.budgets
    SET    pending_usage_usd = pending_usage_usd + p_estimated_cost
    WHERE  business_id = p_business_id;

    RETURN TRUE;
END;
$$;

-- ── commit_reserved_budget (20260320_budgets_and_cost_logs) ──────────────────
CREATE OR REPLACE FUNCTION public.commit_reserved_budget(
    p_business_id UUID,
    p_actual_cost DOUBLE PRECISION
)
RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE public.budgets
    SET
        current_usage_usd = current_usage_usd + p_actual_cost,
        pending_usage_usd = GREATEST(0, pending_usage_usd - p_actual_cost)
    WHERE business_id = p_business_id;
END;
$$;

-- ── release_budget (20260326_budget_fixes) ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.release_budget(
    p_business_id UUID,
    p_amount      DOUBLE PRECISION
)
RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE public.budgets
    SET    pending_usage_usd = GREATEST(0, pending_usage_usd - p_amount)
    WHERE  business_id = p_business_id;
END;
$$;

-- ── reset_monthly_budgets (20260326_budget_fixes) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.reset_monthly_budgets()
RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
    updated_count INT;
BEGIN
    UPDATE public.budgets
    SET    current_usage_usd = 0,
           pending_usage_usd = 0;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$;

-- ── reset_stale_pending_budgets (20260326_budget_fixes) ───────────────────────
CREATE OR REPLACE FUNCTION public.reset_stale_pending_budgets()
RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
    reset_count INT;
BEGIN
    UPDATE public.budgets
    SET    pending_usage_usd  = 0,
           pending_updated_at = NULL
    WHERE  pending_usage_usd  > 0
      AND  pending_updated_at < NOW() - INTERVAL '15 minutes';

    GET DIAGNOSTICS reset_count = ROW_COUNT;
    RETURN reset_count;
END;
$$;

-- ── budgets_stamp_pending trigger function (20260326_budget_fixes) ────────────
CREATE OR REPLACE FUNCTION public.budgets_stamp_pending()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.pending_usage_usd IS DISTINCT FROM OLD.pending_usage_usd THEN
        IF NEW.pending_usage_usd > 0 THEN
            NEW.pending_updated_at := NOW();
        ELSE
            NEW.pending_updated_at := NULL;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_budgets_stamp_pending ON public.budgets;
CREATE TRIGGER trg_budgets_stamp_pending
    BEFORE UPDATE ON public.budgets
    FOR EACH ROW EXECUTE FUNCTION public.budgets_stamp_pending();

-- ── claim_queue_items (20260320_dead_letter_queue_and_budget_alerts) ──────────
-- Picks up pending items and retryable failed items atomically.
CREATE OR REPLACE FUNCTION public.claim_queue_items(p_batch_size INT DEFAULT 10)
RETURNS SETOF public.request_queue
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
        UPDATE public.request_queue
        SET status = 'processing'
        WHERE id IN (
            SELECT id
            FROM public.request_queue
            WHERE
                (status = 'pending')
                OR
                (status = 'failed' AND retry_count < 3 AND retry_at <= NOW())
            ORDER BY created_at ASC
            LIMIT p_batch_size
            FOR UPDATE SKIP LOCKED
        )
        RETURNING *;
END;
$$;

-- ── cleanup_stale_queue_items (20260320_dead_letter_queue_and_budget_alerts) ──
CREATE OR REPLACE FUNCTION public.cleanup_stale_queue_items()
RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM public.request_queue
    WHERE
        (status = 'completed' AND created_at < NOW() - INTERVAL '7 days')
        OR
        (status = 'failed' AND retry_count >= 3 AND created_at < NOW() - INTERVAL '7 days')
        OR
        (status = 'processing' AND created_at < NOW() - INTERVAL '1 hour');

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- ── cleanup_stale_conversations (20260320_dead_letter_queue_and_budget_alerts) ─
CREATE OR REPLACE FUNCTION public.cleanup_stale_conversations()
RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM public.conversations
    WHERE expires_at < NOW() - INTERVAL '30 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- ── search_conversations (20260320_timezone_email_cleanup) ───────────────────
CREATE OR REPLACE FUNCTION public.search_conversations(
    p_business_id UUID,
    p_query       TEXT,
    p_limit       INT DEFAULT 50,
    p_offset      INT DEFAULT 0
)
RETURNS TABLE (
    id               UUID,
    customer_chat_id TEXT,
    intent           TEXT,
    status           TEXT,
    last_message_at  TIMESTAMPTZ,
    created_at       TIMESTAMPTZ,
    history          JSONB,
    state            JSONB
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.customer_chat_id,
        c.intent,
        c.status,
        c.last_message_at,
        c.created_at,
        c.history,
        c.state
    FROM public.conversations c
    WHERE c.business_id = p_business_id
      AND (
          c.customer_chat_id ILIKE '%' || p_query || '%'
          OR EXISTS (
              SELECT 1
              FROM jsonb_array_elements(c.history) AS msg
              WHERE (msg -> 'parts' -> 0 ->> 'text') ILIKE '%' || p_query || '%'
          )
      )
    ORDER BY c.last_message_at DESC
    LIMIT  p_limit
    OFFSET p_offset;
END;
$$;

-- ── search_faqs_keyword (20260319_enhancements) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.search_faqs_keyword(
    p_business_id UUID,
    p_query       TEXT,
    p_limit       INT DEFAULT 3
)
RETURNS TABLE (
    id         UUID,
    question   TEXT,
    answer     TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.question,
        d.answer,
        0.5::FLOAT AS similarity
    FROM public.faq_documents d
    WHERE d.business_id = p_business_id
      AND (
          d.question ILIKE '%' || p_query || '%'
          OR d.answer ILIKE '%' || p_query || '%'
      )
    ORDER BY
        CASE
            WHEN lower(d.question) = lower(p_query) THEN 0
            WHEN d.question ILIKE '%' || p_query || '%' THEN 1
            ELSE 2
        END
    LIMIT p_limit;
END;
$$;

-- ── match_faqs — OpenAI text-embedding-3-small 1536-dim (20260329_pgvector_migration)
-- Uses LANGUAGE sql for planner inlining and HNSW index activation.
CREATE OR REPLACE FUNCTION public.match_faqs(
    query_embedding  vector(1536),
    match_threshold  FLOAT,
    match_count      INT,
    p_business_id    UUID
)
RETURNS TABLE (
    id         UUID,
    question   TEXT,
    answer     TEXT,
    similarity FLOAT
)
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
    SELECT
        d.id,
        d.question,
        d.answer,
        1.0 - (e.embedding <=> query_embedding) AS similarity
    FROM public.faq_documents  d
    JOIN public.faq_embeddings e ON e.faq_id = d.id
    WHERE d.business_id = p_business_id
      AND (e.embedding <=> query_embedding) < (1.0 - match_threshold)
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_count
$$;

-- ── match_faqs_gemini — Google text-embedding-004 768-dim (20260329_pgvector_migration)
CREATE OR REPLACE FUNCTION public.match_faqs_gemini(
    query_embedding  vector(768),
    match_threshold  FLOAT,
    match_count      INT,
    p_business_id    UUID
)
RETURNS TABLE (
    id         UUID,
    question   TEXT,
    answer     TEXT,
    similarity FLOAT
)
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
    SELECT
        d.id,
        d.question,
        d.answer,
        1.0 - (e.embedding_gemini <=> query_embedding) AS similarity
    FROM public.faq_documents  d
    JOIN public.faq_embeddings e ON e.faq_id = d.id
    WHERE d.business_id = p_business_id
      AND (e.embedding_gemini <=> query_embedding) < (1.0 - match_threshold)
    ORDER BY e.embedding_gemini <=> query_embedding
    LIMIT match_count
$$;
