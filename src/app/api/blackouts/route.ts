import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import { getSession, hasRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !hasRole(session, 'business')) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const supabase = getSupabaseClient();
  const { data, error } = await (supabase.from('business_blackouts') as any)
    .select('id, date, label, repeat_annually, created_at')
    .eq('business_id', session.businessId)
    .order('date', { ascending: true });

  if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !hasRole(session, 'business')) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await req.json();
  const date = (body.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Invalid date format (YYYY-MM-DD required)' }, { status: 400 });

  const supabase = getSupabaseClient();
  const { data, error } = await (supabase.from('business_blackouts') as any)
    .upsert({
      business_id:     session.businessId,
      date,
      label:           (body.label || 'Closed').trim(),
      repeat_annually: !!body.repeat_annually,
    }, { onConflict: 'business_id,date' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Failed to save blackout date' }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !hasRole(session, 'business')) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const supabase = getSupabaseClient();
  const { error } = await (supabase.from('business_blackouts') as any)
    .delete()
    .eq('id', id)
    .eq('business_id', session.businessId);

  if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  return NextResponse.json({ success: true });
}
