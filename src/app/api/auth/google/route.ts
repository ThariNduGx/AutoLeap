import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { getSession, hasRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/google
 * Initiate Google Calendar OAuth flow. Business ID is taken from the session
 * (not from a query parameter) to prevent connecting another business's calendar.
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
        state: businessId,
        prompt: 'consent', // Force refresh token on every connect
    });

    return NextResponse.redirect(authUrl);
}
