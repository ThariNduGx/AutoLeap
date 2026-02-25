import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';

export const runtime = 'edge';

/**
 * POST /api/facebook/debug
 *
 * Diagnostic endpoint - given a user access token, returns raw Facebook API
 * responses so we can see exactly what permissions are granted and what pages exist.
 *
 * REMOVE THIS ROUTE IN PRODUCTION
 */
export async function POST(req: NextRequest) {
    const session = await getSession(req);
    if (!session || !hasRole(session, 'business')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { user_access_token } = await req.json();
    if (!user_access_token) {
        return NextResponse.json({ error: 'Missing user_access_token' }, { status: 400 });
    }

    const version = 'v24.0';
    const base = `https://graph.facebook.com/${version}`;

    // 1. Get user's own profile
    const meRes = await fetch(`${base}/me?fields=id,name&access_token=${user_access_token}`);
    const meData = await meRes.json();

    // 2. Get granted permissions on this token
    const permRes = await fetch(`${base}/me/permissions?access_token=${user_access_token}`);
    const permData = await permRes.json();

    // 3. Get pages (the main call that fails)
    const pagesRes = await fetch(`${base}/me/accounts?fields=id,name,access_token,category,tasks&access_token=${user_access_token}`);
    const pagesData = await pagesRes.json();

    // 4. Show what the token looks like (type, app it belongs to)
    const tokenRes = await fetch(`${base}/debug_token?input_token=${user_access_token}&access_token=${user_access_token}`);
    const tokenData = await tokenRes.json();

    return NextResponse.json({
        graphApiVersion: version,
        me: meData,
        permissions: permData,
        pages: pagesData,
        tokenDebug: tokenData,
    });
}
