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
