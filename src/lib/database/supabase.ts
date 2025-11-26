import { createClient } from '@supabase/supabase-js';

// We export a function to create the client to ensure we get a fresh instance
// which is important for Edge environments to handle auth correctly.
export const createSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase Environment Variables');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: 'public',
    },
  });
};

// Singleton instance for standard Node.js usage (optional, but good for caching)
export const supabaseAdmin = createSupabaseClient();