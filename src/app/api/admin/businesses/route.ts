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

        // Get FAQ counts for each business
        const businessesWithStats = await Promise.all(
            (businesses || []).map(async (business: any) => {
                // Count FAQs
                const { count: faqCount } = await (supabase
                    .from('faqs') as any)
                    .select('*', { count: 'exact', head: true })
                    .eq('business_id', business.id);

                return {
                    id: business.id,
                    name: business.name,
                    owner: business.users ? {
                        email: business.users.email,
                        name: business.users.name,
                    } : null,
                    integrations: {
                        telegram: !!business.telegram_bot_token,
                        facebook: !!business.fb_page_id,
                    },
                    facebookPageName: business.fb_page_name,
                    faqCount: faqCount || 0,
                    createdAt: business.created_at,
                };
            })
        );

        return NextResponse.json({
            success: true,
            businesses: businessesWithStats,
        });

    } catch (error) {
        console.error('[ADMIN API] Exception:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
