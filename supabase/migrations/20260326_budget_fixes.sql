-- =============================================================================
-- Migration: Budget Safety Fixes
-- =============================================================================
-- Fixes three cost-guard defects:
--
-- 1. ATOMIC RELEASE  — releaseBudget() in TypeScript was doing a non-atomic
--    read-modify-write (SELECT … then UPDATE), which loses one release when two
--    concurrent serverless invocations both catch an error for the same business.
--    The new release_budget() function does a single atomic UPDATE.
--
-- 2. MONTHLY RESET   — current_usage_usd was never reset, so the "monthly" cap
--    was effectively a lifetime cap. The new reset_monthly_budgets() function is
--    called by the cleanup cron on the 1st of each month.
--
-- 3. PENDING RECONCILIATION — if a worker crashes after reserve_budget() but
--    before commitCost/releaseBudget, pending_usage_usd stays inflated forever.
--    reset_stale_pending_budgets() zeros pending rows that have been non-zero for
--    more than 15 minutes (safe because real pending ops complete in < 60 s).
-- =============================================================================

-- ─────────────────────────────────────────────
-- 1. ATOMIC release_budget
-- Replaces the TypeScript read-modify-write with a single locked UPDATE.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION release_budget(
    p_business_id UUID,
    p_amount      DOUBLE PRECISION
)
RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE public.budgets
    SET    pending_usage_usd = GREATEST(0, pending_usage_usd - p_amount)
    WHERE  business_id = p_business_id;
END;
$$;

-- ─────────────────────────────────────────────
-- 2. MONTHLY RESET
-- Zeros current_usage_usd and pending_usage_usd for all businesses.
-- Called by the cleanup cron on the 1st of each month.
-- Returns the number of rows updated.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION reset_monthly_budgets()
RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
    updated_count INT;
BEGIN
    UPDATE public.budgets
    SET    current_usage_usd = 0,
           pending_usage_usd = 0;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$;

-- ─────────────────────────────────────────────
-- 3. PENDING RECONCILIATION
-- Zeros any pending_usage_usd that has been non-zero for > 15 minutes.
-- Real pending operations complete in under 60 s; any row stuck longer than
-- 15 min is the result of a crashed worker that never called commitCost or
-- releaseBudget.
-- Returns the number of rows reset.
--
-- NOTE: The budgets table has no updated_at column so we add one here
-- (with a default of now(), meaning existing rows will start tracking from
-- this migration forward).
-- ─────────────────────────────────────────────
ALTER TABLE public.budgets
    ADD COLUMN IF NOT EXISTS pending_updated_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION reset_stale_pending_budgets()
RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
    reset_count INT;
BEGIN
    UPDATE public.budgets
    SET    pending_usage_usd  = 0,
           pending_updated_at = NULL
    WHERE  pending_usage_usd  > 0
      AND  pending_updated_at < now() - interval '15 minutes';

    GET DIAGNOSTICS reset_count = ROW_COUNT;
    RETURN reset_count;
END;
$$;

-- Also update pending_updated_at whenever pending changes; done via trigger.
CREATE OR REPLACE FUNCTION budgets_stamp_pending()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.pending_usage_usd IS DISTINCT FROM OLD.pending_usage_usd THEN
        IF NEW.pending_usage_usd > 0 THEN
            NEW.pending_updated_at := now();
        ELSE
            NEW.pending_updated_at := NULL;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_budgets_stamp_pending ON public.budgets;
CREATE TRIGGER trg_budgets_stamp_pending
    BEFORE UPDATE ON public.budgets
    FOR EACH ROW EXECUTE FUNCTION budgets_stamp_pending();
