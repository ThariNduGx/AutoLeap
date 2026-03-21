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
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession(req);
    if (!session || !hasRole(session, 'business')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const businessId = session.businessId;
    if (!businessId) {
        return NextResponse.json({ error: 'No business' }, { status: 400 });
    }

    const { id: convId } = await params;
    const body = await req.json();

    const supabase = getSupabaseClient();
    const updates: Record<string, unknown> = {};

    // Status toggle
    if ('status' in body) {
        const ALLOWED_STATUSES = ['ai', 'human', 'escalated'];
        if (!ALLOWED_STATUSES.includes(body.status)) {
            return NextResponse.json(
                { error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}` },
                { status: 400 }
            );
        }
        updates.status = body.status;
    }

    // Internal notes (owner-only, never sent to customer)
    if ('notes' in body) {
        updates.notes = body.notes ?? null;
    }

    // Tags array (e.g. ["vip", "follow-up"])
    if ('tags' in body) {
        if (!Array.isArray(body.tags)) {
            return NextResponse.json({ error: 'tags must be an array' }, { status: 400 });
        }
        updates.tags = body.tags.map((t: unknown) => String(t).trim()).filter(Boolean);
    }

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
    }

    // Update scoped to this business for security
    const { data, error } = await (supabase
        .from('conversations') as any)
        .update(updates)
        .eq('id', convId)
        .eq('business_id', businessId)
        .select('id, status, notes, tags')
        .single();

    if (error || !data) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    console.log(`[CONVERSATIONS] Updated conv ${convId}:`, Object.keys(updates));
    return NextResponse.json({ success: true, ...data });
}
