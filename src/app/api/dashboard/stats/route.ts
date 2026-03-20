import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';

/**
 * GET /api/dashboard/stats
 *
 * Returns dashboard statistics for the logged-in business user.
 * Response is intentionally kept lean — only the counters the UI needs.
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getSession(request);

        if (!session || !hasRole(session, 'business')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const businessId = session.businessId;
        if (!businessId) {
            return NextResponse.json({ error: 'No business associated with this account' }, { status: 400 });
        }

        const supabase = getSupabaseClient();

        // Run all independent queries in parallel
        const today = new Date().toISOString().split('T')[0];
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const [
            businessRes,
            faqCountRes,
            messageCountRes,
            todayApptsRes,
            bookingAttemptsRes,
        ] = await Promise.all([
            (supabase.from('businesses') as any)
                .select('name, telegram_bot_token, fb_page_id')
                .eq('id', businessId)
                .single(),

            (supabase.from('faq_documents') as any)
                .select('*', { count: 'exact', head: true })
                .eq('business_id', businessId),

            (supabase.from('request_queue') as any)
                .select('*', { count: 'exact', head: true })
                .eq('business_id', businessId)
                .eq('status', 'completed'),

            // Appointments scheduled for today
            (supabase.from('appointments') as any)
                .select('*', { count: 'exact', head: true })
                .eq('business_id', businessId)
                .eq('appointment_date', today)
                .eq('status', 'scheduled'),

            // Booking attempts in the last 30 days for completion rate
            (supabase.from('booking_attempts') as any)
                .select('success')
                .eq('business_id', businessId)
                .gte('created_at', thirtyDaysAgo),
        ]);

        const business = businessRes.data;

        // Calculate booking completion rate
        const attempts: { success: boolean }[] = bookingAttemptsRes.data || [];
        const totalAttempts = attempts.length;
        const successfulAttempts = attempts.filter((a) => a.success).length;
        const bookingCompletionRate =
            totalAttempts > 0 ? Math.round((successfulAttempts / totalAttempts) * 100) : null;

        return NextResponse.json({
            businessName: business?.name || 'Your Business',
            userName: session.name,
            totalMessages: messageCountRes.count || 0,
            totalFAQs: faqCountRes.count || 0,
            telegramConnected: !!business?.telegram_bot_token,
            facebookConnected: !!business?.fb_page_id,
            todayAppointments: todayApptsRes.count || 0,
            bookingCompletionRate,     // percentage 0-100, or null if no data
            bookingAttempts: totalAttempts,
        });

    } catch (error: any) {
        console.error('[DASHBOARD STATS] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch dashboard stats' },
            { status: 500 }
        );
    }
}
