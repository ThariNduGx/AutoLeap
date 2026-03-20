import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import { getSession, hasRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const session = await getSession(req);

    if (!session || !hasRole(session, 'business')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const businessId = session.businessId;
    if (!businessId) {
        return NextResponse.json({ error: 'No business associated with this account' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await (supabase
        .from('businesses') as any)
        .select('id, name, telegram_bot_token, fb_page_id, fb_page_name, google_calendar_token')
        .eq('id', businessId)
        .single();

    if (error) {
        return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Never expose OAuth tokens to the client — return a boolean flag only
    return NextResponse.json({
        id: data.id,
        name: data.name,
        telegram_bot_token: data.telegram_bot_token,
        fb_page_id: data.fb_page_id,
        fb_page_name: data.fb_page_name,
        has_google_calendar: !!data.google_calendar_token,
    });
}

export async function POST(req: NextRequest) {
    const session = await getSession(req);

    if (!session || !hasRole(session, 'business')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const businessId = session.businessId;
    if (!businessId) {
        return NextResponse.json({ error: 'No business associated with this account' }, { status: 400 });
    }

    try {
        const body = await req.json();
        const { name, phone, description, business_hours } = body;

        const updates: Record<string, unknown> = {};

        if (name !== undefined) {
            if (typeof name !== 'string' || name.trim().length === 0) {
                return NextResponse.json({ error: 'Name must be a non-empty string' }, { status: 400 });
            }
            updates.name = name.trim().slice(0, 120);
        }
        if (phone !== undefined) {
            if (typeof phone !== 'string') {
                return NextResponse.json({ error: 'Phone must be a string' }, { status: 400 });
            }
            updates.phone = phone.trim().slice(0, 30);
        }
        if (description !== undefined) {
            if (typeof description !== 'string') {
                return NextResponse.json({ error: 'Description must be a string' }, { status: 400 });
            }
            updates.description = description.trim().slice(0, 500);
        }
        if (business_hours !== undefined) {
            if (typeof business_hours !== 'object' || business_hours === null || Array.isArray(business_hours)) {
                return NextResponse.json({ error: 'business_hours must be an object' }, { status: 400 });
            }
            updates.business_hours = business_hours;
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        const supabase = getSupabaseClient();
        const { error } = await (supabase
            .from('businesses') as any)
            .update(updates)
            .eq('id', businessId);

        if (error) {
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
