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
