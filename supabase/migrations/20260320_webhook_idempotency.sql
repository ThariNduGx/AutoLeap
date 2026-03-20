-- =============================================================================
-- Migration: Webhook Idempotency
-- Telegram retries delivery if it doesn't receive a 200 within 5 seconds.
-- Without deduplication, a slow DB insert could cause the same message to be
-- processed twice, resulting in duplicate bookings or double responses.
--
-- Solution: store the Telegram update_id (unique per bot) on the request_queue
-- row and use ON CONFLICT DO NOTHING so retried webhooks are silent no-ops.
-- =============================================================================

-- 1. Add idempotency key column (nullable for backward-compat + Messenger rows)
ALTER TABLE public.request_queue
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- 2. Partial unique index: enforce uniqueness only where the key is present.
--    This allows NULL for Messenger/other rows while deduplicating Telegram ones.
CREATE UNIQUE INDEX IF NOT EXISTS idx_request_queue_idempotency_key
    ON public.request_queue (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- 3. Index for fast pending lookup (already exists but document it here)
--    idx_request_queue_status already created in earlier migrations.
