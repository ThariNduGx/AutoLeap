-- =============================================================================
-- Migration: Post-bootstrap reconciliation
-- Ensures tables created after the original audit migrations receive the same
-- final RLS/policy/index posture on fresh database bootstraps.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users',
    'businesses',
    'appointments',
    'business_costs',
    'budgets',
    'cost_logs',
    'conversations',
    'waitlist',
    'services',
    'business_blackouts',
    'customers',
    'reviews',
    'booking_attempts',
    'platform_settings',
    'faq_documents',
    'faq_embeddings',
    'request_queue'
  ]
  LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regclass('public.appointments') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "business_own_appointments" ON public.appointments';
    EXECUTE 'DROP POLICY IF EXISTS "deny_direct_access" ON public.appointments';
    EXECUTE 'CREATE POLICY "deny_direct_access" ON public.appointments
      AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_appointments_status
      ON public.appointments (business_id, status)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_appointments_created_at
      ON public.appointments (business_id, created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_appointments_platform
      ON public.appointments (business_id, platform)
      WHERE platform IS NOT NULL';
  END IF;

  IF to_regclass('public.business_costs') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "business_own_costs" ON public.business_costs';
    EXECUTE 'DROP POLICY IF EXISTS "deny_direct_access" ON public.business_costs';
    EXECUTE 'CREATE POLICY "deny_direct_access" ON public.business_costs
      AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false)';
  END IF;

  IF to_regclass('public.budgets') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "budgets_service_role_all" ON public.budgets';
    EXECUTE 'DROP POLICY IF EXISTS "deny_direct_access" ON public.budgets';
    EXECUTE 'CREATE POLICY "deny_direct_access" ON public.budgets
      AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false)';
  END IF;

  IF to_regclass('public.cost_logs') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "cost_logs_service_role_all" ON public.cost_logs';
    EXECUTE 'DROP POLICY IF EXISTS "deny_direct_access" ON public.cost_logs';
    EXECUTE 'CREATE POLICY "deny_direct_access" ON public.cost_logs
      AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false)';
  END IF;

  IF to_regclass('public.conversations') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "service_role_conversations" ON public.conversations';
    EXECUTE 'DROP POLICY IF EXISTS "deny_direct_access" ON public.conversations';
    EXECUTE 'CREATE POLICY "deny_direct_access" ON public.conversations
      AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_conversations_created_at
      ON public.conversations (business_id, created_at DESC)';
  END IF;

  IF to_regclass('public.waitlist') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "waitlist_service_role_all" ON public.waitlist';
    EXECUTE 'DROP POLICY IF EXISTS "deny_direct_access" ON public.waitlist';
    EXECUTE 'CREATE POLICY "deny_direct_access" ON public.waitlist
      AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false)';
  END IF;

  IF to_regclass('public.services') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "services_service_role_all" ON public.services';
    EXECUTE 'DROP POLICY IF EXISTS "deny_direct_access" ON public.services';
    EXECUTE 'CREATE POLICY "deny_direct_access" ON public.services
      AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false)';
  END IF;

  IF to_regclass('public.users') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "deny_direct_access" ON public.users';
    EXECUTE 'CREATE POLICY "deny_direct_access" ON public.users
      AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false)';
  END IF;

  IF to_regclass('public.businesses') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "deny_direct_access" ON public.businesses';
    EXECUTE 'CREATE POLICY "deny_direct_access" ON public.businesses
      AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false)';
  END IF;

  IF to_regclass('public.business_blackouts') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "deny_direct_access" ON public.business_blackouts';
    EXECUTE 'CREATE POLICY "deny_direct_access" ON public.business_blackouts
      AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false)';
  END IF;

  IF to_regclass('public.customers') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "deny_direct_access" ON public.customers';
    EXECUTE 'CREATE POLICY "deny_direct_access" ON public.customers
      AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_customers_name_trgm
      ON public.customers USING GIN (name gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_customers_business_chat_id
      ON public.customers (business_id, chat_id)
      WHERE chat_id IS NOT NULL';
  END IF;

  IF to_regclass('public.reviews') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "deny_direct_access" ON public.reviews';
    EXECUTE 'CREATE POLICY "deny_direct_access" ON public.reviews
      AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_reviews_business_created_at
      ON public.reviews (business_id, created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_reviews_rating
      ON public.reviews (business_id, rating)
      WHERE rating IS NOT NULL';
  END IF;

  IF to_regclass('public.booking_attempts') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "deny_direct_access" ON public.booking_attempts';
    EXECUTE 'CREATE POLICY "deny_direct_access" ON public.booking_attempts
      AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false)';
  END IF;

  IF to_regclass('public.platform_settings') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "deny_direct_access" ON public.platform_settings';
    EXECUTE 'CREATE POLICY "deny_direct_access" ON public.platform_settings
      AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false)';
  END IF;

  IF to_regclass('public.faq_documents') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "deny_direct_access" ON public.faq_documents';
    EXECUTE 'CREATE POLICY "deny_direct_access" ON public.faq_documents
      AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_faq_documents_business_id
      ON public.faq_documents (business_id)';
  END IF;

  IF to_regclass('public.faq_embeddings') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "deny_direct_access" ON public.faq_embeddings';
    EXECUTE 'CREATE POLICY "deny_direct_access" ON public.faq_embeddings
      AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false)';
  END IF;

  IF to_regclass('public.request_queue') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "deny_direct_access" ON public.request_queue';
    EXECUTE 'CREATE POLICY "deny_direct_access" ON public.request_queue
      AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false)';
  END IF;
END $$;
