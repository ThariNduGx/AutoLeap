import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import { getSession, hasRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const VALID_CURRENCIES = ['LKR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'INR', 'AUD'] as const;

const TierSchema = z.object({
  name: z.string().min(1, 'Tier name is required').max(80),
  price: z.number({ error: 'Tier price must be a number' }).min(0).max(1_000_000),
  currency: z.string().optional(),
  duration_minutes: z.number().int().min(5).max(480).optional(),
});

const ServiceCreateSchema = z.object({
  name: z.string().min(1, 'Service name is required').max(100),
  description: z.string().max(300).optional(),
  duration_minutes: z.coerce.number({ error: 'duration_minutes must be a number' }).int().min(5, 'duration_minutes must be at least 5').max(480, 'duration_minutes must be at most 480'),
  buffer_minutes: z.coerce.number().int().min(0).max(120).optional().default(0),
  min_advance_hours: z.coerce.number().int().min(0).max(168).optional().default(0),
  price: z.number().min(0).max(1_000_000).nullable().optional(),
  currency: z.enum(VALID_CURRENCIES, { error: `currency must be one of: ${VALID_CURRENCIES.join(', ')}` }).optional().default('LKR'),
  tiers: z.array(TierSchema).optional().default([]),
});

// For PATCH every field is optional — only the supplied fields are updated
const ServicePatchSchema = ServiceCreateSchema.partial();

// ─── Route handlers ───────────────────────────────────────────────────────────

/**
 * GET /api/services
 * List all services for the authenticated business.
 *
 * POST /api/services
 * Create a new service.
 * Body: { name, description?, duration_minutes, price?, currency?, tiers?,
 *         buffer_minutes?, min_advance_hours? }
 *
 * PATCH /api/services?id=UUID
 * Update a service (any subset of its fields + tiers).
 *
 * DELETE /api/services?id=UUID
 * Soft-delete if appointments exist; hard-delete otherwise.
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
  const parsed = ServiceCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { name, description, duration_minutes, buffer_minutes, min_advance_hours, price, currency, tiers } = parsed.data;

  const supabase = getSupabaseClient();
  const { data, error } = await (supabase
    .from('services') as any)
    .insert({
      business_id: session.businessId,
      name: name.trim(),
      description: description?.trim() || null,
      duration_minutes,
      buffer_minutes,
      min_advance_hours,
      price: price ?? null,
      currency,
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
  const parsed = ServicePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const updates = parsed.data as Record<string, unknown>;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  // Trim name if present
  if (typeof updates.name === 'string') updates.name = (updates.name as string).trim();
  if (typeof updates.description === 'string') updates.description = (updates.description as string).trim() || null;

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

  // Fetch the service first to get its name (used to match service_type in appointments)
  const { data: svc } = await (supabase
    .from('services') as any)
    .select('name')
    .eq('id', id)
    .eq('business_id', session.businessId)
    .maybeSingle();

  if (!svc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Guard: count appointments referencing this service by name (no FK — service_type is text)
  const { count } = await (supabase
    .from('appointments') as any)
    .select('id', { count: 'exact', head: true })
    .eq('business_id', session.businessId)
    .eq('service_type', svc.name);

  if (count && count > 0) {
    // Soft-delete: deactivate so the service is hidden but historical data stays intact
    const { error: updateErr } = await (supabase
      .from('services') as any)
      .update({ is_active: false })
      .eq('id', id)
      .eq('business_id', session.businessId);

    if (updateErr) return NextResponse.json({ error: 'Failed to deactivate service' }, { status: 500 });
    return NextResponse.json({ softDeleted: true, appointmentCount: count });
  }

  // No linked appointments — safe to hard-delete
  const { error } = await (supabase
    .from('services') as any)
    .delete()
    .eq('id', id)
    .eq('business_id', session.businessId);

  if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  return NextResponse.json({ success: true });
}
