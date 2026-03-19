-- Check if businesses table exists and has required columns
-- Run this in Supabase SQL Editor to verify

SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'businesses'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- If the table doesn't exist, create it:
CREATE TABLE IF NOT EXISTS public.businesses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    telegram_bot_token text,
    fb_page_id text UNIQUE,
    fb_page_access_token text,
    fb_page_name text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_businesses_user_id ON public.businesses(user_id);
CREATE INDEX IF NOT EXISTS idx_businesses_fb_page_id ON public.businesses(fb_page_id) WHERE fb_page_id IS NOT NULL;

-- Add update trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_businesses_updated_at ON public.businesses;
CREATE TRIGGER update_businesses_updated_at
    BEFORE UPDATE ON public.businesses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
