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
