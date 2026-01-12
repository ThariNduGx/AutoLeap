import { getSupabaseClient, reserveBudget, commitReservedBudget } from './supabase';

// OpenAI Pricing (as of Nov 2024)
const MODEL_COSTS = {
  'gpt-4o': {
    input: 2.50 / 1_000_000,
    output: 10.00 / 1_000_000,
  },
  'gpt-4o-mini': {
    input: 0.150 / 1_000_000,
    output: 0.600 / 1_000_000,
  },
  'text-embedding-3-small': {
    input: 0.020 / 1_000_000,
    output: 0,
  },
  // Gemini pricing (for estimation when switching to paid)
  'gemini-1.5-flash': {
    input: 0.075 / 1_000_000,
    output: 0.300 / 1_000_000,
  },
  'gemini-1.5-pro': {
    input: 1.25 / 1_000_000,
    output: 5.00 / 1_000_000,
  },
  'gemini-2.5-flash': {
    input: 0.075 / 1_000_000,
    output: 0.300 / 1_000_000,
  },
  'gemini-flash-latest': {
    input: 0.075 / 1_000_000, // Standard Flash pricing
    output: 0.300 / 1_000_000,
  },
  'text-embedding-004': {
    input: 0.000 / 1_000_000, // Free tier
    output: 0,
  },
} as const;

export type ModelName = keyof typeof MODEL_COSTS;

export interface CostEstimate {
  estimatedCost: number;
  model: ModelName;
  estimatedTokensIn: number;
  estimatedTokensOut: number;
}

/**
 * Estimates cost for a given model and message length.
 */
export function estimateCost(
  model: ModelName,
  inputText: string,
  expectedOutputTokens: number = 300
): CostEstimate {
  const estimatedTokensIn = Math.ceil(inputText.length / 3);
  const estimatedTokensOut = expectedOutputTokens;

  const costs = MODEL_COSTS[model];
  const estimatedCost =
    estimatedTokensIn * costs.input + estimatedTokensOut * costs.output;

  return {
    estimatedCost,
    model,
    estimatedTokensIn,
    estimatedTokensOut,
  };
}

/**
 * Reserve budget before making AI calls.
 */
export async function requestBudget(
  businessId: string,
  estimate: CostEstimate
): Promise<boolean> {
  const safetyMargin = estimate.estimatedCost * 1.2;

  console.log('[COST] Requesting budget:', {
    businessId,
    model: estimate.model,
    estimatedCost: estimate.estimatedCost.toFixed(6),
    withMargin: safetyMargin.toFixed(6),
  });

  const reserved = await reserveBudget(businessId, safetyMargin);

  if (!reserved) {
    console.warn('[COST] ⚠️ Budget exceeded for business:', businessId);
  }

  return reserved;
}

/**
 * Track daily aggregated cost
 */
async function trackDailyCost(
  businessId: string,
  cost: number,
  isCacheHit: boolean = false
) {
  const supabase = getSupabaseClient();
  const date = new Date().toISOString().split('T')[0];

  try {
    // We use a stored procedure or just an upsert if logic allows. 
    // For simplicity with RLS and upserts, we'll try to fetch-update or upsert.
    // However, concurrent upserts can be tricky. A simpler way for this MVP:
    // We will just insert/update blindly assuming low concurrency for a single biz.

    // First, try to get existing record
    const { data: existing } = await (supabase
      .from('business_costs') as any)
      .select('*')
      .eq('business_id', businessId)
      .eq('date', date)
      .single();

    if (existing) {
      // Update
      const newTotal = existing.total_cost + cost;
      const newCount = existing.query_count + 1;
      const newHits = existing.cache_hits + (isCacheHit ? 1 : 0);

      await (supabase
        .from('business_costs') as any)
        .update({
          total_cost: newTotal,
          query_count: newCount,
          cache_hits: newHits,
        })
        .eq('id', existing.id);
    } else {
      // Insert
      await (supabase
        .from('business_costs') as any)
        .insert({
          business_id: businessId,
          date: date,
          total_cost: cost,
          query_count: 1,
          cache_hits: isCacheHit ? 1 : 0,
        });
    }
  } catch (err) {
    console.error('[COST] Failed to track daily cost:', err);
  }
}

/**
 * Log actual cost after API call completes.
 */
export async function commitCost(
  businessId: string,
  actualCost: number,
  model: ModelName | 'cache',
  tokensIn: number,
  tokensOut: number
): Promise<void> {
  const supabase = getSupabaseClient();

  try {
    // 1. Log the cost (detailed)
    if (model !== 'cache') {
      const { error: logError } = await (supabase.from('cost_logs') as any).insert({
        business_id: businessId,
        amount_usd: actualCost,
        model_used: model,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
      });

      if (logError) {
        console.error('[COST] Failed to log cost:', logError);
      }
    }

    // 2. Track daily aggregate
    await trackDailyCost(businessId, actualCost, model === 'cache');

    // 3. Move from pending to current usage
    const committed = await commitReservedBudget(businessId, actualCost);

    if (!committed) {
      console.error('[COST] Failed to commit budget');
    }

    console.log('[COST] ✅ Committed:', {
      businessId,
      amount: actualCost.toFixed(6),
      model,
      tokens: `${tokensIn}→${tokensOut}`,
    });
  } catch (err) {
    console.error('[COST] Exception during cost commit:', err);
  }
}

/**
 * Release reserved budget if AI call was never made.
 */
export async function releaseBudget(
  businessId: string,
  reservedAmount: number
): Promise<void> {
  const supabase = getSupabaseClient();

  try {
    // Get current pending usage first
    const { data: currentBudget, error: fetchError } = await (supabase
      .from('budgets') as any)
      .select('pending_usage_usd')
      .eq('business_id', businessId)
      .single();

    if (fetchError) {
      console.error('[COST] Failed to fetch budget:', fetchError);
      return;
    }

    if (currentBudget) {
      const newPending = Math.max(0, (currentBudget as any).pending_usage_usd - reservedAmount);

      const { error } = await (supabase
        .from('budgets') as any)
        .update({ pending_usage_usd: newPending })
        .eq('business_id', businessId);

      if (error) {
        console.error('[COST] Failed to release budget:', error);
      } else {
        console.log('[COST] 🔓 Released:', reservedAmount.toFixed(6));
      }
    }
  } catch (err) {
    console.error('[COST] Exception during budget release:', err);
  }
}

/**
 * Calculate actual cost from OpenAI API response.
 */
export function calculateActualCost(
  model: ModelName,
  tokensIn: number,
  tokensOut: number
): number {
  const costs = MODEL_COSTS[model];
  return tokensIn * costs.input + tokensOut * costs.output;
}