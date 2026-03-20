import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSession, hasRole } from '@/lib/auth/session';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/change-password
 *
 * Allows an authenticated business user to change their own password.
 * Requires the current password for verification.
 */
export async function POST(req: NextRequest) {
    try {
        const session = await getSession(req);

        if (!session || !hasRole(session, 'business')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const body = await req.json();
        const { current_password, new_password } = body;

        if (!current_password || !new_password) {
            return NextResponse.json({ error: 'current_password and new_password are required' }, { status: 400 });
        }

        if (typeof new_password !== 'string' || new_password.length < 8) {
            return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
        }

        const supabase = getSupabaseClient();

        // Fetch stored password hash
        const { data: user, error } = await (supabase
            .from('users') as any)
            .select('id, password_hash')
            .eq('id', session.id)
            .single();

        if (error || !user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Verify current password
        const valid = await bcrypt.compare(current_password, user.password_hash);
        if (!valid) {
            return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
        }

        // Hash and save new password
        const newHash = await bcrypt.hash(new_password, 10);
        const { error: updateError } = await (supabase
            .from('users') as any)
            .update({ password_hash: newHash })
            .eq('id', user.id);

        if (updateError) {
            return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
