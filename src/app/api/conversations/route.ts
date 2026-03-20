import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import { getSession, hasRole } from '@/lib/auth/session';
import { rateLimit } from '@/lib/infrastructure/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/conversations?search=text&status=escalated&intent=booking&page=1
 * Returns paginated conversations for the authenticated business.
 * Supports searching by customer_chat_id, intent, or message content.
 */
export async function GET(req: NextRequest) {
    const rl = await rateLimit(req, 'conversations', { limit: 60, windowSeconds: 60 });
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
    const search = searchParams.get('search')?.trim() || '';
    const statusFilter = searchParams.get('status') || '';
    const intentFilter = searchParams.get('intent') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = 50;
    const offset = (page - 1) * limit;

    const supabase = getSupabaseClient();

    // If there's a message content search, delegate to DB RPC for JSONB search
    if (search) {
        const { data, error } = await (supabase.rpc as any)('search_conversations', {
            p_business_id: businessId,
            p_query: search,
            p_limit: limit,
            p_offset: offset,
        });

        if (error) {
            console.error('[CONVERSATIONS] Search RPC error:', error);
            // Fallback to simple chat_id search
        } else {
            return NextResponse.json(data || []);
        }
    }

    // Standard query with optional filters
    let query = (supabase
        .from('conversations') as any)
        .select('id, customer_chat_id, intent, status, last_message_at, created_at, history, state, notes, tags')
        .eq('business_id', businessId)
        .order('last_message_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (search) {
        query = query.ilike('customer_chat_id', `%${search}%`);
    }
    if (statusFilter) {
        query = query.eq('status', statusFilter);
    }
    if (intentFilter) {
        query = query.eq('intent', intentFilter);
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json(data || []);
}
