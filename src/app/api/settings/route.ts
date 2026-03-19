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

    return NextResponse.json(data);
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

        const supabase = getSupabaseClient();
        const { error } = await (supabase
            .from('businesses') as any)
            .update({ name, phone, description, business_hours })
            .eq('id', businessId);

        if (error) {
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
