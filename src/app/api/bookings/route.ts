import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import { getSession, hasRole } from '@/lib/auth/session';
import { rateLimit } from '@/lib/infrastructure/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const rl = await rateLimit(req, 'bookings', { limit: 60, windowSeconds: 60 });
    if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const session = await getSession(req);
    if (!session || !hasRole(session, 'business')) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const format    = searchParams.get('format');    // 'csv'
    const dateFrom  = searchParams.get('date_from'); // YYYY-MM-DD
    const dateTo    = searchParams.get('date_to');   // YYYY-MM-DD

    const supabase = getSupabaseClient();
    let query = (supabase.from('appointments') as any)
        .select('id, customer_name, customer_phone, service_type, appointment_date, appointment_time, status, platform, notes, price, currency, duration_minutes, created_at')
        .eq('business_id', session.businessId)
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: false });

    if (dateFrom) query = query.gte('appointment_date', dateFrom);
    if (dateTo)   query = query.lte('appointment_date', dateTo);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });
    const rows = data || [];

    // ── CSV export ────────────────────────────────────────────────────────────
    if (format === 'csv') {
        const headers = ['Date', 'Time', 'Customer', 'Phone', 'Service', 'Status', 'Price', 'Currency', 'Duration (min)', 'Notes'];
        const csvRows = [
            headers.join(','),
            ...rows.map((b: any) => [
                b.appointment_date,
                b.appointment_time,
                `"${(b.customer_name || '').replace(/"/g, '""')}"`,
                b.customer_phone,
                `"${(b.service_type  || '').replace(/"/g, '""')}"`,
                b.status,
                b.price ?? '',
                b.currency ?? '',
                b.duration_minutes ?? '',
                `"${(b.notes || '').replace(/"/g, '""')}"`,
            ].join(',')),
        ];
        return new NextResponse(csvRows.join('\n'), {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="bookings_${dateFrom || 'all'}_to_${dateTo || 'all'}.csv"`,
            },
        });
    }

    return NextResponse.json(rows);
}

/** PATCH /api/bookings — bulk status update */
export async function PATCH(req: NextRequest) {
    const session = await getSession(req);
    if (!session || !hasRole(session, 'business')) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const body = await req.json();
    const ids: string[]   = Array.isArray(body.ids) ? body.ids : [];
    const newStatus: string = body.status;

    const ALLOWED_STATUSES = ['completed', 'no_show'];
    if (!ids.length || !ALLOWED_STATUSES.includes(newStatus)) {
        return NextResponse.json({ error: 'ids (array) and status (completed|no_show) required' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { error } = await (supabase.from('appointments') as any)
        .update({ status: newStatus })
        .in('id', ids)
        .eq('business_id', session.businessId);

    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 });

    // If marking as no_show, increment customer noshow_count
    if (newStatus === 'no_show') {
        try {
            const { data: appts } = await (supabase.from('appointments') as any)
                .select('customer_phone')
                .in('id', ids)
                .eq('business_id', session.businessId);

            const phones = [...new Set((appts || []).map((a: any) => a.customer_phone))];
            for (const phone of phones) {
                await (supabase.from('customers') as any)
                    .update({ noshow_count: (supabase as any).sql`noshow_count + 1` })
                    .eq('business_id', session.businessId)
                    .eq('phone', phone);
            }
        } catch { /* non-fatal */ }
    }

    return NextResponse.json({ success: true, updated: ids.length });
}
