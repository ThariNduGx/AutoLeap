-- =============================================================================
-- Migration: Dead Letter Queue + Budget Alerts
-- Adds retry logic to request_queue and budget alert tracking to budgets table.
-- =============================================================================

-- ─────────────────────────────────────────────
-- 1. DEAD LETTER QUEUE COLUMNS ON request_queue
-- ─────────────────────────────────────────────

-- retry_count: how many times this item has been attempted (0 = first try)
ALTER TABLE request_queue
  ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0;

-- retry_at: earliest time the item should be retried (NULL = ready immediately)
ALTER TABLE request_queue
  ADD COLUMN IF NOT EXISTS retry_at TIMESTAMPTZ;

-- error_message: last failure reason, for debugging
ALTER TABLE request_queue
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Index to efficiently pick up retryable failed items
CREATE INDEX IF NOT EXISTS idx_request_queue_retry
  ON request_queue(status, retry_at)
  WHERE status = 'failed' AND retry_at IS NOT NULL;

-- ─────────────────────────────────────────────
-- 2. UPDATED claim_queue_items — also picks up retryable failed items
-- Items are eligible for retry when: status='failed' AND retry_at <= now() AND retry_count < 3
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION claim_queue_items(p_batch_size int DEFAULT 10)
RETURNS SETOF request_queue
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
    UPDATE request_queue
    SET status = 'processing'
    WHERE id IN (
      SELECT id
      FROM   request_queue
      WHERE
        -- New pending items
        (status = 'pending')
        OR
        -- Retryable failed items (max 3 retries, retry window elapsed)
        (status = 'failed' AND retry_count < 3 AND retry_at <= now())
      ORDER BY created_at ASC
      LIMIT  p_batch_size
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
END;
$$;

-- ─────────────────────────────────────────────
-- 3. BUDGET ALERT TRACKING
-- Prevents spamming the owner with repeated alert emails.
-- ─────────────────────────────────────────────

-- Add a column to track when the last budget alert was sent.
-- We only send one alert per threshold crossing per day.
ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS budget_alert_sent_at TIMESTAMPTZ;

-- ─────────────────────────────────────────────
-- 4. STALE QUEUE CLEANUP FUNCTION
-- Called by the cleanup cron; removes old completed/failed items and
-- purges dead-lettered items (failed + retry_count >= 3) older than 7 days.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_stale_queue_items()
RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM request_queue
  WHERE
    -- Completed items older than 7 days
    (status = 'completed' AND created_at < now() - interval '7 days')
    OR
    -- Dead-lettered items (exhausted retries) older than 7 days
    (status = 'failed' AND retry_count >= 3 AND created_at < now() - interval '7 days')
    OR
    -- Stuck processing items older than 1 hour (presumed crashed)
    (status = 'processing' AND created_at < now() - interval '1 hour');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ─────────────────────────────────────────────
-- 5. STALE CONVERSATION CLEANUP FUNCTION
-- Purges expired conversations (expires_at in past) older than 30 days.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_stale_conversations()
RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM conversations
  WHERE expires_at < now() - interval '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
