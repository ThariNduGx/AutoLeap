import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';

/**
 * GET /api/admin/businesses
 * 
 * Fetch all businesses (admin only)
 * Returns business list with integration status and statistics
 */
export async function GET(request: NextRequest) {
    try {
        // Check authentication and authorization
        const session = await getSession(request);

        if (!session || !hasRole(session, 'admin')) {
            return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
        }

        const supabase = getSupabaseClient();

        // Fetch all businesses with user info and FAQ counts
        const { data: businesses, error } = await (supabase
            .from('businesses') as any)
            .select(`
        id,
        name,
        is_active,
        telegram_bot_token,
        fb_page_id,
        fb_page_name,
        created_at,
        user_id,
        users:user_id (
          email,
          name
        )
      `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[ADMIN API] Error fetching businesses:', error);
            return NextResponse.json({ error: 'Failed to fetch businesses' }, { status: 500 });
        }

        const bizList = businesses || [];
        const businessIds = bizList.map((b: any) => b.id);

        // Fetch all FAQ and message counts in two bulk queries (avoids N+1)
        const [faqBulk, msgBulk] = await Promise.all([
            businessIds.length > 0
                ? (supabase.from('faq_documents') as any)
                    .select('business_id')
                    .in('business_id', businessIds)
                : Promise.resolve({ data: [] }),
            businessIds.length > 0
                ? (supabase.from('request_queue') as any)
                    .select('business_id')
                    .in('business_id', businessIds)
                    .eq('status', 'completed')
                : Promise.resolve({ data: [] }),
        ]);

        // Build count maps in memory
        const faqCountMap = new Map<string, number>();
        const msgCountMap = new Map<string, number>();
        for (const row of (faqBulk.data || [])) {
            faqCountMap.set(row.business_id, (faqCountMap.get(row.business_id) || 0) + 1);
        }
        for (const row of (msgBulk.data || [])) {
            msgCountMap.set(row.business_id, (msgCountMap.get(row.business_id) || 0) + 1);
        }

        const businessesWithStats = bizList.map((business: any) => ({
            id: business.id,
            name: business.name,
            isActive: business.is_active !== false,
            owner: business.users ? {
                email: business.users.email,
                name: business.users.name,
            } : null,
            integrations: {
                telegram: !!business.telegram_bot_token,
                facebook: !!business.fb_page_id,
            },
            facebookPageName: business.fb_page_name,
            faqCount: faqCountMap.get(business.id) || 0,
            messageCount: msgCountMap.get(business.id) || 0,
            createdAt: business.created_at,
        }));

        return NextResponse.json({
            success: true,
            businesses: businessesWithStats,
        });

    } catch (error) {
        console.error('[ADMIN API] Exception:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
