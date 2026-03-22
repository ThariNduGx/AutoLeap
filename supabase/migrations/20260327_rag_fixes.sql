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
