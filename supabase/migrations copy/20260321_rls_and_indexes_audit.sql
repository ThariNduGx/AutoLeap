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
