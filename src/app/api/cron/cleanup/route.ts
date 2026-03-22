import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET/POST /api/cron/cleanup
 *
 * Nightly maintenance cron job.
 * Purges:
 *   - Completed/dead-lettered queue items older than 7 days
 *   - Stuck "processing" items older than 1 hour (presumed crashed)
 *   - Expired conversations older than 30 days
 *
 * Authorization: CRON_SECRET via Bearer header or ?key= query param.
 * Add to vercel.json: { "path": "/api/cron/cleanup", "schedule": "0 2 * * *" }
 */
export async function GET(req: Request) {
  try {
    // Auth — header only; query-param key is intentionally not supported (would log secret)
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return new NextResponse('Server misconfiguration: CRON_SECRET not set', { status: 500 });
    }
    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      console.warn('[CLEANUP CRON] Unauthorized request');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    console.log('[CLEANUP CRON] Starting maintenance...');
    const start = Date.now();

    const supabase = getSupabaseClient();

    // 1. Purge stale queue items via DB function
    const { data: queueDeleted, error: queueErr } = await (supabase.rpc as any)(
      'cleanup_stale_queue_items'
    );

    if (queueErr) {
      console.error('[CLEANUP CRON] Queue cleanup error:', queueErr);
    } else {
      console.log(`[CLEANUP CRON] Removed ${queueDeleted ?? 0} stale queue items`);
    }

    // 2. Purge stale conversations via DB function
    const { data: convDeleted, error: convErr } = await (supabase.rpc as any)(
      'cleanup_stale_conversations'
    );

    if (convErr) {
      console.error('[CLEANUP CRON] Conversation cleanup error:', convErr);
    } else {
      console.log(`[CLEANUP CRON] Removed ${convDeleted ?? 0} stale conversations`);
    }

    // 3. Nightly: reconcile any pending_usage_usd stuck > 15 min (crash survivors)
    const { data: pendingReset, error: pendingErr } = await (supabase.rpc as any)(
      'reset_stale_pending_budgets'
    );
    if (pendingErr) {
      console.error('[CLEANUP CRON] Pending budget reconciliation error:', pendingErr);
    } else if ((pendingReset ?? 0) > 0) {
      console.warn(`[CLEANUP CRON] ⚠️ Reconciled ${pendingReset} budgets with stale pending_usage_usd`);
    }

    // 4. Monthly: on the 1st, reset current_usage_usd and budget alert flags
    //    current_usage_usd is a running total — without a monthly reset the
    //    "monthly" cap becomes a lifetime cap and businesses are permanently blocked.
    const today = new Date();
    if (today.getDate() === 1) {
      const { data: budgetsReset, error: budgetResetErr } = await (supabase.rpc as any)(
        'reset_monthly_budgets'
      );
      if (budgetResetErr) {
        console.error('[CLEANUP CRON] Monthly budget reset error:', budgetResetErr);
      } else {
        console.log(`[CLEANUP CRON] Reset monthly usage for ${budgetsReset ?? 0} budgets`);
      }

      // Also clear the per-business alert dedup flag so owners get alerted again
      const { error: alertResetErr } = await (supabase
        .from('budgets') as any)
        .update({ budget_alert_sent_at: null })
        .not('budget_alert_sent_at', 'is', null);
      if (alertResetErr) {
        console.error('[CLEANUP CRON] Budget alert reset error:', alertResetErr);
      } else {
        console.log('[CLEANUP CRON] Reset monthly budget alert flags');
      }
    }

    const duration = Date.now() - start;
    console.log(`[CLEANUP CRON] ✅ Completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      queueItemsRemoved: queueDeleted ?? 0,
      conversationsRemoved: convDeleted ?? 0,
      stalePendingBudgetsReconciled: pendingReset ?? 0,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[CLEANUP CRON] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
