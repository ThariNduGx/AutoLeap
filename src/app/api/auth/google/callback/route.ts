import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import { redis } from '@/lib/infrastructure/redis';

export const dynamic = 'force-dynamic';

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // This is the CSRF nonce, not a raw businessId
    const error = searchParams.get('error');

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const calendarUrl = `${baseUrl}/dashboard/calendar`;
    const dashboardUrl = `${baseUrl}/dashboard`;

    if (error) {
        return NextResponse.redirect(`${calendarUrl}?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
        return NextResponse.redirect(`${calendarUrl}?error=missing_params`);
    }

    // CSRF check: resolve nonce → { businessId, from } and immediately delete the key (one-time use).
    // The stored value is JSON ({ businessId, from }) written by /api/auth/google.
    const stored = await redis.getdel(`oauth:state:${state}`);
    if (!stored || typeof stored !== 'string') {
        console.error('[OAUTH] Invalid or expired state nonce');
        return NextResponse.redirect(`${calendarUrl}?error=invalid_state`);
    }

    let businessId: string;
    let from: string | null = null;
    try {
        const parsed = JSON.parse(stored);
        businessId = parsed.businessId;
        from = parsed.from ?? null;
    } catch {
        // Legacy fallback: stored value is a plain businessId string (pre-migration sessions)
        businessId = stored;
    }

    if (!businessId) {
        console.error('[OAUTH] No businessId in stored state');
        return NextResponse.redirect(`${calendarUrl}?error=invalid_state`);
    }

    // Determine redirect targets based on originating context.
    // When coming from the onboarding wizard (?from=onboarding) the user's setup data
    // was already saved before they were sent to Google, so we send them straight to
    // the dashboard on both success and failure (calendar connection is optional).
    const successRedirect = from === 'onboarding' ? dashboardUrl : `${calendarUrl}?connected=true`;
    const failRedirect   = from === 'onboarding' ? dashboardUrl : `${calendarUrl}?error=oauth_failed`;

    try {
        // Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Fetch the user's email from Google
        let calendarEmail: string | null = null;
        try {
            const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
            const userInfo = await oauth2.userinfo.get();
            calendarEmail = userInfo.data.email || null;
        } catch {
            // Non-fatal — email display is optional
        }

        const supabase = getSupabaseClient();

        const { error: dbError } = await (supabase.from('businesses') as any)
            .update({
                google_calendar_token: JSON.stringify(tokens),
                google_calendar_email: calendarEmail,
            })
            .eq('id', businessId);

        if (dbError) {
            console.error('[OAUTH] Failed to store tokens:', dbError);
            return NextResponse.redirect(failRedirect);
        }

        console.log('[OAUTH] ✅ Calendar connected for business:', businessId, 'email:', calendarEmail);
        return NextResponse.redirect(successRedirect);
    } catch (err) {
        console.error('[OAUTH] Error during token exchange:', err);
        return NextResponse.redirect(failRedirect);
    }
}
