import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';

/**
 * GET /api/admin/users?page=1&limit=25&search=foo&role=business
 *
 * Returns paginated platform users with their linked business names.
 * Admin-only.
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getSession(request);

        if (!session || !hasRole(session, 'admin')) {
            return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')));
        const search = searchParams.get('search')?.trim() || '';
        const roleFilter = searchParams.get('role') || '';

        const offset = (page - 1) * limit;

        const supabase = getSupabaseClient();

        // Build query with optional search and role filter
        let query = (supabase
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
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (search) {
            query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
        }
        if (roleFilter === 'admin' || roleFilter === 'business') {
            query = query.eq('role', roleFilter);
        }

        const { data: users, error, count } = await query;

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

        const totalPages = Math.ceil((count ?? 0) / limit);

        return NextResponse.json({
            success: true,
            users: mapped,
            pagination: {
                page,
                limit,
                total: count ?? 0,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        });

    } catch (error) {
        console.error('[ADMIN USERS] Exception:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
