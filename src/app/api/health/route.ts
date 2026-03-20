import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health
 *
 * Health check endpoint for uptime monitors and load balancers.
 * Verifies Supabase connectivity and returns queue depth.
 * Returns 200 when healthy, 503 when degraded.
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; latencyMs?: number; detail?: string }> = {};

  // ── Supabase connectivity ─────────────────────────────────────────────────
  const supabaseStart = Date.now();
  try {
    const supabase = getSupabaseClient();
    const { error } = await (supabase
      .from('businesses') as any)
      .select('id')
      .limit(1);

    checks.supabase = {
      ok: !error,
      latencyMs: Date.now() - supabaseStart,
      detail: error?.message,
    };
  } catch (err) {
    checks.supabase = {
      ok: false,
      latencyMs: Date.now() - supabaseStart,
      detail: err instanceof Error ? err.message : 'Unknown error',
    };
  }

  // ── Queue depth ───────────────────────────────────────────────────────────
  try {
    const supabase = getSupabaseClient();
    const { count } = await (supabase
      .from('request_queue') as any)
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    checks.queue = { ok: true, detail: `${count ?? 0} pending items` };
  } catch {
    checks.queue = { ok: false, detail: 'Could not read queue' };
  }

  // ── Redis (optional — only check if configured) ───────────────────────────
  if (process.env.UPSTASH_REDIS_REST_URL) {
    const redisStart = Date.now();
    try {
      const { Redis } = await import('@upstash/redis');
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });
      await redis.ping();
      checks.redis = { ok: true, latencyMs: Date.now() - redisStart };
    } catch (err) {
      checks.redis = {
        ok: false,
        latencyMs: Date.now() - redisStart,
        detail: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  const allHealthy = Object.values(checks).every(c => c.ok);
  const status = allHealthy ? 200 : 503;

  return NextResponse.json(
    {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status }
  );
}
