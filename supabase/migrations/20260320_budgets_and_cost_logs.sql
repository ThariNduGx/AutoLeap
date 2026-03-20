-- =============================================================================
-- Migration: Budgets + Cost Logs
-- Creates the budgets and cost_logs tables and their supporting RPC functions.
-- These tables are referenced by cost-tracker.ts and supabase.ts but were
-- never created by a prior migration, causing reserve_budget() to fail on
-- fresh deployments and block all paid-model AI calls.
-- =============================================================================

-- ─────────────────────────────────────────────
-- 1. BUDGETS TABLE
-- One row per business. Tracks monthly cap, current spend, and pending spend.
-- pending_usage_usd is incremented before each AI call and decremented after.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.budgets (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id           UUID        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    monthly_budget_usd    DOUBLE PRECISION NOT NULL DEFAULT 10.0,  -- default $10/month
    current_usage_usd     DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    pending_usage_usd     DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    budget_alert_sent_at  TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (business_id)
);

CREATE INDEX IF NOT EXISTS idx_budgets_business_id ON public.budgets (business_id);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- Service-role key bypasses RLS; these policies cover anon/authenticated reads
CREATE POLICY IF NOT EXISTS "budgets_service_role_all" ON public.budgets
    FOR ALL USING (true);

-- ─────────────────────────────────────────────
-- 2. COST LOGS TABLE
-- Per-call log of actual LLM spend for auditing and UI cost breakdown.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cost_logs (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id  UUID        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    amount_usd   DOUBLE PRECISION NOT NULL,
    model_used   TEXT        NOT NULL,
    tokens_in    INTEGER     NOT NULL DEFAULT 0,
    tokens_out   INTEGER     NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cost_logs_business_created
    ON public.cost_logs (business_id, created_at DESC);

ALTER TABLE public.cost_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "cost_logs_service_role_all" ON public.cost_logs
    FOR ALL USING (true);

-- ─────────────────────────────────────────────
-- 3. reserve_budget(p_business_id, p_estimated_cost)
-- Atomically checks whether a business has headroom in their monthly budget.
-- If yes, increments pending_usage_usd and returns TRUE.
-- If the business has no budget row yet, one is auto-created with the default
-- $10 cap so the first call is always allowed.
-- Returns FALSE only when current + pending + new cost would exceed the cap.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION reserve_budget(
    p_business_id   UUID,
    p_estimated_cost DOUBLE PRECISION
)
RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
    v_budget RECORD;
BEGIN
    -- Upsert: auto-create a row if this business doesn't have one yet
    INSERT INTO public.budgets (business_id)
    VALUES (p_business_id)
    ON CONFLICT (business_id) DO NOTHING;

    -- Lock the row for the duration of this transaction
    SELECT *
    INTO   v_budget
    FROM   public.budgets
    WHERE  business_id = p_business_id
    FOR UPDATE;

    -- If no monthly cap is set (0 or NULL), always allow
    IF v_budget.monthly_budget_usd IS NULL OR v_budget.monthly_budget_usd <= 0 THEN
        RETURN TRUE;
    END IF;

    -- Check headroom
    IF (v_budget.current_usage_usd + v_budget.pending_usage_usd + p_estimated_cost)
        > v_budget.monthly_budget_usd THEN
        RETURN FALSE;
    END IF;

    -- Reserve the budget
    UPDATE public.budgets
    SET    pending_usage_usd = pending_usage_usd + p_estimated_cost
    WHERE  business_id = p_business_id;

    RETURN TRUE;
END;
$$;

-- ─────────────────────────────────────────────
-- 4. commit_reserved_budget(p_business_id, p_actual_cost)
-- Called after an AI call completes. Moves p_actual_cost from pending to
-- current. Any over-estimate in pending is automatically released because we
-- reduce pending by the full estimated amount (stored implicitly; here we
-- reduce by actual cost and rely on releaseBudget() in TS for the remainder,
-- or simply clamp pending to 0 if it would go negative).
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION commit_reserved_budget(
    p_business_id UUID,
    p_actual_cost DOUBLE PRECISION
)
RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE public.budgets
    SET
        current_usage_usd = current_usage_usd + p_actual_cost,
        -- Reduce pending by the actual cost; clamp to 0 to avoid negatives
        pending_usage_usd = GREATEST(0, pending_usage_usd - p_actual_cost)
    WHERE business_id = p_business_id;
END;
$$;

-- ─────────────────────────────────────────────
-- 5. AUTO-PROVISION budget rows for existing businesses
-- Any business that already exists gets a default budget row so the first
-- AI call doesn't trigger the INSERT in reserve_budget() mid-transaction.
-- ─────────────────────────────────────────────
INSERT INTO public.budgets (business_id)
SELECT id FROM public.businesses
ON CONFLICT (business_id) DO NOTHING;
