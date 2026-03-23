-- =============================================================================
-- Migration: Add pricing tiers (packages) to services
-- =============================================================================
--
-- A service can have zero or more pricing tiers.
-- When tiers are present, the top-level `price` column is used as a fallback
-- only. The AI bot will present the tiers as selectable packages and record
-- the chosen tier name as the `service_type` on the appointment.
--
-- Tier JSON shape (array element):
--   {
--     "name":             string,   -- e.g. "Hydra Cleanup"
--     "price":            number,   -- e.g. 5000 (in local currency)
--     "currency":         string?,  -- e.g. "LKR" (optional, defaults to business currency)
--     "duration_minutes": number?   -- override the service default, e.g. 90
--   }
-- =============================================================================

ALTER TABLE public.services
    ADD COLUMN IF NOT EXISTS tiers JSONB NOT NULL DEFAULT '[]';

-- Optional: store currency code at service level so the bot knows how to label prices
ALTER TABLE public.services
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'LKR';
