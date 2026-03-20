import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import { rateLimit } from '@/lib/infrastructure/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/analytics?days=30
 *
 * Returns analytics data for the dashboard:
 * - Booking funnel (attempts vs successful)
 * - Intent distribution from conversations
 * - Peak booking hours from appointments
 * - Top FAQs by hit count
 * - Daily bookings trend
 */
export async function GET(req: NextRequest) {
    const rl = await rateLimit(req, 'analytics', { limit: 30, windowSeconds: 60 });
    if (!rl.allowed) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const session = await getSession(req);
    if (!session || !hasRole(session, 'business')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const businessId = session.businessId;
    if (!businessId) {
        return NextResponse.json({ error: 'No business' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const days = Math.min(90, Math.max(7, parseInt(searchParams.get('days') || '30') || 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const supabase = getSupabaseClient();

    const [
        attemptsRes,
        conversationsRes,
        appointmentsRes,
        topFAQsRes,
    ] = await Promise.all([
        // Booking attempts for funnel
        (supabase.from('booking_attempts') as any)
            .select('success, failure_reason, turns_taken, created_at, platform')
            .eq('business_id', businessId)
            .gte('created_at', since)
            .order('created_at', { ascending: true }),

        // Conversations for intent breakdown
        (supabase.from('conversations') as any)
            .select('intent, status, created_at')
            .eq('business_id', businessId)
            .gte('created_at', since),

        // Appointments for peak hours and daily trend
        (supabase.from('appointments') as any)
            .select('appointment_date, appointment_time, status, platform, created_at')
            .eq('business_id', businessId)
            .gte('created_at', since)
            .order('appointment_date', { ascending: true }),

        // Top FAQs by hit count
        (supabase.from('faq_documents') as any)
            .select('question, category, hit_count')
            .eq('business_id', businessId)
            .gt('hit_count', 0)
            .order('hit_count', { ascending: false })
            .limit(10),
    ]);

    const attempts: any[] = attemptsRes.data || [];
    const conversations: any[] = conversationsRes.data || [];
    const appointments: any[] = appointmentsRes.data || [];
    const topFAQs: any[] = topFAQsRes.data || [];

    // ── Booking Funnel ──────────────────────────────────────
    const totalAttempts = attempts.length;
    const successful = attempts.filter(a => a.success).length;
    const failed = totalAttempts - successful;
    const avgTurns = attempts.length > 0
        ? Math.round(attempts.reduce((s, a) => s + (a.turns_taken || 0), 0) / attempts.length * 10) / 10
        : 0;

    // Failure reason breakdown
    const failureReasons: Record<string, number> = {};
    attempts.filter(a => !a.success && a.failure_reason).forEach(a => {
        failureReasons[a.failure_reason] = (failureReasons[a.failure_reason] || 0) + 1;
    });

    // Platform breakdown
    const byPlatform: Record<string, { attempts: number; success: number }> = {};
    attempts.forEach(a => {
        const p = a.platform || 'telegram';
        if (!byPlatform[p]) byPlatform[p] = { attempts: 0, success: 0 };
        byPlatform[p].attempts++;
        if (a.success) byPlatform[p].success++;
    });

    // ── Intent Distribution ─────────────────────────────────
    const intentCounts: Record<string, number> = {};
    conversations.forEach(c => {
        intentCounts[c.intent || 'unknown'] = (intentCounts[c.intent || 'unknown'] || 0) + 1;
    });
    const intentBreakdown = Object.entries(intentCounts)
        .map(([intent, count]) => ({ intent, count }))
        .sort((a, b) => b.count - a.count);

    // Escalation rate
    const escalated = conversations.filter(c => c.status === 'escalated').length;
    const humanTakeover = conversations.filter(c => c.status === 'human').length;

    // ── Peak Booking Hours ──────────────────────────────────
    const hourCounts: number[] = new Array(24).fill(0);
    appointments.forEach(a => {
        if (a.appointment_time) {
            const hour = parseInt(a.appointment_time.split(':')[0]);
            if (!isNaN(hour)) hourCounts[hour]++;
        }
    });
    const peakHours = hourCounts.map((count, hour) => ({
        hour: `${hour.toString().padStart(2, '0')}:00`,
        count,
    }));

    // ── Daily Bookings Trend ────────────────────────────────
    const dailyMap: Record<string, { scheduled: number; cancelled: number; completed: number }> = {};
    appointments.forEach(a => {
        const date = a.appointment_date;
        if (!date) return;
        if (!dailyMap[date]) dailyMap[date] = { scheduled: 0, cancelled: 0, completed: 0 };
        const status = a.status || 'scheduled';
        if (status in dailyMap[date]) {
            (dailyMap[date] as any)[status]++;
        }
    });
    const dailyBookings = Object.entries(dailyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, counts]) => ({ date, ...counts }));

    return NextResponse.json({
        period: { days, since },
        bookingFunnel: {
            totalAttempts,
            successful,
            failed,
            successRate: totalAttempts > 0 ? Math.round((successful / totalAttempts) * 100) : null,
            avgTurnsToBook: avgTurns,
            failureReasons: Object.entries(failureReasons)
                .map(([reason, count]) => ({ reason, count }))
                .sort((a, b) => b.count - a.count),
            byPlatform: Object.entries(byPlatform).map(([platform, data]) => ({
                platform,
                ...data,
                successRate: data.attempts > 0 ? Math.round((data.success / data.attempts) * 100) : 0,
            })),
        },
        conversations: {
            total: conversations.length,
            intentBreakdown,
            escalated,
            humanTakeover,
            escalationRate: conversations.length > 0
                ? Math.round((escalated / conversations.length) * 100)
                : 0,
        },
        appointments: {
            total: appointments.length,
            scheduled: appointments.filter(a => a.status === 'scheduled').length,
            completed: appointments.filter(a => a.status === 'completed').length,
            cancelled: appointments.filter(a => a.status === 'cancelled').length,
            noShow: appointments.filter(a => a.status === 'no_show').length,
            peakHours,
            dailyBookings,
        },
        topFAQs,
    });
}
