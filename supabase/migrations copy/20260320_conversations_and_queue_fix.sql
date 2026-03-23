-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: conversations table, status column, advisory-lock queue claim
-- Date: 2026-03-20
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1. CONVERSATIONS TABLE (was missing from all migrations)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_chat_id text NOT NULL,
  platform         text NOT NULL DEFAULT 'telegram',
  intent           text,
  status           text NOT NULL DEFAULT 'ai',   -- 'ai' | 'human' | 'escalated'
  state            jsonb DEFAULT '{}'::jsonb,
  history          jsonb DEFAULT '[]'::jsonb,
  last_message_at  timestamptz DEFAULT now(),
  expires_at       timestamptz DEFAULT (now() + interval '30 minutes'),
  created_at       timestamptz DEFAULT now()
);

-- Add status column to existing conversations table if it already exists
-- without the column (safe no-op when table was freshly created above)
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ai';

-- Add platform column if missing
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'telegram';

-- Ensure check constraint exists (idempotent via DROP IF EXISTS first)
ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_status_check;

ALTER TABLE conversations
  ADD CONSTRAINT conversations_status_check
    CHECK (status IN ('ai', 'human', 'escalated'));

-- ─────────────────────────────────────────────
-- 2. RLS FOR CONVERSATIONS
-- ─────────────────────────────────────────────
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_conversations" ON conversations;
CREATE POLICY "service_role_conversations"
  ON conversations
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────
-- 3. CONVERSATIONS INDEXES (idempotent)
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_conversations_active
  ON conversations(business_id, customer_chat_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_conversations_business_recent
  ON conversations(business_id, last_message_at DESC);

-- ─────────────────────────────────────────────
-- 4. ATOMIC QUEUE CLAIM FUNCTION
-- Prevents duplicate processing when two cron runs overlap.
-- Uses FOR UPDATE SKIP LOCKED — only one worker can claim each row.
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
      WHERE  status = 'pending'
      ORDER  BY created_at ASC
      LIMIT  p_batch_size
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
END;
$$;
