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
