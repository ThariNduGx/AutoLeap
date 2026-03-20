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
  // Free-tier models (Gemini) have $0 cost — always approve without calling the DB
  if (estimate.estimatedCost === 0) {
    return true;
  }

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
 * Track daily aggregated cost using atomic upsert (no race condition).
 */
async function trackDailyCost(
  businessId: string,
  cost: number,
  isCacheHit: boolean = false
) {
  const supabase = getSupabaseClient();
  const date = new Date().toISOString().split('T')[0];

  try {
    await (supabase.rpc as any)('upsert_daily_cost', {
      p_business_id: businessId,
      p_date: date,
      p_cost: cost,
      p_is_cache: isCacheHit,
    });
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

    // 4. Check budget thresholds and send alert if needed (fire-and-forget)
    checkBudgetAlert(businessId).catch(err =>
      console.warn('[COST] Budget alert check failed (non-fatal):', err)
    );
  } catch (err) {
    console.error('[COST] Exception during cost commit:', err);
  }
}

/**
 * Check if budget usage has crossed a warning threshold (80% or 95%)
 * and send an alert email if we haven't already sent one today.
 */
async function checkBudgetAlert(businessId: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { data: budget } = await (supabase
    .from('budgets') as any)
    .select('current_usage_usd, monthly_budget_usd, budget_alert_sent_at')
    .eq('business_id', businessId)
    .single();

  if (!budget || !budget.monthly_budget_usd || budget.monthly_budget_usd <= 0) return;

  const usagePercent = (budget.current_usage_usd / budget.monthly_budget_usd) * 100;

  // Only alert at >= 80%
  if (usagePercent < 80) return;

  // Don't send more than once per 24 hours
  if (budget.budget_alert_sent_at) {
    const lastSent = new Date(budget.budget_alert_sent_at).getTime();
    if (Date.now() - lastSent < 24 * 60 * 60 * 1000) return;
  }

  // Fetch owner email
  const { data: biz } = await (supabase
    .from('businesses') as any)
    .select('name, users:user_id (email)')
    .eq('id', businessId)
    .single();

  const ownerEmail = (biz?.users as any)?.email;
  if (!ownerEmail || !biz?.name) return;

  const { sendBudgetAlertEmail } = await import('./email');
  await sendBudgetAlertEmail({
    toEmail: ownerEmail,
    businessName: biz.name,
    usagePercent,
    currentUsageUsd: budget.current_usage_usd,
    monthlyBudgetUsd: budget.monthly_budget_usd,
  });

  // Record that we sent the alert so we don't spam
  await (supabase
    .from('budgets') as any)
    .update({ budget_alert_sent_at: new Date().toISOString() })
    .eq('business_id', businessId);
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