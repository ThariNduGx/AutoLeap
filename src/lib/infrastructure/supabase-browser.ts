import { createClient } from '@supabase/supabase-js';

// Browser-side Supabase client using the public anon key.
// IMPORTANT: This client bypasses RLS only if the anon key grants it — never put
// SUPABASE_SERVICE_ROLE_KEY here. The anon key is safe to ship to the browser.
//
// Used exclusively for Realtime subscriptions that trigger authenticated API refetches.
// Actual data reads/writes always go through server-side API routes (service role key).

let browserClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowserClient(): ReturnType<typeof createClient> | null {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!url || !anonKey) {
    console.warn('[SUPABASE-BROWSER] NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY) not set — Realtime disabled');
    return null;
  }

  browserClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });

  return browserClient;
}
