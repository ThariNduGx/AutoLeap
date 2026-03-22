import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import { getSession, hasRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * POST /api/reviews is called by the bot webhook — not by a logged-in owner.
 * Requires either appointment_id or customer_chat_id so we can associate the
 * review with a real customer interaction.
 */
const ReviewPostSchema = z.object({
  business_id: z.string().uuid('business_id must be a valid UUID'),
  appointment_id: z.string().uuid('appointment_id must be a valid UUID').optional(),
  customer_chat_id: z.string().max(200).optional(),
  platform: z.enum(['telegram', 'messenger', 'whatsapp', 'web']).optional(),
  rating: z.number({ invalid_type_error: 'rating must be a number' }).int().min(1, 'rating must be at least 1').max(5, 'rating must be at most 5'),
  comment: z.string().max(2000, 'comment must be 2000 characters or fewer').optional(),
}).refine(
  d => d.appointment_id || d.customer_chat_id,
  { message: 'Either appointment_id or customer_chat_id is required' },
);

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
 *
 * Security: if appointment_id is supplied, we verify it belongs to the stated business_id
 * to prevent submitting spoofed reviews for arbitrary businesses.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = ReviewPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { business_id, appointment_id, customer_chat_id, platform, rating, comment } = parsed.data;

  const supabase = getSupabaseClient();

  // If an appointment_id is provided, verify it actually belongs to this business
  if (appointment_id) {
    const { data: appt, error: apptErr } = await (supabase.from('appointments') as any)
      .select('id')
      .eq('id', appointment_id)
      .eq('business_id', business_id)
      .maybeSingle();

    if (apptErr || !appt) {
      return NextResponse.json({ error: 'Invalid appointment or business' }, { status: 400 });
    }
  }

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
