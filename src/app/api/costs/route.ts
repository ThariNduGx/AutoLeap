import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import { getSession, hasRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const session = await getSession(req);

    if (!session || !hasRole(session, 'business')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const businessId = session.businessId;
    if (!businessId) {
        return NextResponse.json({ error: 'No business associated with this account' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    // Clamp days between 1 and 90 to prevent abuse
    const days = Math.min(90, Math.max(1, parseInt(searchParams.get('days') || '30') || 30));

    const supabase = getSupabaseClient();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    try {
        const { data, error } = await (supabase
            .from('business_costs') as any)
            .select('*')
            .eq('business_id', businessId)
            .gte('date', startDateStr)
            .order('date', { ascending: true });

        if (error) {
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        const rows = data || [];
        const totalCost = rows.reduce((sum: number, d: any) => sum + (d.total_cost || 0), 0);
        const totalQueries = rows.reduce((sum: number, d: any) => sum + (d.query_count || 0), 0);
        const totalHits = rows.reduce((sum: number, d: any) => sum + (d.cache_hits || 0), 0);

        // Compute the actual elapsed days from the earliest data row to today.
        // Using the requested `days` window as the denominator is wrong when the
        // business is newer than the window (e.g. 5 days old but days=30), which
        // would produce a 6x underestimate of projected monthly spend.
        const actualDays = rows.length > 0
            ? Math.max(1, Math.floor(
                (Date.now() - new Date(rows[0].date + 'T00:00:00Z').getTime()) / 86_400_000
              ) + 1)
            : days;

        // Fetch the budget for this business
        const { data: budget } = await (supabase
            .from('budgets') as any)
            .select('monthly_budget_usd')
            .eq('business_id', businessId)
            .single();

        return NextResponse.json({
            daily: rows,
            summary: {
                totalCost,
                avgDailyCost: actualDays > 0 ? totalCost / actualDays : 0,
                projectedMonthly: actualDays > 0 ? (totalCost / actualDays) * 30 : 0,
                cacheHitRate: totalQueries > 0 ? totalHits / totalQueries : 0,
                avgCostPerQuery: totalQueries > 0 ? totalCost / totalQueries : 0,
                monthlyBudget: budget?.monthly_budget_usd ?? null,
            },
        });
    } catch {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
