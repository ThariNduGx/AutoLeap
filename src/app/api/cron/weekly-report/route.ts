import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET/POST /api/cron/weekly-report
 *
 * Sends a weekly activity digest to every active business owner.
 * Intended to run every Monday at 08:00 UTC via Vercel Cron:
 *   { "path": "/api/cron/weekly-report", "schedule": "0 8 * * 1" }
 */
export async function GET(req: Request) {
  // Auth
  const { searchParams } = new URL(req.url);
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return new NextResponse('CRON_SECRET not set', { status: 500 });

  const isValid =
    req.headers.get('authorization') === `Bearer ${cronSecret}` ||
    searchParams.get('key') === cronSecret;

  if (!isValid) return new NextResponse('Unauthorized', { status: 401 });

  const supabase = getSupabaseClient();

  // Date range: last 7 days
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const weekAgoStr = weekAgo.toISOString();

  const weekStart = weekAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const weekEnd = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Fetch all active businesses with owner email
  const { data: businesses } = await (supabase
    .from('businesses') as any)
    .select('id, name, timezone, users:user_id (email)')
    .eq('is_active', true);

  if (!businesses?.length) {
    return NextResponse.json({ success: true, sent: 0 });
  }

  let sent = 0;

  for (const biz of businesses) {
    const ownerEmail = (biz.users as any)?.email;
    if (!ownerEmail) continue;

    try {
      // Run all queries in parallel for this business
      const [bookingsRes, cancellationsRes, conversationsRes, faqsRes, costRes] = await Promise.all([
        // New bookings this week
        (supabase.from('appointments') as any)
          .select('id', { count: 'exact', head: true })
          .eq('business_id', biz.id)
          .gte('created_at', weekAgoStr),

        // Cancellations this week
        (supabase.from('appointments') as any)
          .select('id', { count: 'exact', head: true })
          .eq('business_id', biz.id)
          .eq('status', 'cancelled')
          .gte('created_at', weekAgoStr),

        // Conversations this week
        (supabase.from('conversations') as any)
          .select('id', { count: 'exact', head: true })
          .eq('business_id', biz.id)
          .gte('created_at', weekAgoStr),

        // Top FAQs by hit count
        (supabase.from('faq_documents') as any)
          .select('question, hit_count')
          .eq('business_id', biz.id)
          .gt('hit_count', 0)
          .order('hit_count', { ascending: false })
          .limit(5),

        // AI cost this week (sum from cost_logs)
        (supabase.from('cost_logs') as any)
          .select('amount_usd')
          .eq('business_id', biz.id)
          .gte('created_at', weekAgoStr),
      ]);

      const totalCost = (costRes.data || []).reduce(
        (sum: number, r: any) => sum + (r.amount_usd || 0), 0
      );

      const { sendWeeklySummaryEmail } = await import('@/lib/infrastructure/email');
      await sendWeeklySummaryEmail({
        toEmail: ownerEmail,
        businessName: biz.name,
        weekStart,
        weekEnd,
        newBookings: bookingsRes.count ?? 0,
        cancellations: cancellationsRes.count ?? 0,
        conversations: conversationsRes.count ?? 0,
        topFAQs: (faqsRes.data || []).map((f: any) => ({ question: f.question, hits: f.hit_count })),
        aiCostUsd: totalCost,
      });

      sent++;
      console.log(`[WEEKLY] ✅ Sent summary to ${ownerEmail} (${biz.name})`);
    } catch (err) {
      console.error(`[WEEKLY] Failed for business ${biz.id}:`, err);
    }
  }

  return NextResponse.json({ success: true, sent, weekStart, weekEnd });
}

export async function POST(req: Request) {
  return GET(req);
}
