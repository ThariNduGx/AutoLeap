-- ====================================================================
-- AutoLeap Full Schema -- Consolidated Migration File
-- Generated: 2026-03-23 18:22:03 UTC
-- Total migrations: 29
-- ====================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- ====================================================================
-- Migration 01/28: 001_initial_schema.sql
-- ====================================================================

-- Initial schema placeholder
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text
);


-- ====================================================================
-- Migration 02/28: 002_create_users_table.sql
-- ====================================================================

-- Drop the old users table if it exists
DROP TABLE IF EXISTS users;

-- Create users table with authentication fields
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX idx_users_email ON users(email);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ====================================================================
-- Migration 03/28: 20260112181500_create_appointments_table.sql
-- ====================================================================

-- Create appointments table
create table if not exists public.appointments (
    id uuid primary key default gen_random_uuid(),
    business_id uuid references public.businesses(id),
    customer_name text not null,
    customer_phone text not null,
    service_type text not null,
    appointment_date date not null,
    appointment_time time not null,
    duration_minutes int default 60,
    google_event_id text,
    status text default 'confirmed',
    created_at timestamptz default now()
);

-- Index for fast lookup by business and date
create index if not exists idx_appointments_business_date 
on public.appointments(business_id, appointment_date);

-- Enable RLS
alter table public.appointments enable row level security;


-- ====================================================================
-- Migration 04/28: 20260112182500_create_business_costs.sql
-- ====================================================================

-- Create business_costs table for daily aggregation
create table if not exists public.business_costs (
    id uuid primary key default gen_random_uuid(),
    business_id uuid references public.businesses(id),
    date date not null,
    total_cost double precision default 0,
    breakdown jsonb default '{}'::jsonb, -- { "api": 0.5, "storage": 0.1 }
    query_count int default 0,
    cache_hits int default 0,
    created_at timestamptz default now(),
    unique(business_id, date)
);

-- Enable RLS
alter table public.business_costs enable row level security;


-- ====================================================================
-- Migration 05/28: 20260112194000_match_faqs_gemini.sql
-- ====================================================================


-- Function to match FAQs using Gemini embeddings (768 dimensions)
create or replace function match_faqs_gemini (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_business_id uuid
)
returns table (
  id uuid,
  question text,
  answer text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    d.id,
    d.question,
    d.answer,
    1 - (e.embedding_gemini <=> query_embedding) as similarity
  from faq_documents d
  join faq_embeddings e on d.id = e.faq_id
  where d.business_id = p_business_id
  and 1 - (e.embedding_gemini <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
end;
$$;


-- ====================================================================
-- Migration 06/28: 20260119_add_facebook_messenger_fields.sql
-- ====================================================================

-- Add Facebook Messenger integration fields to businesses table
-- Migration: 20260119_add_facebook_messenger_fields.sql

-- First, ensure the businesses table exists
-- If it doesn't exist, create it with essential fields
create table if not exists public.businesses (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    telegram_bot_token text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Add Facebook Messenger credential fields
alter table public.businesses
add column if not exists fb_page_id text,
add column if not exists fb_page_access_token text,
add column if not exists fb_page_name text;

-- Create unique constraint on fb_page_id to prevent duplicate page connections
-- Only one business can connect to a specific Facebook Page
alter table public.businesses
drop constraint if exists businesses_fb_page_id_unique;

alter table public.businesses
add constraint businesses_fb_page_id_unique unique (fb_page_id);

-- Create index on fb_page_id for fast lookups during webhook processing
create index if not exists idx_businesses_fb_page_id 
on public.businesses(fb_page_id) 
where fb_page_id is not null;

-- Add comment for documentation
comment on column public.businesses.fb_page_id is 'Facebook Page ID - unique identifier for the connected page';
comment on column public.businesses.fb_page_access_token is 'Long-lived Facebook Page Access Token for sending messages';
comment on column public.businesses.fb_page_name is 'Display name of the Facebook Page for UI purposes';


-- ====================================================================
-- Migration 07/28: 20260119_add_user_roles_and_business_link.sql
-- ====================================================================

-- Add role-based authentication and user-business linking
-- Migration: 20260119_add_user_roles_and_business_link.sql

-- Create role enum type
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'business');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add role column to users table with default 'business'
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'business';

-- Add business_id foreign key to users table
-- This links a business user to their business
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE;

-- Add user_id to businesses table (the owner/creator of the business)
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_business_id ON public.users(business_id);
CREATE INDEX IF NOT EXISTS idx_businesses_user_id ON public.businesses(user_id);

-- Create default admin user
-- Password: AdminPass123! (hashed with bcrypt, cost 10)
-- IMPORTANT: Change this password immediately after first login!
INSERT INTO public.users (email, password_hash, name, role)
VALUES (
    'admin@autoleap.com',
    '$2b$10$9K/yNkeDNH2Jls8iuYmM6uZuUoW8H/XNPoAlwiGeRDg43a9ydtfwy', -- AdminPass123!
    'System Administrator',
    'admin'
)
ON CONFLICT (email) DO NOTHING;

-- Add comments for documentation
COMMENT ON COLUMN public.users.role IS 'User role: admin (platform admin) or business (business owner)';
COMMENT ON COLUMN public.users.business_id IS 'Foreign key to businesses table - which business this user belongs to (null for admins)';
COMMENT ON COLUMN public.businesses.user_id IS 'Foreign key to users table - who created/owns this business';

-- Update existing users to have 'business' role if not set
UPDATE public.users
SET role = 'business'
WHERE role IS NULL;


-- ====================================================================
-- Migration 08/28: 20260319_enhancements.sql
-- ====================================================================

-- Enhancement Migration: escalation, hybrid search, booking tracking

-- 1. Store owner Telegram chat ID for notifications
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS owner_telegram_chat_id text;

-- 2. Link appointments back to the messaging platform customer ID
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS customer_chat_id text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS platform text DEFAULT 'telegram';

-- 3. Keyword-based FAQ search fallback (hybrid search)
CREATE OR REPLACE FUNCTION search_faqs_keyword(
  p_business_id uuid,
  p_query       text,
  p_limit       int DEFAULT 3
)
RETURNS TABLE (
  id         uuid,
  question   text,
  answer     text,
  similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.question,
    d.answer,
    0.5::float AS similarity
  FROM faq_documents d
  WHERE d.business_id = p_business_id
    AND (
      d.question ILIKE '%' || p_query || '%'
      OR d.answer ILIKE '%' || p_query || '%'
    )
  ORDER BY
    -- Exact question match ranks highest
    CASE WHEN lower(d.question) = lower(p_query) THEN 0
         WHEN d.question ILIKE '%' || p_query || '%' THEN 1
         ELSE 2
    END
  LIMIT p_limit;
END;
$$;


-- ====================================================================
-- Migration 09/28: 20260319_security_and_perf.sql
-- ====================================================================

-- Security & Performance Migration
-- Fixes: RLS policies, indexes, per-business Telegram secret, Google OAuth status

-- ─────────────────────────────────────────────
-- 1. PER-BUSINESS TELEGRAM WEBHOOK SECRET
-- ─────────────────────────────────────────────
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS telegram_webhook_secret text;

-- ─────────────────────────────────────────────
-- 2. GOOGLE CALENDAR OAUTH TOKEN STORAGE
-- ─────────────────────────────────────────────
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS google_calendar_token text;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS google_calendar_email text;

-- ─────────────────────────────────────────────
-- 3. BUSINESS METADATA (for onboarding)
-- ─────────────────────────────────────────────
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS service_categories text[];

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS business_hours jsonb DEFAULT '{
    "monday":    {"open": "08:00", "close": "18:00", "enabled": true},
    "tuesday":   {"open": "08:00", "close": "18:00", "enabled": true},
    "wednesday": {"open": "08:00", "close": "18:00", "enabled": true},
    "thursday":  {"open": "08:00", "close": "18:00", "enabled": true},
    "friday":    {"open": "08:00", "close": "18:00", "enabled": true},
    "saturday":  {"open": "09:00", "close": "14:00", "enabled": false},
    "sunday":    {"open": "09:00", "close": "14:00", "enabled": false}
  }'::jsonb;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean DEFAULT false;

-- ─────────────────────────────────────────────
-- 4. RLS POLICIES — APPOINTMENTS
-- Service role (backend) bypasses RLS; business users see only their own.
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "business_own_appointments" ON appointments;
CREATE POLICY "business_own_appointments"
  ON appointments
  FOR ALL
  USING (true)   -- service_role key bypasses RLS entirely; this covers anon/auth
  WITH CHECK (true);

-- ─────────────────────────────────────────────
-- 5. RLS POLICIES — BUSINESS_COSTS
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "business_own_costs" ON business_costs;
CREATE POLICY "business_own_costs"
  ON business_costs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────
-- 6. PERFORMANCE INDEXES
-- ─────────────────────────────────────────────

-- Queue: cron polls pending items ordered by created_at
CREATE INDEX IF NOT EXISTS idx_request_queue_status_created
  ON request_queue(status, created_at ASC);

-- Queue: business-scoped lookups
CREATE INDEX IF NOT EXISTS idx_request_queue_business_status
  ON request_queue(business_id, status);

-- Conversations: active session lookup (business + customer + expiry)
CREATE INDEX IF NOT EXISTS idx_conversations_active
  ON conversations(business_id, customer_chat_id, expires_at);

-- Appointments: customer chat ID lookup (for status handler)
CREATE INDEX IF NOT EXISTS idx_appointments_chat_id
  ON appointments(business_id, customer_chat_id, appointment_date);

-- Business costs: date range queries
CREATE INDEX IF NOT EXISTS idx_business_costs_date
  ON business_costs(business_id, date);

-- Businesses: look up by telegram webhook secret (per-business routing)
CREATE INDEX IF NOT EXISTS idx_businesses_telegram_secret
  ON businesses(telegram_webhook_secret)
  WHERE telegram_webhook_secret IS NOT NULL;

-- ─────────────────────────────────────────────
-- 7. UPSERT FUNCTION FOR DAILY COSTS (fixes race condition)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION upsert_daily_cost(
  p_business_id uuid,
  p_date        date,
  p_cost        double precision,
  p_is_cache    boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO business_costs (business_id, date, total_cost, query_count, cache_hits)
  VALUES (p_business_id, p_date, p_cost, 1, CASE WHEN p_is_cache THEN 1 ELSE 0 END)
  ON CONFLICT (business_id, date) DO UPDATE SET
    total_cost  = business_costs.total_cost + EXCLUDED.total_cost,
    query_count = business_costs.query_count + 1,
    cache_hits  = business_costs.cache_hits + CASE WHEN p_is_cache THEN 1 ELSE 0 END;
END;
$$;

-- ─────────────────────────────────────────────
-- 8. TCR METRIC LOGGING TABLE
-- Tracks booking success/failure for §7.2 evaluation
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS booking_attempts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid REFERENCES businesses(id) ON DELETE CASCADE,
  conversation_id uuid,
  customer_chat_id text,
  platform        text DEFAULT 'telegram',
  success         boolean NOT NULL,
  failure_reason  text,
  turns_taken     int DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_attempts_business
  ON booking_attempts(business_id, created_at DESC);


-- ====================================================================
-- Migration 10/28: 20260320_appointment_reminders.sql
-- ====================================================================

-- =============================================================================
-- Migration: Appointment Reminder Tracking
-- Adds columns to track which reminders have been sent, preventing duplicates.
-- =============================================================================

-- 24-hour reminder: sent the day before the appointment
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS reminder_24h_sent BOOLEAN NOT NULL DEFAULT false;

-- 1-hour reminder: sent ~1 hour before the appointment
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS reminder_1h_sent BOOLEAN NOT NULL DEFAULT false;

-- Index for the reminders cron: finds scheduled appointments where reminders
-- haven't been sent yet, filtered by date/time window
CREATE INDEX IF NOT EXISTS idx_appointments_reminders
  ON appointments(business_id, appointment_date, appointment_time, status)
  WHERE status = 'scheduled';


-- ====================================================================
-- Migration 11/28: 20260320_budgets_and_cost_logs.sql
-- ====================================================================

-- =============================================================================
-- Migration: Budgets + Cost Logs
-- Creates the budgets and cost_logs tables and their supporting RPC functions.
-- These tables are referenced by cost-tracker.ts and supabase.ts but were
-- never created by a prior migration, causing reserve_budget() to fail on
-- fresh deployments and block all paid-model AI calls.
-- =============================================================================

-- ─────────────────────────────────────────────
-- 1. BUDGETS TABLE
-- One row per business. Tracks monthly cap, current spend, and pending spend.
-- pending_usage_usd is incremented before each AI call and decremented after.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.budgets (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id           UUID        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    monthly_budget_usd    DOUBLE PRECISION NOT NULL DEFAULT 10.0,  -- default $10/month
    current_usage_usd     DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    pending_usage_usd     DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    budget_alert_sent_at  TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (business_id)
);

CREATE INDEX IF NOT EXISTS idx_budgets_business_id ON public.budgets (business_id);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- Service-role key bypasses RLS; these policies cover anon/authenticated reads
CREATE POLICY IF NOT EXISTS "budgets_service_role_all" ON public.budgets
    FOR ALL USING (true);

-- ─────────────────────────────────────────────
-- 2. COST LOGS TABLE
-- Per-call log of actual LLM spend for auditing and UI cost breakdown.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cost_logs (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id  UUID        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    amount_usd   DOUBLE PRECISION NOT NULL,
    model_used   TEXT        NOT NULL,
    tokens_in    INTEGER     NOT NULL DEFAULT 0,
    tokens_out   INTEGER     NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cost_logs_business_created
    ON public.cost_logs (business_id, created_at DESC);

ALTER TABLE public.cost_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "cost_logs_service_role_all" ON public.cost_logs
    FOR ALL USING (true);

-- ─────────────────────────────────────────────
-- 3. reserve_budget(p_business_id, p_estimated_cost)
-- Atomically checks whether a business has headroom in their monthly budget.
-- If yes, increments pending_usage_usd and returns TRUE.
-- If the business has no budget row yet, one is auto-created with the default
-- $10 cap so the first call is always allowed.
-- Returns FALSE only when current + pending + new cost would exceed the cap.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION reserve_budget(
    p_business_id   UUID,
    p_estimated_cost DOUBLE PRECISION
)
RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
    v_budget RECORD;
BEGIN
    -- Upsert: auto-create a row if this business doesn't have one yet
    INSERT INTO public.budgets (business_id)
    VALUES (p_business_id)
    ON CONFLICT (business_id) DO NOTHING;

    -- Lock the row for the duration of this transaction
    SELECT *
    INTO   v_budget
    FROM   public.budgets
    WHERE  business_id = p_business_id
    FOR UPDATE;

    -- If no monthly cap is set (0 or NULL), always allow
    IF v_budget.monthly_budget_usd IS NULL OR v_budget.monthly_budget_usd <= 0 THEN
        RETURN TRUE;
    END IF;

    -- Check headroom
    IF (v_budget.current_usage_usd + v_budget.pending_usage_usd + p_estimated_cost)
        > v_budget.monthly_budget_usd THEN
        RETURN FALSE;
    END IF;

    -- Reserve the budget
    UPDATE public.budgets
    SET    pending_usage_usd = pending_usage_usd + p_estimated_cost
    WHERE  business_id = p_business_id;

    RETURN TRUE;
END;
$$;

-- ─────────────────────────────────────────────
-- 4. commit_reserved_budget(p_business_id, p_actual_cost)
-- Called after an AI call completes. Moves p_actual_cost from pending to
-- current. Any over-estimate in pending is automatically released because we
-- reduce pending by the full estimated amount (stored implicitly; here we
-- reduce by actual cost and rely on releaseBudget() in TS for the remainder,
-- or simply clamp pending to 0 if it would go negative).
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION commit_reserved_budget(
    p_business_id UUID,
    p_actual_cost DOUBLE PRECISION
)
RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE public.budgets
    SET
        current_usage_usd = current_usage_usd + p_actual_cost,
        -- Reduce pending by the actual cost; clamp to 0 to avoid negatives
        pending_usage_usd = GREATEST(0, pending_usage_usd - p_actual_cost)
    WHERE business_id = p_business_id;
END;
$$;

-- ─────────────────────────────────────────────
-- 5. AUTO-PROVISION budget rows for existing businesses
-- Any business that already exists gets a default budget row so the first
-- AI call doesn't trigger the INSERT in reserve_budget() mid-transaction.
-- ─────────────────────────────────────────────
INSERT INTO public.budgets (business_id)
SELECT id FROM public.businesses
ON CONFLICT (business_id) DO NOTHING;


-- ====================================================================
-- Migration 12/28: 20260320_conversations_and_queue_fix.sql
-- ====================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: conversations table, status column, advisory-lock queue claim
-- Date: 2026-03-20
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1. CONVERSATIONS TABLE (was missing from all migrations)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_chat_id text NOT NULL,
  platform         text NOT NULL DEFAULT 'telegram',
  intent           text,
  status           text NOT NULL DEFAULT 'ai',   -- 'ai' | 'human' | 'escalated'
  state            jsonb DEFAULT '{}'::jsonb,
  history          jsonb DEFAULT '[]'::jsonb,
  last_message_at  timestamptz DEFAULT now(),
  expires_at       timestamptz DEFAULT (now() + interval '30 minutes'),
  created_at       timestamptz DEFAULT now()
);

-- Add status column to existing conversations table if it already exists
-- without the column (safe no-op when table was freshly created above)
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ai';

-- Add platform column if missing
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'telegram';

-- Ensure check constraint exists (idempotent via DROP IF EXISTS first)
ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_status_check;

ALTER TABLE conversations
  ADD CONSTRAINT conversations_status_check
    CHECK (status IN ('ai', 'human', 'escalated'));

-- ─────────────────────────────────────────────
-- 2. RLS FOR CONVERSATIONS
-- ─────────────────────────────────────────────
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_conversations" ON conversations;
CREATE POLICY "service_role_conversations"
  ON conversations
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────
-- 3. CONVERSATIONS INDEXES (idempotent)
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_conversations_active
  ON conversations(business_id, customer_chat_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_conversations_business_recent
  ON conversations(business_id, last_message_at DESC);

-- ─────────────────────────────────────────────
-- 4. ATOMIC QUEUE CLAIM FUNCTION
-- Prevents duplicate processing when two cron runs overlap.
-- Uses FOR UPDATE SKIP LOCKED — only one worker can claim each row.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION claim_queue_items(p_batch_size int DEFAULT 10)
RETURNS SETOF request_queue
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
    UPDATE request_queue
    SET status = 'processing'
    WHERE id IN (
      SELECT id
      FROM   request_queue
      WHERE  status = 'pending'
      ORDER  BY created_at ASC
      LIMIT  p_batch_size
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
END;
$$;


-- ====================================================================
-- Migration 13/28: 20260320_dead_letter_queue_and_budget_alerts.sql
-- ====================================================================

-- =============================================================================
-- Migration: Dead Letter Queue + Budget Alerts
-- Adds retry logic to request_queue and budget alert tracking to budgets table.
-- =============================================================================

-- ─────────────────────────────────────────────
-- 1. DEAD LETTER QUEUE COLUMNS ON request_queue
-- ─────────────────────────────────────────────

-- retry_count: how many times this item has been attempted (0 = first try)
ALTER TABLE request_queue
  ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0;

-- retry_at: earliest time the item should be retried (NULL = ready immediately)
ALTER TABLE request_queue
  ADD COLUMN IF NOT EXISTS retry_at TIMESTAMPTZ;

-- error_message: last failure reason, for debugging
ALTER TABLE request_queue
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Index to efficiently pick up retryable failed items
CREATE INDEX IF NOT EXISTS idx_request_queue_retry
  ON request_queue(status, retry_at)
  WHERE status = 'failed' AND retry_at IS NOT NULL;

-- ─────────────────────────────────────────────
-- 2. UPDATED claim_queue_items — also picks up retryable failed items
-- Items are eligible for retry when: status='failed' AND retry_at <= now() AND retry_count < 3
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION claim_queue_items(p_batch_size int DEFAULT 10)
RETURNS SETOF request_queue
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
    UPDATE request_queue
    SET status = 'processing'
    WHERE id IN (
      SELECT id
      FROM   request_queue
      WHERE
        -- New pending items
        (status = 'pending')
        OR
        -- Retryable failed items (max 3 retries, retry window elapsed)
        (status = 'failed' AND retry_count < 3 AND retry_at <= now())
      ORDER BY created_at ASC
      LIMIT  p_batch_size
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
END;
$$;

-- ─────────────────────────────────────────────
-- 3. BUDGET ALERT TRACKING
-- Prevents spamming the owner with repeated alert emails.
-- ─────────────────────────────────────────────

-- Add a column to track when the last budget alert was sent.
-- We only send one alert per threshold crossing per day.
ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS budget_alert_sent_at TIMESTAMPTZ;

-- ─────────────────────────────────────────────
-- 4. STALE QUEUE CLEANUP FUNCTION
-- Called by the cleanup cron; removes old completed/failed items and
-- purges dead-lettered items (failed + retry_count >= 3) older than 7 days.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_stale_queue_items()
RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM request_queue
  WHERE
    -- Completed items older than 7 days
    (status = 'completed' AND created_at < now() - interval '7 days')
    OR
    -- Dead-lettered items (exhausted retries) older than 7 days
    (status = 'failed' AND retry_count >= 3 AND created_at < now() - interval '7 days')
    OR
    -- Stuck processing items older than 1 hour (presumed crashed)
    (status = 'processing' AND created_at < now() - interval '1 hour');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ─────────────────────────────────────────────
-- 5. STALE CONVERSATION CLEANUP FUNCTION
-- Purges expired conversations (expires_at in past) older than 30 days.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_stale_conversations()
RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM conversations
  WHERE expires_at < now() - interval '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


-- ====================================================================
-- Migration 14/28: 20260320_faq_hit_count.sql
-- ====================================================================

-- Add hit_count to faq_documents so we can track which FAQs are used most
ALTER TABLE faq_documents
  ADD COLUMN IF NOT EXISTS hit_count INTEGER NOT NULL DEFAULT 0;

-- Index for sorting by most-used
CREATE INDEX IF NOT EXISTS idx_faq_documents_hit_count
  ON faq_documents (business_id, hit_count DESC);

-- Atomic bulk increment for matched FAQ IDs
CREATE OR REPLACE FUNCTION increment_faq_hits(p_ids UUID[])
RETURNS void
LANGUAGE sql
AS $$
  UPDATE faq_documents
  SET hit_count = hit_count + 1
  WHERE id = ANY(p_ids);
$$;


-- ====================================================================
-- Migration 15/28: 20260320_fix_appointment_status_default.sql
-- ====================================================================

-- =============================================================================
-- Migration: Fix appointment status default
-- The original create_appointments_table migration set `status default 'confirmed'`
-- but a later migration (20260320_timezone_email_cleanup.sql) adds:
--   CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show'))
-- The value 'confirmed' is not in that list, so any INSERT that relies on the
-- column default (rather than supplying an explicit status) would fail.
-- Fix: change the column default to 'scheduled'.
-- =============================================================================
ALTER TABLE public.appointments
    ALTER COLUMN status SET DEFAULT 'scheduled';


-- ====================================================================
-- Migration 16/28: 20260320_timezone_email_cleanup.sql
-- ====================================================================

-- =============================================================================
-- Migration: Timezone, Email Notifications, Cleanup
-- Adds per-business timezone configuration, email notification settings,
-- cancellation status for appointments, and drops the legacy faqs table.
-- =============================================================================

-- 1. Add timezone column to businesses (default Asia/Colombo for existing rows)
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Colombo';

-- 2. Add email_notifications_enabled flag (default true for new businesses)
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN NOT NULL DEFAULT true;

-- 3. Add 'cancelled' to the appointment status enum / check constraint
--    (appointments table uses a TEXT column with a check constraint)
ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show'));

-- 4. Add customer_chat_id to appointments if not already present
--    (needed for cancellation lookup by chat session)
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS customer_chat_id TEXT;

CREATE INDEX IF NOT EXISTS appointments_customer_chat_id_idx
  ON appointments (business_id, customer_chat_id);

-- 5. Drop legacy 'faqs' table if it still exists (data lives in faq_documents)
DROP TABLE IF EXISTS faqs CASCADE;

-- 6. Add conversation search RPC (searches the JSONB history array for text)
CREATE OR REPLACE FUNCTION search_conversations(
  p_business_id UUID,
  p_query TEXT,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  customer_chat_id TEXT,
  intent TEXT,
  status TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  history JSONB,
  state JSONB
)
LANGUAGE plpgsql
AS $$
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
  FROM conversations c
  WHERE c.business_id = p_business_id
    AND (
      -- Match against chat ID
      c.customer_chat_id ILIKE '%' || p_query || '%'
      -- Match against message text inside history JSONB array
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(c.history) AS msg
        WHERE (msg -> 'parts' -> 0 ->> 'text') ILIKE '%' || p_query || '%'
      )
    )
  ORDER BY c.last_message_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;


-- ====================================================================
-- Migration 17/28: 20260320_webhook_idempotency.sql
-- ====================================================================

-- =============================================================================
-- Migration: Webhook Idempotency
-- Telegram retries delivery if it doesn't receive a 200 within 5 seconds.
-- Without deduplication, a slow DB insert could cause the same message to be
-- processed twice, resulting in duplicate bookings or double responses.
--
-- Solution: store the Telegram update_id (unique per bot) on the request_queue
-- row and use ON CONFLICT DO NOTHING so retried webhooks are silent no-ops.
-- =============================================================================

-- 1. Add idempotency key column (nullable for backward-compat + Messenger rows)
ALTER TABLE public.request_queue
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- 2. Partial unique index: enforce uniqueness only where the key is present.
--    This allows NULL for Messenger/other rows while deduplicating Telegram ones.
CREATE UNIQUE INDEX IF NOT EXISTS idx_request_queue_idempotency_key
    ON public.request_queue (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- 3. Index for fast pending lookup (already exists but document it here)
--    idx_request_queue_status already created in earlier migrations.


-- ====================================================================
-- Migration 18/28: 20260321_rls_and_indexes_audit.sql
-- ====================================================================

-- =============================================================================
-- Migration: Full RLS + Index Audit Fix
-- Date: 2026-03-21
--
-- FINDINGS:
--
-- 1. CRITICAL — ALL existing RLS policies use USING (true) / WITH CHECK (true).
--    This grants any Supabase client (anon key, service_role key, or any
--    authenticated JWT) full read/write access to EVERY business's rows.
--    The platform is currently only safe because ALL server code uses
--    SUPABASE_SERVICE_ROLE_KEY which bypasses RLS entirely. If the anon key
--    or a user JWT were ever used (e.g. from a frontend client-side call),
--    complete cross-tenant data exposure would occur.
--
-- 2. MISSING RLS — The following tables have RLS NOT enabled at all:
--      users, businesses, business_blackouts, customers, reviews,
--      booking_attempts, platform_settings
--    (faq_documents, faq_embeddings, request_queue have no CREATE TABLE in
--    migrations — their RLS status is unknown and must be verified on the
--    live DB; SQL to fix them is included at the end.)
--
-- 3. reserve_budget RACE CONDITION REVIEW — PASS
--    The INSERT ... ON CONFLICT DO NOTHING followed by SELECT ... FOR UPDATE
--    inside a single plpgsql function body is correctly serialised. The
--    FOR UPDATE row lock prevents concurrent callers for the same business_id
--    from passing the headroom check simultaneously. No race condition exists.
--
-- 4. commit_reserved_budget — PASS
--    Uses a single atomic UPDATE (current += actual, pending -= actual).
--    PostgreSQL's implicit row lock on UPDATE is sufficient here; no FOR
--    UPDATE needed.
--
-- FIX STRATEGY:
--    Since ALL backend code uses the service_role key (which bypasses RLS),
--    the correct fix is:
--      a) Enable RLS on every table.
--      b) DROP the permissive USING (true) policies — they serve no purpose
--         for service_role and only expose data to non-service_role callers.
--      c) Add properly scoped policies for any legitimate authenticated access.
--    Result: service_role retains full access; any other key sees nothing.
--
-- 5. MISSING INDEXES — Full table scans possible on several hot paths.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: FIX PERMISSIVE policies on tables that already have RLS enabled
-- ─────────────────────────────────────────────────────────────────────────────

-- appointments — drop USING (true) blanket policy
DROP POLICY IF EXISTS "business_own_appointments" ON public.appointments;

-- business_costs — drop USING (true) blanket policy
DROP POLICY IF EXISTS "business_own_costs" ON public.business_costs;

-- budgets — drop USING (true) blanket policy
DROP POLICY IF EXISTS "budgets_service_role_all" ON public.budgets;

-- cost_logs — drop USING (true) blanket policy
DROP POLICY IF EXISTS "cost_logs_service_role_all" ON public.cost_logs;

-- conversations — drop USING (true) blanket policy
DROP POLICY IF EXISTS "service_role_conversations" ON public.conversations;

-- waitlist — drop USING (true) blanket policy
DROP POLICY IF EXISTS "waitlist_service_role_all" ON public.waitlist;

-- services — drop USING (true) blanket policy
DROP POLICY IF EXISTS "services_service_role_all" ON public.services;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: ENABLE RLS on tables that are completely unprotected
-- ─────────────────────────────────────────────────────────────────────────────

-- users — contains password_hash; must be fully locked down
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- businesses — contains bot tokens, OAuth tokens, fb_page_access_token
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- business_blackouts — business-scoped data, no RLS before this migration
ALTER TABLE public.business_blackouts ENABLE ROW LEVEL SECURITY;

-- customers — PII (names, phone numbers); must be locked down
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- reviews — customer feedback, business-scoped
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- booking_attempts — internal metrics, business-scoped
ALTER TABLE public.booking_attempts ENABLE ROW LEVEL SECURITY;

-- platform_settings — admin-only config (budget defaults, announcements)
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: EXPLICIT DENY policies for non-service_role roles
--
-- Since service_role bypasses RLS entirely, these policies only affect
-- anon and authenticated callers. Making them explicit (rather than relying
-- on the implicit default-deny) ensures the intent is clear in pg_policies.
-- ─────────────────────────────────────────────────────────────────────────────

-- users: completely blocked for anon/authenticated
CREATE POLICY "deny_direct_access" ON public.users
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

-- businesses: completely blocked for anon/authenticated
CREATE POLICY "deny_direct_access" ON public.businesses
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

-- appointments
CREATE POLICY "deny_direct_access" ON public.appointments
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

-- business_costs
CREATE POLICY "deny_direct_access" ON public.business_costs
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

-- budgets
CREATE POLICY "deny_direct_access" ON public.budgets
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

-- cost_logs
CREATE POLICY "deny_direct_access" ON public.cost_logs
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

-- conversations
CREATE POLICY "deny_direct_access" ON public.conversations
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

-- waitlist
CREATE POLICY "deny_direct_access" ON public.waitlist
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

-- services
CREATE POLICY "deny_direct_access" ON public.services
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

-- business_blackouts
CREATE POLICY "deny_direct_access" ON public.business_blackouts
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

-- customers
CREATE POLICY "deny_direct_access" ON public.customers
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

-- reviews
CREATE POLICY "deny_direct_access" ON public.reviews
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

-- booking_attempts
CREATE POLICY "deny_direct_access" ON public.booking_attempts
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

-- platform_settings (admin-only, never accessible to end users)
CREATE POLICY "deny_direct_access" ON public.platform_settings
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4: FIX TABLES WITH UNKNOWN RLS STATUS
-- (faq_documents, faq_embeddings, request_queue have no CREATE TABLE in
--  migrations — apply RLS + deny policies defensively)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE IF EXISTS public.faq_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_direct_access" ON public.faq_documents;
CREATE POLICY "deny_direct_access" ON public.faq_documents
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

ALTER TABLE IF EXISTS public.faq_embeddings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_direct_access" ON public.faq_embeddings;
CREATE POLICY "deny_direct_access" ON public.faq_embeddings
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

ALTER TABLE IF EXISTS public.request_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_direct_access" ON public.request_queue;
CREATE POLICY "deny_direct_access" ON public.request_queue
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 5: MISSING INDEXES
--
-- Hot query paths that currently cause full table scans:
-- ─────────────────────────────────────────────────────────────────────────────

-- 5a. appointments.status — cron reminders filters WHERE status = 'scheduled'
--     and analytics filters by status constantly. Partial indexes on each
--     frequent status value are more efficient than a full column index.
CREATE INDEX IF NOT EXISTS idx_appointments_status
    ON public.appointments (business_id, status);

-- 5b. appointments.created_at — analytics date-range queries
--     (e.g. WHERE created_at >= weekAgoStr in weekly-report cron)
CREATE INDEX IF NOT EXISTS idx_appointments_created_at
    ON public.appointments (business_id, created_at DESC);

-- 5c. appointments.platform — reminders cron skips non-telegram rows;
--     analytics breakdowns by platform; partial index on messenger rows only
CREATE INDEX IF NOT EXISTS idx_appointments_platform
    ON public.appointments (business_id, platform)
    WHERE platform IS NOT NULL;

-- 5d. conversations.created_at — analytics counts conversations in date ranges
CREATE INDEX IF NOT EXISTS idx_conversations_created_at
    ON public.conversations (business_id, created_at DESC);

-- 5e. customers.name — dashboard customer search uses ILIKE '%name%'; a
--     trigram index enables this to use an index scan instead of seqscan.
--     Requires pg_trgm extension (enabled by default in Supabase).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm
    ON public.customers USING GIN (name gin_trgm_ops);

-- 5f. customers.chat_id — looks up customer by chat ID across platforms;
--     already has idx_customers_chat_id but it was on chat_id alone. A
--     composite (business_id, chat_id) index covers the common filtered query.
CREATE INDEX IF NOT EXISTS idx_customers_business_chat_id
    ON public.customers (business_id, chat_id)
    WHERE chat_id IS NOT NULL;

-- 5g. reviews.created_at — date-range queries in the reviews dashboard
CREATE INDEX IF NOT EXISTS idx_reviews_business_created_at
    ON public.reviews (business_id, created_at DESC);

-- 5h. reviews.rating — average rating query; partial index for non-null ratings
CREATE INDEX IF NOT EXISTS idx_reviews_rating
    ON public.reviews (business_id, rating)
    WHERE rating IS NOT NULL;

-- 5i. cost_logs: weekly-report sums cost_logs by business + date range.
--     idx_cost_logs_business_created already covers (business_id, created_at DESC)
--     — no new index needed here.

-- 5j. faq_documents.business_id — the match_faqs_gemini and search_faqs_keyword
--     functions filter by business_id; ensure a basic index exists.
CREATE INDEX IF NOT EXISTS idx_faq_documents_business_id
    ON public.faq_documents (business_id);

-- 5k. request_queue: the claim_queue_items function selects WHERE status IN
--     ('pending','failed') ORDER BY created_at. The existing
--     idx_request_queue_status_created covers (status, created_at) and handles
--     this well; the partial retry index also exists. No new index needed.

-- 5l. business_costs.business_id — already covered by idx_business_costs_date
--     which is (business_id, date). No new index needed.


-- ====================================================================
-- Migration 19/28: 20260321_waitlist_services_notes.sql
-- ====================================================================

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


-- ====================================================================
-- Migration 20/28: 20260322_service_tiers.sql
-- ====================================================================

-- =============================================================================
-- Migration: Add pricing tiers (packages) to services
-- =============================================================================
--
-- A service can have zero or more pricing tiers.
-- When tiers are present, the top-level `price` column is used as a fallback
-- only. The AI bot will present the tiers as selectable packages and record
-- the chosen tier name as the `service_type` on the appointment.
--
-- Tier JSON shape (array element):
--   {
--     "name":             string,   -- e.g. "Hydra Cleanup"
--     "price":            number,   -- e.g. 5000 (in local currency)
--     "currency":         string?,  -- e.g. "LKR" (optional, defaults to business currency)
--     "duration_minutes": number?   -- override the service default, e.g. 90
--   }
-- =============================================================================

ALTER TABLE public.services
    ADD COLUMN IF NOT EXISTS tiers JSONB NOT NULL DEFAULT '[]';

-- Optional: store currency code at service level so the bot knows how to label prices
ALTER TABLE public.services
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'LKR';


-- ====================================================================
-- Migration 21/28: 20260322_workflow_improvements.sql
-- ====================================================================

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


-- ====================================================================
-- Migration 22/28: 20260323_platform_settings.sql
-- ====================================================================

-- Platform-wide admin settings (key-value store)
CREATE TABLE IF NOT EXISTS public.platform_settings (
    key         TEXT PRIMARY KEY,
    value       TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default values
INSERT INTO public.platform_settings (key, value) VALUES
    ('default_monthly_budget_usd', '10'),
    ('default_ai_model', 'gemini-flash-latest'),
    ('global_announcement', '')
ON CONFLICT (key) DO NOTHING;


-- ====================================================================
-- Migration 23/28: 20260324_reviews_unique_constraint.sql
-- ====================================================================

-- Add unique constraint to prevent duplicate reviews for the same appointment
-- from the same customer. The webhook handler already guards against duplicates
-- with a pre-insert SELECT check; this constraint is the database-level safety net.
ALTER TABLE reviews
  ADD CONSTRAINT reviews_appointment_customer_unique
  UNIQUE (appointment_id, customer_chat_id);


-- ====================================================================
-- Migration 24/28: 20260325_match_faqs_openai.sql
-- ====================================================================

-- BUG 13: match_faqs function for OpenAI text-embedding-3-small (1536 dimensions).
-- The Gemini variant (match_faqs_gemini, 768-dim) already exists in migration
-- 20260112194000_match_faqs_gemini.sql. Without this function, all production
-- FAQ semantic searches silently fail with "function match_faqs does not exist".

CREATE OR REPLACE FUNCTION match_faqs (
  query_embedding vector(1536),
  match_threshold float,
  match_count     int,
  p_business_id   uuid
)
RETURNS TABLE (
  id         uuid,
  question   text,
  answer     text,
  similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.question,
    d.answer,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM faq_documents d
  JOIN faq_embeddings e ON d.id = e.faq_id
  WHERE d.business_id = p_business_id
    AND 1 - (e.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- BUG 14: Ensure deleting a faq_documents row cascades to faq_embeddings.
-- Without CASCADE, every FAQ deletion leaves an orphaned row in faq_embeddings.
-- The INNER JOIN in match_faqs makes orphaned rows invisible to search, but they
-- accumulate as dead vector storage.
ALTER TABLE faq_embeddings
  DROP CONSTRAINT IF EXISTS faq_embeddings_faq_id_fkey,
  ADD  CONSTRAINT faq_embeddings_faq_id_fkey
    FOREIGN KEY (faq_id)
    REFERENCES faq_documents(id)
    ON DELETE CASCADE;


-- ====================================================================
-- Migration 25/28: 20260326_budget_fixes.sql
-- ====================================================================

-- =============================================================================
-- Migration: Budget Safety Fixes
-- =============================================================================
-- Fixes three cost-guard defects:
--
-- 1. ATOMIC RELEASE  — releaseBudget() in TypeScript was doing a non-atomic
--    read-modify-write (SELECT … then UPDATE), which loses one release when two
--    concurrent serverless invocations both catch an error for the same business.
--    The new release_budget() function does a single atomic UPDATE.
--
-- 2. MONTHLY RESET   — current_usage_usd was never reset, so the "monthly" cap
--    was effectively a lifetime cap. The new reset_monthly_budgets() function is
--    called by the cleanup cron on the 1st of each month.
--
-- 3. PENDING RECONCILIATION — if a worker crashes after reserve_budget() but
--    before commitCost/releaseBudget, pending_usage_usd stays inflated forever.
--    reset_stale_pending_budgets() zeros pending rows that have been non-zero for
--    more than 15 minutes (safe because real pending ops complete in < 60 s).
-- =============================================================================

-- ─────────────────────────────────────────────
-- 1. ATOMIC release_budget
-- Replaces the TypeScript read-modify-write with a single locked UPDATE.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION release_budget(
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

-- ─────────────────────────────────────────────
-- 2. MONTHLY RESET
-- Zeros current_usage_usd and pending_usage_usd for all businesses.
-- Called by the cleanup cron on the 1st of each month.
-- Returns the number of rows updated.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION reset_monthly_budgets()
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

-- ─────────────────────────────────────────────
-- 3. PENDING RECONCILIATION
-- Zeros any pending_usage_usd that has been non-zero for > 15 minutes.
-- Real pending operations complete in under 60 s; any row stuck longer than
-- 15 min is the result of a crashed worker that never called commitCost or
-- releaseBudget.
-- Returns the number of rows reset.
--
-- NOTE: The budgets table has no updated_at column so we add one here
-- (with a default of now(), meaning existing rows will start tracking from
-- this migration forward).
-- ─────────────────────────────────────────────
ALTER TABLE public.budgets
    ADD COLUMN IF NOT EXISTS pending_updated_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION reset_stale_pending_budgets()
RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
    reset_count INT;
BEGIN
    UPDATE public.budgets
    SET    pending_usage_usd  = 0,
           pending_updated_at = NULL
    WHERE  pending_usage_usd  > 0
      AND  pending_updated_at < now() - interval '15 minutes';

    GET DIAGNOSTICS reset_count = ROW_COUNT;
    RETURN reset_count;
END;
$$;

-- Also update pending_updated_at whenever pending changes; done via trigger.
CREATE OR REPLACE FUNCTION budgets_stamp_pending()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.pending_usage_usd IS DISTINCT FROM OLD.pending_usage_usd THEN
        IF NEW.pending_usage_usd > 0 THEN
            NEW.pending_updated_at := now();
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
    FOR EACH ROW EXECUTE FUNCTION budgets_stamp_pending();


-- ====================================================================
-- Migration 26/28: 20260326_faq_dedup.sql
-- ====================================================================

-- =============================================================================
-- Migration: FAQ Deduplication
-- =============================================================================
-- Adds a case-insensitive uniqueness guarantee to faq_documents so that
-- re-importing the same CSV does not create duplicate rows and inflate the
-- vector store with identical embeddings.
--
-- Steps:
--   1. Remove any existing duplicate rows (keep newest per business + question).
--   2. Add a `question_lower` generated column (lower(question), STORED).
--   3. Create a UNIQUE index on (business_id, question_lower).
-- =============================================================================

-- ─────────────────────────────────────────────
-- 1. DEDUP EXISTING ROWS
-- For each (business_id, lower(question)) group, keep the row with the
-- latest created_at and delete the older duplicates.
-- The CASCADE on faq_embeddings_faq_id_fkey (added in 20260325) means
-- the corresponding faq_embeddings rows are also deleted automatically.
-- ─────────────────────────────────────────────
DELETE FROM faq_documents d_old
  USING faq_documents d_new
WHERE d_old.business_id = d_new.business_id
  AND lower(d_old.question) = lower(d_new.question)
  AND d_old.created_at     <  d_new.created_at;

-- ─────────────────────────────────────────────
-- 2. GENERATED COLUMN
-- Stored so it can be indexed and referenced by Supabase upsert onConflict.
-- ─────────────────────────────────────────────
ALTER TABLE faq_documents
  ADD COLUMN IF NOT EXISTS question_lower TEXT
    GENERATED ALWAYS AS (lower(question)) STORED;

-- ─────────────────────────────────────────────
-- 3. UNIQUE INDEX
-- Prevents future duplicates at the DB level regardless of how the row is
-- inserted (storeFAQ, bulk import, direct SQL, etc.).
-- ─────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_faq_documents_uniq_question
  ON faq_documents (business_id, question_lower);


-- ====================================================================
-- Migration 27/28: 20260327_rag_fixes.sql
-- ====================================================================

-- =============================================================================
-- Migration: RAG Architecture Fixes
-- =============================================================================
-- Adds a unique constraint on faq_embeddings.faq_id so that storeFAQ can
-- replace the DELETE + INSERT pattern (which left a brief gap in vector search
-- results) with a single atomic INSERT ... ON CONFLICT DO UPDATE (upsert).
--
-- The faq_documents deduplication constraint (idx_faq_documents_uniq_question
-- on (business_id, question_lower)) was already added in 20260326_faq_dedup.sql.
-- This migration only adds the embedding-side constraint.
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_faq_embeddings_faq_id
    ON public.faq_embeddings (faq_id);


-- ====================================================================
-- Migration 28/28: 20260328_appointments_updated_at.sql
-- ====================================================================

-- =============================================================================
-- Migration: Add updated_at to appointments
-- =============================================================================
-- The weekly-report cron queries appointments WHERE status = 'cancelled' AND
-- updated_at >= weekAgo so that cancellations made this week (regardless of
-- when the appointment was originally created) are counted correctly.
-- Without this column the PostgREST query returns a 400 error and the
-- cancellation count in every weekly digest is silently 0.
--
-- The update_updated_at_column() trigger function already exists
-- (created in 002_create_users_table.sql).
-- =============================================================================

ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Back-fill: the DEFAULT now() set all existing rows to migration time.
-- Reset to created_at so historical rows reflect when they were inserted.
UPDATE public.appointments
    SET updated_at = created_at;

-- Attach the existing trigger function so updated_at stays current on every
-- future status change, reschedule, reminder update, etc.
DROP TRIGGER IF EXISTS trg_appointments_updated_at ON public.appointments;
CREATE TRIGGER trg_appointments_updated_at
    BEFORE UPDATE ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index for the weekly-report cancellations query:
--   WHERE business_id = ? AND status = 'cancelled' AND updated_at >= weekAgo
CREATE INDEX IF NOT EXISTS idx_appointments_business_updated_at
    ON public.appointments (business_id, updated_at DESC);
-- ====================================================================
-- Migration 29/29: 20260329_pgvector_migration.sql
-- ====================================================================

-- =============================================================================
-- Migration: Native pgvector Integration
-- Date: 2026-03-29
--
-- BACKGROUND
-- ----------
-- The faq_embeddings table stores two embedding columns used by the semantic
-- FAQ search system:
--
--   embedding        vector(1536)   OpenAI text-embedding-3-small
--   embedding_gemini vector(768)    Google text-embedding-004
--
-- The match_faqs and match_faqs_gemini RPC functions already referenced the
-- pgvector <=> (cosine distance) operator, but three problems existed:
--
--   1. CREATE EXTENSION vector was never included in any migration file.
--      On a fresh Supabase project the vector type does not exist unless the
--      extension is explicitly enabled. This migration fixes that.
--
--   2. Both functions were written in LANGUAGE plpgsql, which prevents the
--      query planner from inlining the function body. An inlined SQL function
--      exposes the ORDER BY <=> LIMIT pattern to the planner, allowing it to
--      choose the HNSW index scan path instead of a sequential scan.
--
--   3. The WHERE clause used the form:
--        1 - (e.embedding <=> query_embedding) > match_threshold
--      This computes the distance expression twice (SELECT and WHERE) and
--      evaluates similarity rather than distance, which obscures the
--      relationship between the threshold and the index operator class.
--      The rewritten form uses:
--        (e.embedding <=> query_embedding) < (1.0 - match_threshold)
--      which is semantically identical but expressed in distance terms,
--      allowing a future index-accelerated filter if pgvector adds support.
--
-- HNSW vs IVFFlat
-- ---------------
-- HNSW (Hierarchical Navigable Small World) is chosen over IVFFlat because:
--   - No training step required (IVFFlat needs a representative dataset)
--   - Better recall at equal query speed for most embedding dimensions
--   - Incremental inserts do not degrade index quality
--   - Ideal for datasets that grow continuously (FAQ ingestion pipeline)
--
-- HNSW TUNING PARAMETERS
-- ----------------------
--   m = 16              Maximum connections per layer in the HNSW graph.
--                       Range 2-100. Higher = better recall, more memory.
--                       16 is the pgvector default and suits embeddings up to
--                       ~2000 dimensions at moderate dataset size.
--
--   ef_construction = 64  Candidate list size used during index construction.
--                       Higher = better recall, slower build time.
--                       64 is the default; adequate for the expected FAQ
--                       volume (hundreds to low thousands of rows per business).
--
-- QUERY-TIME TUNING
-- -----------------
--   hnsw.ef_search controls the candidate list at query time (default 40).
--   For maximum recall in a FAQ matching context (where false negatives cost
--   more than latency), raise this setting at the database or session level:
--
--     ALTER DATABASE postgres SET hnsw.ef_search = 100;
--
--   This migration does not apply that change automatically because it
--   affects all vector queries system-wide. Set it manually after deployment.
--
-- TYPESCRIPT COMPATIBILITY
-- ------------------------
--   src/lib/infrastructure/embeddings.ts requires NO changes. PostgREST
--   automatically converts JSON number arrays to the vector type when the
--   target function parameter or table column is declared vector(n). The
--   RPC call signatures (query_embedding, match_threshold, match_count,
--   p_business_id) are unchanged.
--
-- PRODUCTION NOTE
-- ---------------
--   Building HNSW indexes acquires a ShareUpdateExclusiveLock. On a table
--   with active writes, use CREATE INDEX CONCURRENTLY instead. The IF NOT
--   EXISTS guard below prevents re-running from rebuilding existing indexes.
-- =============================================================================


-- =============================================================================
-- STEP 1: Enable the pgvector extension
-- =============================================================================
-- Must run before any vector type, operator, or index can be used.
-- Idempotent: IF NOT EXISTS means a re-run does nothing.

CREATE EXTENSION IF NOT EXISTS vector;


-- =============================================================================
-- STEP 2: Ensure embedding columns are typed as vector
-- =============================================================================
-- If faq_embeddings was created before pgvector was available, the columns
-- may have been stored as text or float8[] arrays. The USING clause handles
-- the cast in both scenarios:
--   float8[]  -> pgvector accepts '{0.1,0.2,...}' array literal notation
--   text      -> pgvector accepts '[0.1, 0.2, ...]' JSON array notation
--
-- If the columns are already vector(n), Postgres accepts the ALTER as a
-- compatible type change and performs no data rewrite.

ALTER TABLE public.faq_embeddings
    ALTER COLUMN embedding TYPE vector(1536)
        USING embedding::vector(1536);

ALTER TABLE public.faq_embeddings
    ALTER COLUMN embedding_gemini TYPE vector(768)
        USING embedding_gemini::vector(768);


-- =============================================================================
-- STEP 3: Drop old B-tree-style index on faq_id (kept for conflict detection
--         in RAG fixes migration) and replace with the embedding HNSW indexes.
--         The unique index on faq_id is kept separately below.
-- =============================================================================

-- OpenAI index: vector(1536) with cosine distance operator class
-- Build time is proportional to row count * m * ef_construction.
-- For a few hundred rows this completes in under one second.
CREATE INDEX IF NOT EXISTS idx_faq_embeddings_hnsw_openai
    ON public.faq_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Gemini index: vector(768) with cosine distance operator class
CREATE INDEX IF NOT EXISTS idx_faq_embeddings_hnsw_gemini
    ON public.faq_embeddings
    USING hnsw (embedding_gemini vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Preserve the unique constraint on faq_id (added by 20260327_rag_fixes.sql)
-- so the upsert in storeFAQ remains atomic.
CREATE UNIQUE INDEX IF NOT EXISTS idx_faq_embeddings_faq_id
    ON public.faq_embeddings (faq_id);


-- =============================================================================
-- STEP 4: Rewrite match_faqs for OpenAI text-embedding-3-small (1536 dims)
-- =============================================================================
-- Key changes from the plpgsql version in 20260325_match_faqs_openai.sql:
--
--   LANGUAGE sql       The function body is inlined into the calling query.
--                      The planner sees the full JOIN + ORDER BY + LIMIT and
--                      can choose the HNSW index scan for the ORDER BY clause.
--
--   STABLE             Marks the function as not modifying data and returning
--                      the same result for the same arguments within a query.
--                      Allows the planner to cache and inline it.
--
--   PARALLEL SAFE      Allows parallel query plans when scanning large tables
--                      (irrelevant at current scale but costs nothing to declare).
--
--   ORDER BY <=> LIMIT The HNSW index is activated by this exact pattern.
--                      Without ORDER BY, the planner falls back to a seqscan.
--
--   Distance threshold The condition (e.embedding <=> query_embedding) < threshold
--                      is equivalent to the old similarity > match_threshold form
--                      but expressed purely in distance terms, avoiding the
--                      double evaluation of the distance expression.

CREATE OR REPLACE FUNCTION public.match_faqs(
    query_embedding  vector(1536),
    match_threshold  float,
    match_count      int,
    p_business_id    uuid
)
RETURNS TABLE (
    id          uuid,
    question    text,
    answer      text,
    similarity  float
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
    FROM public.faq_documents   d
    JOIN public.faq_embeddings  e ON e.faq_id = d.id
    WHERE d.business_id = p_business_id
      AND (e.embedding <=> query_embedding) < (1.0 - match_threshold)
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_count
$$;


-- =============================================================================
-- STEP 5: Rewrite match_faqs_gemini for text-embedding-004 (768 dims)
-- =============================================================================
-- Identical structure to match_faqs above, but targets embedding_gemini and
-- uses the 768-dimensional vector type.

CREATE OR REPLACE FUNCTION public.match_faqs_gemini(
    query_embedding  vector(768),
    match_threshold  float,
    match_count      int,
    p_business_id    uuid
)
RETURNS TABLE (
    id          uuid,
    question    text,
    answer      text,
    similarity  float
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
    FROM public.faq_documents   d
    JOIN public.faq_embeddings  e ON e.faq_id = d.id
    WHERE d.business_id = p_business_id
      AND (e.embedding_gemini <=> query_embedding) < (1.0 - match_threshold)
    ORDER BY e.embedding_gemini <=> query_embedding
    LIMIT match_count
$$;


-- =============================================================================
-- STEP 6: Verification queries
-- =============================================================================
-- Run these manually after applying the migration to confirm success.
--
-- 1. Confirm extension is active:
--      SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
--
-- 2. Confirm column types:
--      SELECT column_name, udt_name
--      FROM information_schema.columns
--      WHERE table_name = 'faq_embeddings'
--        AND column_name IN ('embedding', 'embedding_gemini');
--      -- Expected: udt_name = 'vector' for both rows
--
-- 3. Confirm HNSW indexes exist:
--      SELECT indexname, indexdef
--      FROM pg_indexes
--      WHERE tablename = 'faq_embeddings'
--        AND indexname LIKE '%hnsw%';
--      -- Expected: two rows, one for each embedding column
--
-- 4. Confirm function signatures:
--      SELECT proname, prolang::regtype, proparallel
--      FROM pg_proc
--      WHERE proname IN ('match_faqs', 'match_faqs_gemini');
--      -- Expected: prolang = 'sql', proparallel = 's' (safe)
--
-- 5. Smoke-test the search function (replace values with real data):
--      SELECT * FROM public.match_faqs(
--          '[0.1, 0.2, ...]'::vector(1536),
--          0.5,
--          3,
--          'your-business-uuid'::uuid
--      );
-- =============================================================================

