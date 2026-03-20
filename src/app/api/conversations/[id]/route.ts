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
    const newStatus: string = body.status;

    const ALLOWED_STATUSES = ['ai', 'human', 'escalated'];
    if (!ALLOWED_STATUSES.includes(newStatus)) {
        return NextResponse.json(
            { error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}` },
            { status: 400 }
        );
    }

    const supabase = getSupabaseClient();

    // Update in one query, scoped to this business for security
    const { data, error } = await (supabase
        .from('conversations') as any)
        .update({ status: newStatus })
        .eq('id', params.id)
        .eq('business_id', businessId)
        .select('id, status')
        .single();

    if (error || !data) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    console.log(`[CONVERSATIONS] Status → ${newStatus} for conv ${params.id}`);
    return NextResponse.json({ success: true, status: data.status });
}
