import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';

/**
 * GET /api/dashboard/stats
 * 
 * Get dashboard statistics for the logged-in business user
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getSession(request);

        if (!session || !hasRole(session, 'business')) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 403 }
            );
        }

        const businessId = session.businessId;

        if (!businessId) {
            return NextResponse.json(
                { error: 'No business associated with this account' },
                { status: 400 }
            );
        }

        const supabase = getSupabaseClient();

        // Fetch business details
        const { data: business } = await (supabase
            .from('businesses') as any)
            .select('name, telegram_bot_token, fb_page_id')
            .eq('id', businessId)
            .single();

        // Count FAQs (stored in faq_documents, not faqs)
        const { count: faqCount } = await (supabase
            .from('faq_documents') as any)
            .select('*', { count: 'exact', head: true })
            .eq('business_id', businessId);

        // Count processed messages (from request_queue with status 'completed')
        const { count: messageCount } = await (supabase
            .from('request_queue') as any)
            .select('*', { count: 'exact', head: true })
            .eq('business_id', businessId)
            .eq('status', 'completed');

        return NextResponse.json({
            businessName: business?.name || 'Your Business',
            userName: session.name,
            totalMessages: messageCount || 0,
            totalFAQs: faqCount || 0,
            telegramConnected: !!business?.telegram_bot_token,
            facebookConnected: !!business?.fb_page_id,
        });

    } catch (error: any) {
        console.error('[DASHBOARD STATS] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch dashboard stats', details: error.message },
            { status: 500 }
        );
    }
}
