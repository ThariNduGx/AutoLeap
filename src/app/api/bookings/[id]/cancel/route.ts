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
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('business_id', businessId) as any);

    if (updateError) {
        return NextResponse.json({ error: 'Failed to cancel appointment' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
