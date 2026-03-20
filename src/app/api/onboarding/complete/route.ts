import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/onboarding/complete
 * Save onboarding data and mark the business as onboarded.
 * Body: { name, phone, service_categories, business_hours }
 */
export async function POST(req: NextRequest) {
    const session = await getSession(req);
    if (!session || !hasRole(session, 'business')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const businessId = session.businessId;
    if (!businessId) {
        return NextResponse.json({ error: 'No business associated with this account' }, { status: 400 });
    }

    let body: {
        name?: string;
        phone?: string;
        service_categories?: string[];
        business_hours?: Record<string, unknown>;
    };

    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
        onboarding_complete: true,
    };

    if (body.name && typeof body.name === 'string') {
        updates.name = body.name.trim().slice(0, 120);
    }
    if (body.phone && typeof body.phone === 'string') {
        updates.phone = body.phone.trim().slice(0, 30);
    }
    if (Array.isArray(body.service_categories)) {
        // Allowlist categories to prevent junk data
        const allowed = ['Plumbing', 'Electrical', 'Cleaning', 'Salon', 'Catering', 'Other'];
        updates.service_categories = body.service_categories.filter(c => allowed.includes(c));
    }
    if (body.business_hours && typeof body.business_hours === 'object') {
        updates.business_hours = body.business_hours;
    }

    const supabase = getSupabaseClient();
    const { error } = await (supabase.from('businesses') as any)
        .update(updates)
        .eq('id', businessId);

    if (error) {
        console.error('[ONBOARDING] Failed to save:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
