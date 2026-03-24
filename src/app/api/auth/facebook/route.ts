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

    const appId = (process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || '').trim();
    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || '').trim();
    const configId = (process.env.FB_LOGIN_CONFIG_ID || '').trim();
    const redirectUri = `${baseUrl}/api/auth/facebook/callback`;

    // Encode businessId + timestamp in state for CSRF protection
    const statePayload = JSON.stringify({ businessId, ts: Date.now() });
    const state = Buffer.from(statePayload).toString('base64url');

    const fbAuthUrl = new URL('https://www.facebook.com/v24.0/dialog/oauth');
    fbAuthUrl.searchParams.set('client_id', appId);
    fbAuthUrl.searchParams.set('redirect_uri', redirectUri);
    fbAuthUrl.searchParams.set('response_type', 'code');
    fbAuthUrl.searchParams.set('state', state);

    // Facebook Login for Business uses config_id (set in Meta Developer Console)
    // instead of raw scope. Without config_id, Facebook may show "Feature unavailable".
    if (configId) {
        fbAuthUrl.searchParams.set('config_id', configId);
        console.log('[FB AUTH] Using Facebook Login for Business config_id:', configId);
    } else {
        fbAuthUrl.searchParams.set('scope', 'pages_show_list,pages_messaging,pages_manage_metadata,business_management');
        console.warn('[FB AUTH] No FB_LOGIN_CONFIG_ID set — using raw scope fallback');
    }

    console.log('[FB AUTH] Redirecting to Facebook OAuth for business:', businessId, '→', redirectUri);
    return NextResponse.redirect(fbAuthUrl.toString());
}
