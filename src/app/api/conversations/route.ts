import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import { getSession, hasRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/conversations
 * Returns the 50 most recent conversations for the authenticated business.
 */
export async function GET(req: NextRequest) {
    const session = await getSession(req);
    if (!session || !hasRole(session, 'business')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const businessId = session.businessId;
    if (!businessId) {
        return NextResponse.json({ error: 'No business' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    const { data, error } = await (supabase
        .from('conversations') as any)
        .select('id, customer_chat_id, intent, status, last_message_at, created_at, history, state')
        .eq('business_id', businessId)
        .order('last_message_at', { ascending: false })
        .limit(50);

    if (error) {
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json(data || []);
}

/**
 * PATCH /api/conversations/:id
 * Toggle manual takeover (status: 'human' | 'ai')
 * Handled separately — see /api/conversations/[id]/route.ts
 */
