import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';

/**
 * PATCH /api/admin/businesses/[id]
 * Update business name and/or is_active status. Admin-only.
 * Body: { name?: string, is_active?: boolean }
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await getSession(request);

        if (!session || !hasRole(session, 'admin')) {
            return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const updates: Record<string, any> = {};

        if (typeof body.name === 'string' && body.name.trim()) {
            updates.name = body.name.trim();
        }
        if (typeof body.is_active === 'boolean') {
            updates.is_active = body.is_active;
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        const supabase = getSupabaseClient();

        const { data: business, error } = await (supabase
            .from('businesses') as any)
            .update(updates)
            .eq('id', id)
            .select('id, name, is_active')
            .single();

        if (error) {
            console.error('[ADMIN BIZ] Update error:', error);
            return NextResponse.json({ error: 'Failed to update business' }, { status: 500 });
        }

        return NextResponse.json({ success: true, business });

    } catch (error) {
        console.error('[ADMIN BIZ] PATCH exception:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/businesses/[id]
 * Permanently delete a business and all its data. Admin-only.
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await getSession(request);

        if (!session || !hasRole(session, 'admin')) {
            return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
        }

        const supabase = getSupabaseClient();

        // Delete related data first to avoid FK violations, then the business
        const tables = [
            'request_queue',
            'business_costs',
            'cost_logs',
            'booking_attempts',
            'conversations',
            'faq_documents',
            'faq_embeddings',
            'appointments',
            'customers',
            'services',
            'blackout_dates',
            'waitlist',
            'reviews',
            'budgets',
        ];
        for (const table of tables) {
            const { error } = await (supabase.from(table) as any)
                .delete()
                .eq('business_id', id);
            if (error) {
                // Non-fatal: table may not exist or have no rows
                console.warn(`[ADMIN BIZ] Delete from ${table}:`, error.message);
            }
        }

        // Delete the business itself (cascades to unlink users.business_id)
        const { error: bizError } = await (supabase
            .from('businesses') as any)
            .delete()
            .eq('id', id);

        if (bizError) {
            console.error('[ADMIN BIZ] Business delete error:', bizError);
            return NextResponse.json({ error: 'Failed to delete business' }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[ADMIN BIZ] DELETE exception:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
