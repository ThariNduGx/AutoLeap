import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import { getSession, hasRole } from '@/lib/auth/session';
import { cancelAppointment } from '@/lib/infrastructure/calendar';

export const dynamic = 'force-dynamic';

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getSession(req);

    if (!session || !hasRole(session, 'business')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const businessId = session.businessId;
    if (!businessId) {
        return NextResponse.json({ error: 'No business associated with this account' }, { status: 400 });
    }

    const { id } = params;
    const supabase = getSupabaseClient();

    // Fetch the appointment and verify ownership
    const { data: appointment, error: fetchError } = await (supabase
        .from('appointments')
        .select('id, status, google_event_id, appointment_date')
        .eq('id', id)
        .eq('business_id', businessId)
        .single() as any);

    if (fetchError || !appointment) {
        return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    if (appointment.status !== 'scheduled') {
        return NextResponse.json({ error: 'Only scheduled appointments can be cancelled' }, { status: 400 });
    }

    // Cancel the Google Calendar event if one exists
    if (appointment.google_event_id) {
        await cancelAppointment(businessId, appointment.google_event_id);
    }

    // Update DB status
    const { error: updateError } = await (supabase
        .from('appointments') as any)
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('business_id', businessId);

    if (updateError) {
        return NextResponse.json({ error: 'Failed to cancel appointment' }, { status: 500 });
    }

    // ── Waitlist auto-notify ──────────────────────────────────────────────────
    // After a cancellation, notify the first unnotified waitlist entry for the
    // same service (and optionally same date) so they can grab the freed slot.
    notifyWaitlist(supabase, businessId, appointment).catch(() => {});

    return NextResponse.json({ success: true });
}

async function notifyWaitlist(supabase: any, businessId: string, cancelledAppt: any) {
    // Fetch the service_type from the appointment (need to re-query since we only
    // selected id, status, google_event_id, appointment_date earlier)
    const { data: apptFull } = await (supabase.from('appointments') as any)
        .select('service_type, appointment_date')
        .eq('id', cancelledAppt.id)
        .single();
    if (!apptFull?.service_type) return;

    // Find first un-notified waitlist entry for this service at this business
    const { data: entry } = await (supabase.from('waitlist') as any)
        .select('id, customer_chat_id, customer_name, service_type, preferred_date, platform')
        .eq('business_id', businessId)
        .eq('service_type', apptFull.service_type)
        .is('notified_at', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (!entry || !entry.customer_chat_id) return;

    // Fetch business bot token
    const { data: biz } = await (supabase.from('businesses') as any)
        .select('telegram_bot_token, name')
        .eq('id', businessId)
        .single();

    if (!biz?.telegram_bot_token || entry.platform !== 'telegram') return;

    const msg = `🎉 *Spot Available!*\n\nGood news, ${entry.customer_name ? entry.customer_name.split(' ')[0] : 'there'}! A spot just opened up for *${entry.service_type}* on ${apptFull.appointment_date} at *${biz.name}*.\n\nReply "book" to secure your appointment now — slots go fast!`;

    const res = await fetch(`https://api.telegram.org/bot${biz.telegram_bot_token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: entry.customer_chat_id, text: msg, parse_mode: 'Markdown' }),
    });

    if (res.ok) {
        // Mark as notified so we don't ping them again
        await (supabase.from('waitlist') as any)
            .update({ notified_at: new Date().toISOString() })
            .eq('id', entry.id);
        console.log('[WAITLIST] Notified customer:', entry.customer_chat_id, 'for service:', entry.service_type);
    }
}
