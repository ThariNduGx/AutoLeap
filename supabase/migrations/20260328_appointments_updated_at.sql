-- =============================================================================
-- Migration: Add updated_at to appointments
-- =============================================================================
-- The weekly-report cron queries appointments WHERE status = 'cancelled' AND
-- updated_at >= weekAgo so that cancellations made this week (regardless of
-- when the appointment was originally created) are counted correctly.
-- Without this column the PostgREST query returns a 400 error and the
-- cancellation count in every weekly digest is silently 0.
--
-- The update_updated_at_column() trigger function already exists
-- (created in 002_create_users_table.sql).
-- =============================================================================

ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Back-fill: the DEFAULT now() set all existing rows to migration time.
-- Reset to created_at so historical rows reflect when they were inserted.
UPDATE public.appointments
    SET updated_at = created_at;

-- Attach the existing trigger function so updated_at stays current on every
-- future status change, reschedule, reminder update, etc.
DROP TRIGGER IF EXISTS trg_appointments_updated_at ON public.appointments;
CREATE TRIGGER trg_appointments_updated_at
    BEFORE UPDATE ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index for the weekly-report cancellations query:
--   WHERE business_id = ? AND status = 'cancelled' AND updated_at >= weekAgo
CREATE INDEX IF NOT EXISTS idx_appointments_business_updated_at
    ON public.appointments (business_id, updated_at DESC);
