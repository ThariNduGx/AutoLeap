import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';

/**
 * POST /api/business/settings/facebook/disconnect
 * 
 * Disconnect Facebook Page from business account
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getSession(request);

        if (!session || !hasRole(session, 'business')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const supabase = getSupabaseClient();

        // Clear Facebook credentials
        const { error } = await (supabase
            .from('businesses') as any)
            .update({
                fb_page_id: null,
                fb_page_access_token: null,
                fb_page_name: null,
            })
            .eq('id', session.businessId);

        if (error) {
            console.error('[FACEBOOK DISCONNECT] Error:', error);
            return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[FACEBOOK DISCONNECT] Exception:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
