-- =============================================================================
-- Migration: Fix appointment status default
-- The original create_appointments_table migration set `status default 'confirmed'`
-- but a later migration (20260320_timezone_email_cleanup.sql) adds:
--   CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show'))
-- The value 'confirmed' is not in that list, so any INSERT that relies on the
-- column default (rather than supplying an explicit status) would fail.
-- Fix: change the column default to 'scheduled'.
-- =============================================================================
ALTER TABLE public.appointments
    ALTER COLUMN status SET DEFAULT 'scheduled';
