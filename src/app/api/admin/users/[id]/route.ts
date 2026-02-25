import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import * as bcrypt from 'bcryptjs';

/**
 * PATCH /api/admin/users/[id]
 *
 * Resets a user's password. Admin-only.
 * Body: { newPassword: string }
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

        const { newPassword } = await request.json();

        if (!newPassword || newPassword.length < 8) {
            return NextResponse.json(
                { error: 'Password must be at least 8 characters' },
                { status: 400 }
            );
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        const supabase = getSupabaseClient();

        const { error } = await (supabase
            .from('users') as any)
            .update({ password_hash: passwordHash })
            .eq('id', id);

        if (error) {
            console.error('[ADMIN USERS] Password reset error:', error);
            return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[ADMIN USERS] PATCH exception:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
