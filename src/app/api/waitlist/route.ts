import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import { getSession, hasRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/waitlist
 * List waitlist entries for the authenticated business (un-notified first).
 *
 * DELETE /api/waitlist?id=UUID
 * Remove a waitlist entry.
 */

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !hasRole(session, 'business')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await (supabase
    .from('waitlist') as any)
    .select('id, customer_chat_id, platform, customer_name, service_type, preferred_date, notified_at, created_at')
    .eq('business_id', session.businessId)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function DELETE(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !hasRole(session, 'business')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const supabase = getSupabaseClient();
  const { error } = await (supabase
    .from('waitlist') as any)
    .delete()
    .eq('id', id)
    .eq('business_id', session.businessId);

  if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  return NextResponse.json({ success: true });
}
