-- =============================================================================
-- Migration: Appointment Reminder Tracking
-- Adds columns to track which reminders have been sent, preventing duplicates.
-- =============================================================================

-- 24-hour reminder: sent the day before the appointment
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS reminder_24h_sent BOOLEAN NOT NULL DEFAULT false;

-- 1-hour reminder: sent ~1 hour before the appointment
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS reminder_1h_sent BOOLEAN NOT NULL DEFAULT false;

-- Index for the reminders cron: finds scheduled appointments where reminders
-- haven't been sent yet, filtered by date/time window
CREATE INDEX IF NOT EXISTS idx_appointments_reminders
  ON appointments(business_id, appointment_date, appointment_time, status)
  WHERE status = 'scheduled';
