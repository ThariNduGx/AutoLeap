
import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('businessId') || process.env.DEFAULT_BUSINESS_ID;
    const days = parseInt(searchParams.get('days') || '30');

    if (!businessId) {
        return NextResponse.json({ error: 'Business ID required' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Calculate start date
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
            console.error('[API] Failed to fetch costs:', error);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        // Calculate totals
        const totalCost = data?.reduce((sum: number, day: any) => sum + day.total_cost, 0) || 0;
        const totalQueries = data?.reduce((sum: number, day: any) => sum + day.query_count, 0) || 0;
        const totalHits = data?.reduce((sum: number, day: any) => sum + day.cache_hits, 0) || 0;

        // Avoid division by zero
        const hitRate = totalQueries > 0 ? (totalHits / totalQueries) : 0;
        const avgCostPerQuery = totalQueries > 0 ? (totalCost / totalQueries) : 0;

        return NextResponse.json({
            daily: data || [],
            summary: {
                totalCost,
                avgDailyCost: totalCost / days,
                projectedMonthly: (totalCost / days) * 30,
                cacheHitRate: hitRate,
                avgCostPerQuery
            }
        });

    } catch (error) {
        console.error('[API] Exception:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
