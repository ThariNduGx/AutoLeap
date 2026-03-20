import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import { getSession, hasRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * Tier shape: { name: string, price: number, currency?: string, duration_minutes?: number }
 */
interface Tier {
  name: string;
  price: number;
  currency?: string;
  duration_minutes?: number;
}

function validateTiers(raw: unknown): Tier[] | null {
  if (!Array.isArray(raw)) return null;
  for (const t of raw) {
    if (typeof t !== 'object' || !t) return null;
    if (typeof (t as any).name !== 'string' || !(t as any).name.trim()) return null;
    if (typeof (t as any).price !== 'number' || (t as any).price < 0) return null;
    if ((t as any).duration_minutes !== undefined) {
      const d = (t as any).duration_minutes;
      if (typeof d !== 'number' || d < 5 || d > 480) return null;
    }
  }
  return raw as Tier[];
}

/**
 * GET /api/services
 * List all services for the authenticated business.
 *
 * POST /api/services
 * Create a new service.
 * Body: { name, description?, duration_minutes, price?, currency?, tiers? }
 *
 * PATCH /api/services?id=UUID
 * Update a service (any combination of its fields + tiers).
 *
 * DELETE /api/services?id=UUID
 * Delete a service.
 */

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !hasRole(session, 'business')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await (supabase
    .from('services') as any)
    .select('id, name, description, duration_minutes, buffer_minutes, min_advance_hours, price, currency, tiers, is_active, sort_order, created_at')
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

  // Validate tiers if provided
  let tiers: Tier[] = [];
  if (body.tiers !== undefined) {
    const validated = validateTiers(body.tiers);
    if (validated === null) {
      return NextResponse.json(
        { error: 'Invalid tiers format. Each tier needs: name (string), price (number ≥ 0), optional duration_minutes (5–480).' },
        { status: 400 }
      );
    }
    tiers = validated;
  }

  const price = body.price != null && body.price !== '' ? parseFloat(body.price) : null;

  const supabase = getSupabaseClient();
  const bufferMinutes = Math.max(0, parseInt(body.buffer_minutes) || 0);
  const minAdvanceHours = Math.max(0, parseInt(body.min_advance_hours) || 0);

  const { data, error } = await (supabase
    .from('services') as any)
    .insert({
      business_id: session.businessId,
      name,
      description: (body.description || '').trim() || null,
      duration_minutes: duration,
      buffer_minutes: bufferMinutes,
      min_advance_hours: minAdvanceHours,
      price: price != null && !isNaN(price) ? price : null,
      currency: (body.currency || 'LKR').toUpperCase(),
      tiers,
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
  const scalar = ['name', 'description', 'duration_minutes', 'buffer_minutes', 'min_advance_hours', 'price', 'currency', 'is_active', 'sort_order'] as const;
  const updates: Record<string, unknown> = {};
  for (const key of scalar) {
    if (key in body) updates[key] = body[key];
  }

  // Handle tiers separately (needs validation)
  if ('tiers' in body) {
    const validated = validateTiers(body.tiers);
    if (validated === null) {
      return NextResponse.json(
        { error: 'Invalid tiers format. Each tier needs: name (string), price (number ≥ 0), optional duration_minutes (5–480).' },
        { status: 400 }
      );
    }
    updates.tiers = validated;
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
