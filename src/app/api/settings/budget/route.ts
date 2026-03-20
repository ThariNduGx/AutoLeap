import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import { getSession, hasRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/settings/budget
 * Returns current budget row (monthly_budget_usd, current_usage_usd, pending_usage_usd).
 *
 * PATCH /api/settings/budget
 * Update monthly_budget_usd. Body: { monthly_budget_usd: number }
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !hasRole(session, 'business')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const businessId = session.businessId;
  if (!businessId) return NextResponse.json({ error: 'No business' }, { status: 400 });

  const supabase = getSupabaseClient();
  const { data } = await (supabase
    .from('budgets') as any)
    .select('monthly_budget_usd, current_usage_usd, pending_usage_usd')
    .eq('business_id', businessId)
    .single();

  return NextResponse.json(
    data ?? { monthly_budget_usd: 10, current_usage_usd: 0, pending_usage_usd: 0 }
  );
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !hasRole(session, 'business')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const businessId = session.businessId;
  if (!businessId) return NextResponse.json({ error: 'No business' }, { status: 400 });

  const body = await req.json();
  const limit = parseFloat(body.monthly_budget_usd);

  if (isNaN(limit) || limit < 0 || limit > 10_000) {
    return NextResponse.json(
      { error: 'monthly_budget_usd must be between 0 and 10000' },
      { status: 400 }
    );
  }

  const supabase = getSupabaseClient();

  // Upsert — create row if it doesn't exist yet
  const { error } = await (supabase
    .from('budgets') as any)
    .upsert(
      { business_id: businessId, monthly_budget_usd: limit },
      { onConflict: 'business_id' }
    );

  if (error) {
    return NextResponse.json({ error: 'Failed to update budget' }, { status: 500 });
  }

  return NextResponse.json({ success: true, monthly_budget_usd: limit });
}
