import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import { getSession, hasRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/conversations/[id]
 * Toggle manual takeover. Body: { status: 'human' | 'ai' }
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getSession(req);
    if (!session || !hasRole(session, 'business')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const businessId = session.businessId;
    if (!businessId) {
        return NextResponse.json({ error: 'No business' }, { status: 400 });
    }

    const body = await req.json();
    const status = body.status === 'human' ? 'human' : 'ai';

    const supabase = getSupabaseClient();

    // Verify conversation belongs to this business
    const { data: conv } = await (supabase
        .from('conversations') as any)
        .select('id')
        .eq('id', params.id)
        .eq('business_id', businessId)
        .single();

    if (!conv) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { error } = await (supabase
        .from('conversations') as any)
        .update({ status })
        .eq('id', params.id);

    if (error) {
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, status });
}
