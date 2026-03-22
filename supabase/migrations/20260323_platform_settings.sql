-- Platform-wide admin settings (key-value store)
CREATE TABLE IF NOT EXISTS public.platform_settings (
    key         TEXT PRIMARY KEY,
    value       TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default values
INSERT INTO public.platform_settings (key, value) VALUES
    ('default_monthly_budget_usd', '10'),
    ('default_ai_model', 'gemini-flash-latest'),
    ('global_announcement', '')
ON CONFLICT (key) DO NOTHING;
