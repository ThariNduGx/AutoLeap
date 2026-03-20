import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import { getSession, hasRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/services
 * List all services for the authenticated business (active + inactive).
 *
 * POST /api/services
 * Create a new service. Body: { name, description?, duration_minutes, price? }
 *
 * DELETE /api/services?id=UUID
 * Delete a service by ID.
 *
 * PATCH /api/services?id=UUID
 * Update a service (name, description, duration_minutes, price, is_active, sort_order).
 */

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !hasRole(session, 'business')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await (supabase
    .from('services') as any)
    .select('id, name, description, duration_minutes, price, is_active, sort_order, created_at')
    .eq('business_id', session.businessId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !hasRole(session, 'business')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await req.json();
  const name = (body.name || '').trim();
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const duration = parseInt(body.duration_minutes) || 60;
  if (duration < 5 || duration > 480) {
    return NextResponse.json({ error: 'duration_minutes must be between 5 and 480' }, { status: 400 });
  }

  const price = body.price != null ? parseFloat(body.price) : null;

  const supabase = getSupabaseClient();
  const { data, error } = await (supabase
    .from('services') as any)
    .insert({
      business_id: session.businessId,
      name,
      description: (body.description || '').trim() || null,
      duration_minutes: duration,
      price: price && !isNaN(price) ? price : null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Failed to create service' }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !hasRole(session, 'business')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const body = await req.json();
  const allowed = ['name', 'description', 'duration_minutes', 'price', 'is_active', 'sort_order'] as const;
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await (supabase
    .from('services') as any)
    .update(updates)
    .eq('id', id)
    .eq('business_id', session.businessId)
    .select()
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data);
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
    .from('services') as any)
    .delete()
    .eq('id', id)
    .eq('business_id', session.businessId);

  if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  return NextResponse.json({ success: true });
}
