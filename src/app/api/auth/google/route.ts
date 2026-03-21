import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { getSession, hasRole } from '@/lib/auth/session';
import { redis } from '@/lib/infrastructure/redis';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/google
 * Initiate Google Calendar OAuth flow. Business ID is taken from the session
 * (not from a query parameter) to prevent connecting another business's calendar.
 *
 * CSRF protection: a random nonce is stored in Redis (10-minute TTL) and used
 * as the OAuth `state` parameter. The callback validates the nonce before
 * trusting the associated businessId. This prevents an attacker from forging
 * a callback with an arbitrary state/businessId.
 */
export async function GET(req: NextRequest) {
    const session = await getSession(req);
    if (!session || !hasRole(session, 'business')) {
        return NextResponse.redirect(new URL('/login', req.url));
    }

    const businessId = session.businessId;
    if (!businessId) {
        return new NextResponse('No business associated with this account', { status: 400 });
    }

    // Generate a random nonce and store businessId under it for 10 minutes
    const nonce = randomUUID();
    await redis.set(`oauth:state:${nonce}`, businessId, { ex: 600 });

    const oauth2Client = new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/userinfo.email',
        ],
        state: nonce, // Opaque nonce — businessId is never exposed in the URL
        prompt: 'consent', // Force refresh token on every connect
    });

    return NextResponse.redirect(authUrl);
}
