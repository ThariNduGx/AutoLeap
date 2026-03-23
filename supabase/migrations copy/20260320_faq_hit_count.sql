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
