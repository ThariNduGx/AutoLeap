import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';

/**
 * GET /api/admin/stats
 *
 * Returns real platform-wide statistics for the admin overview.
 * Admin-only.
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getSession(request);

        if (!session || !hasRole(session, 'admin')) {
            return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
        }

        const supabase = getSupabaseClient();

        // 1. Business counts with integration breakdown
        const { data: businesses, error: bizError } = await (supabase
            .from('businesses') as any)
            .select('id, name, telegram_bot_token, fb_page_id, created_at')
            .order('created_at', { ascending: false });

        if (bizError) {
            console.error('[ADMIN STATS] businesses error:', bizError);
            return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
        }

        const bizList = businesses || [];
        const totalBusinesses = bizList.length;
        const telegramConnections = bizList.filter((b: any) => !!b.telegram_bot_token).length;
        const facebookConnections = bizList.filter((b: any) => !!b.fb_page_id).length;
        const recentBusinesses = bizList.slice(0, 5).map((b: any) => ({
            name: b.name,
            createdAt: b.created_at,
        }));

        // 2. Message queue counts by status
        const [completedRes, failedRes, pendingRes] = await Promise.all([
            (supabase.from('request_queue') as any)
                .select('*', { count: 'exact', head: true })
                .eq('status', 'completed'),
            (supabase.from('request_queue') as any)
                .select('*', { count: 'exact', head: true })
                .eq('status', 'failed'),
            (supabase.from('request_queue') as any)
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending'),
        ]);

        const messages = {
            completed: completedRes.count ?? 0,
            failed: failedRes.count ?? 0,
            pending: pendingRes.count ?? 0,
        };

        // 3. Total platform cost
        const { data: costData } = await (supabase
            .from('business_costs') as any)
            .select('total_cost');

        const totalCostUsd = (costData || []).reduce(
            (sum: number, row: any) => sum + (row.total_cost || 0),
            0
        );

        return NextResponse.json({
            success: true,
            totalBusinesses,
            telegramConnections,
            facebookConnections,
            messages,
            totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
            recentBusinesses,
        });

    } catch (error) {
        console.error('[ADMIN STATS] Exception:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
