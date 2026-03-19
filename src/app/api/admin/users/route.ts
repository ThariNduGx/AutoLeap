import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';

/**
 * GET /api/admin/users
 *
 * Returns all platform users with their linked business names.
 * Admin-only.
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getSession(request);

        if (!session || !hasRole(session, 'admin')) {
            return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
        }

        const supabase = getSupabaseClient();

        const { data: users, error } = await (supabase
            .from('users') as any)
            .select(`
                id,
                name,
                email,
                role,
                created_at,
                business_id,
                businesses:business_id (
                    name
                )
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[ADMIN USERS] Fetch error:', error);
            return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
        }

        const mapped = (users || []).map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            businessName: u.businesses?.name ?? null,
            createdAt: u.created_at,
        }));

        return NextResponse.json({ success: true, users: mapped });

    } catch (error) {
        console.error('[ADMIN USERS] Exception:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
