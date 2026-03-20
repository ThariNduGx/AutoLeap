import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';

/**
 * GET /api/business/settings
 * 
 * Fetch current business user's settings
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getSession(request);

        if (!session || !hasRole(session, 'business')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const supabase = getSupabaseClient();

        // Get business info for this user
        const { data: business, error } = await (supabase
            .from('businesses') as any)
            .select('id, name, telegram_bot_token, fb_page_id, fb_page_name, owner_telegram_chat_id, google_calendar_token, google_calendar_email, timezone, business_hours')
            .eq('id', session.businessId)
            .single();

        if (error || !business) {
            return NextResponse.json({ error: 'Business not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            business: {
                id: business.id,
                name: business.name,
                telegram_bot_token: business.telegram_bot_token,
                fb_page_id: business.fb_page_id,
                fb_page_name: business.fb_page_name,
                owner_telegram_chat_id: business.owner_telegram_chat_id,
                has_google_calendar: !!business.google_calendar_token,
                google_calendar_email: business.google_calendar_email || null,
                timezone: business.timezone || 'Asia/Colombo',
                business_hours: business.business_hours || null,
            },
        });

    } catch (error) {
        console.error('[BUSINESS API] Exception:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * PATCH /api/business/settings
 *
 * Update editable business fields. Only updates fields that are provided.
 */
export async function PATCH(request: NextRequest) {
    try {
        const session = await getSession(request);

        if (!session || !hasRole(session, 'business')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const body = await request.json();
        const allowed = ['owner_telegram_chat_id', 'name', 'phone', 'timezone', 'business_hours'] as const;

        // Only pick allowed fields from the request body
        const updates: Record<string, unknown> = {};
        for (const key of allowed) {
            if (key in body) {
                updates[key] = body[key];
            }
        }

        // Handle Google Calendar disconnect
        if (body.disconnect_google_calendar === true) {
            updates.google_calendar_token = null;
            updates.google_calendar_email = null;
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        const supabase = getSupabaseClient();
        const { error } = await (supabase
            .from('businesses') as any)
            .update(updates)
            .eq('id', session.businessId);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[BUSINESS API PATCH] Exception:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
