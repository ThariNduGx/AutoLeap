import { NextResponse } from 'next/server';
import { processQueue } from '@/lib/core/queue-processor';

// Force Node runtime (we need full Node.js for Supabase operations)
// export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cron endpoint that processes the queue.
 * Triggered manually or by Vercel Cron (configured in vercel.json).
 * 
 * Authorization: Uses CRON_SECRET for security.
 */
export async function GET(req: Request) {
  try {
    // 1. Verify this is a legitimate cron request.
    // Accepts two valid auth paths:
    //   a) Our own CRON_SECRET (used by triggerQueue() inside webhooks)
    //   b) Vercel's built-in cron invocation header (x-vercel-cron: 1)
    //      Vercel sends Authorization: Bearer {CRON_SECRET} automatically when
    //      CRON_SECRET is set, but also sets x-vercel-cron as a secondary signal.
    const cronSecret = process.env.CRON_SECRET;
    const isVercelCron = req.headers.get('x-vercel-cron') === '1';
    const hasValidSecret = cronSecret && req.headers.get('authorization') === `Bearer ${cronSecret}`;

    if (!isVercelCron && !hasValidSecret) {
      console.warn('[CRON] Unauthorized request — missing valid secret or Vercel cron header');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    console.log('[CRON] Starting queue processing...');
    const startTime = Date.now();

    // 2. Process up to 10 items per execution
    const processedCount = await processQueue(10);

    const duration = Date.now() - startTime;

    console.log(`[CRON] ✅ Completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      processedCount,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[CRON] Fatal error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(req: Request) {
  return GET(req);
}