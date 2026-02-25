import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';

/**
 * GET /api/auth/facebook
 *
 * Initiates the Facebook OAuth server-side flow.
 * Redirects the user to Facebook's authorization dialog.
 */
export async function GET(req: NextRequest) {
    const session = await getSession(req);

    if (!session || !hasRole(session, 'business')) {
        return NextResponse.redirect(new URL('/auth/login', req.url));
    }

    const businessId = session.businessId;
    if (!businessId) {
        const url = new URL('/dashboard/settings', req.url);
        url.searchParams.set('fb_error', 'no_business');
        return NextResponse.redirect(url);
    }

    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID!;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL!;
    const redirectUri = `${baseUrl}/api/auth/facebook/callback`;

    // Encode businessId + timestamp in state for CSRF protection
    const statePayload = JSON.stringify({ businessId, ts: Date.now() });
    const state = Buffer.from(statePayload).toString('base64url');

    const fbAuthUrl = new URL('https://www.facebook.com/v24.0/dialog/oauth');
    fbAuthUrl.searchParams.set('client_id', appId);
    fbAuthUrl.searchParams.set('redirect_uri', redirectUri);
    fbAuthUrl.searchParams.set('scope', 'pages_show_list,pages_messaging,pages_manage_metadata,business_management');
    fbAuthUrl.searchParams.set('response_type', 'code');
    fbAuthUrl.searchParams.set('state', state);

    console.log('[FB AUTH] Redirecting to Facebook OAuth for business:', businessId);
    return NextResponse.redirect(fbAuthUrl.toString());
}
