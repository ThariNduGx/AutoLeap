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
