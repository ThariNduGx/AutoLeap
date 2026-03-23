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
  IF to_regclass('public.faq_documents') IS NULL
     OR to_regclass('public.faq_embeddings') IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY EXECUTE $sql$
    SELECT
      d.id,
      d.question,
      d.answer,
      1 - (e.embedding <=> $1) AS similarity
    FROM public.faq_documents d
    JOIN public.faq_embeddings e ON d.id = e.faq_id
    WHERE d.business_id = $2
      AND 1 - (e.embedding <=> $1) > $3
    ORDER BY similarity DESC
    LIMIT $4
  $sql$
  USING query_embedding, p_business_id, match_threshold, match_count;
END;
$$;

-- BUG 14: Ensure deleting a faq_documents row cascades to faq_embeddings.
-- Without CASCADE, every FAQ deletion leaves an orphaned row in faq_embeddings.
-- The INNER JOIN in match_faqs makes orphaned rows invisible to search, but they
-- accumulate as dead vector storage.
DO $$
BEGIN
  IF to_regclass('public.faq_embeddings') IS NOT NULL
     AND to_regclass('public.faq_documents') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.faq_embeddings
      DROP CONSTRAINT IF EXISTS faq_embeddings_faq_id_fkey,
      ADD CONSTRAINT faq_embeddings_faq_id_fkey
      FOREIGN KEY (faq_id)
      REFERENCES public.faq_documents(id)
      ON DELETE CASCADE';
  END IF;
END $$;
