import { createClient } from '@supabase/supabase-js';

// Use a flexible approach - let Supabase infer types naturally
let supabaseClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('CRITICAL: Supabase environment variables not set');
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return supabaseClient;
}

// Type-safe wrapper for RPC calls with explicit any casting
export async function reserveBudget(
  businessId: string,
  estimatedCost: number
): Promise<boolean> {
  const supabase = getSupabaseClient();
  
  try {
    const { data, error } = await (supabase.rpc as any)('reserve_budget', {
      p_business_id: businessId,
      p_estimated_cost: estimatedCost,
    });

    if (error) {
      console.error('[BUDGET] Reservation failed:', error);
      return false;
    }

    return data ?? false;
  } catch (err) {
    console.error('[BUDGET] Exception during reservation:', err);
    return false;
  }
}

// Helper to commit reserved budget
export async function commitReservedBudget(
  businessId: string,
  actualCost: number
): Promise<boolean> {
  const supabase = getSupabaseClient();
  
  try {
    const { error } = await (supabase.rpc as any)('commit_reserved_budget', {
      p_business_id: businessId,
      p_actual_cost: actualCost,
    });

    if (error) {
      console.error('[BUDGET] Commit failed:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[BUDGET] Exception during commit:', err);
    return false;
  }
}

// Atomically decrements pending_usage_usd without a read-modify-write race.
// Replaces the TypeScript-side SELECT→compute→UPDATE pattern in releaseBudget.
export async function releaseBudgetRPC(
  businessId: string,
  amount: number
): Promise<void> {
  const supabase = getSupabaseClient();
  try {
    const { error } = await (supabase.rpc as any)('release_budget', {
      p_business_id: businessId,
      p_amount: amount,
    });
    if (error) {
      console.error('[BUDGET] Atomic release failed:', error);
    }
  } catch (err) {
    console.error('[BUDGET] Exception during atomic release:', err);
  }
}

// Export types for external use
export type SupabaseClient = ReturnType<typeof getSupabaseClient>;
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];