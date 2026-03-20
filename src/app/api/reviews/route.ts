import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import { getSession, hasRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/** GET /api/reviews — list reviews for the authenticated business */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !hasRole(session, 'business')) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const supabase = getSupabaseClient();
  const { data, error } = await (supabase.from('reviews') as any)
    .select(`
      id, rating, comment, platform, customer_chat_id, created_at,
      appointments(customer_name, service_type, appointment_date)
    `)
    .eq('business_id', session.businessId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });
  return NextResponse.json(data || []);
}

/**
 * POST /api/reviews — submit a review (called by bot webhook handler).
 * Does NOT require business auth — it's called on behalf of a customer.
 * Requires: appointment_id OR (business_id + customer_chat_id), rating (1-5), optional comment.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { business_id, appointment_id, customer_chat_id, platform, rating, comment } = body;

  if (!business_id || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'business_id and rating (1-5) are required' }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await (supabase.from('reviews') as any)
    .insert({
      business_id,
      appointment_id:   appointment_id || null,
      customer_chat_id: customer_chat_id || null,
      platform:         platform || null,
      rating,
      comment:          comment?.trim() || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Failed to save review' }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
