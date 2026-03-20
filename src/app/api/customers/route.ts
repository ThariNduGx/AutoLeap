import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import { getSession, hasRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/** GET /api/customers — list customers for the business, with booking counts */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !hasRole(session, 'business')) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('q') || '';
  const customerId = searchParams.get('id');

  const supabase = getSupabaseClient();

  // Single customer with full appointment history
  if (customerId) {
    const { data: customer } = await (supabase.from('customers') as any)
      .select('*')
      .eq('id', customerId)
      .eq('business_id', session.businessId)
      .single();
    if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Filter appointments by phone in the DB query (not in-memory) so we don't
    // miss records when the total appointment count exceeds the page limit.
    const { data: appointments } = await (supabase.from('appointments') as any)
      .select('id, service_type, appointment_date, appointment_time, status, price, currency, notes, customer_phone')
      .eq('business_id', session.businessId)
      .eq('customer_phone', customer.phone)
      .order('appointment_date', { ascending: false })
      .limit(100);

    return NextResponse.json({ ...customer, appointments: appointments || [] });
  }

  // List all customers
  let query = (supabase.from('customers') as any)
    .select('id, phone, name, platform, total_bookings, noshow_count, created_at, updated_at')
    .eq('business_id', session.businessId)
    .order('updated_at', { ascending: false })
    .limit(200);

  if (search) {
    query = query.or(`phone.ilike.%${search}%,name.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });
  return NextResponse.json(data || []);
}

/** PATCH /api/customers?id=UUID — update customer notes */
export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !hasRole(session, 'business')) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const body = await req.json();
  const supabase = getSupabaseClient();
  const { data, error } = await (supabase.from('customers') as any)
    .update({ notes: body.notes ?? null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('business_id', session.businessId)
    .select()
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data);
}
